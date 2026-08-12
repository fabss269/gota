-- Índices faltantes en sig.cajaagua/cajadesague.sectorid — bug real 2026-08-11,
-- encontrado con EXPLAIN ANALYZE en producción: cada resolución de
-- sector/distrito -> suministro_codigos (catastro_enrichment.listar_suministros_
-- por_sector, usado por GET /incidencias?sectorId=/distritoId=) hacía un Seq Scan
-- completo de ~200k filas en cada tabla (~190ms desperdiciados por request, antes
-- de siquiera tocar gota.incidente). Con el índice, Postgres usa un Index Scan.
CREATE INDEX IF NOT EXISTS idx_cajaagua_sectorid ON sig.cajaagua (sectorid);
CREATE INDEX IF NOT EXISTS idx_cajadesague_sectorid ON sig.cajadesague (sectorid);
