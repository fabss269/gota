import math
import uuid
from datetime import date, datetime, timedelta

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_propia import (
    CatalogoEstado,
    CatalogoPrioridad,
    CatalogoTipoAtencion,
    CatalogoTipoGrupo,
    EstadoIncidenteEvento,
    Incidente,
    Reclamo,
)


class PropiaIncidenciaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _query_base(
        self,
        *,
        fecha: date | None,
        fecha_desde: date | None,
        fecha_hasta: date | None,
        categorias: list[str] | None,
        tipo_atencion_codigo: str | None,
        q: str | None,
        bbox: tuple[float, float, float, float] | None,
    ) -> Select:
        stmt = select(Incidente).join(Incidente.tipo_atencion)
        condiciones = []
        if fecha is not None:
            condiciones.append(func.date(Incidente.creado_en) == fecha)
        if fecha_desde is not None:
            condiciones.append(Incidente.creado_en >= fecha_desde)
        if fecha_hasta is not None:
            condiciones.append(Incidente.creado_en <= fecha_hasta)
        if categorias:
            stmt = stmt.join(CatalogoTipoAtencion.tipo_grupo)
            condiciones.append(CatalogoTipoGrupo.codigo.in_(categorias))
        if tipo_atencion_codigo is not None:
            condiciones.append(CatalogoTipoAtencion.codigo == tipo_atencion_codigo)
        if q:
            patron = f"%{q}%"
            condiciones.append(
                or_(Incidente.direccion.ilike(patron), CatalogoTipoAtencion.nombre.ilike(patron))
            )
        if bbox is not None:
            min_lon, min_lat, max_lon, max_lat = bbox
            condiciones.append(Incidente.latitud.between(min_lat, max_lat))
            condiciones.append(Incidente.longitud.between(min_lon, max_lon))
        if condiciones:
            stmt = stmt.where(and_(*condiciones))
        return stmt

    async def listar(
        self,
        *,
        fecha: date | None = None,
        fecha_desde: date | None = None,
        fecha_hasta: date | None = None,
        categorias: list[str] | None = None,
        tipo_atencion_codigo: str | None = None,
        q: str | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        candidatos: set[str] | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> tuple[list[Incidente], int]:
        stmt = self._query_base(
            fecha=fecha,
            fecha_desde=fecha_desde,
            fecha_hasta=fecha_hasta,
            categorias=categorias,
            tipo_atencion_codigo=tipo_atencion_codigo,
            q=q,
            bbox=bbox,
        )
        if candidatos is not None:
            ids = [uuid.UUID(c) for c in candidatos]
            stmt = stmt.where(Incidente.incidente_id.in_(ids))

        total = (
            await self._session.scalar(
                select(func.count()).select_from(stmt.with_only_columns(Incidente.incidente_id).subquery())
            )
        ) or 0

        stmt = stmt.order_by(Incidente.creado_en.desc()).limit(page_size).offset((page - 1) * page_size)
        filas = list(await self._session.scalars(stmt))
        return filas, total

    async def get_by_codigo(self, codigo: str) -> Incidente | None:
        stmt = select(Incidente).join(Incidente.tipo_atencion).where(Incidente.codigo == codigo)
        return await self._session.scalar(stmt)

    async def get_tecnico_asignado(self, incidente_id: uuid.UUID) -> EstadoIncidenteEvento | None:
        stmt = (
            select(EstadoIncidenteEvento)
            .where(
                EstadoIncidenteEvento.incidente_id == incidente_id,
                EstadoIncidenteEvento.usuario_id.is_not(None),
            )
            .order_by(EstadoIncidenteEvento.fecha.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def get_estado_actual(self, incidente_id: uuid.UUID) -> CatalogoEstado | None:
        stmt = (
            select(CatalogoEstado)
            .join(EstadoIncidenteEvento, EstadoIncidenteEvento.estado_resultante_id == CatalogoEstado.estado_id)
            .where(EstadoIncidenteEvento.incidente_id == incidente_id)
            .order_by(EstadoIncidenteEvento.fecha.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def get_ultimo_reclamo(self, incidente_id: uuid.UUID) -> Reclamo | None:
        stmt = (
            select(Reclamo)
            .join(Reclamo.medio_recepcion)
            .where(Reclamo.incidente_id == incidente_id)
            .order_by(Reclamo.fecha_registro.desc())
            .limit(1)
        )
        return await self._session.scalar(stmt)

    async def get_trazabilidad(self, incidente_id: uuid.UUID) -> list[EstadoIncidenteEvento]:
        stmt = (
            select(EstadoIncidenteEvento)
            .where(EstadoIncidenteEvento.incidente_id == incidente_id)
            .order_by(EstadoIncidenteEvento.fecha)
        )
        return list(await self._session.scalars(stmt))

    async def get_predio_reclamos(self, incidente_id: uuid.UUID) -> list[tuple[Reclamo, Incidente]]:
        """Reclamos históricos del mismo predio — mismo `dni` que el reclamo actual del
        incidente (specs/04, la única heurística disponible con el esquema real). Trae
        también el `Incidente` de cada reclamo histórico (para el `tipo` de
        `PredioReclamoOut`, que sale del `tipo_atencion` de ESE incidente, no del actual)."""
        actual = await self.get_ultimo_reclamo(incidente_id)
        if actual is None or actual.dni is None:
            return []
        stmt = (
            select(Reclamo, Incidente)
            .join(Incidente, Reclamo.incidente_id == Incidente.incidente_id)
            .join(Incidente.tipo_atencion)
            .where(Reclamo.dni == actual.dni, Reclamo.incidente_id != incidente_id)
            .order_by(Reclamo.fecha_registro.desc())
        )
        result = await self._session.execute(stmt)
        return [(row.Reclamo, row.Incidente) for row in result]

    async def get_incidencias_relacionadas(
        self, incidente: Incidente, *, radio_metros: float, ventana_dias: int
    ) -> list[Incidente]:
        """Mismo `tipo_atencion_id`, dentro de un radio (comparación de rango sobre
        `latitud`/`longitud` planos — no PostGIS, ver specs/04) y una ventana de tiempo.
        Heurística de negocio, no verdad derivada del esquema — parámetros configurables
        (`core/config.py`), confirmados con Edgar: 150m / 30 días."""
        if incidente.latitud is None or incidente.longitud is None:
            return []

        # 1 grado de latitud ≈ 111_320 m; longitud se ajusta por el coseno de la latitud.
        delta_lat = radio_metros / 111_320
        delta_lon = radio_metros / (111_320 * math.cos(math.radians(float(incidente.latitud))))
        fecha_desde = incidente.creado_en - timedelta(days=ventana_dias)

        stmt = select(Incidente).where(
            Incidente.incidente_id != incidente.incidente_id,
            Incidente.tipo_atencion_id == incidente.tipo_atencion_id,
            Incidente.creado_en >= fecha_desde,
            Incidente.latitud.between(
                float(incidente.latitud) - delta_lat, float(incidente.latitud) + delta_lat
            ),
            Incidente.longitud.between(
                float(incidente.longitud) - delta_lon, float(incidente.longitud) + delta_lon
            ),
        )
        return list(await self._session.scalars(stmt))

    async def count_reclamos_de_incidentes(self, incidente_ids: list[uuid.UUID]) -> int:
        if not incidente_ids:
            return 0
        return (
            await self._session.scalar(
                select(func.count()).select_from(Reclamo).where(Reclamo.incidente_id.in_(incidente_ids))
            )
        ) or 0

    async def insertar_evento(
        self,
        *,
        incidente_id: uuid.UUID,
        estado_resultante_id: int,
        motivo: str | None = None,
        nota: str | None = None,
        usuario_id: uuid.UUID | None = None,
        area_id: int | None = None,
        fecha: datetime,
    ) -> EstadoIncidenteEvento:
        evento = EstadoIncidenteEvento(
            incidente_id=incidente_id,
            estado_resultante_id=estado_resultante_id,
            motivo=motivo,
            nota=nota,
            usuario_id=usuario_id,
            area_id=area_id,
            fecha=fecha,
        )
        self._session.add(evento)
        await self._session.commit()
        await self._session.refresh(evento, attribute_names=["estado_resultante", "usuario", "area"])
        return evento

    async def mapa_estados(self) -> dict[int, str]:
        """`catalogo_estado` tiene 4 filas — traerlo entero por request es más simple
        que cachearlo, mismo criterio que `modules/catalogos` para catálogos chicos."""
        filas = await self._session.execute(select(CatalogoEstado.estado_id, CatalogoEstado.codigo))
        return dict(filas.all())

    async def mapa_prioridades(self) -> dict[int, str]:
        filas = await self._session.execute(select(CatalogoPrioridad.prioridad_id, CatalogoPrioridad.codigo))
        return dict(filas.all())

    async def resolver_estado_id(self, codigo: str) -> int | None:
        return await self._session.scalar(
            select(CatalogoEstado.estado_id).where(CatalogoEstado.codigo == codigo)
        )

    async def resolver_estado_ids(self, codigos: list[str]) -> list[int]:
        filas = await self._session.scalars(
            select(CatalogoEstado.estado_id).where(CatalogoEstado.codigo.in_(codigos))
        )
        return list(filas)

    async def resolver_prioridad_ids(self, codigos: list[str]) -> list[int]:
        filas = await self._session.scalars(
            select(CatalogoPrioridad.prioridad_id).where(CatalogoPrioridad.codigo.in_(codigos))
        )
        return list(filas)

    async def resumen_por_categoria(
        self, fecha_desde: date | None, fecha_hasta: date | None
    ) -> dict[str, int]:
        stmt = (
            select(CatalogoTipoGrupo.codigo, func.count())
            .select_from(Incidente)
            .join(Incidente.tipo_atencion)
            .join(CatalogoTipoAtencion.tipo_grupo)
            .group_by(CatalogoTipoGrupo.codigo)
        )
        if fecha_desde is not None:
            stmt = stmt.where(Incidente.creado_en >= fecha_desde)
        if fecha_hasta is not None:
            stmt = stmt.where(Incidente.creado_en <= fecha_hasta)
        filas = await self._session.execute(stmt)
        return dict(filas.all())

    async def top_tipos_atencion(
        self, fecha_desde: date | None, fecha_hasta: date | None, limite: int
    ) -> list[tuple[str, int]]:
        stmt = (
            select(CatalogoTipoAtencion.nombre, func.count())
            .select_from(Incidente)
            .join(Incidente.tipo_atencion)
            .group_by(CatalogoTipoAtencion.nombre)
            .order_by(func.count().desc())
            .limit(limite)
        )
        if fecha_desde is not None:
            stmt = stmt.where(Incidente.creado_en >= fecha_desde)
        if fecha_hasta is not None:
            stmt = stmt.where(Incidente.creado_en <= fecha_hasta)
        filas = await self._session.execute(stmt)
        return list(filas.all())

    async def antiguedad_promedio_dias(self, incidente_ids: list[uuid.UUID]) -> float | None:
        if not incidente_ids:
            return None
        promedio = await self._session.scalar(
            select(func.avg(func.extract("epoch", func.now() - Incidente.creado_en) / 86400)).where(
                Incidente.incidente_id.in_(incidente_ids)
            )
        )
        return float(promedio) if promedio is not None else None

    async def prioridad_default_codigo(self) -> str | None:
        """Sin módulo de alertas implementado (fuera de alcance, specs/00 §7) no hay
        forma de calcular la prioridad real de un incidente — se usa la de menor
        `orden` como default explícito hasta que ese módulo exista."""
        return await self._session.scalar(
            select(CatalogoPrioridad.codigo).order_by(CatalogoPrioridad.orden).limit(1)
        )
