#!/usr/bin/env bash
# Migración de datos reales: BD local "gota" (schema public, versión pre-esquema)
# -> dump listo para cargar en el esquema "gota" de bd_conhydra (producción).
#
# Es data-only a propósito: la estructura (23 tablas) ya se aplica en producción
# vía vp_gota_create.ddl (ver deploy/PRODUCTION_DEPLOY.md paso 4) — este script NO
# recrea tablas, solo mueve las filas. Requiere que el esquema `gota` en producción
# esté vacío (recién creado, sin scripts/seed_dev.py corrido ahí todavía — si se
# siembra con datos de prueba antes, esta carga puede chocar con UNIQUE
# constraints de catálogos/usuario).
#
# Corre en esta máquina (donde vive la BD local). El archivo resultante
# (gota_data.sql) se copia luego al servidor con acceso a 172.16.5.222 y se carga
# ahí — ver PRODUCTION_DEPLOY.md.
#
# Uso: ./deploy/migrate_gota_data.sh
# Vars opcionales: LOCAL_DB_HOST, LOCAL_DB_PORT, LOCAL_DB_USER, LOCAL_DB_NAME, PGPASSWORD

set -euo pipefail

LOCAL_DB_HOST="${LOCAL_DB_HOST:-127.0.0.1}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5432}"
LOCAL_DB_USER="${LOCAL_DB_USER:-postgres}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-gota}"
OUT_FILE="${OUT_FILE:-gota_data.sql}"

echo "Dump data-only de ${LOCAL_DB_NAME}.public -> ${OUT_FILE}..."
pg_dump -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
  --data-only --disable-triggers --no-owner --no-privileges \
  -n public \
  -f "$OUT_FILE"

echo "Retargeteando schema public -> gota..."
sed -i 's/\bpublic\./gota./g' "$OUT_FILE"

echo "Listo: $OUT_FILE"
echo "Filas por tabla (para verificar después de cargar en producción):"
psql -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" -c "
  select relname, n_live_tup from pg_stat_user_tables order by n_live_tup desc;"

echo ""
echo "Siguiente paso: copiar $OUT_FILE al servidor con acceso a 172.16.5.222 y cargarlo"
echo "  (ver deploy/PRODUCTION_DEPLOY.md, sección 'Migrar datos reales')."
