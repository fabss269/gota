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

    # ── Detalle de un elemento individual (click en el mapa fuera de modo simulación,
    # ver mapLayers.ts/MapView.web.tsx) — un lookup por PK (índice, no table scan) +
    # joins a catálogos chicos (materiales/tipos/sectores/distritos, todos <100 filas),
    # mismo patrón de bajo costo que ya usa CatastroEnrichmentService. Cada método
    # devuelve `None` si el id no existe; el service traduce eso a 404.

    async def elemento_tuberia(self, aguaid: int) -> dict | None:
        stmt = text("""
            SELECT t.aguaid AS id, t.codigo, t.diametro, m.material, at.aguatipo,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.agua t
            LEFT JOIN sig.materiales m ON m.materialid = t.materialid
            LEFT JOIN sig.aguatipos at ON at.aguatipoid = t.aguatipoid
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.aguaid = :id
        """)
        row = (await self._session.execute(stmt, {"id": aguaid})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "codigo": row["codigo"],
            "diametroPulgadas": float(row["diametro"]) if row["diametro"] is not None else None,
            "material": row["material"],
            "tipoNombre": row["aguatipo"],
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def elemento_tramo(self, alcantarilladoid: int) -> dict | None:
        stmt = text("""
            SELECT t.alcantarilladoid AS id, t.codigo, t.primaria, m.material, at.alcantarilladotipo,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.alcantarillado t
            LEFT JOIN sig.materiales m ON m.materialid = t.materialid
            LEFT JOIN sig.alcantarilladotipos at ON at.alcantarilladotipoid = t.alcantarilladotipoid
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.alcantarilladoid = :id
        """)
        row = (await self._session.execute(stmt, {"id": alcantarilladoid})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "codigo": row["codigo"],
            "primaria": row["primaria"],
            "material": row["material"],
            "tipoNombre": row["alcantarilladotipo"],
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def elemento_buzon(self, buzonid: int) -> dict | None:
        stmt = text("""
            SELECT t.buzonid AS id, t.codigo, t.referencia, t.tapa, t.fondo,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.buzones t
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.buzonid = :id
        """)
        row = (await self._session.execute(stmt, {"id": buzonid})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "codigo": row["codigo"],
            "referencia": row["referencia"],
            "cota": float(row["tapa"]) if row["tapa"] is not None else None,
            "cotaFondo": float(row["fondo"]) if row["fondo"] is not None else None,
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def elemento_accesorio(self, accesorioid: int) -> dict | None:
        stmt = text("""
            SELECT t.accesorioid AS id, t.codigo, t.diametro, t.profundidad, at.accesoriotipo,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.accesorios t
            LEFT JOIN sig.accesoriotipos at ON at.accesoriotipoid = t.accesoriotipoid
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.accesorioid = :id
        """)
        row = (await self._session.execute(stmt, {"id": accesorioid})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "codigo": row["codigo"],
            "diametroPulgadas": float(row["diametro"]) if row["diametro"] is not None else None,
            "profundidad": float(row["profundidad"]) if row["profundidad"] is not None else None,
            "tipoNombre": row["accesoriotipo"],
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def _elemento_caja(self, tabla: str, id_col: str, id_valor: int) -> dict | None:
        stmt = text(f"""
            SELECT t.{id_col} AS id, t.inscripcion, t.tipo, t.cota,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.{tabla} t
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.{id_col} = :id
        """)
        row = (await self._session.execute(stmt, {"id": id_valor})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "inscripcion": row["inscripcion"],
            "tipoNombre": row["tipo"],
            "cota": float(row["cota"]) if row["cota"] is not None else None,
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def elemento_cajaagua(self, cajaaguaid: int) -> dict | None:
        return await self._elemento_caja("cajaagua", "cajaaguaid", cajaaguaid)

    async def elemento_cajadesague(self, cajadesagueid: int) -> dict | None:
        return await self._elemento_caja("cajadesague", "cajadesagueid", cajadesagueid)

    async def elemento_manzana(self, manzanaid: int) -> dict | None:
        stmt = text("""
            SELECT t.manzanaid AS id, t.manzana, t.area, t.perimetro,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.manzanas t
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.manzanaid = :id
        """)
        row = (await self._session.execute(stmt, {"id": manzanaid})).mappings().first()
        if row is None:
            return None
        return {
            "id": row["id"],
            "nombre": row["manzana"],
            "area": float(row["area"]) if row["area"] is not None else None,
            "perimetro": float(row["perimetro"]) if row["perimetro"] is not None else None,
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }

    async def elemento_lote(self, loteid: int) -> dict | None:
        stmt = text("""
            SELECT t.loteid AS id, t.cod_lote, t.zonificaci, t.sector_uso, t.area, t.perimetro,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.lotes t
            LEFT JOIN sig.sectores s ON s.sectorid = t.sectorid
            LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid
            WHERE t.loteid = :id
        """)
        row = (await self._session.execute(stmt, {"id": loteid})).mappings().first()
        if row is None:
            return None
        nombre = row["cod_lote"] or None
        tipo_nombre = " · ".join(v for v in (row["zonificaci"], row["sector_uso"]) if v) or None
        return {
            "id": row["id"],
            "nombre": nombre,
            "tipoNombre": tipo_nombre,
            "area": float(row["area"]) if row["area"] is not None else None,
            "perimetro": float(row["perimetro"]) if row["perimetro"] is not None else None,
            "sectorId": row["sectorid"],
            "sectorNombre": (row["sector"] or "").title() or None,
            "distritoId": row["distritoid"],
            "distritoNombre": (row["distrito"] or "").title() or None,
        }


# ── Escritura sobre sig.agua/sig.alcantarillado (excepción explícita al
# read-only, ver app/db/sig.py get_sig_write_session) — edición inline de
# diámetro/material desde el panel de detalle del mapa.


class SigRedWriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def actualizar_tuberia(self, aguaid: int, diametro: float | None, material_id: int | None) -> bool:
        sets = []
        params: dict = {"id": aguaid}
        if diametro is not None:
            sets.append("diametro = :diametro")
            params["diametro"] = diametro
        if material_id is not None:
            sets.append("materialid = :material_id")
            params["material_id"] = material_id
        stmt = text(f"UPDATE sig.agua SET {', '.join(sets)} WHERE aguaid = :id")
        result = await self._session.execute(stmt, params)
        return result.rowcount > 0

    async def actualizar_tramo(self, alcantarilladoid: int, material_id: int) -> bool:
        stmt = text("UPDATE sig.alcantarillado SET materialid = :material_id WHERE alcantarilladoid = :id")
        result = await self._session.execute(stmt, {"id": alcantarilladoid, "material_id": material_id})
        return result.rowcount > 0

    async def listar_materiales(self, grupo: str) -> list[dict]:
        stmt = text(
            "SELECT materialid, material FROM sig.materiales WHERE grupo = :grupo ORDER BY material"
        )
        result = await self._session.execute(stmt, {"grupo": grupo})
        return [{"id": row.materialid, "nombre": row.material} for row in result]
