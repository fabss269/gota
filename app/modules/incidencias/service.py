import asyncio
import uuid
from datetime import UTC, date, datetime, timedelta

from app.core.config import settings
from app.core.exceptions import NoEncontradoError, TransicionInvalidaError
from app.db.models_propia import Incidente, Usuario
from app.modules.catalogos.sig_repository import SigCatalogoRepository
from app.modules.grafo.service import GrafoService
from app.modules.incidencias.cache_repository import IncidenciaCacheRepository
from app.modules.incidencias.catastro_enrichment import CatastroEnrichmentService
from app.modules.incidencias.propia_repository import (
    PRIORIDAD_DEFAULT_UMBRAL,
    UMBRALES_DIAS_PRIORIDAD,
    PropiaIncidenciaRepository,
)
from app.modules.incidencias.schemas import (
    AvanceRequest,
    CatastroOut,
    EstadoPatchRequest,
    FocoOut,
    IncidenciaDetalleOut,
    IncidenciaListResponse,
    IncidenciaOut,
    PredioOut,
    PredioReclamoOut,
    ReclamoResumenOut,
    ResponsablePatchRequest,
    TecnicoAsignadoOut,
    TransicionOut,
    TrazabilidadPasoOut,
)
from app.modules.incidencias.transiciones import MOTIVO_ESTADO, TRANSICIONES, transicion_permitida
from app.shared.deps import IncidenciaFilterParams


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _calcular_prioridad(
    creado_en: datetime, fecha_solucion: datetime | None, categoria: str
) -> str:
    """Version Python de `_prioridad_codigo_expr` (propia_repository). Debe
    devolver EXACTAMENTE el mismo resultado que la expresión SQL. Se usa cuando
    tenemos un `Incidente` ya cargado (detalle, respuesta a un PATCH, etc.) y
    queremos evitar un round-trip extra al SQL solo para computar la prioridad.
    """
    if fecha_solucion is not None:
        return 'a_tiempo'
    dias_alerta, dias_critica = UMBRALES_DIAS_PRIORIDAD.get(
        categoria, PRIORIDAD_DEFAULT_UMBRAL
    )
    edad = _now() - creado_en
    if edad >= timedelta(days=dias_critica):
        return 'critica'
    if edad >= timedelta(days=dias_alerta):
        return 'alerta'
    return 'a_tiempo'


