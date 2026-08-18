"""Grafo hidráulico: impacto de una incidencia, focos por causa raíz compartida, y
simulación interactiva de fallas. Diseño: ~/Documentos/grafos_catastro_epsel.md.
"""

from app.modules.grafo.repository import GrafoRepository
from app.modules.grafo.schemas import (
    AfectadoOut,
    ElementoRedOut,
    FocoActivoOut,
    ImpactoOut,
    SimulacionOut,
    TipoFalla,
    TipoRed,
)

# catalogo_tipo_atencion.codigo -> tipo_falla. Primera versión, basada en los códigos
# reales sembrados (25 tipos, ver sesión) y la clasificación §7.3 del documento —
# queda pendiente de validar con el operador EPSEL, no es definitiva. Tipos que no
# aparecen acá (OTROS/INSPECCION/LIMPIEZA/OBRAS/CALIDAD/ANALISIS/REPARACION) no
# mapean a ninguna simulación de red.
_MAPA_TIPO_FALLA: dict[str, TipoFalla] = {
    "atoro-colector": "atoro_tramo",
    "hist-atoro-en-colectores-y-o-desborde-alcantarill": "atoro_tramo",
    "hist-atoro-en-redes-primaria": "atoro_tramo",
    "hist-rotura-tuberia-redes-de-alcantarillado": "atoro_tramo",
    "hist-atoro-en-conexion-de-alcantarillado": "falla_conexion",
    "hist-colocacion-tapa-de-buzon": "tapa_faltante",
    "hist-colocacion-tapa-desague-en-conexion": "tapa_faltante",
    "fuga-agua": "fuga_tuberia",
    "hist-fuga-de-agua-en-conex-domiciliaria-fuga-acom": "fuga_tuberia",
    "hist-fugas-de-agua-en-red-de-agua-inc-repara-corp": "fuga_tuberia",
    "hist-rotura-tuberia-redes-de-agua": "fuga_tuberia",
    "hist-baja-presion": "fuga_tuberia",
    "hist-falta-de-agua": "fuga_tuberia",
}

_ID_KEY_POR_TIPO_RED: dict[TipoRed, str] = {"desague": "tramo_id", "agua": "tuberia_id"}

# Usados por simular_con_red() (POST /grafo/simulacion, click interactivo del mapa).
_ELEMENTO_TIPO_POR_FALLA: dict[TipoFalla, str] = {
    "atoro_tramo": "tramo",
    "colapso_buzon": "buzon",
    "falla_conexion": "cajadesague",
    "tapa_faltante": "buzon",
    "fuga_tuberia": "tuberia",
    "fuga_accesorio": "accesorio",
}

_RED_METODO_POR_FALLA: dict[TipoFalla, str] = {
    "atoro_tramo": "simular_atoro_tramo_red",
    "colapso_buzon": "simular_colapso_buzon_red",
    "falla_conexion": "simular_falla_conexion_red",
    "tapa_faltante": "simular_tapa_faltante_red",
    "fuga_tuberia": "simular_fuga_tuberia_red",
    "fuga_accesorio": "simular_fuga_accesorio_red",
}


