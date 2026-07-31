-- Migra la BD local "gota" (standalone, tablas en public — versión pre-esquema)
-- para que quede organizada igual que producción: todo dentro de un esquema
-- "gota" en la MISMA base de datos. A diferencia de migrate_gota_data.sh /
-- dump_gota_as_schema.sh (que exportan hacia OTRA base/servidor), esto modifica
-- la BD local en el lugar: ALTER TABLE/SEQUENCE ... SET SCHEMA es una operación
-- de metadata (instantánea, no copia filas) — no un dump/restore.
--
-- Correr con un backup fresco a mano (pg_dump -Fc) antes, por las dudas — es
-- reversible (ALTER ... SET SCHEMA public de vuelta) pero es tu BD real.
--
-- Uso: psql -h 127.0.0.1 -U postgres -d gota -f deploy/migrate_local_to_gota_schema.sql

BEGIN;

CREATE SCHEMA IF NOT EXISTS gota;

-- Mover tablas y vistas primero — una secuencia "owned" por una columna
-- serial/identity viaja SOLA junto con su tabla (Postgres no deja moverla
-- aparte, error "cannot move an owned sequence into another schema").
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.relname, c.relkind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
    LOOP
        IF r.relkind = 'r' THEN
            EXECUTE format('ALTER TABLE public.%I SET SCHEMA gota', r.relname);
        ELSE
            EXECUTE format('ALTER VIEW public.%I SET SCHEMA gota', r.relname);
        END IF;
    END LOOP;
END $$;

-- Solo quedan sueltas (sin tabla dueña) las secuencias que sigan en public
-- después de lo anterior — mover esas también, si hay.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'S'
    LOOP
        EXECUTE format('ALTER SEQUENCE public.%I SET SCHEMA gota', r.relname);
    END LOOP;
END $$;

COMMIT;
