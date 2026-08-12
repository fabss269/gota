"""Repositorio del dashboard operativo.

Todo lo posible se hace desde `gota.mv_incidente_enriquecido` (una MV que ya
tiene sector, grupo, n_reclamos, dias_hasta_solucion, es_resolucion_lenta y
geometría precalculados) para que los queries sean simples GROUP BY.
"""
from datetime import date, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class DashboardGeoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ---------------- Helpers de rango ----------------
    #
    # Todo el módulo trabaja con dos rangos: actual [desde, hasta) y
    # previo [desde_prev, hasta_prev). El servicio los calcula según el
    # `periodo` (anual/mensual) y los pasa a estos métodos.

    async def _filtro_grupo_sql(self, grupo: str | None) -> tuple[str, dict]:
        if grupo and grupo != "todos":
            return " AND grupo = :grupo ", {"grupo": grupo}
        return "", {}

    async def _filtro_sector_sql(self, sectorid: int | None) -> tuple[str, dict]:
        if sectorid is not None:
            return " AND sectorid = :sectorid ", {"sectorid": sectorid}
        return "", {}

    # ---------------- Popup (existente) ----------------

    async def popup_incidencia(self, codigo: str) -> dict[str, Any] | None:
        row = (
            await self._session.execute(
                text(
                    """
                    SELECT
                        i.codigo, i.suministro_codigo, i.direccion,
                        ta.nombre AS tipo_atencion, tg.codigo AS grupo,
                        s.sector AS sector_nombre,
                        i.creado_en, i.fecha_solucion,
                        (i.fecha_solucion IS NULL) AS sin_solucion,
                        CASE WHEN i.fecha_solucion IS NOT NULL
                             THEN EXTRACT(DAY FROM (i.fecha_solucion - i.creado_en))::int
                        END AS dias_hasta_solucion,
                        (
                          SELECT COALESCE(json_agg(json_build_object(
                            'fecha', r.fecha_registro,
                            'detalle', TRIM(regexp_replace(r.detalle_del_ticket, '\\s*TEC\\.?.*$', '', 'i'))
                          ) ORDER BY r.fecha_registro), '[]'::json)
                          FROM gota.reclamo r
                          WHERE r.incidente_id = i.incidente_id
                        ) AS reclamos
                    FROM gota.incidente i
                    JOIN gota.catalogo_tipo_atencion ta ON ta.tipo_atencion_id = i.tipo_atencion_id
                    JOIN gota.catalogo_tipo_grupo    tg ON tg.tipo_grupo_id    = ta.tipo_grupo_id
                    LEFT JOIN gota.mv_incidente_enriquecido mv ON mv.incidente_id = i.incidente_id
                    LEFT JOIN sig.sectores s ON s.sectorid = mv.sectorid
                    WHERE i.codigo = :codigo
                    """
                ),
                {"codigo": codigo},
            )
        ).mappings().first()
        return dict(row) if row else None

    # ---------------- KPIs ----------------

    async def _agregado_ventana(
        self,
        desde: date | datetime,
        hasta: date | datetime,
        grupo: str | None,
        sectorid: int | None,
    ) -> dict[str, Any]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        row = (
            await self._session.execute(
                text(
                    f"""
                    SELECT
                        COUNT(*)                                     AS volumen,
                        COUNT(*) FILTER (WHERE sin_solucion)         AS sin_solucion,
                        PERCENTILE_CONT(0.5) WITHIN GROUP (
                            ORDER BY dias_hasta_solucion
                        ) FILTER (WHERE dias_hasta_solucion IS NOT NULL) AS tiempo_mediano_dias,
                        (
                          SELECT COUNT(*)
                          FROM gota.mv_incidente_enriquecido mv2
                          JOIN gota.incidente i ON i.incidente_id = mv2.incidente_id
                          WHERE i.es_robo = true
                            AND mv2.creado_en >= :desde
                            AND mv2.creado_en <  :hasta
                            {gsql.replace('grupo', 'mv2.grupo')}
                            {ssql.replace('sectorid', 'mv2.sectorid')}
                        ) AS robos
                    FROM gota.mv_incidente_enriquecido
                    WHERE creado_en >= :desde AND creado_en < :hasta
                      {gsql} {ssql}
                    """
                ),
                {"desde": desde, "hasta": hasta, **gparams, **sparams},
            )
        ).mappings().first()
        return dict(row) if row else {
            "volumen": 0, "sin_solucion": 0, "tiempo_mediano_dias": None, "robos": 0
        }

    async def sparkline_volumen(
        self,
        desde: date | datetime,
        hasta: date | datetime,
        grupo: str | None,
        sectorid: int | None,
        bucket: str = "month",
    ) -> list[dict[str, Any]]:
        """Serie tipo sparkline (bucketed) de volumen dentro del rango."""
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT date_trunc(:bucket, creado_en)::date AS x, COUNT(*)::float AS y
                    FROM gota.mv_incidente_enriquecido
                    WHERE creado_en >= :desde AND creado_en < :hasta
                      {gsql} {ssql}
                    GROUP BY x ORDER BY x
                    """
                ),
                {"desde": desde, "hasta": hasta, "bucket": bucket, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def sparkline_robos(
        self,
        desde: date | datetime,
        hasta: date | datetime,
        grupo: str | None,
        sectorid: int | None,
        bucket: str = "month",
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT date_trunc(:bucket, mv.creado_en)::date AS x, COUNT(*)::float AS y
                    FROM gota.mv_incidente_enriquecido mv
                    JOIN gota.incidente i ON i.incidente_id = mv.incidente_id
                    WHERE i.es_robo = true
                      AND mv.creado_en >= :desde AND mv.creado_en < :hasta
                      {gsql.replace('grupo', 'mv.grupo')}
                      {ssql.replace('sectorid', 'mv.sectorid')}
                    GROUP BY x ORDER BY x
                    """
                ),
                {"desde": desde, "hasta": hasta, "bucket": bucket, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def sparkline_tiempo_mediano(
        self,
        desde: date | datetime,
        hasta: date | datetime,
        grupo: str | None,
        sectorid: int | None,
        bucket: str = "month",
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT date_trunc(:bucket, creado_en)::date AS x,
                           PERCENTILE_CONT(0.5) WITHIN GROUP (
                               ORDER BY dias_hasta_solucion
                           )::float AS y
                    FROM gota.mv_incidente_enriquecido
                    WHERE creado_en >= :desde AND creado_en < :hasta
                      AND dias_hasta_solucion IS NOT NULL
                      {gsql} {ssql}
                    GROUP BY x ORDER BY x
                    """
                ),
                {"desde": desde, "hasta": hasta, "bucket": bucket, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Sectores / heatmap ----------------

    async def sectores_ranking(
        self,
        limite: int = 10,
        grupo: str | None = None,
        distrito_id: str | None = None,
        provincia_id: str | None = None,
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        # `distrito_id`/`provincia_id` llegan del catálogo del frontend (ubigeo /
        # provinciacod, ver catalogos/sig_repository.py) — NO son las PK internas
        # `sig.distritos.distritoid` ni el código corto de `sig.sectores.provincia`
        # (ese último usa otra numeración interna, no INEI). Se resuelven siempre
        # vía JOIN con sig.distritos, mismo patrón que red/repository.py.
        condiciones = []
        params: dict[str, Any] = {"limite": limite, **gparams}
        necesita_distritos = bool(distrito_id or provincia_id)
        join_distritos = (
            "LEFT JOIN sig.distritos d ON d.distritoid = s.distritoid" if necesita_distritos else ""
        )
        if distrito_id:
            condiciones.append("d.ubigeo = :distrito_id")
            params["distrito_id"] = distrito_id
        if provincia_id:
            condiciones.append("d.provinciacod = :provincia_id")
            params["provincia_id"] = provincia_id
        wsql = (" AND " + " AND ".join(condiciones)) if condiciones else ""
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT
                        s.sectorid, s.sector,
                        COUNT(mv.incidente_id) AS n_incidencias,
                        COUNT(mv.incidente_id) FILTER (WHERE mv.grupo = 'agua')    AS n_agua,
                        COUNT(mv.incidente_id) FILTER (WHERE mv.grupo = 'desague') AS n_desague
                    FROM sig.sectores s
                    {join_distritos}
                    LEFT JOIN gota.mv_incidente_enriquecido mv
                        ON mv.sectorid = s.sectorid {gsql}
                    WHERE 1=1 {wsql}
                    GROUP BY s.sectorid, s.sector
                    HAVING COUNT(mv.incidente_id) > 0
                    ORDER BY n_incidencias DESC
                    LIMIT :limite
                    """
                ),
                params,
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def heatmap_sectores(self, grupo: str | None = None) -> list[dict[str, Any]]:
        """Todos los sectores con su conteo y densidad — para pintar polígonos."""
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT
                        s.sectorid, s.sector,
                        COUNT(mv.incidente_id) AS n_incidencias,
                        ROUND(
                            COUNT(mv.incidente_id) / NULLIF(s.area / 1000000.0, 0), 2
                        )::float AS densidad_por_km2
                    FROM sig.sectores s
                    LEFT JOIN gota.mv_incidente_enriquecido mv
                        ON mv.sectorid = s.sectorid {gsql}
                    GROUP BY s.sectorid, s.sector, s.area
                    ORDER BY n_incidencias DESC
                    """
                ),
                gparams,
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Top calles (tramo) ----------------

    async def top_calles(
        self,
        limite: int = 10,
        grupo: str | None = None,
        sectorid: int | None = None,
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    WITH agrupado AS (
                        SELECT
                            tramo_id,
                            tramo_tipo,
                            sectorid,
                            COUNT(*) AS n,
                            (array_agg(direccion ORDER BY creado_en DESC))[1] AS dir_muestra
                        FROM gota.mv_incidente_enriquecido
                        WHERE tramo_id IS NOT NULL
                          {gsql} {ssql}
                        GROUP BY tramo_id, tramo_tipo, sectorid
                    )
                    SELECT a.tramo_id, a.tramo_tipo, a.dir_muestra AS direccion_muestra,
                           a.sectorid, s.sector, a.n AS n_incidencias
                    FROM agrupado a
                    LEFT JOIN sig.sectores s ON s.sectorid = a.sectorid
                    ORDER BY a.n DESC
                    LIMIT :limite
                    """
                ),
                {"limite": limite, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Series temporales ----------------

    async def serie_mensual_por_anio(
        self, grupo: str | None = None, sectorid: int | None = None
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT
                        TO_CHAR(date_trunc('month', creado_en), 'YYYY-MM') AS mes,
                        COUNT(*)::float AS n
                    FROM gota.mv_incidente_enriquecido
                    WHERE 1=1 {gsql} {ssql}
                    GROUP BY mes ORDER BY mes
                    """
                ),
                {**gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def serie_robos_mensual(self) -> list[dict[str, Any]]:
        """Serie mensual de robos de medidor — toda la historia disponible."""
        rows = (
            await self._session.execute(
                text(
                    """
                    SELECT
                        TO_CHAR(date_trunc('month', mv.creado_en), 'YYYY-MM') AS x,
                        COUNT(*)::float AS y
                    FROM gota.mv_incidente_enriquecido mv
                    JOIN gota.incidente i ON i.incidente_id = mv.incidente_id
                    WHERE i.es_robo = true
                    GROUP BY x ORDER BY x
                    """
                )
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def tiempo_resolucion_mensual(
        self, grupo: str | None = None, sectorid: int | None = None
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT
                        TO_CHAR(date_trunc('month', creado_en), 'YYYY-MM') AS x,
                        AVG(dias_hasta_solucion)::float AS y
                    FROM gota.mv_incidente_enriquecido
                    WHERE dias_hasta_solucion IS NOT NULL
                      {gsql} {ssql}
                    GROUP BY x ORDER BY x
                    """
                ),
                {**gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def tipo_atencion_mensual_stacked(
        self, grupo: str | None = None, sectorid: int | None = None, top_n: int = 6
    ) -> list[dict[str, Any]]:
        """Serie mensual con conteo por top N tipo_atencion (resto agrupado como 'Otros')."""
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    WITH top_tipos AS (
                        SELECT tipo_atencion, COUNT(*) AS n
                        FROM gota.mv_incidente_enriquecido
                        WHERE 1=1 {gsql} {ssql}
                        GROUP BY tipo_atencion
                        ORDER BY n DESC LIMIT :top_n
                    ),
                    clasif AS (
                        SELECT
                            date_trunc('month', mv.creado_en)::date AS mes,
                            CASE WHEN t.tipo_atencion IS NULL THEN 'Otros' ELSE mv.tipo_atencion END AS tipo,
                            COUNT(*)::float AS n
                        FROM gota.mv_incidente_enriquecido mv
                        LEFT JOIN top_tipos t USING (tipo_atencion)
                        WHERE 1=1 {gsql.replace('grupo', 'mv.grupo')} {ssql.replace('sectorid', 'mv.sectorid')}
                        GROUP BY mes, tipo
                    )
                    SELECT TO_CHAR(mes, 'YYYY-MM') AS mes, tipo, n FROM clasif ORDER BY mes, tipo
                    """
                ),
                {"top_n": top_n, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Reincidentes ----------------

    async def suministros_reincidentes(
        self,
        meses_ventana: int,
        min_incidencias: int,
        limite: int,
        solo_robo: bool = False,
    ) -> list[dict[str, Any]]:
        """
        Reincidentes por suministro.

        - Modo general (solo_robo=False): cuenta INCIDENTES por suministro
          (misma casa tuvo N tickets distintos en la ventana).
        - Modo robo (solo_robo=True): cuenta RECLAMOS DE ROBO por suministro
          (un mismo predio pudo tener múltiples reclamos de robo, sean o no
          del mismo incidente). Semánticamente "predio víctima de N robos".
        """
        if solo_robo:
            sql = """
                WITH robos AS (
                    SELECT
                        mv.suministro_codigo,
                        COUNT(r.reclamo_id) AS n_incidencias,
                        MAX(r.fecha_registro) AS ultima_fecha,
                        (array_agg(mv.direccion ORDER BY r.fecha_registro DESC))[1] AS direccion,
                        (array_agg(mv.sectorid ORDER BY r.fecha_registro DESC))[1] AS sectorid,
                        MODE() WITHIN GROUP (ORDER BY mv.tipo_atencion) AS tipo_dominante
                    FROM gota.mv_incidente_enriquecido mv
                    JOIN gota.incidente i ON i.incidente_id = mv.incidente_id
                    WHERE i.es_robo = true
                      AND mv.creado_en >= now() - (:meses * interval '1 month')
                      AND mv.suministro_codigo IS NOT NULL
                      AND mv.suministro_codigo != '99999999'
                    GROUP BY mv.suministro_codigo
                    HAVING COUNT(r.reclamo_id) >= :minimo
                )
                SELECT r.suministro_codigo AS suministro, r.direccion,
                       s.sector, r.n_incidencias, r.tipo_dominante, r.ultima_fecha
                FROM robos r
                LEFT JOIN sig.sectores s ON s.sectorid = r.sectorid
                ORDER BY r.n_incidencias DESC, r.ultima_fecha DESC
                LIMIT :limite
            """
        else:
            sql = """
                WITH filtrado AS (
                    SELECT mv.*
                    FROM gota.mv_incidente_enriquecido mv
                    WHERE mv.creado_en >= now() - (:meses * interval '1 month')
                ),
                agrupado AS (
                    SELECT
                        suministro_codigo,
                        COUNT(*) AS n_incidencias,
                        MAX(creado_en) AS ultima_fecha,
                        (array_agg(direccion ORDER BY creado_en DESC))[1] AS direccion,
                        (array_agg(sectorid ORDER BY creado_en DESC))[1] AS sectorid,
                        MODE() WITHIN GROUP (ORDER BY tipo_atencion) AS tipo_dominante
                    FROM filtrado
                    WHERE suministro_codigo IS NOT NULL
                      AND suministro_codigo != '99999999'
                    GROUP BY suministro_codigo
                    HAVING COUNT(*) >= :minimo
                )
                SELECT a.suministro_codigo AS suministro, a.direccion,
                       s.sector, a.n_incidencias, a.tipo_dominante, a.ultima_fecha
                FROM agrupado a
                LEFT JOIN sig.sectores s ON s.sectorid = a.sectorid
                ORDER BY a.n_incidencias DESC, a.ultima_fecha DESC
                LIMIT :limite
            """
        rows = (
            await self._session.execute(
                text(sql),
                {"meses": meses_ventana, "minimo": min_incidencias, "limite": limite},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Sin solución ----------------

    async def sin_solucion_ranking(
        self,
        limite: int = 20,
        grupo: str | None = None,
        sectorid: int | None = None,
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT mv.codigo, mv.tipo_atencion, s.sector, mv.direccion,
                           GREATEST(EXTRACT(DAY FROM (now() - mv.creado_en))::int, 0) AS dias_sin_resolver
                    FROM gota.mv_incidente_enriquecido mv
                    LEFT JOIN sig.sectores s ON s.sectorid = mv.sectorid
                    WHERE mv.sin_solucion
                      {gsql.replace('grupo', 'mv.grupo')}
                      {ssql.replace('sectorid', 'mv.sectorid')}
                    ORDER BY dias_sin_resolver DESC
                    LIMIT :limite
                    """
                ),
                {"limite": limite, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Multi-reclamos ----------------

    async def multi_reclamos(
        self,
        minimo: int = 2,
        limite: int = 20,
        grupo: str | None = None,
        sectorid: int | None = None,
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT mv.codigo, mv.direccion, s.sector, mv.n_reclamos,
                           mv.tipo_atencion
                    FROM gota.mv_incidente_enriquecido mv
                    LEFT JOIN sig.sectores s ON s.sectorid = mv.sectorid
                    WHERE mv.n_reclamos >= :minimo
                      {gsql.replace('grupo', 'mv.grupo')}
                      {ssql.replace('sectorid', 'mv.sectorid')}
                    ORDER BY mv.n_reclamos DESC, mv.creado_en DESC
                    LIMIT :limite
                    """
                ),
                {"minimo": minimo, "limite": limite, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Parentesco ----------------

    async def parentesco_split(
        self, grupo: str | None = None, sectorid: int | None = None
    ) -> list[dict[str, Any]]:
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT p.nombre AS parentesco, COUNT(*) AS n
                    FROM gota.reclamo r
                    JOIN gota.catalogo_parentesco p ON p.parentesco_id = r.parentesco_id
                    JOIN gota.mv_incidente_enriquecido mv ON mv.incidente_id = r.incidente_id
                    WHERE 1=1
                      {gsql.replace('grupo', 'mv.grupo')}
                      {ssql.replace('sectorid', 'mv.sectorid')}
                    GROUP BY p.nombre
                    ORDER BY n DESC
                    """
                ),
                {**gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Tortas (tipo_grupo / tipo_atencion) ----------------

    async def tipo_grupo_split(self, sectorid: int | None = None) -> list[dict[str, Any]]:
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    SELECT grupo AS etiqueta, COUNT(*) AS n
                    FROM gota.mv_incidente_enriquecido
                    WHERE 1=1 {ssql}
                    GROUP BY grupo
                    ORDER BY n DESC
                    """
                ),
                sparams,
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def tipo_atencion_split(
        self, grupo: str | None = None, sectorid: int | None = None, top_n: int = 6
    ) -> list[dict[str, Any]]:
        """Snapshot (no por mes, a diferencia de tipo_atencion_mensual_stacked) —
        top N tipo_atencion + resto agrupado como 'Otros', mismo criterio que la
        versión mensual para no mostrar una torta con demasiadas porciones chicas."""
        gsql, gparams = await self._filtro_grupo_sql(grupo)
        ssql, sparams = await self._filtro_sector_sql(sectorid)
        rows = (
            await self._session.execute(
                text(
                    f"""
                    WITH top_tipos AS (
                        SELECT tipo_atencion, COUNT(*) AS n
                        FROM gota.mv_incidente_enriquecido
                        WHERE 1=1 {gsql} {ssql}
                        GROUP BY tipo_atencion
                        ORDER BY n DESC LIMIT :top_n
                    )
                    SELECT
                        CASE WHEN t.tipo_atencion IS NULL THEN 'Otros' ELSE mv.tipo_atencion END AS etiqueta,
                        COUNT(*) AS n
                    FROM gota.mv_incidente_enriquecido mv
                    LEFT JOIN top_tipos t USING (tipo_atencion)
                    WHERE 1=1 {gsql} {ssql}
                    GROUP BY etiqueta
                    ORDER BY n DESC
                    """
                ),
                {"top_n": top_n, **gparams, **sparams},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Robos por distrito ----------------

    async def robos_por_distrito(self, limite: int = 5) -> list[dict[str, Any]]:
        """Mismo origen de datos que serie_robos_mensual (gota.reclamo WHERE
        es_robo=true) — no mezclar con reclamo_sin_suministro (166 filas reales,
        pero sin incidente_id ni sig_distritoid resuelto, forma de dato distinta;
        se deja fuera a propósito, ver plan de esta feature)."""
        rows = (
            await self._session.execute(
                text(
                    """
                    SELECT d.distritoid, d.distrito, COUNT(*) AS n_robos
                    FROM gota.mv_incidente_enriquecido mv
                    JOIN gota.incidente i ON i.incidente_id = mv.incidente_id
                    LEFT JOIN sig.distritos d ON d.distritoid = mv.sig_distritoid
                    WHERE i.es_robo = true
                    GROUP BY d.distritoid, d.distrito
                    ORDER BY n_robos DESC
                    LIMIT :limite
                    """
                ),
                {"limite": limite},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Regresión / predicción ----------------

    async def regresion_sectores(self, meses_lookback: int = 6) -> list[dict[str, Any]]:
        """Regresión lineal simple sobre los últimos N meses por sector."""
        rows = (
            await self._session.execute(
                text(
                    """
                    WITH mensual AS (
                        SELECT
                            mv.sectorid,
                            EXTRACT(EPOCH FROM date_trunc('month', creado_en))::float AS t,
                            COUNT(*)::float AS n
                        FROM gota.mv_incidente_enriquecido mv
                        WHERE mv.creado_en >= now() - (:lookback * interval '1 month')
                          AND mv.sectorid IS NOT NULL
                        GROUP BY mv.sectorid, date_trunc('month', creado_en)
                    ),
                    regr AS (
                        SELECT
                            sectorid,
                            regr_slope(n, t)     AS pendiente,
                            regr_intercept(n, t) AS intercepto,
                            AVG(n)               AS promedio,
                            COUNT(*)             AS puntos
                        FROM mensual
                        GROUP BY sectorid
                        HAVING COUNT(*) >= 3
                    )
                    SELECT r.sectorid, s.sector,
                           r.pendiente, r.intercepto, r.promedio, r.puntos,
                           GREATEST(
                             ROUND(r.intercepto + r.pendiente *
                                   EXTRACT(EPOCH FROM (now() + interval '1 month')))::int, 0
                           ) AS pred_proximo_mes,
                           CASE WHEN r.promedio > 0
                                THEN ROUND((r.pendiente * 60 * 60 * 24 * 30 / r.promedio * 100)::numeric, 2)
                                ELSE 0
                           END::float AS cambio_pct_mensual
                    FROM regr r
                    LEFT JOIN sig.sectores s ON s.sectorid = r.sectorid
                    ORDER BY r.pendiente DESC
                    """
                ),
                {"lookback": meses_lookback},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    # ---------------- Alertas semáforo ----------------

    async def alertas_backlog_critico(self, min_tickets: int = 10, min_dias: int = 7):
        rows = (
            await self._session.execute(
                text(
                    """
                    SELECT s.sector, s.sectorid, COUNT(*) AS n
                    FROM gota.mv_incidente_enriquecido mv
                    JOIN sig.sectores s USING (sectorid)
                    WHERE mv.sin_solucion
                      AND EXTRACT(DAY FROM (now() - mv.creado_en)) > :min_dias
                    GROUP BY s.sector, s.sectorid
                    HAVING COUNT(*) >= :min_tickets
                    ORDER BY n DESC LIMIT 5
                    """
                ),
                {"min_tickets": min_tickets, "min_dias": min_dias},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def alertas_reincidencia_alta(self, meses: int = 3, minimo: int = 5):
        rows = (
            await self._session.execute(
                text(
                    """
                    SELECT suministro_codigo, COUNT(*) AS n
                    FROM gota.mv_incidente_enriquecido
                    WHERE creado_en >= now() - (:meses * interval '1 month')
                      AND suministro_codigo IS NOT NULL AND suministro_codigo != '99999999'
                    GROUP BY suministro_codigo
                    HAVING COUNT(*) >= :minimo
                    ORDER BY n DESC LIMIT 5
                    """
                ),
                {"meses": meses, "minimo": minimo},
            )
        ).mappings().all()
        return [dict(r) for r in rows]

    async def alertas_tendencia_favorable(self):
        """Tiempo de resolución mejorando en las últimas semanas."""
        rows = (
            await self._session.execute(
                text(
                    """
                    WITH semanas AS (
                        SELECT date_trunc('week', creado_en) AS s,
                               AVG(dias_hasta_solucion)::float AS t
                        FROM gota.mv_incidente_enriquecido
                        WHERE dias_hasta_solucion IS NOT NULL
                          AND creado_en >= now() - interval '6 weeks'
                        GROUP BY 1 ORDER BY 1
                    ),
                    con_lag AS (
                        SELECT s, t, LAG(t) OVER (ORDER BY s) AS prev_t FROM semanas
                    )
                    SELECT COUNT(*) FILTER (WHERE t < prev_t)  AS mejoras,
                           COUNT(*) FILTER (WHERE prev_t IS NOT NULL) AS total
                    FROM con_lag
                    """
                )
            )
        ).mappings().first()
        return dict(rows) if rows else {"mejoras": 0, "total": 0}
