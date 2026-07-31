"""Lógica compartida de carga de tickets (normalizados) a la BD propia
(`incidente`, `reclamo`, `estado_incidente_evento` + catálogos).

Usado por `load_tickets_historico.py` (parte de un parquet ya normalizado) y por
`etl_tickets_crudos.py` (parte de un xlsx crudo y normaliza él mismo antes de llamar
acá) — ambos arman un DataFrame con las mismas columnas
(TICKET/ALCANCE/MEDIO_RECEPCION/FECHA_REGISTRO/USUARIO_REGISTRA/DISTRITO/SUMINISTRO/
DIRECCION/PERSONA/DNI/CELULAR/TELEFONO_FIJO/CORREO_ELECTRONICO/PARENTESCO/TIPO_GRUPO/
TIPO_DE_ATENCION/DETALLE_DEL_TICKET/USUARIO_SOLUCIONA/DETALLE_DE_SOLUCION/
FECHA_SOLUCION/problema/direccion_detalle/tecnico/es_robo) y llaman a
`cargar_dataframe(df)`.

Decisiones confirmadas con Edgar 2026-07-30 (no re-derivar, ver memoria de sesión):
- ALCANCE: general -> catalogo_alcance 'masivo', particular -> 'individual'.
- DETALLE_DE_SOLUCION nulo ('SIN_DATO') se trata igual que no-nulo ('ATENDIDO'): el
  ticket sí se resolvió (tiene fecha_solucion), solo falta la nota -> mismo
  estado_resultante ATENDIDO en ambos casos.
- USUARIO_REGISTRA/USUARIO_SOLUCIONA sin cuenta en `usuario` -> se crean con rol
  'tecnico', DNI y password placeholders (no deben poder loguearse con esto, es solo
  para preservar trazabilidad histórica de quién registró/resolvió).
- latitud/longitud de `incidente` se resuelven en la carga vía join
  SUMINISTRO <-> sig.cajaagua/cajadesague.inscripcion (excluye el sentinel
  '00000000').

Idempotente por `incidente.codigo`/`reclamo.ticket_original` (=TICKET): tickets que ya
existen en la BD se saltan — carga progresiva, se puede re-correr sin duplicar.

IMPORTANTE: el túnel a `sig` (ssh.kasqan.com:15432) comparte un límite bajo de
conexiones con sistemas externos de CONHYDRA (visto en vivo: 100 max_connections,
a veces ya casi lleno solo con el contenedor `gota-martin` -pool_size 10- corriendo).
Esta función abre una única conexión a `sig`, hace hasta 2 queries y la cierra. Si
`gota-martin` está corriendo, conviene detenerlo antes (`docker stop gota-martin`) y
levantarlo de nuevo después (`docker start gota-martin`).
"""

import re
import secrets
import unicodedata

import asyncpg
import pandas as pd

from app.core.config import propia_connect_args, settings
from app.core.security import hash_password

# ALCANCE (dataset) -> catalogo_alcance.codigo (ya existente en la BD)
ALCANCE_MAP = {"general": "masivo", "particular": "individual"}

# MEDIO_RECEPCION (dataset) -> catalogo_medio_recepcion.codigo
MEDIO_RECEPCION_MAP = {
    "presencial": "presencial",
    "telefono": "telefono",
    "correo electrónico": "correo-electronico",
    "formulario web": "formulario-web",
    "redes sociales": "redes-sociales",
}
MEDIO_RECEPCION_NOMBRES = {
    "correo-electronico": "Correo electrónico",
    "formulario-web": "Formulario web",
    "redes-sociales": "Redes sociales",
}

# PARENTESCO (dataset, tal como viene) -> catalogo_parentesco.codigo
PARENTESCO_MAP = {
    "TITULAR": "titular",
    "FAMILIAR": "familiar",
    "EXTRAÑO": "extrano",
    "INQUILINO": "inquilino",
}
PARENTESCO_NOMBRES = {"extrano": "Extraño", "inquilino": "Inquilino"}


def slugify(value: str, maxlen: int = 50) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "-", normalized.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:maxlen].rstrip("-")


def username_from_raw(raw: str) -> str:
    return raw.lower()


def nombres_apellidos_from_username(raw: str) -> tuple[str, str]:
    parts = raw.split(".")
    if len(parts) >= 2:
        return parts[0].title(), " ".join(p.title() for p in parts[1:])
    return raw.title(), "Sin apellido"


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    return sqlalchemy_url.replace("postgresql+asyncpg://", "postgresql://")


