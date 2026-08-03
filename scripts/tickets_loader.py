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
- ALCANCE: se usa el valor directo del dataset (general/particular). Los códigos del
  catalogo_alcance fueron renombrados a 'general'/'particular' — antes eran
  'masivo'/'individual'.
- DETALLE_DE_SOLUCION nulo ('SIN_DATO') se trata igual que no-nulo ('ATENDIDO'): el
  ticket sí se resolvió (tiene fecha_solucion), solo falta la nota -> mismo
  estado_resultante FINALIZADO en ambos casos.
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
    que `tickets_v3_normalizado.parquet`) y lo carga a la BD propia.

    Idempotencia y dedup:
    - Un ticket cuyo TICKET ya existe en `reclamo.ticket_original` se salta.
    - Un ticket NUEVO cuyo (suministro_codigo, tipo_atencion_id) coincide con un
      incidente existente creado en las últimas 72h se agrega como reclamo del
      incidente existente (no crea incidente nuevo).
    - No filtramos por estado (FINALIZADO): la dedup ya está protegida por
      suministro_codigo. Si el mismo suministro vuelve a reclamar por el mismo tipo
      dentro de 72h, es señal de que el problema físico no quedó bien resuelto —
      queremos agruparlos, no crear un incidente separado. Los reclamos de OTROS
      afectados (suministros distintos) nunca caen en la dedup y se detectan como
      foco vía el grafo (mismo tramo/tubería receptora).
    """
    print(f"Filas a procesar: {len(df)}")

    propia = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    try:
        # Idempotencia por reclamo.ticket_original (el TICKET del origen)
        existentes = await propia.fetch("SELECT ticket_original FROM reclamo")
        ya_cargados = {r["ticket_original"] for r in existentes}
        pendientes = df[~df["TICKET"].isin(ya_cargados)]
        print(f"Reclamos ya cargados: {len(ya_cargados)} — pendientes: {len(pendientes)}")
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


async def cargar_sin_suministro(df_sin: pd.DataFrame) -> None:
    """Carga reclamos SIN suministro válido a gota.reclamo_sin_suministro.
    Estos NO van a gota.incidente/reclamo (ensucian los KPIs) ni al datamart
    (no aportan a analítica), pero se preservan para auditoría/regulatorio.

    Idempotente por ticket_original: si un ticket ya existe, lo saltea.
    """
    print(f"\nSin-suministro: {len(df_sin)} filas a procesar")
    propia = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    try:
        existentes = await propia.fetch(
            "SELECT ticket_original FROM reclamo_sin_suministro"
        )
        ya_cargados = {r["ticket_original"] for r in existentes}
        pendientes = df_sin[~df_sin["TICKET"].isin(ya_cargados)]
        print(f"  ya cargados: {len(ya_cargados)} — pendientes: {len(pendientes)}")
        if pendientes.empty:
            print("  Nada que cargar.")
            return

        # Reutilizamos los IDs de catálogos y usuarios que el flujo principal
        # también necesita
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
        usuario_ids = await _ensure_usuarios(propia, pendientes)

        rows = []
        for row in pendientes.itertuples(index=False):
            fecha_solucion = (
                row.FECHA_SOLUCION.to_pydatetime()
                if pd.notna(row.FECHA_SOLUCION)
                else None
            )
            usuario_soluciona_id = (
                usuario_ids.get(row.USUARIO_SOLUCIONA)
                if pd.notna(row.USUARIO_SOLUCIONA)
                else None
            )
            rows.append((
                _str_or_none(row.TICKET),
                row.FECHA_REGISTRO.to_pydatetime(),
                _str_or_none(row.PERSONA),
                _str_or_none(row.DNI),
                _str_or_none(row.CELULAR),
                _str_or_none(row.TELEFONO_FIJO),
                _str_or_none(row.CORREO_ELECTRONICO),
                parentesco_ids[PARENTESCO_MAP[row.PARENTESCO]],
                _str_or_none(row.DISTRITO),
                tipo_atencion_ids[(row.TIPO_GRUPO, row.TIPO_DE_ATENCION)],
                alcance_ids[row.ALCANCE],
                medio_recepcion_ids[MEDIO_RECEPCION_MAP[row.MEDIO_RECEPCION]],
                _str_or_none(row.DETALLE_DEL_TICKET),
                _str_or_none(row.problema),
                _str_or_none(row.tecnico),
                bool(row.es_robo),
                _str_or_none(row.DETALLE_DE_SOLUCION) if fecha_solucion else None,
                fecha_solucion,
                usuario_soluciona_id,
                usuario_ids[row.USUARIO_REGISTRA],
            ))

        async with propia.transaction():
            await propia.executemany(
                """
                INSERT INTO reclamo_sin_suministro
                    (ticket_original, fecha_registro, persona, dni, celular, telefono_fijo,
                     correo, parentesco_id, distrito, tipo_atencion_id, alcance_id,
                     medio_recepcion_id, detalle_del_ticket, problema, tecnico_nombre,
                     es_robo, detalle_solucion, fecha_solucion, usuario_soluciona_id,
                     usuario_registra_id)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
                """,
                rows,
            )
        print(f"  reclamo_sin_suministro: {len(rows)} filas insertadas")
    finally:
        await propia.close()


def _str_or_none(v) -> str | None:
    """Convierte NaN/NaT/pd.NA a None y todo lo demás a str. Necesario porque
    itertuples() preserva los NaN como float y asyncpg los rechaza al bindear a
    columnas varchar."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if pd.isna(v):
        return None
    return str(v)


