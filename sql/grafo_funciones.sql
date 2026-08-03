-- ============================================================================
-- Grafo hidráulico — funciones de simulación de fallas y detección de focos
-- ============================================================================
-- Fuente de diseño: ~/Documentos/grafos_catastro_epsel.md (sección 9), adaptado:
-- namespace `gota.` en vez de `sig.` — estas funciones son nuestras (viven en el
-- esquema que administramos), aunque su cuerpo lea tablas de `sig` (CONHYDRA,
-- solo lectura) vía cross-schema dentro de la misma BD `bd_conhydra`. Nunca se
-- escribe DDL en `sig` directamente.
--
-- Aplicar una sola vez (y de nuevo si se edita este archivo) contra la BD real:
--   psql -h <host> -U postgres -d bd_conhydra -f sql/grafo_funciones.sql
-- (local: bd_conhydra_local; producción: ver deploy/PRODUCTION_DEPLOY.md)
--
-- Alcance: cálculo on-demand en cada request, sin persistencia de focos ni job
-- programado (documento §8.6.9-8.6.10) — no implementado en esta primera versión.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) simular_atoro_tramo — BFS reverso desde buzonsalidaid del tramo (desagüe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_atoro_tramo(
    p_tramo_id INTEGER,
    p_niveles_max INTEGER DEFAULT 30
)
RETURNS TABLE (
    suministro       VARCHAR(8),
    cajadesagueid    INTEGER,
    tramo_receptor   INTEGER,
    nivel            INTEGER,
    horas_estimadas  INTEGER,
    prioridad        VARCHAR(10)
) LANGUAGE sql AS $$
    WITH RECURSIVE arriba AS (
        SELECT alcantarilladoid AS tramo,
               buzonsalidaid    AS bs,
               0                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE alcantarilladoid = p_tramo_id

        UNION

        SELECT a.alcantarilladoid, a.buzonsalidaid, ar.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN arriba ar ON a.buzonllegadaid = ar.bs
        WHERE ar.nivel < p_niveles_max
          AND a.buzonsalidaid IS NOT NULL
    )
    SELECT DISTINCT
        cd.inscripcion,
        cd.cajadesagueid,
        MIN(ar.tramo) AS tramo_receptor,
        MIN(ar.nivel) AS nivel,
        CASE
            WHEN MIN(ar.nivel) <= 1 THEN 4
            WHEN MIN(ar.nivel) <= 3 THEN 12
            ELSE 24
        END AS horas_estimadas,
        CASE
            WHEN MIN(ar.nivel) <= 1 THEN 'ALTA'
            WHEN MIN(ar.nivel) <= 3 THEN 'MEDIA'
            ELSE 'BAJA'
        END AS prioridad
    FROM arriba ar
    JOIN sig.cajadesagueconexion cdc ON cdc.alcantarilladoid = ar.tramo
    JOIN sig.cajadesague cd          ON cd.cajadesagueid = cdc.cajadesagueid
    WHERE cd.inscripcion IS NOT NULL
      AND cd.inscripcion NOT IN ('99999999','00000000')
    GROUP BY cd.inscripcion, cd.cajadesagueid
    ORDER BY nivel ASC;
$$;

-- ----------------------------------------------------------------------------
-- 1b) simular_atoro_tramo_red — mismo BFS que (1), sin colapsar por suministro:
--     devuelve cada tramo/buzón recorrido para pintar la red completa en rojo
--     en modo vista (frontend).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_atoro_tramo_red(
    p_tramo_id INTEGER,
    p_niveles_max INTEGER DEFAULT 30
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE arriba AS (
        SELECT alcantarilladoid AS tramo,
               buzonsalidaid    AS bs,
               buzonllegadaid   AS bll,
               0                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE alcantarilladoid = p_tramo_id

        UNION

        SELECT a.alcantarilladoid, a.buzonsalidaid, a.buzonllegadaid, ar.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN arriba ar ON a.buzonllegadaid = ar.bs
        WHERE ar.nivel < p_niveles_max
          AND a.buzonsalidaid IS NOT NULL
    )
    SELECT elemento_tipo, elemento_id, MIN(nivel) AS nivel
    FROM (
        SELECT 'tramo'::varchar(15) AS elemento_tipo, tramo AS elemento_id, nivel FROM arriba
        UNION ALL
        SELECT 'buzon', bs, nivel FROM arriba WHERE bs IS NOT NULL
        UNION ALL
        SELECT 'buzon', bll, nivel FROM arriba WHERE bll IS NOT NULL
    ) todos
    GROUP BY elemento_tipo, elemento_id
    ORDER BY nivel;
$$;

-- ----------------------------------------------------------------------------
-- 2) simular_colapso_buzon — BFS reverso desde todos los tramos que descargan
--    al buzón colapsado (desagüe)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_colapso_buzon(
    p_buzon_id INTEGER,
    p_niveles_max INTEGER DEFAULT 30
)
RETURNS TABLE (
    suministro       VARCHAR(8),
    cajadesagueid    INTEGER,
    tramo_afectado   INTEGER,
    nivel            INTEGER,
    horas_estimadas  INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE arriba AS (
        SELECT alcantarilladoid AS tramo,
               buzonsalidaid    AS bs,
               1                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE buzonllegadaid = p_buzon_id
          AND buzonsalidaid IS NOT NULL

        UNION

        SELECT a.alcantarilladoid, a.buzonsalidaid, ar.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN arriba ar ON a.buzonllegadaid = ar.bs
        WHERE ar.nivel < p_niveles_max
          AND a.buzonsalidaid IS NOT NULL
    )
    SELECT DISTINCT
        cd.inscripcion,
        cd.cajadesagueid,
        MIN(ar.tramo)  AS tramo_afectado,
        MIN(ar.nivel)  AS nivel,
        CASE
            WHEN MIN(ar.nivel) <= 1 THEN 4
            WHEN MIN(ar.nivel) <= 3 THEN 12
            ELSE 24
        END AS horas_estimadas
    FROM arriba ar
    JOIN sig.cajadesagueconexion cdc ON cdc.alcantarilladoid = ar.tramo
    JOIN sig.cajadesague cd          ON cd.cajadesagueid = cdc.cajadesagueid
    WHERE cd.inscripcion IS NOT NULL
      AND cd.inscripcion NOT IN ('99999999','00000000')
    GROUP BY cd.inscripcion, cd.cajadesagueid
    ORDER BY nivel ASC;
$$;

-- ----------------------------------------------------------------------------
-- 2b) simular_colapso_buzon_red — red completa recorrida (para modo vista)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_colapso_buzon_red(
    p_buzon_id INTEGER,
    p_niveles_max INTEGER DEFAULT 30
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE arriba AS (
        SELECT alcantarilladoid AS tramo,
               buzonsalidaid    AS bs,
               buzonllegadaid   AS bll,
               1                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE buzonllegadaid = p_buzon_id
          AND buzonsalidaid IS NOT NULL

        UNION

        SELECT a.alcantarilladoid, a.buzonsalidaid, a.buzonllegadaid, ar.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN arriba ar ON a.buzonllegadaid = ar.bs
        WHERE ar.nivel < p_niveles_max
          AND a.buzonsalidaid IS NOT NULL
    )
    SELECT elemento_tipo, elemento_id, MIN(nivel) AS nivel
    FROM (
        SELECT 'buzon'::varchar(15) AS elemento_tipo, p_buzon_id AS elemento_id, 0 AS nivel
        UNION ALL
        SELECT 'tramo', tramo, nivel FROM arriba
        UNION ALL
        SELECT 'buzon', bs, nivel FROM arriba WHERE bs IS NOT NULL
        UNION ALL
        SELECT 'buzon', bll, nivel FROM arriba WHERE bll IS NOT NULL
    ) todos
    GROUP BY elemento_tipo, elemento_id
    ORDER BY nivel;
$$;

-- ----------------------------------------------------------------------------
-- 3) simular_falla_conexion — consulta directa, sin BFS (desagüe, solo predio)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_falla_conexion(
    p_cajadesague_id INTEGER
)
RETURNS TABLE (
    suministro    VARCHAR(8),
    cajadesagueid INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    SELECT
        cd.inscripcion,
        cd.cajadesagueid,
        0 AS nivel
    FROM sig.cajadesague cd
    WHERE cd.cajadesagueid = p_cajadesague_id
      AND cd.inscripcion IS NOT NULL
      AND cd.inscripcion NOT IN ('99999999','00000000');
$$;

-- ----------------------------------------------------------------------------
-- 3b) simular_falla_conexion_red — sin BFS, la red afectada es el elemento
--     mismo (mismo criterio que la función base).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_falla_conexion_red(
    p_cajadesague_id INTEGER
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    SELECT 'cajadesague'::varchar(15), p_cajadesague_id, 0;
$$;

-- ----------------------------------------------------------------------------
-- 4) simular_tapa_faltante — BFS directo (aguas abajo) desde el buzón sin tapa
--    (desagüe). Corregida 2026-08-03: la versión original no resolvía
--    suministro/caja (solo tramo/riesgo), por lo que
--    service.py::simular()'s `if "suministro" in f` la descartaba siempre
--    (devolvía [] para tapa_faltante) — se agrega el mismo join a
--    cajadesagueconexion/cajadesague que ya usa simular_atoro_tramo, y
--    riesgo(ALTO/MEDIO/BAJO) pasa a prioridad(ALTA/MEDIA/BAJA) para
--    coincidir con AfectadoOut.prioridad.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_tapa_faltante(
    p_buzon_id INTEGER,
    p_niveles_max INTEGER DEFAULT 10
)
RETURNS TABLE (
    suministro       VARCHAR(8),
    cajadesagueid    INTEGER,
    tramo_afectado   INTEGER,
    nivel            INTEGER,
    horas_estimadas  INTEGER,
    prioridad        VARCHAR(10),
    tipo_impacto     VARCHAR(50)
) LANGUAGE sql AS $$
    WITH RECURSIVE abajo AS (
        SELECT alcantarilladoid AS tramo,
               buzonllegadaid   AS bll,
               1                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE buzonsalidaid = p_buzon_id
          AND buzonllegadaid IS NOT NULL

        UNION

        SELECT a.alcantarilladoid, a.buzonllegadaid, ab.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN abajo ab ON a.buzonsalidaid = ab.bll
        WHERE ab.nivel < p_niveles_max
          AND a.buzonllegadaid IS NOT NULL
    )
    SELECT DISTINCT
        cd.inscripcion,
        cd.cajadesagueid,
        MIN(ab.tramo) AS tramo_afectado,
        MIN(ab.nivel) AS nivel,
        CASE
            WHEN MIN(ab.nivel) = 1 THEN 4
            WHEN MIN(ab.nivel) <= 3 THEN 12
            ELSE 24
        END AS horas_estimadas,
        CASE
            WHEN MIN(ab.nivel) = 1 THEN 'ALTA'
            WHEN MIN(ab.nivel) <= 3 THEN 'MEDIA'
            ELSE 'BAJA'
        END AS prioridad,
        CASE
            WHEN MIN(ab.nivel) = 1 THEN 'Basura acumulada directamente'
            WHEN MIN(ab.nivel) <= 3 THEN 'Riesgo de atoro aguas abajo'
            ELSE 'Sobrecarga en lluvia'
        END AS tipo_impacto
    FROM abajo ab
    JOIN sig.cajadesagueconexion cdc ON cdc.alcantarilladoid = ab.tramo
    JOIN sig.cajadesague cd          ON cd.cajadesagueid = cdc.cajadesagueid
    WHERE cd.inscripcion IS NOT NULL
      AND cd.inscripcion NOT IN ('99999999','00000000')
    GROUP BY cd.inscripcion, cd.cajadesagueid
    ORDER BY nivel ASC;