async def cargar_dataframe(df: pd.DataFrame) -> None:
    """Punto de entrada público: recibe un DataFrame ya normalizado (mismas columnas
    que `tickets_v3_normalizado.parquet`) y lo carga a la BD propia, saltando los
    tickets que ya existen (`incidente.codigo`)."""
    print(f"Filas a procesar: {len(df)}")

    propia = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    try:
        existentes = await propia.fetch("SELECT codigo FROM incidente")
        ya_cargados = {r["codigo"] for r in existentes}
        pendientes = df[~df["TICKET"].isin(ya_cargados)]
        print(f"Tickets ya cargados: {len(ya_cargados)} — pendientes: {len(pendientes)}")
        if pendientes.empty:
            print("Nada que cargar.")
            return

        tipo_grupo_ids = {
            r["codigo"]: r["tipo_grupo_id"]
            for r in await propia.fetch("SELECT codigo, tipo_grupo_id FROM catalogo_tipo_grupo")
        }

        tipo_atencion_ids = await _ensure_tipo_atencion(propia, pendientes, tipo_grupo_ids)
        medio_recepcion_ids = await _ensure_medio_recepcion(propia)
        parentesco_ids = await _ensure_parentesco(propia)
        alcance_ids = {
            r["codigo"]: r["alcance_id"]
            for r in await propia.fetch("SELECT codigo, alcance_id FROM catalogo_alcance")
        }
        estado_ids = {
            r["codigo"]: r["estado_id"]
            for r in await propia.fetch("SELECT codigo, estado_id FROM catalogo_estado")
        }
        motivo_resuelto_id = await propia.fetchval(
            "SELECT motivo_id FROM catalogo_motivo WHERE codigo = 'SE_RESOLVIO'"
        )
        usuario_ids = await _ensure_usuarios(propia, pendientes)

        suministro_geo = await _resolver_geo_sig(pendientes)

        await _cargar(
            propia,
            pendientes,
            tipo_atencion_ids=tipo_atencion_ids,
            medio_recepcion_ids=medio_recepcion_ids,
            parentesco_ids=parentesco_ids,
            alcance_ids=alcance_ids,
            estado_ids=estado_ids,
            motivo_resuelto_id=motivo_resuelto_id,
            usuario_ids=usuario_ids,
            suministro_geo=suministro_geo,
        )
    finally:
        await propia.close()


async def _ensure_tipo_atencion(
    conn: asyncpg.Connection, df: pd.DataFrame, tipo_grupo_ids: dict[str, int]
) -> dict[tuple[str, str], int]:
    pares = (
        df[["TIPO_GRUPO", "TIPO_DE_ATENCION"]]
        .drop_duplicates()
        .itertuples(index=False, name=None)
    )
    result: dict[tuple[str, str], int] = {}
    for tipo_grupo, tipo_atencion in pares:
        grupo_codigo = tipo_grupo.lower()
        existente = await conn.fetchrow(
            "SELECT tipo_atencion_id FROM catalogo_tipo_atencion "
            "WHERE nombre = $1 AND tipo_grupo_id = $2",
            tipo_atencion,
            tipo_grupo_ids[grupo_codigo],
        )
        if existente:
            result[(tipo_grupo, tipo_atencion)] = existente["tipo_atencion_id"]
            continue
        codigo = f"hist-{slugify(tipo_atencion, 44)}"
        tipo_atencion_id = await conn.fetchval(
            "INSERT INTO catalogo_tipo_atencion (codigo, nombre, tipo_grupo_id) "
            "VALUES ($1, $2, $3) RETURNING tipo_atencion_id",
            codigo,
            tipo_atencion,
            tipo_grupo_ids[grupo_codigo],
        )
        result[(tipo_grupo, tipo_atencion)] = tipo_atencion_id
    print(f"catalogo_tipo_atencion: {len(result)} categorías mapeadas")
    return result


async def _ensure_medio_recepcion(conn: asyncpg.Connection) -> dict[str, int]:
    existentes = {
        r["codigo"]: r["medio_recepcion_id"]
        for r in await conn.fetch("SELECT codigo, medio_recepcion_id FROM catalogo_medio_recepcion")
    }
    for codigo in MEDIO_RECEPCION_MAP.values():
        if codigo in existentes:
            continue
        nombre = MEDIO_RECEPCION_NOMBRES[codigo]
        medio_id = await conn.fetchval(
            "INSERT INTO catalogo_medio_recepcion (codigo, nombre) VALUES ($1, $2) "
            "RETURNING medio_recepcion_id",
            codigo,
            nombre,
        )
        existentes[codigo] = medio_id
    return existentes


