from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# `sig` es de solo lectura — SQL explícito, sin ORM (specs/00-arquitectura.md §1).
# `distritoId` sigue la misma convención que `modules/catalogos` (id = ubigeo, se
# resuelve a `distritoid` antes de filtrar); `sectorId` = `sig.sectores.sectorid`.

_DISTRITO_JOIN = "JOIN sig.distritos d ON d.distritoid = t.distritoid AND d.ubigeo = :distrito_id"


def _titulo(valor: str | None) -> str | None:
    return (valor or "").title() or None


def _num(valor) -> float | None:
    return float(valor) if valor is not None else None


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

    # ── Detalle de un elemento individual (click en el mapa fuera de modo simulación).
    # Cada método devuelve `None` si el id no existe; el service traduce eso a 404.

    async def elemento_tuberia(self, aguaid: int) -> dict | None:
        stmt = text("""
            SELECT t.aguaid AS id, t.codigo, t.diametro, t.distancia, t.materialid,
                   m.material, at.aguatipo,
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
            "diametroPulgadas": _num(row["diametro"]),
            "distancia": _num(row["distancia"]),
            "materialId": row["materialid"],
            "material": row["material"],
            "tipoNombre": row["aguatipo"],
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
        }

    async def elemento_tramo(self, alcantarilladoid: int) -> dict | None:
        stmt = text("""
            SELECT t.alcantarilladoid AS id, t.codigo, t.primaria, t.pendiente, t.distancia,
                   t.materialid, m.material, at.alcantarilladotipo,
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
            "pendiente": _num(row["pendiente"]),
            "distancia": _num(row["distancia"]),
            "materialId": row["materialid"],
            "material": row["material"],
            "tipoNombre": row["alcantarilladotipo"],
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
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
            "cota": _num(row["tapa"]),
            "cotaFondo": _num(row["fondo"]),
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
        }

    async def elemento_accesorio(self, accesorioid: int) -> dict | None:
        stmt = text("""
            SELECT t.accesorioid AS id, t.codigo, t.diametro, t.profundidad,
                   t.accesoriotipoid, at.accesoriotipo,
                   t.accesorioclasificacionid, ac.accesorioclasificacion,
                   t.sectorid, s.sector, t.distritoid, d.distrito
            FROM sig.accesorios t
            LEFT JOIN sig.accesoriotipos at ON at.accesoriotipoid = t.accesoriotipoid
            LEFT JOIN sig.accesorioclasificacion ac ON ac.accesorioclasificacionid = t.accesorioclasificacionid
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
            "diametroPulgadas": _num(row["diametro"]),
            "profundidad": _num(row["profundidad"]),
            "accesorioTipoId": row["accesoriotipoid"],
            "tipoNombre": row["accesoriotipo"],
            "accesorioClasificacionId": row["accesorioclasificacionid"],
            "accesorioClasificacion": row["accesorioclasificacion"],
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
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
            "cota": _num(row["cota"]),
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
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
            "area": _num(row["area"]),
            "perimetro": _num(row["perimetro"]),
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
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
            "area": _num(row["area"]),
            "perimetro": _num(row["perimetro"]),
            "sectorId": row["sectorid"],
            "sectorNombre": _titulo(row["sector"]),
            "distritoId": row["distritoid"],
            "distritoNombre": _titulo(row["distrito"]),
        }

    # ── Dashboard: longitud de red por material ─────────────────────────────

    async def longitud_por_material(
        self,
        grupo: str,
        sector_id: str | None,
        distrito_id: str | None,
        provincia_id: str | None,
        diametro: float | None,
    ) -> list[dict]:
        """`grupo`: 'agua' (sig.agua, filtrable por diametro) o 'alcantarillado'
        (sig.alcantarillado, sin diametro — esa tabla no tiene esa columna, gap
        real ya documentado en otros lugares de este módulo). `distrito_id` es el
        ubigeo (mismo criterio que el resto del repo); `provincia_id` es
        `provinciacod` (NO `provinciaid` — esa columna viene NULL en `sig.
        distritos` en esta BD, la única relación confiable con `sig.provincias`
        es por código, ver `catalogos/sig_repository.py:listar_distritos`)."""
        tabla = "agua" if grupo == "agua" else "alcantarillado"
        necesita_distritos = bool(distrito_id or provincia_id)
        join = "LEFT JOIN sig.distritos d ON d.distritoid = t.distritoid" if necesita_distritos else ""
        condiciones = ["t.geom IS NOT NULL", "t.distancia IS NOT NULL"]
        params: dict = {}
        if distrito_id:
            condiciones.append("d.ubigeo = :distrito_id")
            params["distrito_id"] = distrito_id
        if provincia_id:
            condiciones.append("d.provinciacod = :provincia_id")
            params["provincia_id"] = provincia_id
        if sector_id:
            condiciones.append("t.sectorid = :sector_id")
            params["sector_id"] = int(sector_id)
        if diametro is not None and grupo == "agua":
            condiciones.append("t.diametro = :diametro")
            params["diametro"] = diametro
        where = " AND ".join(condiciones)
        stmt = text(
            f"""
            SELECT COALESCE(m.material, 'Sin dato') AS material, SUM(t.distancia) AS metros
            FROM sig.{tabla} t
            LEFT JOIN sig.materiales m ON m.materialid = t.materialid
            {join}
            WHERE {where}
            GROUP BY m.material
            ORDER BY metros DESC
            """
        )
        result = await self._session.execute(stmt, params)
        return [{"material": row.material, "metros": float(row.metros or 0)} for row in result]


# ── Escritura sobre sig.* (excepción explícita al read-only, ver
# app/db/sig.py get_sig_write_session) — edición inline desde el panel de detalle.


class SigRedWriteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def _update_generico(
        self, tabla: str, id_col: str, id_valor: int, cambios: dict
    ) -> bool:
        """Genera UPDATE ... SET col1=:col1, col2=:col2 WHERE id_col=:id.
        Los nombres de columna vienen del código (whitelist en service.py), NO del
        usuario — seguro para f-string.
        """
        if not cambios:
            return False
        sets = ", ".join(f"{col} = :{col}" for col in cambios)
        params = {**cambios, "id": id_valor}
        stmt = text(f"UPDATE sig.{tabla} SET {sets} WHERE {id_col} = :id")
        result = await self._session.execute(stmt, params)
        return result.rowcount > 0

    async def actualizar_tuberia(self, aguaid: int, cambios: dict) -> bool:
        return await self._update_generico("agua", "aguaid", aguaid, cambios)

    async def actualizar_tramo(self, alcantarilladoid: int, cambios: dict) -> bool:
        return await self._update_generico(
            "alcantarillado", "alcantarilladoid", alcantarilladoid, cambios
        )

    async def actualizar_buzon(self, buzonid: int, cambios: dict) -> bool:
        return await self._update_generico("buzones", "buzonid", buzonid, cambios)

    async def actualizar_accesorio(self, accesorioid: int, cambios: dict) -> bool:
        return await self._update_generico("accesorios", "accesorioid", accesorioid, cambios)

    async def actualizar_cajaagua(self, cajaaguaid: int, cambios: dict) -> bool:
        return await self._update_generico("cajaagua", "cajaaguaid", cajaaguaid, cambios)

    async def actualizar_cajadesague(self, cajadesagueid: int, cambios: dict) -> bool:
        return await self._update_generico("cajadesague", "cajadesagueid", cajadesagueid, cambios)

    # ── Catálogos ─────────────────────────────────────────────────────

    async def listar_materiales(self, grupo: str | None) -> list[dict]:
        if grupo is None:
            stmt = text(
                "SELECT materialid, material FROM sig.materiales "
                "WHERE estado = 'H' AND situacion = 'A' ORDER BY material"
            )
            params: dict = {}
        else:
            stmt = text(
                "SELECT materialid, material FROM sig.materiales "
                "WHERE grupo = :grupo AND estado = 'H' AND situacion = 'A' ORDER BY material"
            )
            params = {"grupo": grupo}
        result = await self._session.execute(stmt, params)
        return [{"id": row.materialid, "nombre": row.material} for row in result]

    async def listar_accesorio_tipos(self, grupo: str | None) -> list[dict]:
        if grupo is None:
            stmt = text(
                "SELECT accesoriotipoid, accesoriotipo FROM sig.accesoriotipos "
                "WHERE estado = 'H' AND situacion = 'A' ORDER BY accesoriotipo"
            )
            params: dict = {}
        else:
            stmt = text(
                "SELECT accesoriotipoid, accesoriotipo FROM sig.accesoriotipos "
                "WHERE grupo = :grupo AND estado = 'H' AND situacion = 'A' ORDER BY accesoriotipo"
            )
            params = {"grupo": grupo}
        result = await self._session.execute(stmt, params)
        return [{"id": row.accesoriotipoid, "nombre": row.accesoriotipo} for row in result]

    async def listar_accesorio_clasificaciones(self) -> list[dict]:
        stmt = text(
            "SELECT accesorioclasificacionid, accesorioclasificacion "
            "FROM sig.accesorioclasificacion "
            "WHERE estado = 'H' AND situacion = 'A' "
            "ORDER BY accesorioclasificacion"
        )
        result = await self._session.execute(stmt)
        return [
            {"id": row.accesorioclasificacionid, "nombre": row.accesorioclasificacion}
            for row in result
        ]