$$;

-- ----------------------------------------------------------------------------
-- 4b) simular_tapa_faltante_red — red completa recorrida (para modo vista)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_tapa_faltante_red(
    p_buzon_id INTEGER,
    p_niveles_max INTEGER DEFAULT 10
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE abajo AS (
        SELECT alcantarilladoid AS tramo,
               buzonllegadaid   AS bll,
               1                AS nivel
        FROM sig.mv_alcantarillado_dirigido
        WHERE buzonsalidaid = p_buzon_id
          AND buzonllegadaid IS NOT NULL

        UNION

        SELECT a.alcantarilladoid, a.buzonllegadaid, ab.nivel + 1
        FROM sig.mv_alcantarillado_dirigido a
        JOIN abajo ab ON a.buzonsalidaid = ab.bll
        WHERE ab.nivel < p_niveles_max
          AND a.buzonllegadaid IS NOT NULL
    )
    SELECT elemento_tipo, elemento_id, MIN(nivel) AS nivel
    FROM (
        SELECT 'buzon'::varchar(15) AS elemento_tipo, p_buzon_id AS elemento_id, 0 AS nivel
        UNION ALL
        SELECT 'tramo', tramo, nivel FROM abajo
        UNION ALL
        SELECT 'buzon', bll, nivel FROM abajo WHERE bll IS NOT NULL
    ) todos
    GROUP BY elemento_tipo, elemento_id
    ORDER BY nivel;
$$;

-- ----------------------------------------------------------------------------
-- 5) simular_fuga_tuberia — BFS bidireccional (grafo no dirigido, agua)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_fuga_tuberia(
    p_tuberia_id INTEGER,
    p_niveles_max INTEGER DEFAULT 15
)
RETURNS TABLE (
    suministro       VARCHAR(8),
    cajaaguaid       INTEGER,
    tuberia_conexion INTEGER,
    nivel            INTEGER,
    tipo_afectacion  VARCHAR(30)
) LANGUAGE sql AS $$
    WITH RECURSIVE red_afectada AS (
        SELECT aguaid, 0 AS nivel
        FROM sig.agua
        WHERE aguaid = p_tuberia_id

        UNION

        SELECT DISTINCT a2.aguaid, ra.nivel + 1
        FROM red_afectada ra
        JOIN sig.aguaaccesorios aa1 ON aa1.aguaid = ra.aguaid
        JOIN sig.aguaaccesorios aa2 ON aa2.accesorioid = aa1.accesorioid
        JOIN sig.agua a2 ON a2.aguaid = aa2.aguaid
        WHERE a2.aguaid <> ra.aguaid
          AND ra.nivel < p_niveles_max
    )
    SELECT DISTINCT
        ca.inscripcion,
        ca.cajaaguaid,
        MIN(ra.aguaid) AS tuberia_conexion,
        MIN(ra.nivel)  AS nivel,
        CASE
            WHEN MIN(ra.nivel) = 0 THEN 'sin_agua_directo'
            WHEN MIN(ra.nivel) <= 2 THEN 'sin_agua_probable'
            ELSE 'baja_presion'
        END AS tipo_afectacion
    FROM red_afectada ra
    JOIN sig.cajaaguaconexion cac ON cac.aguaid = ra.aguaid
    JOIN sig.cajaagua ca          ON ca.cajaaguaid = cac.cajaaguaid
    WHERE ca.inscripcion IS NOT NULL
      AND ca.inscripcion NOT IN ('99999999','00000000')
    GROUP BY ca.inscripcion, ca.cajaaguaid
    ORDER BY nivel ASC;