class IncidenciaService:
    def __init__(
        self,
        propia_repo: PropiaIncidenciaRepository,
        cache_repo: IncidenciaCacheRepository,
        catastro_svc: CatastroEnrichmentService,
        sig_catalogo_repo: SigCatalogoRepository,
        grafo_svc: GrafoService,
    ) -> None:
        self._propia = propia_repo
        self._cache = cache_repo
        self._catastro = catastro_svc
        self._sig_catalogo = sig_catalogo_repo
        self._grafo = grafo_svc
        self._mapas_cargados = False
        self._mapa_estados: dict[int, str] = {}
        self._mapa_estados_inv: dict[str, int] = {}
        self._mapa_prioridades: dict[int, str] = {}
        self._mapa_prioridades_inv: dict[str, int] = {}

    async def _precargar_mapas(self) -> None:
        if self._mapas_cargados:
            return
        self._mapa_estados = await self._propia.mapa_estados()
        self._mapa_estados_inv = {v: k for k, v in self._mapa_estados.items()}
        self._mapa_prioridades = await self._propia.mapa_prioridades()
        self._mapa_prioridades_inv = {v: k for k, v in self._mapa_prioridades.items()}
        self._mapas_cargados = True

    async def _resolver_resumen(self, incidente: Incidente, categoria: str) -> tuple[str, str | None, str | None]:
        """Lee `estado`/`sector` de la caché Redis (spec 00 §7); en *cache miss*
        recalcula contra la fuente real y repuebla la entrada. La prioridad se
        computa siempre en Python con `_calcular_prioridad` (cambia con el
        reloj, no cachearla). Ya no se persiste `prioridad_id` en Redis."""
        await self._precargar_mapas()
        resumen = await self._cache.get_resumen(str(incidente.incidente_id))

        estado_codigo = (
            self._mapa_estados.get(int(resumen.estado_actual_id))
            if resumen and resumen.estado_actual_id
            else None
        )
        sector_nombre = resumen.sector_nombre if resumen else None
        sector_resuelto = bool(resumen and resumen.sector_resuelto)

        set_kwargs: dict[str, str | bool] = {}
        if estado_codigo is None:
            estado_row = await self._propia.get_estado_actual(incidente.incidente_id)
            estado_codigo = estado_row.codigo if estado_row else "CREADO"
            estado_id = estado_row.estado_id if estado_row else self._mapa_estados_inv.get("CREADO")
            if estado_id is not None:
                set_kwargs["estado_actual_id"] = str(estado_id)

        if not sector_resuelto:
            predio = await self._catastro.resolver_predio(incidente.suministro_codigo, categoria)
            if predio is not None:
                sector_nombre = predio.sector_nombre
                set_kwargs["sector_id"] = str(predio.sector_id)
                set_kwargs["sector_nombre"] = predio.sector_nombre
                set_kwargs["distrito_id"] = str(predio.distrito_id)
            else:
                set_kwargs["sin_catastro"] = True

        if set_kwargs:
            await self._cache.set_resumen(str(incidente.incidente_id), **set_kwargs)

        prioridad_codigo = _calcular_prioridad(
            incidente.creado_en, incidente.fecha_solucion, categoria
        )
        return estado_codigo, prioridad_codigo, sector_nombre

    async def _resolver_resumenes_pagina(
        self, incidentes: list[Incidente]
    ) -> dict[uuid.UUID, tuple[str, str | None, str | None]]:
        """Igual que `_resolver_resumen`, pero para una página entera de una sola
        vez — bug real encontrado en vivo 2026-08-10: `listar()` llamaba
        `_resolver_resumen` una vez por fila (hasta 100), cada una con su propio
        round-trip a Redis (`get_resumen`) sin pipeline; listar 100 incidencias
        tardaba ~1.2s y NO mejoraba con caché caliente (100 round-trips secuenciales
        de todos modos). Acá: un solo `mget_resumenes` (pipeline) para toda la
        página, y los cache-miss se resuelven agrupados por sesión de BD — `gota`
        (estado + prioridad, mismo `self._propia`) y `sig` (sector, `self._catastro`)
        corren EN PARALELO entre sí (dos conexiones distintas), pero cada grupo es
        secuencial puertas adentro porque una `AsyncSession` de SQLAlchemy no
        soporta queries concurrentes sobre la misma sesión."""
        await self._precargar_mapas()
        ids = [str(i.incidente_id) for i in incidentes]
        resumenes = await self._cache.mget_resumenes(ids)

        estados: dict[uuid.UUID, str] = {}
        sectores: dict[uuid.UUID, str | None] = {}
        prioridades: dict[uuid.UUID, str | None] = {}
        pendientes_estado: list[Incidente] = []
        pendientes_sector: list[Incidente] = []
        pendientes_prioridad: list[Incidente] = []

        for incidente in incidentes:
            resumen = resumenes.get(str(incidente.incidente_id))
            if resumen and resumen.estado_actual_id:
                estados[incidente.incidente_id] = self._mapa_estados.get(int(resumen.estado_actual_id), "CREADO")
            else:
                pendientes_estado.append(incidente)

            if resumen and resumen.sector_resuelto:
                sectores[incidente.incidente_id] = resumen.sector_nombre
            else:
                pendientes_sector.append(incidente)

            if resumen and resumen.prioridad_id:
                prioridades[incidente.incidente_id] = self._mapa_prioridades.get(int(resumen.prioridad_id))
            else:
                pendientes_prioridad.append(incidente)

        set_kwargs_por_incidente: dict[str, dict[str, str | bool]] = {}

        async def _resolver_gota() -> None:
            for incidente in pendientes_estado:
                estado_row = await self._propia.get_estado_actual(incidente.incidente_id)
                estado_codigo = estado_row.codigo if estado_row else "CREADO"
                estado_id = estado_row.estado_id if estado_row else self._mapa_estados_inv.get("CREADO")
                estados[incidente.incidente_id] = estado_codigo
                if estado_id is not None:
                    set_kwargs_por_incidente.setdefault(str(incidente.incidente_id), {})["estado_actual_id"] = str(
                        estado_id
                    )
            for incidente in pendientes_prioridad:
                prioridad_id = await self._propia.get_prioridad_real(incidente.incidente_id)
                if prioridad_id is not None:
                    prioridades[incidente.incidente_id] = self._mapa_prioridades.get(prioridad_id)
                    set_kwargs_por_incidente.setdefault(str(incidente.incidente_id), {})["prioridad_id"] = str(
                        prioridad_id
                    )
                else:
                    prioridades[incidente.incidente_id] = None

        async def _resolver_sig() -> None:
            for incidente in pendientes_sector:
                categoria = incidente.tipo_atencion.tipo_grupo.codigo
                predio = await self._catastro.resolver_predio(incidente.suministro_codigo, categoria)
                kwargs = set_kwargs_por_incidente.setdefault(str(incidente.incidente_id), {})
                if predio is not None:
                    sectores[incidente.incidente_id] = predio.sector_nombre
                    kwargs["sector_id"] = str(predio.sector_id)
                    kwargs["sector_nombre"] = predio.sector_nombre
                    kwargs["distrito_id"] = str(predio.distrito_id)
                else:
                    sectores[incidente.incidente_id] = None
                    kwargs["sin_catastro"] = True

        await asyncio.gather(_resolver_gota(), _resolver_sig())
        await self._cache.set_resumenes(set_kwargs_por_incidente)

        return {
            incidente.incidente_id: (
                estados[incidente.incidente_id],
                prioridades.get(incidente.incidente_id),
                sectores.get(incidente.incidente_id),
            )
            for incidente in incidentes
        }

    def _a_incidencia_out(
        self, incidente: Incidente, categoria: str, estado: str, prioridad: str | None, sector: str | None
    ) -> IncidenciaOut:
        return IncidenciaOut(
            id=incidente.codigo,
            tipo=incidente.tipo_atencion.nombre,
            categoria=categoria,
            direccion=incidente.direccion,
            sector=sector,
            prioridad=prioridad,
            estado=estado,
            antiguedadDias=(_now() - incidente.creado_en).days,
            lat=incidente.latitud,
            lon=incidente.longitud,
            fechaCreacion=incidente.creado_en,
        )

    @staticmethod
    def _mapear_paso(evento) -> TrazabilidadPasoOut:
        asignado_a = None
        grupo = None
        if evento.usuario is not None:
            asignado_a = f"{evento.usuario.nombres} {evento.usuario.apellidos}"
            if evento.area is not None:
                asignado_a += f" · {evento.area.nombre}"
        elif evento.area is not None:
            grupo = evento.area.nombre
        return TrazabilidadPasoOut(
            estado=evento.estado_resultante.codigo,
            fecha=evento.fecha,
            grupo=grupo,
            asignadoA=asignado_a,
            nota=evento.nota,
        )

    @staticmethod
    def _parse_fecha(valor: str | None) -> date | None:
        if valor is None:
            return None
        if valor == "hoy":
            return datetime.now(UTC).date()
        return date.fromisoformat(valor)

    async def listar(self, filtros: IncidenciaFilterParams) -> IncidenciaListResponse:
        # `estado`/`sector`/`distrito` se filtran directo contra Postgres/`sig`, no
        # contra índices en Redis (decisión de Edgar 2026-08-10 — Redis es una
        # caché de lectura individual nada más, nunca una fuente de verdad para
        # filtrar). `prioridad` se calcula y filtra en SQL al vuelo
        # (_prioridad_codigo_expr en propia_repository) — no depende de cache
        # ni del módulo de alertas (incidente_alerta_regla, siempre vacía).
        estado_ids: list[int] | None = None
        if filtros.estado:
            estado_ids = await self._propia.resolver_estado_ids(filtros.csv(filtros.estado) or [])

        suministro_codigos: list[str] | None = None
        if filtros.sectorId or filtros.distritoId:
            sector_ids: set[str] = set()
            if filtros.sectorId:
                sector_ids.update(filtros.csv(filtros.sectorId) or [])
            if filtros.distritoId:
                sectores = await self._sig_catalogo.listar_sectores(filtros.distritoId)
                sector_ids.update(s["id"] for s in sectores)
            suministro_codigos = await self._catastro.listar_suministros_por_sector([int(s) for s in sector_ids])
            if not suministro_codigos:
                return IncidenciaListResponse(items=[], page=filtros.page, pageSize=filtros.pageSize, total=0)

        filas, total = await self._propia.listar(
            fecha=self._parse_fecha(filtros.fecha),
            fecha_desde=filtros.fechaDesde,
            fecha_hasta=filtros.fechaHasta,
            categorias=filtros.csv(filtros.categoria),
            tipo_atencion_codigo=filtros.tipoAtencionId,
            prioridad_codigos=filtros.csv(filtros.prioridad),
            q=filtros.q,
            bbox=filtros.bbox_tuple(),
            resuelto=filtros.resuelto,
            estado_ids=estado_ids,
            suministro_codigos=suministro_codigos,
            page=filtros.page,
            page_size=filtros.pageSize,
        )

        incidentes = [incidente for incidente, _ in filas]
        prioridad_por_id = {incidente.incidente_id: prioridad_sql for incidente, prioridad_sql in filas}
        # Estado/sector resueltos en bloque (evita N+1 — bug real 2026-08-10,
        # ver _resolver_resumenes_pagina). La prioridad de ahí se ignora: la de
        # arriba (SQL, misma query que ya trajo las filas) es más fresca y no
        # cuesta un round-trip extra.
        resumenes = await self._resolver_resumenes_pagina(incidentes)
        items = [
            self._a_incidencia_out(
                incidente,
                incidente.tipo_atencion.tipo_grupo.codigo,
                resumenes[incidente.incidente_id][0],
                prioridad_por_id[incidente.incidente_id],
                resumenes[incidente.incidente_id][2],
            )
            for incidente in incidentes
        ]

        return IncidenciaListResponse(items=items, page=filtros.page, pageSize=filtros.pageSize, total=total)

    async def _get_o_404(self, codigo: str) -> Incidente:
        incidente = await self._propia.get_by_codigo(codigo)
        if incidente is None:
            raise NoEncontradoError(f"Incidencia {codigo} no encontrada")
        return incidente

    async def detalle(self, codigo: str) -> IncidenciaDetalleOut:
        incidente = await self._get_o_404(codigo)
        categoria = incidente.tipo_atencion.tipo_grupo.codigo

        (estado, prioridad, _sector), (tecnico_evento, ultimo_reclamo) = await asyncio.gather(
            self._resolver_resumen(incidente, categoria),
            self._cargar_tecnico_y_reclamo(incidente.incidente_id),
        )

        predio_catastral = await self._catastro.resolver_predio(incidente.suministro_codigo, categoria)
        catastro_out = None
        if predio_catastral is not None:
            cercano = await self._catastro.resolver_catastro_cercano(
                predio_catastral.lat, predio_catastral.lon, categoria
            )
            catastro_out = CatastroOut(
                redAsociada=cercano.red_asociada,
                diametroMm=cercano.diametro_mm,
                material=cercano.material,
                buzonCercano=cercano.buzon_cercano,
                sector=predio_catastral.sector_nombre,
            )

        # Foco por causa raíz compartida (grafo hidráulico) — reemplaza el heurístico
        # geométrico anterior (proximidad + mismo tipo_atencion). Mismo shape de
        # respuesta (`FocoOut`), cambia solo el criterio de agrupación: mismo tramo/
        # tubería con reclamos activos, no cercanía superficial (ver
        # ~/Documentos/grafos_catastro_epsel.md §8.6.2).
        foco = None
        quejas_agrupadas = 0
        foco_activo = await self._grafo.foco_de_incidencia(incidente.suministro_codigo, categoria)
        if foco_activo is not None:
            relacionados = await self._grafo.incidentes_relacionados_por_infra(categoria, foco_activo.infraId)
            quejas_agrupadas = len(relacionados)
            elemento_txt = "tramo" if categoria == "desague" else "tubería"
            dias_txt = int(foco_activo.diasActivo) if foco_activo.diasActivo is not None else "varios"
            foco = FocoOut(
                descripcion=(
                    f"Causa raíz común: {foco_activo.nReclamos} reclamos comparten el mismo "
                    f"{elemento_txt} en los últimos {dias_txt} días."
                ),
                incidenciasRelacionadasIds=[
                    r["codigo"] for r in relacionados if r["codigo"] != incidente.codigo
                ][: settings.quejas_max_relacionadas],
            )

        historicos = await self._propia.get_predio_reclamos(incidente.incidente_id)
        limite_6m = _now() - timedelta(days=182)
        quejas_6m = sum(1 for reclamo, _inc in historicos if reclamo.fecha_registro >= limite_6m)

        return IncidenciaDetalleOut(
            id=incidente.codigo,
            tipo=incidente.tipo_atencion.nombre,
            categoria=categoria,
            direccion=incidente.direccion,
            codigoSuministro=incidente.suministro_codigo,
            prioridad=prioridad,
            estado=estado,
            antiguedadDias=(_now() - incidente.creado_en).days,
            lat=predio_catastral.lat if predio_catastral else None,
            lon=predio_catastral.lon if predio_catastral else None,
            tecnicoAsignado=(
                TecnicoAsignadoOut(
                    id=str(tecnico_evento.usuario_id),
                    nombre=f"{tecnico_evento.usuario.nombres} {tecnico_evento.usuario.apellidos}",
                )
                if tecnico_evento
                else None
            ),
            reclamo=(
                ReclamoResumenOut(
                    fechaRegistro=ultimo_reclamo.fecha_registro,
                    medioRecepcion=ultimo_reclamo.medio_recepcion.nombre,
                    descripcion=ultimo_reclamo.problema,
                    detalleTicket=ultimo_reclamo.detalle_del_ticket,
                    esRobo=bool(ultimo_reclamo.es_robo),
                )
                if ultimo_reclamo
                else None
            ),
            catastro=catastro_out,
            quejasAgrupadas=quejas_agrupadas,
            predio=PredioOut(noReincidente=quejas_6m == 0, quejasUltimos6Meses=quejas_6m),
            foco=foco,
        )

    async def _cargar_tecnico_y_reclamo(self, incidente_id: uuid.UUID):
        return await asyncio.gather(
            self._propia.get_tecnico_asignado(incidente_id),
            self._propia.get_ultimo_reclamo(incidente_id),
        )

    async def trazabilidad(self, codigo: str) -> list[TrazabilidadPasoOut]:
        incidente = await self._get_o_404(codigo)
        eventos = await self._propia.get_trazabilidad(incidente.incidente_id)
        return [self._mapear_paso(evento) for evento in eventos]

    async def predio(self, codigo: str) -> list[PredioReclamoOut]:
        incidente = await self._get_o_404(codigo)
        historicos = await self._propia.get_predio_reclamos(incidente.incidente_id)
        return [
            PredioReclamoOut(id=inc.codigo, tipo=inc.tipo_atencion.nombre, fecha=reclamo.fecha_registro)
            for reclamo, inc in historicos
        ]

    async def transiciones_validas(self, codigo: str) -> list[TransicionOut]:
        incidente = await self._get_o_404(codigo)
        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        estado, _prioridad, _sector = await self._resolver_resumen(incidente, categoria)
        return [TransicionOut(hacia=t.hacia, requiereFormulario=t.requiere_formulario) for t in TRANSICIONES.get(estado, [])]

    async def registrar_avance(self, codigo: str, body: AvanceRequest, usuario_actual: Usuario) -> TrazabilidadPasoOut:
        incidente = await self._get_o_404(codigo)
        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        estado_actual, _prioridad, _sector = await self._resolver_resumen(incidente, categoria)

        estado_destino = MOTIVO_ESTADO[body.motivo]
        if not transicion_permitida(estado_actual, estado_destino):
            raise TransicionInvalidaError(
                f"No se puede registrar '{body.motivo}' (implica {estado_destino}) desde {estado_actual}"
            )

        estado_destino_id = self._mapa_estados_inv[estado_destino]
        # spec 05: usuario_id solo cuando el motivo es autoasignación del técnico
        # logueado ("me hago cargo") — reasignar A OTRO técnico usa PATCH /responsable.
        usuario_id = usuario_actual.usuario_id if body.motivo == "REASIGNAR_TECNICO" else None

        evento = await self._propia.insertar_evento(
            incidente_id=incidente.incidente_id,
            estado_resultante_id=estado_destino_id,
            motivo=body.motivo,
            nota=body.nota,
            usuario_id=usuario_id,
            fecha=_now(),
        )
        await self._cache.set_resumen(str(incidente.incidente_id), estado_actual_id=str(estado_destino_id))
        return self._mapear_paso(evento)

    async def cambiar_estado(self, codigo: str, body: EstadoPatchRequest) -> IncidenciaOut:
        incidente = await self._get_o_404(codigo)
        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        estado_actual, prioridad, sector = await self._resolver_resumen(incidente, categoria)

        if not transicion_permitida(estado_actual, body.estado) or body.estado not in self._mapa_estados_inv:
            raise TransicionInvalidaError(f"No se puede pasar de {estado_actual} a {body.estado}")

        estado_id = self._mapa_estados_inv[body.estado]
        await self._propia.insertar_evento(
            incidente_id=incidente.incidente_id, estado_resultante_id=estado_id, fecha=_now()
        )
        await self._cache.set_resumen(str(incidente.incidente_id), estado_actual_id=str(estado_id))
        return self._a_incidencia_out(incidente, categoria, body.estado, prioridad, sector)

    async def reasignar_responsable(self, codigo: str, body: ResponsablePatchRequest) -> IncidenciaOut:
        incidente = await self._get_o_404(codigo)
        categoria = incidente.tipo_atencion.tipo_grupo.codigo
        estado_actual, prioridad, sector = await self._resolver_resumen(incidente, categoria)
        estado_actual_id = self._mapa_estados_inv[estado_actual]

        await self._propia.insertar_evento(
            incidente_id=incidente.incidente_id,
            estado_resultante_id=estado_actual_id,
            motivo="Reasignación manual",
            usuario_id=uuid.UUID(body.tecnicoId) if body.tecnicoId else None,
            area_id=body.areaId,
            fecha=_now(),
        )
        return self._a_incidencia_out(incidente, categoria, estado_actual, prioridad, sector)
