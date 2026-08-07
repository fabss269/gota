-- Correcciones a aplicar DESPUÉS de restaurar un backup de bd_conhydra tipo
-- `bd_conhydra_2026-08-07.backup` (el que usa Fabiana para cargar datos reales +
-- sus funciones de datamart). Ver deploy/DESPLIEGUE_LOCAL_TUNEL.md.
--
-- 1) sql/martin_vistas_2d.sql ya se corre aparte (recrea gota.agua_2d/
--    alcantarillado_2d con Force2D — necesario para Martin, ver ese archivo).
--
-- 2) Dato sucio real encontrado en sig.sectores: el sectorid=35 venía como
--    "PIMENTEL - SECTOR 08" con distritoid apuntando a Pimentel (2525), pero es
--    geográficamente un sector de Chiclayo. Corrección puntual dada por Edgar
--    2026-08-07 — no es una migración de schema, es un fix de datos de ESTE
--    backup específico (puede no aplicar a un backup futuro si Fabiana ya lo
--    corrige en origen).
update sig.sectores set distritoid = 3437 where sectorid = 35;
update sig.sectores set sector = 'CHICLAYO - SECTOR 08' where sectorid = 35;