$$;

-- ----------------------------------------------------------------------------
-- 5b) simular_fuga_tuberia_red — red completa recorrida (tuberías + accesorios
--     de paso) para modo vista.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_fuga_tuberia_red(
    p_tuberia_id INTEGER,
    p_niveles_max INTEGER DEFAULT 15
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE red_afectada AS (
        SELECT aguaid, NULL::integer AS accesorioid, 0 AS nivel
        FROM sig.agua
        WHERE aguaid = p_tuberia_id

        UNION

        SELECT DISTINCT a2.aguaid, aa1.accesorioid, ra.nivel + 1
        FROM red_afectada ra
        JOIN sig.aguaaccesorios aa1 ON aa1.aguaid = ra.aguaid
        JOIN sig.aguaaccesorios aa2 ON aa2.accesorioid = aa1.accesorioid
        JOIN sig.agua a2 ON a2.aguaid = aa2.aguaid
        WHERE a2.aguaid <> ra.aguaid
          AND ra.nivel < p_niveles_max
    )
    SELECT elemento_tipo, elemento_id, MIN(nivel) AS nivel
    FROM (
        SELECT 'tuberia'::varchar(15) AS elemento_tipo, aguaid AS elemento_id, nivel FROM red_afectada
        UNION ALL
        SELECT 'accesorio', accesorioid, nivel FROM red_afectada WHERE accesorioid IS NOT NULL
    ) todos
    GROUP BY elemento_tipo, elemento_id
    ORDER BY nivel;
$$;

-- ----------------------------------------------------------------------------
-- 6) detectar_focos_activos_desague — agrupación por tramo receptor común
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.detectar_focos_activos_desague(
    p_dias_ventana INTEGER DEFAULT 7,
    p_min_reclamos INTEGER DEFAULT 3
)
RETURNS TABLE (
    tramo_id       INTEGER,
    n_reclamos     INTEGER,
    n_suministros  INTEGER,
    primer_ticket  TIMESTAMP,
    ultimo_ticket  TIMESTAMP,
    dias_activo    NUMERIC,
    tipo_dominante VARCHAR(60)
) LANGUAGE sql AS $$
    WITH tickets_recientes AS (
        SELECT
            r.reclamo_id,
            r.fecha_registro,
            i.suministro_codigo AS suministro,
            i.tipo_atencion_id,
            ta.nombre AS tipo_atencion,
            cdc.alcantarilladoid AS tramo_id
        FROM gota.reclamo r
        JOIN gota.incidente i ON i.incidente_id = r.incidente_id
        JOIN gota.catalogo_tipo_atencion ta USING (tipo_atencion_id)
        JOIN sig.cajadesague cd ON cd.inscripcion = i.suministro_codigo
        JOIN sig.cajadesagueconexion cdc ON cdc.cajadesagueid = cd.cajadesagueid
        WHERE r.fecha_registro >= NOW() - (p_dias_ventana || ' days')::interval
          AND ta.nombre ILIKE 'ATORO%'
    )
    SELECT
        tramo_id,
        COUNT(*)::int              AS n_reclamos,
        COUNT(DISTINCT suministro)::int AS n_suministros,
        MIN(fecha_registro)        AS primer_ticket,
        MAX(fecha_registro)        AS ultimo_ticket,
        ROUND(EXTRACT(EPOCH FROM MAX(fecha_registro) - MIN(fecha_registro))/86400.0, 1) AS dias_activo,
        MODE() WITHIN GROUP (ORDER BY tipo_atencion) AS tipo_dominante
    FROM tickets_recientes
    GROUP BY tramo_id
    HAVING COUNT(*) >= p_min_reclamos
    ORDER BY n_reclamos DESC;
