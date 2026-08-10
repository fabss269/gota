"""Único responsable del cruce con `sig` (specs/00-arquitectura.md §6).

Usado desde tres flujos: creación de incidente (`resolver_predio`, para poblar
`latitud`/`longitud` + sector), detalle de incidente (`resolver_predio` +
`resolver_catastro_cercano`, para el bloque `catastro` de `GET /incidencias/{id}`)
y el buscador de suministro del mapa (`resolver_predio`, ver `catalogos/router.py`).

Nunca hace JOIN con la BD propia — todo el cruce ocurre en Python, combinando el
resultado de estas consultas (que solo tocan `sig`) con datos ya obtenidos por
separado de la BD propia, en `service.py`.
"""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

_SENTINEL_INSCRIPCION = "00000000"


@dataclass
class PredioCatastral:
    sector_id: int
    sector_nombre: str
    distrito_id: int
    localidad_id: int | None
    lat: float
    lon: float


@dataclass
class CatastroCercano:
    red_asociada: str | None
    diametro_mm: float | None
    material: str | None
    buzon_cercano: str | None


class CatastroEnrichmentService:
    def __init__(self, sig_session: AsyncSession) -> None:
        self._session = sig_session

    async def resolver_predio(
        self, suministro_codigo: str, categoria: str
    ) -> PredioCatastral | None:
        """Busca en `sig.cajaagua` (categoria=agua) o `sig.cajadesague`
        (categoria=desague) por `inscripcion = suministro_codigo`, excluyendo el
        centinela '00000000'. Desempate por id ascendente si hay más de una fila
        (~0.01% de los códigos reales, ver memoria del proyecto)."""
        if suministro_codigo == _SENTINEL_INSCRIPCION:
            return None

        tabla, id_col = ("cajaagua", "cajaaguaid") if categoria == "agua" else ("cajadesague", "cajadesagueid")
        stmt = text(
            f"""
            SELECT c.sectorid, s.sector, c.distritoid, c.localidadid,
                   ST_Y(ST_Transform(c.geom, 4326)) AS lat,
                   ST_X(ST_Transform(c.geom, 4326)) AS lon
            FROM sig.{tabla} c
            LEFT JOIN sig.sectores s ON s.sectorid = c.sectorid
            WHERE c.inscripcion = :suministro AND c.inscripcion <> :sentinel
            ORDER BY c.{id_col}
            LIMIT 1
            """
        )
        row = (
            await self._session.execute(
                stmt, {"suministro": suministro_codigo, "sentinel": _SENTINEL_INSCRIPCION}
            )
        ).first()
        if row is None:
            return None

        return PredioCatastral(
            sector_id=row.sectorid,
            sector_nombre=(row.sector or "").title(),
            distrito_id=row.distritoid,
            localidad_id=row.localidadid,
            lat=float(row.lat),
            lon=float(row.lon),
        )

    async def listar_suministros_por_sector(self, sector_ids: list[int]) -> list[str]:
        """Códigos de suministro (== `inscripcion` en sig.cajaagua/cajadesague) de
        los sectores dados — usado para filtrar `GET /incidencias?sectorId=`/
        `distritoId=` directo contra la BD, sin depender de Redis (decisión de
        Edgar 2026-08-10: antes esto se resolvía con un índice invertido en Redis
        que solo se llenaba leyendo incidentes uno por uno, así que un Redis recién
        reiniciado o vaciado dejaba el filtro de sector devolviendo 0 resultados
        aunque la BD tuviera todo bien). Sin JOIN cross-schema (specs/00 §1): el
        resultado se usa como `WHERE suministro_codigo = ANY(...)` en la BD propia,
        en `service.py`."""
        if not sector_ids:
            return []
        stmt = text(
            """
            SELECT inscripcion FROM sig.cajaagua WHERE sectorid = ANY(:sector_ids) AND inscripcion <> :sentinel
            UNION
            SELECT inscripcion FROM sig.cajadesague WHERE sectorid = ANY(:sector_ids) AND inscripcion <> :sentinel
            """
        )
        result = await self._session.execute(stmt, {"sector_ids": sector_ids, "sentinel": _SENTINEL_INSCRIPCION})
        return [row[0] for row in result if row[0]]

    async def mapa_suministro_a_sector(self) -> dict[str, int]:
        """Igual idea que `listar_suministros_por_sector` pero en la dirección
        contraria y para TODOS los sectores de una — usado por el dashboard
        (`prioridadPorSector`) para agrupar incidentes por sector sin hacer un
        query a `sig` por sector (antes N queries a Redis, uno por sector, con el
        mismo problema de índice-vacío-si-no-se-usó-antes)."""
        stmt = text(
            """
            SELECT inscripcion, sectorid FROM sig.cajaagua
            WHERE inscripcion <> :sentinel AND sectorid IS NOT NULL
            UNION
            SELECT inscripcion, sectorid FROM sig.cajadesague
            WHERE inscripcion <> :sentinel AND sectorid IS NOT NULL
            """
        )
        result = await self._session.execute(stmt, {"sentinel": _SENTINEL_INSCRIPCION})
        return {row.inscripcion: row.sectorid for row in result}

    async def resolver_catastro_cercano(self, lat: float, lon: float, categoria: str) -> CatastroCercano:
        """Vecino más cercano en `sig.agua`/`sig.alcantarillado` (según `categoria`) +
        `sig.buzones`, usando los índices GiST existentes (`<->` KNN). El punto de
        consulta se transforma a 32719 (SRID nativo de `sig`) para que el operador de
        distancia use el índice espacial de forma eficiente."""
        punto = "ST_Transform(ST_SetSRID(ST_MakePoint(:lon, :lat), 4326), 32719)"
        params = {"lon": lon, "lat": lat}

        if categoria == "agua":
            stmt = text(
                f"""
                SELECT t.aguatipo AS red_asociada, l.diametro AS diametro_mm, m.material
                FROM sig.agua l
                LEFT JOIN sig.aguatipos t ON t.aguatipoid = l.aguatipoid
                LEFT JOIN sig.materiales m ON m.materialid = l.materialid
                ORDER BY l.geom <-> {punto}
                LIMIT 1
                """
            )
        else:
            # sig.alcantarillado no tiene columna de diámetro (a diferencia de
            # sig.agua) — gap real del schema, no un olvido de esta consulta.
            stmt = text(
                f"""
                SELECT t.alcantarilladotipo AS red_asociada, NULL::numeric AS diametro_mm, m.material
                FROM sig.alcantarillado l
                LEFT JOIN sig.alcantarilladotipos t ON t.alcantarilladotipoid = l.alcantarilladotipoid
                LEFT JOIN sig.materiales m ON m.materialid = l.materialid
                ORDER BY l.geom <-> {punto}
                LIMIT 1
                """
            )
        red_row = (await self._session.execute(stmt, params)).first()

        buzon_stmt = text(
            f"""
            SELECT b.codigo, c.cota
            FROM sig.buzones b
            LEFT JOIN sig.cotas c ON c.buzonid = b.buzonid
            ORDER BY b.geom <-> {punto}
            LIMIT 1
            """
        )
        buzon_row = (await self._session.execute(buzon_stmt, params)).first()
        buzon_cercano = None
        if buzon_row is not None:
            buzon_cercano = (
                f"{buzon_row.codigo} · Cota {buzon_row.cota:.2f} m"
                if buzon_row.cota is not None
                else buzon_row.codigo
            )

        return CatastroCercano(
            red_asociada=red_row.red_asociada if red_row else None,
            diametro_mm=float(red_row.diametro_mm) if red_row and red_row.diametro_mm is not None else None,
            material=red_row.material if red_row else None,
            buzon_cercano=buzon_cercano,
        )
