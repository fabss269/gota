from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


# `sig` es de solo lectura y ajena a este servicio (bd_conhydra) — se consulta con SQL
# explícito, sin modelos ORM propios, para que quede claro en el código que nunca se le
# hace INSERT/UPDATE/DELETE (ver specs/00-arquitectura.md §1). Por eso el bbox de cada
# fila se calcula al vuelo con ST_Transform+ST_X/YMin/Max en el SELECT en vez de crear
# una vista en `sig` — evita cualquier DDL sobre esa BD ajena.
def _bbox_columns(geom_expr: str) -> str:
    return f"""
        ST_XMin(ST_Transform({geom_expr}, 4326)) AS min_lon,
        ST_YMin(ST_Transform({geom_expr}, 4326)) AS min_lat,
        ST_XMax(ST_Transform({geom_expr}, 4326)) AS max_lon,
        ST_YMax(ST_Transform({geom_expr}, 4326)) AS max_lat
    """


def _bbox(row) -> dict:
    return {"minLon": row.min_lon, "minLat": row.min_lat, "maxLon": row.max_lon, "maxLat": row.max_lat}


class SigCatalogoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar_provincias(self) -> list[dict]:
        stmt = text(
            f"""
            SELECT provinciacod, provincia, {_bbox_columns("geom")}
            FROM sig.provincias
            WHERE departamentocod = '14'
            ORDER BY provincia
            """
        )
        result = await self._session.execute(stmt)
        return [
            {"id": row.provinciacod, "nombre": row.provincia.title(), "bbox": _bbox(row)}
            for row in result
        ]

    async def listar_distritos(self) -> list[dict]:
        # `distritos.provinciaid` viene NULL en esta BD — la única relación confiable
        # con `provincias` es por el par de códigos (provinciacod, departamentocod).
        stmt = text(
            f"""
            SELECT ubigeo, distrito, provinciacod, {_bbox_columns("geom")}
            FROM sig.distritos
            WHERE departamentocod = '14'
            ORDER BY provinciacod, distrito
            """
        )
        result = await self._session.execute(stmt)
        return [
            {
                "id": row.ubigeo,
                "nombre": row.distrito.title(),
                "provinciaId": row.provinciacod,
                "bbox": _bbox(row),
            }
            for row in result
        ]

    async def listar_sectores(self, distrito_ubigeo: str | None) -> list[dict]:
        # `sectores.provincia` (texto crudo) viene sucio en 13 de 55 filas — se ignora.
        # `sectores.distritoid` sí está completo al 100% y es la relación confiable.
        stmt = f"""
            SELECT s.sectorid, s.sector, d.ubigeo AS distrito_ubigeo, {_bbox_columns("s.geom")}
            FROM sig.sectores s
            JOIN sig.distritos d ON d.distritoid = s.distritoid
        """
        params: dict[str, str] = {}
        if distrito_ubigeo is not None:
            stmt += " WHERE d.ubigeo = :distrito_ubigeo"
            params["distrito_ubigeo"] = distrito_ubigeo
        stmt += " ORDER BY s.sector"

        result = await self._session.execute(text(stmt), params)
        return [
            {
                "id": str(row.sectorid),
                "nombre": row.sector.title(),
                "distritoId": row.distrito_ubigeo,
                "bbox": _bbox(row),
            }
            for row in result
        ]