$$;

-- ----------------------------------------------------------------------------
-- 7) detectar_focos_activos_agua — análogo, cruzando por cajaaguaconexion
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.detectar_focos_activos_agua(
    p_dias_ventana INTEGER DEFAULT 7,
    p_min_reclamos INTEGER DEFAULT 3
)
RETURNS TABLE (
    tuberia_id     INTEGER,
    n_reclamos     INTEGER,
    n_suministros  INTEGER,
    primer_ticket  TIMESTAMP,
    ultimo_ticket  TIMESTAMP,
    tipo_dominante VARCHAR(60)
) LANGUAGE sql AS $$
    WITH tickets_recientes AS (
        SELECT
            r.reclamo_id,
            r.fecha_registro,
            i.suministro_codigo AS suministro,
            ta.nombre AS tipo_atencion,
            cac.aguaid AS tuberia_id
        FROM gota.reclamo r
        JOIN gota.incidente i ON i.incidente_id = r.incidente_id
        JOIN gota.catalogo_tipo_atencion ta USING (tipo_atencion_id)
        JOIN sig.cajaagua ca ON ca.inscripcion = i.suministro_codigo
        JOIN sig.cajaaguaconexion cac ON cac.cajaaguaid = ca.cajaaguaid
        WHERE r.fecha_registro >= NOW() - (p_dias_ventana || ' days')::interval
          AND (ta.nombre ILIKE 'FUGA%' OR ta.nombre IN ('BAJA PRESION','FALTA DE AGUA'))
    )
    SELECT
        tuberia_id,
        COUNT(*)::int,
        COUNT(DISTINCT suministro)::int,
        MIN(fecha_registro),
        MAX(fecha_registro),
        MODE() WITHIN GROUP (ORDER BY tipo_atencion)
    FROM tickets_recientes
    GROUP BY tuberia_id
    HAVING COUNT(*) >= p_min_reclamos
    ORDER BY 2 DESC;