async def _ensure_parentesco(conn: asyncpg.Connection) -> dict[str, int]:
    existentes = {
        r["codigo"]: r["parentesco_id"]
        for r in await conn.fetch("SELECT codigo, parentesco_id FROM catalogo_parentesco")
    }
    for codigo in ("extrano", "inquilino"):
        if codigo in existentes:
            continue
        parentesco_id = await conn.fetchval(
            "INSERT INTO catalogo_parentesco (codigo, nombre) VALUES ($1, $2) "
            "RETURNING parentesco_id",
            codigo,
            PARENTESCO_NOMBRES[codigo],
        )
        existentes[codigo] = parentesco_id
    return existentes


async def _ensure_usuarios(conn: asyncpg.Connection, df: pd.DataFrame) -> dict[str, str]:
    raws = sorted(set(df["USUARIO_REGISTRA"].unique()) | set(df["USUARIO_SOLUCIONA"].unique()))
    tecnico_rol_id = await conn.fetchval("SELECT rol_id FROM rol WHERE codigo = 'tecnico'")

    existentes_rows = await conn.fetch("SELECT usuario_id, dni FROM usuario")
    dnis_usados = {r["dni"] for r in existentes_rows}

    result: dict[str, str] = {}
    siguiente_dni = 90000001
    for raw in raws:
        username = username_from_raw(raw)
        existente = await conn.fetchval(
            "SELECT usuario_id FROM usuario WHERE username = $1", username
        )
        if existente:
            result[raw] = existente
            continue
        while str(siguiente_dni) in dnis_usados:
            siguiente_dni += 1
        dni = str(siguiente_dni)
        dnis_usados.add(dni)
        siguiente_dni += 1
        nombres, apellidos = nombres_apellidos_from_username(raw)
        password_hash = hash_password(secrets.token_urlsafe(32))
        usuario_id = await conn.fetchval(
            "INSERT INTO usuario (dni, username, nombres, apellidos, password_hash, rol_id, activo) "
            "VALUES ($1, $2, $3, $4, $5, $6, FALSE) RETURNING usuario_id",
            dni,
            username,
            nombres,
            apellidos,
            password_hash,
            tecnico_rol_id,
        )
        result[raw] = usuario_id
    print(f"usuario: {len(result)} usuarios históricos (nuevos o existentes) resueltos")
    return result


async def _resolver_geo_sig(df: pd.DataFrame) -> dict[str, tuple[float, float]]:
    agua_codigos = sorted(
        set(df.loc[df["TIPO_GRUPO"] == "AGUA", "SUMINISTRO"].unique())
    )
    desague_codigos = sorted(
        set(df.loc[df["TIPO_GRUPO"] == "DESAGUE", "SUMINISTRO"].unique())
    )
    print(
        f"Resolviendo geo contra sig: {len(agua_codigos)} suministros de agua, "
        f"{len(desague_codigos)} de desagüe (conexión única, no dejar martin corriendo)"
    )

    dsn = (
        f"postgresql://{settings.sig_db_user}:{settings.sig_db_password}"
        f"@{settings.sig_db_host}:{settings.sig_db_port}/{settings.sig_db_name}"
    )
    sig = await asyncpg.connect(dsn=dsn)
    geo: dict[str, tuple[float, float]] = {}
    try:
        await sig.execute("SET TRANSACTION READ ONLY")
        if agua_codigos:
            rows = await sig.fetch(
                """
                SELECT DISTINCT ON (inscripcion) inscripcion,
                       ST_Y(ST_Transform(geom, 4326)) AS lat,
                       ST_X(ST_Transform(geom, 4326)) AS lon
                FROM sig.cajaagua
                WHERE inscripcion = ANY($1::varchar[]) AND inscripcion <> '00000000'
                ORDER BY inscripcion, cajaaguaid
                """,
                agua_codigos,
            )
            for r in rows:
                geo[r["inscripcion"]] = (r["lat"], r["lon"])
        if desague_codigos:
            rows = await sig.fetch(
                """
                SELECT DISTINCT ON (inscripcion) inscripcion,
                       ST_Y(ST_Transform(geom, 4326)) AS lat,
                       ST_X(ST_Transform(geom, 4326)) AS lon
                FROM sig.cajadesague
                WHERE inscripcion = ANY($1::varchar[]) AND inscripcion <> '00000000'
                ORDER BY inscripcion, cajadesagueid
                """,
                desague_codigos,
            )
            for r in rows:
                geo[r["inscripcion"]] = (r["lat"], r["lon"])
    finally:
        await sig.close()

    cobertura = len(geo) / max(len(agua_codigos) + len(desague_codigos), 1) * 100
    print(f"Geo resuelta para {len(geo)} suministros distintos ({cobertura:.1f}% cobertura)")
    return geo


