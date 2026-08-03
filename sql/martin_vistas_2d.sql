-- ============================================================================
-- Vistas 2D para Martin — workaround de un bug real de PostGIS/ST_AsMVTGeom
-- ============================================================================
-- Encontrado en vivo 2026-08-03: el frontend recibía 500 en tiles puntuales de
-- `alcantarillado` (ej. z13/x2279/y4249) con este error de Postgres/PostGIS:
--   lwcollection_construct: mixed dimension geometries: 2/0
--
-- Causa raíz aislada con un wrapper plpgsql que capturó la excepción por fila
-- (ver conversación 2026-08-03): `sig.alcantarillado.geom` es MultiLineStringZ,
-- y en filas con Z=0 (la inmensa mayoría de la tabla — ver conteo abajo), al
-- recortar/cuantizar la geometría al grid del tile en cierto zoom/posición,
-- ST_AsMVTGeom construye internamente una colección con dimensiones mixtas y
-- falla. Confirmado con alcantarilladoid 311 (duplicado en 8, mismo
-- codigo='FID_046085'), geometría válida y simple a resolución completa
-- (ST_IsValid/ST_IsSimple = true) — el bug es solo del paso de recorte/cuantización
-- de ST_AsMVTGeom con Z, no un dato corrupto.
--
-- La Z no se usa en el mapa 2D (MapView.web.tsx / MapLibre) y en ambas tablas es
-- casi siempre 0, así que ST_Force2D(geom) es seguro y no pierde información
-- relevante:
--   agua:            254 / 25401 filas con Z≠0
--   alcantarillado:    0 / 30815 filas con Z≠0
--
-- Probado también con ST_RemoveRepeatedPoints y ST_SimplifyPreserveTopology antes
-- de ST_AsMVTGeom — ninguno de los dos evitó el error; solo ST_Force2D lo evita.
--
-- Por qué en `gota` y no en `sig`: `sig` es de solo lectura (CONHYDRA) — nunca se
-- escribe DDL ahí directamente, mismo criterio que sql/grafo_funciones.sql. Estas
-- vistas viven en `gota` aunque lean `sig.agua`/`sig.alcantarillado` cross-schema.
--
-- Consumidor: deploy/martin-config.template.yaml (fuentes `agua`/`alcantarillado`
-- apuntan a `gota.agua_2d`/`gota.alcantarillado_2d`, no a las tablas base — el id
-- publicado por Martin no cambia, solo la tabla real detrás).
--
-- Aplicar una sola vez (y de nuevo si se edita este archivo) contra la BD real:
--   psql -h <host> -U postgres -d bd_conhydra -f sql/martin_vistas_2d.sql
-- (local: bd_conhydra_local; producción: ver deploy/PRODUCTION_DEPLOY.md)
--
-- Tras aplicar, reiniciar Martin para que relea las fuentes:
--   docker compose up -d --force-recreate martin
-- ============================================================================

CREATE OR REPLACE VIEW gota.agua_2d AS
SELECT aguaid, ST_Force2D(geom) AS geom, aguatipoid, sectorid
FROM sig.agua;

CREATE OR REPLACE VIEW gota.alcantarillado_2d AS
SELECT alcantarilladoid, ST_Force2D(geom) AS geom, codigo, alcantarilladotipoid,
       materialid, primaria, sectorid, distritoid
FROM sig.alcantarillado;
