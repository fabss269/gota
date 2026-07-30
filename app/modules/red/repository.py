from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# `sig` es de solo lectura — SQL explícito, sin ORM (specs/00-arquitectura.md §1).
# `distritoId` sigue la misma convención que `modules/catalogos` (id = ubigeo, se
# resuelve a `distritoid` antes de filtrar); `sectorId` = `sig.sectores.sectorid`.

_DISTRITO_JOIN = "JOIN sig.distritos d ON d.distritoid = t.distritoid AND d.ubigeo = :distrito_id"


class SigRedRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _feature_collection(self, inner_select: str, params: dict) -> dict:
        stmt = text(
            f"""
            SELECT jsonb_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(jsonb_agg(f), '[]'::jsonb)
            ) AS fc
            FROM ({inner_select}) AS features(f)
            """
        )
        row = (await self._session.execute(stmt, params)).first()
        return row.fc

    def _filtro_distrito_sector(self, distrito_id: str | None, sector_id: str | None) -> tuple[str, str, dict]:
        join = _DISTRITO_JOIN if distrito_id else ""
        condiciones = []
        params: dict = {}
        if distrito_id:
            params["distrito_id"] = distrito_id
        if sector_id:
            condiciones.append("t.sectorid = :sector_id")
            params["sector_id"] = int(sector_id)
        where = f"AND {' AND '.join(condiciones)}" if condiciones else ""
        return join, where, params

    async def red_potable(self, distrito_id: str | None, sector_id: str | None) -> dict:
        join, where, params = self._filtro_distrito_sector(distrito_id, sector_id)
        inner = f"""
            SELECT jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb,
                'properties', NULL
            )
            FROM sig.agua t
            {join}
            WHERE t.geom IS NOT NULL {where}
        """
        return await self._feature_collection(inner, params)

    async def red_desague(self, primaria: bool, distrito_id: str | None, sector_id: str | None) -> dict:
        join, where, params = self._filtro_distrito_sector(distrito_id, sector_id)
        params["primaria"] = primaria
        inner = f"""
            SELECT jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb,
                'properties', jsonb_build_object(
                    'codigo', t.codigo, 'material', m.material, 'tipo', at.alcantarilladotipo
                )
            )
            FROM sig.alcantarillado t
            LEFT JOIN sig.materiales m ON m.materialid = t.materialid
            LEFT JOIN sig.alcantarilladotipos at ON at.alcantarilladotipoid = t.alcantarilladotipoid
            {join}
            WHERE t.geom IS NOT NULL AND t.primaria = :primaria {where}
        """
        return await self._feature_collection(inner, params)

    async def buzones(self, distrito_id: str | None, sector_id: str | None) -> dict:
        join, where, params = self._filtro_distrito_sector(distrito_id, sector_id)
        inner = f"""
            SELECT jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb,
                'properties', jsonb_build_object('codigo', t.codigo)
            )
            FROM sig.buzones t
            {join}
            WHERE t.geom IS NOT NULL {where}
        """
        return await self._feature_collection(inner, params)

    async def accesorios(
        self, patron_tipo: str, distrito_id: str | None, sector_id: str | None
    ) -> dict:
        """`sig.accesoriotipos` no distingue "válvula"/"grifo contra incendio" como
        grupo propio (las 20 filas reales son todas `grupo='AGUA POTABLE'`, nombres de
        accesorios genéricos de tubería: codo, tapón, T, cruz, etc. — ninguna se llama
        "válvula" ni "hidrante"). Mejor esfuerzo: `ILIKE` sobre el nombre del tipo:
        devuelve `FeatureCollection` vacía con la data real actual, no un error — gap de
        catálogo a confirmar con Edgar, no un bug de esta consulta."""
        join, where, params = self._filtro_distrito_sector(distrito_id, sector_id)
        params["patron"] = patron_tipo
        inner = f"""
            SELECT jsonb_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(ST_Transform(t.geom, 4326))::jsonb,
                'properties', jsonb_build_object('codigo', t.codigo, 'tipo', at.accesoriotipo)
            )
            FROM sig.accesorios t
            JOIN sig.accesoriotipos at ON at.accesoriotipoid = t.accesoriotipoid AND at.accesoriotipo ILIKE :patron
            {join}
            WHERE t.geom IS NOT NULL {where}
        """
        return await self._feature_collection(inner, params)
