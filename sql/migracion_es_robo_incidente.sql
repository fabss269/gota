-- Mueve es_robo de gota.reclamo (por reclamo individual) a gota.incidente (por
-- incidente) — es una propiedad del incidente, no puede variar entre reclamos
-- del mismo incidente. Escrita por Fabiana 2026-08-11, código ya actualizado en
-- el commit 0ed21f9 (app/db/models_propia.py, dashboard_geo/repository.py,
-- incidencias/service.py) — este script es lo que falta correr contra cada BD
-- para que ese código funcione (sin esto, cualquier SELECT sobre Incidente
-- rompe: el modelo ORM ya declara la columna `es_robo` que la tabla real
-- todavía no tiene).
BEGIN;

-- Fase 1: agregar columna nueva a `incidente` (nullable temporalmente)
ALTER TABLE gota.incidente ADD COLUMN es_robo boolean;

-- Fase 2: backfill desde `reclamo` — OR de todos los reclamos del incidente
-- (si alguna vez alguien lo reportó como robo, queda TRUE)
UPDATE gota.incidente i SET es_robo = (
    SELECT bool_or(r.es_robo) FROM gota.reclamo r WHERE r.incidente_id = i.incidente_id
);

-- Fase 3: incidentes sin reclamos quedan es_robo = FALSE
UPDATE gota.incidente SET es_robo = false WHERE es_robo IS NULL;

-- Fase 4: default + NOT NULL en `incidente.es_robo`
ALTER TABLE gota.incidente
    ALTER COLUMN es_robo SET DEFAULT false,
    ALTER COLUMN es_robo SET NOT NULL;

-- Fase 5: eliminar columnas de `reclamo`
ALTER TABLE gota.reclamo
    DROP COLUMN es_robo,
    DROP COLUMN distrito;

COMMIT;
