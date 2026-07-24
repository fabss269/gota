from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# `sig` es de solo lectura y ajena a este servicio (bd_conhydra) — se consulta con SQL
# explícito, sin modelos ORM propios, para que quede claro en el código que nunca se le
# hace INSERT/UPDATE/DELETE (ver specs/00-arquitectura.md §1).


class SigCatalogoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def listar_distritos(self) -> list[dict]:
        stmt = text(
            """
            SELECT ubigeo, distrito
            FROM sig.distritos
            WHERE departamentocod = '14'
            ORDER BY distrito
            """
        )
        result = await self._session.execute(stmt)
        return [{"id": row.ubigeo, "nombre": row.distrito.title()} for row in result]

    async def listar_sectores(self, distrito_ubigeo: str | None) -> list[dict]:
        stmt = """
            SELECT s.sectorid, s.sector
            FROM sig.sectores s
        """
        params: dict[str, str] = {}
        if distrito_ubigeo is not None:
            stmt += """
            JOIN sig.distritos d ON d.distritoid = s.distritoid
            WHERE d.ubigeo = :distrito_ubigeo
            """
            params["distrito_ubigeo"] = distrito_ubigeo
        stmt += " ORDER BY s.sector"

        result = await self._session.execute(text(stmt), params)
        return [{"id": str(row.sectorid), "nombre": row.sector.title()} for row in result]