$$;

-- ----------------------------------------------------------------------------
-- 8) simular_fuga_accesorio — BFS bidireccional desde un accesorio (agua) —
--    "herramienta" del pedido del usuario 2026-08-03 (válvulas/codos/tees,
--    sig.accesorios). Misma mecánica que simular_fuga_tuberia, sembrada desde
--    todas las tuberías que tocan el accesorio en vez de una sola tubería.
--    Todo accesorio se trata como nodo de paso (peor caso): no hay forma de
--    distinguir válvulas activas de uniones pasivas en los datos migrados —
--    sig.accesoriotipos no tiene tipo "Válvula", situacion/estado son
--    idénticos en las 20,374 filas (ver ~/Documentos/grafos_catastro_epsel.md
--    §3.7, §6.3: los datos reales de válvulas están solo en el shapefile
--    accesoriosficha_agua.shp, nunca migrados a Postgres).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_fuga_accesorio(
    p_accesorio_id INTEGER,
    p_niveles_max INTEGER DEFAULT 15
)
RETURNS TABLE (
    suministro       VARCHAR(8),
    cajaaguaid       INTEGER,
    tuberia_conexion INTEGER,
    nivel            INTEGER,
    tipo_afectacion  VARCHAR(30)
) LANGUAGE sql AS $$
    WITH RECURSIVE red_afectada AS (
        SELECT aa0.aguaid, 0 AS nivel
        FROM sig.aguaaccesorios aa0
        WHERE aa0.accesorioid = p_accesorio_id

        UNION

        SELECT DISTINCT a2.aguaid, ra.nivel + 1
        FROM red_afectada ra
        JOIN sig.aguaaccesorios aa1 ON aa1.aguaid = ra.aguaid
        JOIN sig.aguaaccesorios aa2 ON aa2.accesorioid = aa1.accesorioid
        JOIN sig.agua a2 ON a2.aguaid = aa2.aguaid
        WHERE a2.aguaid <> ra.aguaid
          AND ra.nivel < p_niveles_max
    )
    SELECT DISTINCT
        ca.inscripcion,
        ca.cajaaguaid,
        MIN(ra.aguaid) AS tuberia_conexion,
        MIN(ra.nivel)  AS nivel,
        CASE
            WHEN MIN(ra.nivel) = 0 THEN 'sin_agua_directo'
            WHEN MIN(ra.nivel) <= 2 THEN 'sin_agua_probable'
            ELSE 'baja_presion'
        END AS tipo_afectacion
    FROM red_afectada ra
    JOIN sig.cajaaguaconexion cac ON cac.aguaid = ra.aguaid
    JOIN sig.cajaagua ca          ON ca.cajaaguaid = cac.cajaaguaid
    WHERE ca.inscripcion IS NOT NULL
      AND ca.inscripcion NOT IN ('99999999','00000000')
    GROUP BY ca.inscripcion, ca.cajaaguaid
    ORDER BY nivel ASC;
