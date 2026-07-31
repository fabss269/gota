#!/usr/bin/env bash
# Dump completo (estructura + datos) de la BD local "gota" (schema public, versión
# vieja/standalone), reescrito para crear TODO dentro de un esquema "gota" — un solo
# archivo autocontenido, no depende de aplicar vp_gota_create.ddl por separado antes.
# Útil para recrear una réplica de "la versión nueva" (esquema, no BD aparte) en
# cualquier Postgres vacío, sin pasos previos.
#
# Distinto de migrate_gota_data.sh (ese es data-only, asume que el esquema `gota`
# ya existe porque se aplicó vp_gota_create.ddl antes — es el que corresponde para
# cargar en bd_conhydra real, donde `gota` se crea vía el DDL canónico, no vía este
# dump). Este script es para clonar/probar en una máquina nueva y vacía.
#
# Uso: ./deploy/dump_gota_as_schema.sh
# Vars opcionales: LOCAL_DB_HOST, LOCAL_DB_PORT, LOCAL_DB_USER, LOCAL_DB_NAME, PGPASSWORD

set -euo pipefail

LOCAL_DB_HOST="${LOCAL_DB_HOST:-127.0.0.1}"
LOCAL_DB_PORT="${LOCAL_DB_PORT:-5432}"
LOCAL_DB_USER="${LOCAL_DB_USER:-postgres}"
LOCAL_DB_NAME="${LOCAL_DB_NAME:-gota}"
OUT_FILE="${OUT_FILE:-gota_schema_full.sql}"

echo "Dump completo (estructura + datos) de ${LOCAL_DB_NAME}.public -> ${OUT_FILE}..."
pg_dump -h "$LOCAL_DB_HOST" -p "$LOCAL_DB_PORT" -U "$LOCAL_DB_USER" -d "$LOCAL_DB_NAME" \
  --no-owner --no-privileges \
  -n public \
  -f "${OUT_FILE}.tmp"

echo "Retargeteando schema public -> gota, y agregando el CREATE SCHEMA..."
{
  echo "CREATE SCHEMA IF NOT EXISTS gota;"
  sed 's/\bpublic\./gota./g' "${OUT_FILE}.tmp"
} > "$OUT_FILE"
rm "${OUT_FILE}.tmp"

echo "Listo: $OUT_FILE"
echo ""
echo "Para recrear en otra máquina (Postgres vacío, sin nada corrido antes):"
echo "  createdb -h <destino> -U postgres <nombre_bd>"
echo "  psql -h <destino> -U postgres -d <nombre_bd> -f $OUT_FILE"
