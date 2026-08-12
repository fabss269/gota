-- Precalcula el DISTINCT ON (política "cajaagua primero, fallback cajadesague",
-- ver catastro_enrichment.py) que antes se corría EN VIVO en cada request de
-- listar_suministros_por_sector/mapa_suministro_a_sector. Bug real 2026-08-12,
-- auditado en producción: togglear un sector grande (una provincia entera,
-- ~42 sectores) tardaba 3.6s de punta a punta — EXPLAIN ANALYZE mostró que el
-- DISTINCT ON sobre las ~285k filas combinadas de sig.cajaagua+cajadesague
-- cuesta ~1.3s SIEMPRE, sin importar cuántos sectores se pidan (el filtro por
-- sectorid no se puede aplicar antes del dedup, así que Postgres siempre
-- escanea+ordena la tabla completa). Con esta vista precalculada, el mismo
-- caso baja a ~27ms (47x) — verificado con EXPLAIN ANALYZE local antes de
-- aplicar esto a producción.
--
-- Refresco: diario por cron (madrugada) — cajaagua/cajadesague es catastro
-- comercial que cambia con poca frecuencia, no hace falta en tiempo real.
-- CONCURRENTLY evita bloquear lecturas mientras se refresca (requiere el
-- índice único de abajo).

CREATE MATERIALIZED VIEW IF NOT EXISTS sig.suministro_sector_resuelto AS
SELECT DISTINCT ON (inscripcion) inscripcion, sectorid
FROM (
    SELECT inscripcion, sectorid, 1 AS prio FROM sig.cajaagua
    WHERE inscripcion IS NOT NULL AND inscripcion <> '00000000' AND sectorid IS NOT NULL
    UNION ALL
    SELECT inscripcion, sectorid, 2 AS prio FROM sig.cajadesague
    WHERE inscripcion IS NOT NULL AND inscripcion <> '00000000' AND sectorid IS NOT NULL
) t
ORDER BY inscripcion, prio, sectorid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ssr_inscripcion ON sig.suministro_sector_resuelto (inscripcion);
CREATE INDEX IF NOT EXISTS idx_ssr_sectorid ON sig.suministro_sector_resuelto (sectorid);

-- Para refrescar manualmente (o desde el cron):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY sig.suministro_sector_resuelto;
