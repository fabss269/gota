"""Grafo hidráulico (`sql/grafo_funciones.sql`) — funciones que viven en `gota`
(nuestro schema) pero leen `sig.*` (CONHYDRA) cross-schema. Se llaman vía
`propia_session`, no `sig_session`: son nuestras, y en producción ambas conexiones
apuntan a la misma BD (`bd_conhydra`) de todas formas. `sig_session` sigue siendo
la de otros módulos que solo leen `sig` directamente (catastro_enrichment, red).

Este repositorio también resuelve, con consultas chicas directas a `sig.*`, el
elemento de red (tramo/tubería/buzón) que corresponde a un `suministro_codigo` —
necesario para "impacto de incidencia" y para el foco embebido en el detalle.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_SENTINEL = "00000000"


class GrafoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _call(self, fn_sql: str, params: dict) -> list[dict]:
        rows = (await self._session.execute(text(fn_sql), params)).mappings()
        return [dict(r) for r in rows]

    async def simular_atoro_tramo(self, tramo_id: int, niveles_max: int = 30) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_atoro_tramo(:tramo_id, :niveles_max)",
            {"tramo_id": tramo_id, "niveles_max": niveles_max},
        )

    async def simular_colapso_buzon(self, buzon_id: int, niveles_max: int = 30) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_colapso_buzon(:buzon_id, :niveles_max)",
            {"buzon_id": buzon_id, "niveles_max": niveles_max},
        )

    async def simular_falla_conexion(self, cajadesague_id: int) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_falla_conexion(:cajadesague_id)",
            {"cajadesague_id": cajadesague_id},
        )

    async def simular_tapa_faltante(self, buzon_id: int, niveles_max: int = 10) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_tapa_faltante(:buzon_id, :niveles_max)",
            {"buzon_id": buzon_id, "niveles_max": niveles_max},
        )

    async def simular_fuga_tuberia(self, tuberia_id: int, niveles_max: int = 15) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_fuga_tuberia(:tuberia_id, :niveles_max)",
            {"tuberia_id": tuberia_id, "niveles_max": niveles_max},
        )

    async def simular_fuga_accesorio(self, accesorio_id: int, niveles_max: int = 15) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_fuga_accesorio(:accesorio_id, :niveles_max)",
            {"accesorio_id": accesorio_id, "niveles_max": niveles_max},
        )

    # -- Compañeras "_red": misma BFS, devuelven la red completa recorrida (sin
    #    colapsar por suministro) para el modo vista del mapa --

    async def simular_atoro_tramo_red(self, tramo_id: int, niveles_max: int = 30) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_atoro_tramo_red(:tramo_id, :niveles_max)",
            {"tramo_id": tramo_id, "niveles_max": niveles_max},
        )

    async def simular_colapso_buzon_red(self, buzon_id: int, niveles_max: int = 30) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_colapso_buzon_red(:buzon_id, :niveles_max)",
            {"buzon_id": buzon_id, "niveles_max": niveles_max},
        )

    async def simular_falla_conexion_red(self, cajadesague_id: int) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_falla_conexion_red(:cajadesague_id)",
            {"cajadesague_id": cajadesague_id},
        )

    async def simular_tapa_faltante_red(self, buzon_id: int, niveles_max: int = 10) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_tapa_faltante_red(:buzon_id, :niveles_max)",
            {"buzon_id": buzon_id, "niveles_max": niveles_max},
        )

    async def simular_fuga_tuberia_red(self, tuberia_id: int, niveles_max: int = 15) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_fuga_tuberia_red(:tuberia_id, :niveles_max)",
            {"tuberia_id": tuberia_id, "niveles_max": niveles_max},
        )

    async def simular_fuga_accesorio_red(self, accesorio_id: int, niveles_max: int = 15) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.simular_fuga_accesorio_red(:accesorio_id, :niveles_max)",
            {"accesorio_id": accesorio_id, "niveles_max": niveles_max},
        )

    async def detectar_focos_activos_desague(self, dias: int, min_reclamos: int) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.detectar_focos_activos_desague(:dias, :min_reclamos)",
            {"dias": dias, "min_reclamos": min_reclamos},
        )

    async def detectar_focos_activos_agua(self, dias: int, min_reclamos: int) -> list[dict]:
        return await self._call(
            "SELECT * FROM gota.detectar_focos_activos_agua(:dias, :min_reclamos)",
            {"dias": dias, "min_reclamos": min_reclamos},
        )

    # -- Resolución suministro -> elemento de red (sig.*, consultas directas) --

    async def resolver_tramo_desague(self, suministro_codigo: str) -> int | None:
        stmt = text(
            """
            SELECT cdc.alcantarilladoid
            FROM sig.cajadesague cd
            JOIN sig.cajadesagueconexion cdc ON cdc.cajadesagueid = cd.cajadesagueid
            WHERE cd.inscripcion = :suministro AND cd.inscripcion <> :sentinel
            ORDER BY cd.cajadesagueid
            LIMIT 1
            """
        )
        row = (await self._session.execute(stmt, {"suministro": suministro_codigo, "sentinel": _SENTINEL})).first()
        return row.alcantarilladoid if row else None

    async def resolver_cajadesague_id(self, suministro_codigo: str) -> int | None:
        stmt = text(
            """
            SELECT cajadesagueid FROM sig.cajadesague
            WHERE inscripcion = :suministro AND inscripcion <> :sentinel
            ORDER BY cajadesagueid LIMIT 1
            """
        )
        row = (await self._session.execute(stmt, {"suministro": suministro_codigo, "sentinel": _SENTINEL})).first()
        return row.cajadesagueid if row else None

    async def resolver_buzon_salida_tramo(self, tramo_id: int) -> int | None:
        stmt = text("SELECT buzonsalidaid FROM sig.mv_alcantarillado_dirigido WHERE alcantarilladoid = :tramo_id")
        row = (await self._session.execute(stmt, {"tramo_id": tramo_id})).first()
        return row.buzonsalidaid if row else None

    async def listar_incidentes_por_infra_desague(self, tramo_id: int, dias: int) -> list[dict]:
        """Las funciones `detectar_focos_activos_*` agregan (GROUP BY), no devuelven
        qué incidentes concretos componen el foco — esta consulta re-resuelve esa
        lista puntual para un tramo, usada al poblar `incidenciasRelacionadasIds`."""
        stmt = text(
            """
            SELECT DISTINCT i.incidente_id, i.codigo
            FROM gota.incidente i
            JOIN gota.reclamo r ON r.incidente_id = i.incidente_id
            JOIN sig.cajadesague cd ON cd.inscripcion = i.suministro_codigo
            JOIN sig.cajadesagueconexion cdc ON cdc.cajadesagueid = cd.cajadesagueid
            WHERE cdc.alcantarilladoid = :tramo_id
              AND r.fecha_registro >= NOW() - (:dias * INTERVAL '1 day')
            """
        )
        rows = (await self._session.execute(stmt, {"tramo_id": tramo_id, "dias": dias})).mappings()
        return [dict(r) for r in rows]

    async def listar_incidentes_por_infra_agua(self, tuberia_id: int, dias: int) -> list[dict]:
        stmt = text(
            """
            SELECT DISTINCT i.incidente_id, i.codigo
            FROM gota.incidente i
            JOIN gota.reclamo r ON r.incidente_id = i.incidente_id
            JOIN sig.cajaagua ca ON ca.inscripcion = i.suministro_codigo
            JOIN sig.cajaaguaconexion cac ON cac.cajaaguaid = ca.cajaaguaid
            WHERE cac.aguaid = :tuberia_id
              AND r.fecha_registro >= NOW() - (:dias * INTERVAL '1 day')
            """
        )
        rows = (await self._session.execute(stmt, {"tuberia_id": tuberia_id, "dias": dias})).mappings()
        return [dict(r) for r in rows]

    async def resolver_tuberia_agua(self, suministro_codigo: str) -> int | None:
        stmt = text(
            """
            SELECT cac.aguaid
            FROM sig.cajaagua ca
            JOIN sig.cajaaguaconexion cac ON cac.cajaaguaid = ca.cajaaguaid
            WHERE ca.inscripcion = :suministro AND ca.inscripcion <> :sentinel
            ORDER BY ca.cajaaguaid
            LIMIT 1
            """
        )
        row = (await self._session.execute(stmt, {"suministro": suministro_codigo, "sentinel": _SENTINEL})).first()
        return row.aguaid if row else None