class GrafoService:
    def __init__(self, repository: GrafoRepository) -> None:
        self._repo = repository

    async def impacto_incidencia(
        self, suministro_codigo: str, categoria: TipoRed, tipo_atencion_codigo: str
    ) -> ImpactoOut:
        tipo_falla = _MAPA_TIPO_FALLA.get(tipo_atencion_codigo)
        if tipo_falla is None:
            return ImpactoOut(tipoFalla=None, elementoTipo=None, elementoId=None, afectados=[])

        if categoria == "desague":
            elemento_tipo, elemento_id = await self._resolver_elemento_desague(tipo_falla, suministro_codigo)
        else:
            elemento_tipo = "tuberia"
            elemento_id = await self._repo.resolver_tuberia_agua(suministro_codigo)

        if elemento_id is None:
            return ImpactoOut(tipoFalla=tipo_falla, elementoTipo=elemento_tipo, elementoId=None, afectados=[])

        afectados = await self.simular(tipo_falla, elemento_id)
        return ImpactoOut(tipoFalla=tipo_falla, elementoTipo=elemento_tipo, elementoId=elemento_id, afectados=afectados)

    async def _resolver_elemento_desague(self, tipo_falla: TipoFalla, suministro_codigo: str) -> tuple[str, int | None]:
        if tipo_falla == "falla_conexion":
            return "cajadesague", await self._repo.resolver_cajadesague_id(suministro_codigo)
        tramo_id = await self._repo.resolver_tramo_desague(suministro_codigo)
        if tipo_falla == "tapa_faltante":
            if tramo_id is None:
                return "buzon", None
            # Heurística: el buzón de salida del tramo receptor del suministro — es el
            # buzón más cercano en la cadena hidráulica de este predio, no
            # necesariamente el que reportó el ticket (no hay ese dato en el join
            # suministro->red). Documentado como aproximación, no dato exacto.
            return "buzon", await self._repo.resolver_buzon_salida_tramo(tramo_id)
        return "tramo", tramo_id

    async def simular(self, tipo_falla: TipoFalla, elemento_id: int) -> list[AfectadoOut]:
        if tipo_falla == "atoro_tramo":
            filas = await self._repo.simular_atoro_tramo(elemento_id)
        elif tipo_falla == "colapso_buzon":
            filas = await self._repo.simular_colapso_buzon(elemento_id)
        elif tipo_falla == "falla_conexion":
            filas = await self._repo.simular_falla_conexion(elemento_id)
        elif tipo_falla == "tapa_faltante":
            filas = await self._repo.simular_tapa_faltante(elemento_id)
        elif tipo_falla == "fuga_tuberia":
            filas = await self._repo.simular_fuga_tuberia(elemento_id)
        else:
            filas = await self._repo.simular_fuga_accesorio(elemento_id)
        return [self._a_afectado(f) for f in filas if "suministro" in f]

    @staticmethod
    def _a_afectado(fila: dict) -> AfectadoOut:
        return AfectadoOut(
            suministro=fila["suministro"],
            cajaId=fila.get("cajadesagueid") or fila.get("cajaaguaid"),
            infraId=fila.get("tramo_receptor") or fila.get("tramo_afectado") or fila.get("tuberia_conexion"),
            nivel=fila["nivel"],
            horasEstimadas=fila.get("horas_estimadas"),
            prioridad=fila.get("prioridad"),
        )

    async def simular_con_red(self, tipo_falla: TipoFalla, elemento_id: int) -> SimulacionOut:
        """Usado por POST /grafo/simulacion (click interactivo en modo simulación
        del mapa): además de los suministros afectados, trae toda la sub-red
        recorrida (tramo/tubería/buzón/accesorio/caja) para que el frontend
        pueda pintar la red completa en modo vista, no solo los cajas terminales."""
        afectados = await self.simular(tipo_falla, elemento_id)
        metodo_red = getattr(self._repo, _RED_METODO_POR_FALLA[tipo_falla])
        filas_red = await metodo_red(elemento_id)
        red_afectada = [
            ElementoRedOut(elementoTipo=f["elemento_tipo"], elementoId=f["elemento_id"], nivel=f["nivel"])
            for f in filas_red
        ]
        return SimulacionOut(
            tipoFalla=tipo_falla,
            elementoTipo=_ELEMENTO_TIPO_POR_FALLA[tipo_falla],
            elementoId=elemento_id,
            afectados=afectados,
            redAfectada=red_afectada,
        )

    async def focos_activos(self, tipo_red: TipoRed, dias: int = 7, min_reclamos: int = 3) -> list[FocoActivoOut]:
        if tipo_red == "desague":
            filas = await self._repo.detectar_focos_activos_desague(dias, min_reclamos)
        else:
            filas = await self._repo.detectar_focos_activos_agua(dias, min_reclamos)
        id_key = _ID_KEY_POR_TIPO_RED[tipo_red]
        return [
            FocoActivoOut(
                infraId=f[id_key],
                tipoRed=tipo_red,
                nReclamos=f["n_reclamos"],
                nSuministros=f["n_suministros"],
                primerTicket=f["primer_ticket"],
                ultimoTicket=f["ultimo_ticket"],
                diasActivo=f.get("dias_activo"),
                tipoDominante=f.get("tipo_dominante"),
            )
            for f in filas
        ]

    async def foco_de_incidencia(self, suministro_codigo: str, categoria: TipoRed) -> FocoActivoOut | None:
        """Para el campo `foco` embebido en el detalle de incidencia (reemplaza el
        heurístico geométrico): resuelve el tramo/tubería de ESTE suministro y
        confirma si aparece en los focos activos actuales de su misma red."""
        if categoria == "desague":
            elemento_id = await self._repo.resolver_tramo_desague(suministro_codigo)
        else:
            elemento_id = await self._repo.resolver_tuberia_agua(suministro_codigo)
        if elemento_id is None:
            return None
        focos = await self.focos_activos(categoria)
        return next((f for f in focos if f.infraId == elemento_id), None)

    async def incidentes_relacionados_por_infra(self, tipo_red: TipoRed, infra_id: int, dias: int = 7) -> list[dict]:
        if tipo_red == "desague":
            return await self._repo.listar_incidentes_por_infra_desague(infra_id, dias)
        return await self._repo.listar_incidentes_por_infra_agua(infra_id, dias)