async def _cargar(
    conn: asyncpg.Connection,
    df: pd.DataFrame,
    *,
    tipo_atencion_ids: dict[tuple[str, str], int],
    medio_recepcion_ids: dict[str, int],
    parentesco_ids: dict[str, int],
    alcance_ids: dict[str, int],
    estado_ids: dict[str, int],
    motivo_resuelto_id: int | None,
    usuario_ids: dict[str, str],
    suministro_geo: dict[str, tuple[float, float]],
) -> None:
    incidente_rows = []
    reclamo_rows = []
    evento_rows = []

    for row in df.itertuples(index=False):
        geo = suministro_geo.get(row.SUMINISTRO)
        lat, lon = geo if geo else (None, None)

        incidente_rows.append(
            (
                row.TICKET,
                row.SUMINISTRO,
                row.DIRECCION,
                row.DISTRITO,
                tipo_atencion_ids[(row.TIPO_GRUPO, row.TIPO_DE_ATENCION)],
                row.FECHA_REGISTRO.to_pydatetime(),
                lat,
                lon,
            )
        )

    async with conn.transaction():
        insertados = await conn.fetch(
            """
            INSERT INTO incidente
                (codigo, suministro_codigo, direccion, distrito, tipo_atencion_id,
                 creado_en, latitud, longitud)
            SELECT * FROM unnest(
                $1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::int[],
                $6::timestamp[], $7::numeric[], $8::numeric[]
            )
            RETURNING incidente_id, codigo
            """,
            [r[0] for r in incidente_rows],
            [r[1] for r in incidente_rows],
            [r[2] for r in incidente_rows],
            [r[3] for r in incidente_rows],
            [r[4] for r in incidente_rows],
            [r[5] for r in incidente_rows],
            [r[6] for r in incidente_rows],
            [r[7] for r in incidente_rows],
        )
        incidente_id_por_codigo = {r["codigo"]: r["incidente_id"] for r in insertados}
        print(f"incidente: {len(incidente_id_por_codigo)} filas insertadas")

        for row in df.itertuples(index=False):
            incidente_id = incidente_id_por_codigo[row.TICKET]
            alcance_codigo = ALCANCE_MAP[row.ALCANCE]
            medio_codigo = MEDIO_RECEPCION_MAP[row.MEDIO_RECEPCION]
            parentesco_codigo = PARENTESCO_MAP[row.PARENTESCO]

            reclamo_rows.append(
                (
                    row.TICKET,
                    incidente_id,
                    row.DNI,
                    row.PERSONA,
                    row.CELULAR,
                    row.TELEFONO_FIJO,
                    row.CORREO_ELECTRONICO,
                    parentesco_ids[parentesco_codigo],
                    row.direccion_detalle,
                    row.DISTRITO,
                    alcance_ids[alcance_codigo],
                    medio_recepcion_ids[medio_codigo],
                    row.DETALLE_DEL_TICKET,
                    row.problema,
                    bool(row.es_robo),
                    row.tecnico,
                    row.FECHA_REGISTRO.to_pydatetime(),
                    usuario_ids[row.USUARIO_REGISTRA],
                )
            )

            evento_rows.append(
                (
                    incidente_id,
                    row.FECHA_REGISTRO.to_pydatetime(),
                    estado_ids["CREADO"],
                    usuario_ids[row.USUARIO_REGISTRA],
                    None,
                    None,
                )
            )
            evento_rows.append(
                (
                    incidente_id,
                    row.FECHA_SOLUCION.to_pydatetime(),
                    estado_ids["ATENDIDO"],
                    usuario_ids[row.USUARIO_SOLUCIONA],
                    motivo_resuelto_id,
                    # Detalle de solución normalizado (ATENDIDO/SIN_DATO) — antes se
                    # perdía, ahora queda como nota del evento de cierre.
                    row.DETALLE_DE_SOLUCION,
                )
            )

        await conn.executemany(
            """
            INSERT INTO reclamo
                (ticket_original, incidente_id, dni, persona, celular, telefono_fijo, correo,
                 parentesco_id, direccion_detalle, distrito, alcance_id, medio_recepcion_id,
                 detalle_del_ticket, problema, es_robo, tecnico_nombre, fecha_registro,
                 usuario_registra_id)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
            """,
            reclamo_rows,
        )
        print(f"reclamo: {len(reclamo_rows)} filas insertadas")

        await conn.executemany(
            """
            INSERT INTO estado_incidente_evento
                (incidente_id, fecha, estado_resultante_id, usuario_id, catalogo_motivo_id, motivo)
            VALUES ($1,$2,$3,$4,$5,$6)
            """,
            evento_rows,
        )
        print(f"estado_incidente_evento: {len(evento_rows)} filas insertadas")