$$;

-- ----------------------------------------------------------------------------
-- 8b) simular_fuga_accesorio_red — red completa recorrida (para modo vista)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION gota.simular_fuga_accesorio_red(
    p_accesorio_id INTEGER,
    p_niveles_max INTEGER DEFAULT 15
)
RETURNS TABLE (
    elemento_tipo VARCHAR(15),
    elemento_id   INTEGER,
    nivel         INTEGER
) LANGUAGE sql AS $$
    WITH RECURSIVE red_afectada AS (
        SELECT aa0.aguaid, NULL::integer AS accesorioid, 0 AS nivel
        FROM sig.aguaaccesorios aa0
        WHERE aa0.accesorioid = p_accesorio_id

        UNION

        SELECT DISTINCT a2.aguaid, aa1.accesorioid, ra.nivel + 1
        FROM red_afectada ra
        JOIN sig.aguaaccesorios aa1 ON aa1.aguaid = ra.aguaid
        JOIN sig.aguaaccesorios aa2 ON aa2.accesorioid = aa1.accesorioid
        JOIN sig.agua a2 ON a2.aguaid = aa2.aguaid
        WHERE a2.aguaid <> ra.aguaid
          AND ra.nivel < p_niveles_max
    )
    SELECT elemento_tipo, elemento_id, MIN(nivel) AS nivel
    FROM (
        SELECT 'accesorio'::varchar(15) AS elemento_tipo, p_accesorio_id AS elemento_id, 0 AS nivel
        UNION ALL
        SELECT 'tuberia', aguaid, nivel FROM red_afectada
        UNION ALL
        SELECT 'accesorio', accesorioid, nivel FROM red_afectada WHERE accesorioid IS NOT NULL
    ) todos
    GROUP BY elemento_tipo, elemento_id
    ORDER BY nivel;
$$;