async def _buscar_incidente_dedup(
    conn: asyncpg.Connection,
    suministro: str,
    tipo_atencion_id: int,
    fecha_registro,
    ventana_horas: int = 72,
) -> str | None:
    """Regla de deduplicación por Fabiana:
    Un reclamo se agrupa como reclamo de un incidente existente si (suministro,
    tipo_atencion) coinciden Y se cumple al menos una de estas condiciones:

    1. El incidente fue creado dentro de las últimas ``ventana_horas`` (72h por
       default) — probablemente el mismo evento o continuación de uno mal resuelto.

    2. El incidente aún NO está FINALIZADO (``fecha_solucion IS NULL``) — el
       problema sigue abierto sin atender, aunque haya pasado más de la ventana.
       Ejemplo: un reclamo del lunes que no se resolvió y el mismo suministro
       vuelve a reclamar el jueves; ambos son el mismo problema no atendido.

    Un incidente FINALIZADO fuera de la ventana no se reabre: si el mismo suministro
    vuelve a reclamar por lo mismo días después de resuelto, es un evento distinto.

    Los reclamos de OTROS afectados (suministros distintos) no caen en la dedup
    aunque compartan tramo/tubería: eso es un FOCO, detectado por el grafo, no un
    reclamo del mismo incidente.

    Retorna None si hay que crear un incidente nuevo.
    """
    row = await conn.fetchrow(
        """
        SELECT incidente_id
        FROM incidente
        WHERE suministro_codigo = $1
          AND tipo_atencion_id = $2
          AND creado_en <= $3::timestamp
          AND (
              -- Condicion 1: dentro de la ventana temporal
              creado_en >= $3::timestamp - (INTERVAL '1 hour' * $4)
              -- Condicion 2: aun abierto (aunque este fuera de ventana)
              OR fecha_solucion IS NULL
          )
        ORDER BY creado_en DESC
        LIMIT 1
        """,
        suministro,
        tipo_atencion_id,
        fecha_registro,
        ventana_horas,
    )
    return row["incidente_id"] if row else None


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
    # USUARIO_SOLUCIONA puede venir None (ticket aún sin resolver desde la API);
    # solo consideramos usuarios reales para crear/resolver cuentas.
    solucionan = {u for u in df["USUARIO_SOLUCIONA"].unique() if pd.notna(u)}
    raws = sorted(set(df["USUARIO_REGISTRA"].unique()) | solucionan)
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

    # sig usa la misma URL que propia (por default) — misma BD, distinto schema.
    # Si sig_db_url está definida aparte en el .env, usa esa (para caso remoto).
    dsn = _to_asyncpg_dsn(settings.sig_db_url_effective)
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
                WHERE inscripcion = ANY($1::varchar[])
                  AND inscripcion NOT IN ('00000000', '99999999')
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
                WHERE inscripcion = ANY($1::varchar[])
                  AND inscripcion NOT IN ('00000000', '99999999')
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
    finalizado_id = estado_ids["FINALIZADO"]
    creado_id = estado_ids["CREADO"]

    reclamo_rows: list[tuple] = []
    evento_rows: list[tuple] = []
    n_dedup = 0  # reclamos agregados a un incidente existente por la regla de 72h

    async with conn.transaction():
        # Procesamos ordenados cronológicamente para que la dedup funcione consistente
        # (los tickets más viejos crean el incidente; los que caen en la ventana de 72h
        # se agregan como reclamos).
        for row in df.sort_values("FECHA_REGISTRO").itertuples(index=False):
            suministro = row.SUMINISTRO
            tipo_atencion_id = tipo_atencion_ids[(row.TIPO_GRUPO, row.TIPO_DE_ATENCION)]
            fecha_registro = row.FECHA_REGISTRO.to_pydatetime()

            # Regla de dedup: mismo (suministro, tipo_atencion), y (dentro de 72h
            # O incidente aun no finalizado). Excluye el placeholder '99999999'.
            incidente_existente = None
            if suministro != "99999999":
                incidente_existente = await _buscar_incidente_dedup(
                    conn,
                    suministro=suministro,
                    tipo_atencion_id=tipo_atencion_id,
                    fecha_registro=fecha_registro,
                )

            # Resolver campos de resolución (si el ticket viene con solución)
            fecha_solucion = (
                row.FECHA_SOLUCION.to_pydatetime()
                if pd.notna(row.FECHA_SOLUCION)
                else None
            )
            usuario_soluciona_id = (
                usuario_ids.get(row.USUARIO_SOLUCIONA)
                if pd.notna(row.USUARIO_SOLUCIONA)
                else None
            )
            tiene_solucion = fecha_solucion is not None

            if incidente_existente:
                # Solo agregar reclamo al incidente existente. NO tocar los campos
                # del incidente (mantener los originales).
                incidente_id = incidente_existente
                n_dedup += 1
            else:
                # Crear incidente nuevo
                geo = suministro_geo.get(suministro)
                lat, lon = geo if geo else (None, None)

                incidente_id = await conn.fetchval(
                    """
                    INSERT INTO incidente
                        (codigo, suministro_codigo, direccion, distrito, tipo_atencion_id,
                         creado_en, latitud, longitud,
                         detalle_solucion, fecha_solucion, usuario_soluciona_id)
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    RETURNING incidente_id
                    """,
                    _str_or_none(row.TICKET),
                    _str_or_none(suministro),
                    _str_or_none(row.DIRECCION),
                    _str_or_none(row.DISTRITO),
                    tipo_atencion_id,
                    fecha_registro,
                    lat,
                    lon,
                    _str_or_none(row.DETALLE_DE_SOLUCION) if tiene_solucion else None,
                    fecha_solucion,
                    usuario_soluciona_id,
                )

                # Evento de creación
                evento_rows.append(
                    (
                        incidente_id,
                        fecha_registro,
                        creado_id,
                        usuario_ids[row.USUARIO_REGISTRA],
                        None,
                        None,
                    )
                )
                # Evento de cierre si vino con solución
                if tiene_solucion:
                    evento_rows.append(
                        (
                            incidente_id,
                            fecha_solucion,
                            finalizado_id,
                            usuario_soluciona_id,
                            motivo_resuelto_id,
                            row.DETALLE_DE_SOLUCION,
                        )
                    )

            # Reclamo (siempre se inserta, sea a incidente nuevo o existente).
            # Envolvemos con _str_or_none todos los varchar que pueden venir NaN
            # (TELEFONO_FIJO ~80% nulo, CORREO/DIRECCION también).
            reclamo_rows.append(
                (
                    _str_or_none(row.TICKET),
                    incidente_id,
                    _str_or_none(row.DNI),
                    _str_or_none(row.PERSONA),
                    _str_or_none(row.CELULAR),
                    _str_or_none(row.TELEFONO_FIJO),
                    _str_or_none(row.CORREO_ELECTRONICO),
                    parentesco_ids[PARENTESCO_MAP[row.PARENTESCO]],
                    _str_or_none(row.direccion_detalle),
                    _str_or_none(row.DISTRITO),
                    alcance_ids[row.ALCANCE],   # 'general' o 'particular' directo
                    medio_recepcion_ids[MEDIO_RECEPCION_MAP[row.MEDIO_RECEPCION]],
                    _str_or_none(row.DETALLE_DEL_TICKET),
                    _str_or_none(row.problema),
                    bool(row.es_robo),
                    _str_or_none(row.tecnico),
                    fecha_registro,
                    usuario_ids[row.USUARIO_REGISTRA],
                )
            )

        print(f"incidente: {len(reclamo_rows) - n_dedup} nuevos + {n_dedup} reclamos "
              f"agregados por dedup 72h")

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

        if evento_rows:
            await conn.executemany(
                """
                INSERT INTO estado_incidente_evento
                    (incidente_id, fecha, estado_resultante_id, usuario_id, catalogo_motivo_id, motivo)
                VALUES ($1,$2,$3,$4,$5,$6)
                """,
                evento_rows,
            )
            print(f"estado_incidente_evento: {len(evento_rows)} filas insertadas")
