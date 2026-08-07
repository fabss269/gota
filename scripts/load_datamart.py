"""Carga el datamart `datamart_gota` (schemas `gota_dm` + `gota_dm_pii`) a partir de
la BD operacional (`gota.reclamo` + `gota.incidente`).

Estrategia: FULL REFRESH. Cada corrida hace TRUNCATE de todas las tablas del
datamart y las repuebla desde cero. Es adecuado para el volumen actual (miles
de reclamos) y evita tener que trackear deltas entre corridas. Cuando el
volumen crezca lo suficiente para que el full refresh moleste, migrar a
incremental por `fecha_registro` es directo (el fact tiene `ticket_id` PK
sobre el que hacer upsert).

Restricción del proyecto: el script NUNCA modifica la DDL del datamart (nada
de ALTER TABLE, ADD COLUMN, DROP CONSTRAINT). Todo lo que no calza en el
esquema tal como está se adapta en Python (truncados, mapeos por lógica).

Grano del fact: 1 fila = 1 reclamo. `fact_tickets.ticket_id` bigint =
int(reclamo.ticket_original) — el TICKET de 5 dígitos del origen, para que se
pueda buscar por número humano ("¿qué pasó con el ticket 15234?"). La DDL de
`gota.reclamo` NO tiene UNIQUE sobre ticket_original (la unicidad depende del
loader); si hay duplicados en la BD operacional, el datamart los detecta,
imprime diagnóstico, y se queda con el reclamo más viejo por ticket_original
(ver `_diagnosticar_duplicados` y el DISTINCT ON del SELECT).

Alcance v1 — decisiones tomadas para no bloquear el primer reporte:
  - Solo `gota.reclamo` va al datamart. `gota.reclamo_sin_suministro` NO —
    misma decisión documentada en scripts/etl_tickets_crudos.py (no aportan a
    analítica, quedan solo para auditoría/regulatorio).
  - `dim_georef` se puebla vía SUMINISTRO ↔ sig.cajaagua/cajadesague (2 queries
    grandes, una por tabla). Se llenan `sector`, `cota` (extraída de la Z de la
    geom, que en sig es PointZ 3D) y `geom` (aplanado a 2D con ST_Force2D para
    calzar con el tipo Point del datamart, SRID 32719). `manzana/lote/catastroid`
    quedan NULL — esas columnas no las expone la interfaz de sig que usa el
    resto del backend (ver catastro_enrichment.py). Un suministro puede aparecer
    en agua Y desague con geom distintos, por eso el mapa
    `{(suministro, tipo_grupo) → georef_sk}` en vez de solo suministro.
  - `dim_tipo_incidencia.grupo` y `.categoria` quedan NULL: son columnas del
    xlsx crudo (GRUPO/CATEGORÍA) que el ETL descarta (ver
    etl_tickets_crudos.COLUMNAS_A_DESCARTAR). Si más adelante se decide
    conservarlas, hay que agregarlas al reclamo/incidente primero.
  - `dim_estado`: se derivan solo 'Creado' y 'Finalizado' (con fecha_solucion
    NULL vs. no-NULL). Coincide con el filtro de vw_backlog_abierto (que compara
    contra 'Finalizado'). Si en algún momento se necesita estado intermedio
    ('En proceso'), hay que leerlo de `estado_incidente_evento`.
  - `dim_semaforo`: se insertan las 3 filas fijas del DDL (verde/amarillo/rojo)
    con los cortes de referencia (AGUA), pero al calcular `fact_tickets.semaforo_sk`
    se aplican cortes DISTINTOS por tipo_grupo (ver CUTOFFS_POR_GRUPO). Reportes
    que quieran conocer el corte real usado por un ticket deben cruzarlo por
    tipo_grupo (joinable vía dim_tipo_incidencia).
  - `dim_problema.problema` es varchar(150) en la DDL; los `problema` extraídos
    del detalle pueden ser más largos. Se truncan en Python a 150 chars
    (`_truncar_problema`); dos problemas con los primeros 150 chars iguales
    colapsan en el mismo sk.
  - `score_criticidad`/`score_version`: NULL. No hay pipeline de scoring todavía.
  - `dim_persona` (PII): dedup por DNI cuando está presente; si es NULL, se
    crea una fila por reclamante (puede haber duplicados de personas sin DNI).

Uso:
    .venv/Scripts/python.exe -m scripts.load_datamart

Requiere en .env:
    DATAMART_NAME=datamart_gota
"""

from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any

import asyncpg

from app.core.config import propia_connect_args, settings

MESES_ES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Setiembre", "Octubre", "Noviembre", "Diciembre",
]
DIAS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

# dim_semaforo: 3 filas fijas (verde/amarillo/rojo), respetando la DDL original
# (color UNIQUE, sin tipo_grupo). Los cortes por tipo_grupo NO se materializan en
# la tabla — se aplican en Python al calcular fact_tickets.semaforo_sk, usando
# CUTOFFS_POR_GRUPO. Trade-off: los reportes que quieran mostrar el corte real
# usado por cada ticket tienen que asumir la política vía tipo_grupo (joinable
# desde dim_tipo_incidencia), en vez de leerlo directo de dim_semaforo.
# dias_min/dias_max en la tabla son informativos: usamos los cortes de AGUA como
# "referencia" ya que es el grupo con la distribución más amplia.
SEMAFORO_ROWS: list[tuple[int, str, float, float | None]] = [
    (1, "verde", 0, 10.2),
    (2, "amarillo", 10.2, 28),
    (3, "rojo", 28, None),
]
# Cortes reales aplicados al calcular semaforo_sk por ticket (Fabiana 2026-08-05,
# tomados del análisis KDE — DESAGUE muy concentrado ~4 días, AGUA bimodal con
# picos en ~4 y ~17). El primer elemento de cada tupla es el sk que se asigna
# (mapea a SEMAFORO_ROWS: 1=verde, 2=amarillo, 3=rojo).
CUTOFFS_POR_GRUPO: dict[str, list[tuple[int, float, float | None]]] = {
    "agua": [
        (1, 0, 10.2),      # verde
        (2, 10.2, 28),     # amarillo
        (3, 28, None),     # rojo (sin tope)
    ],
    "desague": [
        (1, 0, 4),         # verde
        (2, 4, 22),        # amarillo
        (3, 22, None),     # rojo (sin tope)
    ],
}

# Máximo de la columna dim_problema.problema en la DDL (varchar(150)). Truncamos
# en Python para no romper el INSERT; documentado en `_seed_dim_simple`.
MAX_PROBLEMA_LEN = 150

# Estados del datamart. Coincide con lo que espera vw_backlog_abierto ('Finalizado'
# capitalizado). Ver docstring.
ESTADO_CREADO = "Creado"
ESTADO_FINALIZADO = "Finalizado"


def _to_asyncpg_dsn(sqlalchemy_url: str) -> str:
    return sqlalchemy_url.replace("postgresql+asyncpg://", "postgresql://")


def _fecha_sk(d: date) -> int:
    return d.year * 10_000 + d.month * 100 + d.day




def _franja_horaria(hora: int) -> str:
    if 0 <= hora < 6:
        return "Madrugada"
    if 6 <= hora < 12:
        return "Mañana"
    if 12 <= hora < 18:
        return "Tarde"
    return "Noche"


def _es_temporada_verano(d: date) -> bool:
    # Perú (hemisferio sur): verano oficial dic-mar. Chiclayo tiene calor todo
    # el año pero se sigue la convención calendárica.
    return d.month in (12, 1, 2, 3)


def _semaforo_sk_para_dias(dias: float | None, tipo_grupo: str) -> int | None:
    if dias is None:
        return None
    tramos = CUTOFFS_POR_GRUPO.get(tipo_grupo)
    if tramos is None:
        return None
    for sk, dmin, dmax in tramos:
        if dias >= dmin and (dmax is None or dias < dmax):
            return sk
    return None


def _truncar_problema(s: str | None) -> str | None:
    """dim_problema.problema es varchar(150). Los `problema` extraídos por
    etl_tickets_crudos.extraer_problema_direccion pueden superar ese largo
    cuando el DETALLE DEL TICKET no tiene una "EN" con la que partir. Truncamos
    en Python para no romper el INSERT.

    Trade-off: dos `problema` con los primeros 150 chars iguales colisionan en
    la natural key de dim_problema y quedan como el MISMO problema en el
    datamart. En la práctica los problemas tienen prefijo estructural
    consistente (`FUGA DE AGUA…`, `ATORO EN COLECTOR…`), así que la colisión
    real es poco frecuente."""
    if s is None:
        return None
    return s[:MAX_PROBLEMA_LEN]


async def _truncar_datamart(dm: asyncpg.Connection) -> None:
    print("Truncando datamart…")
    # Un solo TRUNCATE con CASCADE se encarga de todas las FK, y RESTART IDENTITY
    # resetea las secuencias de los dim_*_sk. dim_fecha/dim_hora/dim_semaforo NO
    # son IDENTITY (sk explícito), no molestan con RESTART IDENTITY.
    await dm.execute(
        """
        TRUNCATE TABLE
            gota_dm.fact_historial_estados,
            gota_dm.fact_tickets,
            gota_dm.dim_fecha,
            gota_dm.dim_hora,
            gota_dm.dim_distrito,
            gota_dm.dim_georef,
            gota_dm.dim_suministro,
            gota_dm.dim_tipo_incidencia,
            gota_dm.dim_tecnico,
            gota_dm.dim_usuario,
            gota_dm.dim_medio_recepcion,
            gota_dm.dim_estado,
            gota_dm.dim_alcance,
            gota_dm.dim_problema,
            gota_dm.dim_parentesco,
            gota_dm.dim_semaforo,
            gota_dm_pii.dim_persona
        RESTART IDENTITY CASCADE
        """
    )


async def _seed_dim_hora(dm: asyncpg.Connection) -> None:
    # 24 filas fijas — hora_sk = hora. es_horario_activo: horario laboral 8-18.
    rows = [
        (h, h, _franja_horaria(h), 8 <= h < 18) for h in range(24)
    ]
    await dm.executemany(
        "INSERT INTO gota_dm.dim_hora (hora_sk, hora, franja_horaria, es_horario_activo) "
        "VALUES ($1, $2, $3, $4)",
        rows,
    )


async def _seed_dim_semaforo(dm: asyncpg.Connection) -> None:
    await dm.executemany(
        "INSERT INTO gota_dm.dim_semaforo (semaforo_sk, color, dias_min, dias_max) "
        "VALUES ($1, $2, $3, $4)",
        SEMAFORO_ROWS,
    )


async def _seed_dim_estado(dm: asyncpg.Connection) -> dict[str, int]:
    rows = await dm.fetch(
        "INSERT INTO gota_dm.dim_estado (estado_del_ticket) VALUES ($1), ($2) "
        "RETURNING estado_sk, estado_del_ticket",
        ESTADO_CREADO, ESTADO_FINALIZADO,
    )
    return {r["estado_del_ticket"]: r["estado_sk"] for r in rows}


async def _seed_dim_fecha(dm: asyncpg.Connection, min_d: date, max_d: date) -> None:
    # +30 días de colchón por adelante para cubrir fechas de solución posteriores
    # a la última fecha_registro observada, y CURRENT_DATE que usa vw_backlog_abierto.
    hoy = date.today()  # noqa: DTZ011
    max_d = max(max_d, hoy) + timedelta(days=30)
    rows: list[tuple[Any, ...]] = []
    d = min_d
    while d <= max_d:
        dow = d.weekday()  # 0=lunes .. 6=domingo
        rows.append((
            _fecha_sk(d), d, d.year, (d.month - 1) // 3 + 1, d.month,
            MESES_ES[d.month - 1], d.day, dow, DIAS_ES[dow],
            d.isocalendar().week, dow >= 5, _es_temporada_verano(d),
        ))
        d += timedelta(days=1)
    await dm.executemany(
        """
        INSERT INTO gota_dm.dim_fecha
            (fecha_sk, fecha, anio, trimestre, mes, mes_nombre, dia,
             dia_semana_num, dia_semana_nombre, semana_anio, es_fin_semana,
             es_temporada_verano)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        """,
        rows,
    )
    print(f"  dim_fecha: {len(rows)} días ({min_d} → {max_d})")


async def _seed_dim_simple(
    dm: asyncpg.Connection, tabla: str, columna: str, valores: set[str]
) -> dict[str, int]:
    """Inserta valores únicos en una dim con natural key de una sola columna y
    retorna el mapa valor→sk. INSERT fila-a-fila para poder emparejar sk↔valor
    sin depender del orden en que Postgres devuelve las filas de un INSERT
    multi-fila (no está garantizado)."""
    if not valores:
        return {}
    sk_column = tabla.removeprefix("dim_") + "_sk"
    # Solo dim_problema tiene un varchar acotado (150) que la fuente puede
    # exceder — para el resto, truncar es identidad.
    normalizar = _truncar_problema if tabla == "dim_problema" else (lambda x: x)
    # Con el truncado puede haber colisiones (dos valores originales que quedan
    # iguales en 150 chars). set() los colapsa en el mismo insert; el mapa de
    # retorno mapea el valor ORIGINAL al sk del valor truncado equivalente.
    result: dict[str, int] = {}
    sk_por_truncado: dict[str, int] = {}
    for v in sorted(valores):
        v_norm = normalizar(v)
        sk = sk_por_truncado.get(v_norm)
        if sk is None:
            sk = await dm.fetchval(
                f"INSERT INTO gota_dm.{tabla} ({columna}) VALUES ($1) "
                f"RETURNING {sk_column}",
                v_norm,
            )
            sk_por_truncado[v_norm] = sk
        result[v] = sk
    return result


async def _seed_dim_tipo_incidencia(
    dm: asyncpg.Connection, pares: set[tuple[str, str]]
) -> dict[tuple[str, str], int]:
    """(tipo_grupo, tipo_de_atencion) → tipo_incidencia_sk. grupo y categoria
    quedan NULL (ver docstring)."""
    result: dict[tuple[str, str], int] = {}
    for tipo_grupo, tipo_atencion in sorted(pares):
        sk = await dm.fetchval(
            """
            INSERT INTO gota_dm.dim_tipo_incidencia
                (grupo, tipo_grupo, categoria, tipo_de_atencion)
            VALUES (NULL, $1, NULL, $2)
            RETURNING tipo_incidencia_sk
            """,
            tipo_grupo, tipo_atencion,
        )
        result[(tipo_grupo, tipo_atencion)] = sk
    return result


async def _seed_dim_suministro(
    dm: asyncpg.Connection, source_rows: list[dict]
) -> dict[str, int]:
    """Calcula métricas de reincidencia por SUMINISTRO y las carga a dim_suministro.

    es_reincidente = num_tickets_historico > 1.
    es_cronico = num_meses_distintos >= 3 (umbral heurístico, cambiar si Fabiana
    define uno oficial).
    """
    por_sum: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"n": 0, "meses": set(), "min": None, "max": None}
    )
    for r in source_rows:
        s = r["suministro_codigo"]
        d = r["fecha_registro"].date()
        agg = por_sum[s]
        agg["n"] += 1
        agg["meses"].add((d.year, d.month))
        agg["min"] = d if agg["min"] is None or d < agg["min"] else agg["min"]
        agg["max"] = d if agg["max"] is None or d > agg["max"] else agg["max"]

    result: dict[str, int] = {}
    for s in sorted(por_sum):
        agg = por_sum[s]
        n_meses = len(agg["meses"])
        sk = await dm.fetchval(
            """
            INSERT INTO gota_dm.dim_suministro
                (suministro, num_tickets_historico, es_reincidente, es_cronico,
                 num_meses_distintos, primer_ticket_fecha, ultimo_ticket_fecha)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING suministro_sk
            """,
            s, agg["n"], agg["n"] > 1, n_meses >= 3, n_meses, agg["min"], agg["max"],
        )
        result[s] = sk
    return result


async def _seed_dim_persona(
    dm: asyncpg.Connection, source_rows: list[dict]
) -> dict[int, int]:
    """Retorna {reclamo_row_index → persona_sk}. Dedup por DNI cuando está
    presente; si es NULL, una fila por reclamante (posibles duplicados)."""
    # Primer pase: agrupar índices por DNI (o marcar sin-dni).
    dni_a_idxs: dict[str, list[int]] = defaultdict(list)
    sin_dni_idxs: list[int] = []
    for i, r in enumerate(source_rows):
        if r["dni"]:
            dni_a_idxs[r["dni"]].append(i)
        else:
            sin_dni_idxs.append(i)

    result: dict[int, int] = {}
    # Con DNI: una fila por DNI, usando el primer reclamo como referencia de PII.
    for dni, idxs in dni_a_idxs.items():
        r = source_rows[idxs[0]]
        sk = await dm.fetchval(
            """
            INSERT INTO gota_dm_pii.dim_persona
                (persona_nombre, dni, celular, telefono_fijo, correo_electronico)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING persona_sk
            """,
            r["persona"], dni, r["celular"], r["telefono_fijo"], r["correo"],
        )
        for i in idxs:
            result[i] = sk
    # Sin DNI: una fila por reclamo (no hay natural key confiable para dedup).
    for i in sin_dni_idxs:
        r = source_rows[i]
        sk = await dm.fetchval(
            """
            INSERT INTO gota_dm_pii.dim_persona
                (persona_nombre, dni, celular, telefono_fijo, correo_electronico)
            VALUES ($1, NULL, $2, $3, $4)
            RETURNING persona_sk
            """,
            r["persona"], r["celular"], r["telefono_fijo"], r["correo"],
        )
        result[i] = sk
    return result


async def _seed_dim_georef(
    dm: asyncpg.Connection,
    propia: asyncpg.Connection,
    source_rows: list[dict],
) -> dict[tuple[str, str], int]:
    """Puebla `dim_georef` cruzando SUMINISTRO ↔ `sig.cajaagua`/`cajadesague`.

    Retorna {(suministro, tipo_grupo) → georef_sk}. Un suministro puede existir
    en ambas tablas (agua y desague) y tener geom/sector distintos — por eso la
    clave del mapa es la tupla, no solo el suministro.

    Columnas de dim_georef que se pueblan: sector (via join a sig.sectores),
    geom (nativo SRID 32719, transferido vía EWKB hex). Las columnas
    manzana/lote/catastroid/cota quedan NULL: no las expone la interfaz de
    sig.cajaagua/cajadesague que usa el resto del backend (ver
    catastro_enrichment.py). Si más adelante se agregan, se pueden llenar aquí.

    Excluye los sentinelas '00000000' y '99999999' (mismo criterio que
    _resolver_geo_sig en tickets_loader.py).
    """
    # Batch por tipo_grupo — 1 query grande por tabla en vez de N pings.
    codigos_agua = sorted({
        r["suministro_codigo"] for r in source_rows
        if r["tipo_grupo"] == "agua"
        and r["suministro_codigo"] not in ("00000000", "99999999")
    })
    codigos_desague = sorted({
        r["suministro_codigo"] for r in source_rows
        if r["tipo_grupo"] == "desague"
        and r["suministro_codigo"] not in ("00000000", "99999999")
    })

    def _sql_lectura(tabla: str, id_col: str) -> str:
        # DISTINCT ON (inscripcion) — la misma inscripcion puede aparecer en
        # varias filas (~0.01% de los códigos reales, ver PredioCatastral); nos
        # quedamos con la de menor id como criterio de desempate estable.
        # Fetch geom como EWKT para pasarla como texto a otra BD y reinsertar
        # con ST_GeomFromEWKT — más simple que manejar EWKB binario cross-DB.
        # `public.` calificado porque la conexión propia tiene search_path=gota
        # y postgis vive en public (sin schema qualifier, "no existe la función
        # st_transform" aunque la extensión esté instalada). No transformamos —
        # sig.cajaagua/cajadesague ya están en SRID 32719 nativo (mismo asumido
        # por tickets_loader._resolver_geo_sig y el resto del backend).
        #
        # ST_Force2D: sig.cajaagua.geom es PointZ (3D con altitud), pero
        # dim_georef.geom es Point (2D). Aplanamos a 2D acá — la Z que
        # descartamos es justo la `cota` que dim_georef ya tiene como columna
        # aparte, así que la extraemos con ST_Z antes de forzar 2D.
        return f"""
            SELECT DISTINCT ON (c.inscripcion)
                   c.inscripcion,
                   s.sector,
                   public.ST_Z(c.geom) AS cota,
                   public.ST_AsEWKT(public.ST_Force2D(c.geom)) AS geom_ewkt
            FROM sig.{tabla} c
            LEFT JOIN sig.sectores s ON s.sectorid = c.sectorid
            WHERE c.inscripcion = ANY($1::varchar[])
              AND c.inscripcion NOT IN ('00000000', '99999999')
            ORDER BY c.inscripcion, c.{id_col}
        """

    resultado: dict[tuple[str, str], int] = {}
    filas_insertadas = 0
    for grupo, codigos, tabla, id_col in [
        ("agua", codigos_agua, "cajaagua", "cajaaguaid"),
        ("desague", codigos_desague, "cajadesague", "cajadesagueid"),
    ]:
        if not codigos:
            continue
        rows = await propia.fetch(_sql_lectura(tabla, id_col), codigos)
        resueltos_grupo = 0
        for r in rows:
            sector = (r["sector"] or "").title() or None
            sk = await dm.fetchval(
                """
                INSERT INTO gota_dm.dim_georef (sector, cota, geom)
                VALUES ($1, $2, public.ST_GeomFromEWKT($3))
                RETURNING georef_sk
                """,
                sector, r["cota"], r["geom_ewkt"],
            )
            resultado[(r["inscripcion"], grupo)] = sk
            resueltos_grupo += 1
            filas_insertadas += 1
        print(f"  dim_georef ({grupo}): {resueltos_grupo} de "
              f"{len(codigos)} suministros resueltos")
    return resultado


async def _cargar_fact_tickets(
    dm: asyncpg.Connection,
    source_rows: list[dict],
    *,
    distrito_sk: dict[str, int],
    suministro_sk: dict[str, int],
    georef_sk: dict[tuple[str, str], int],
    tipo_incidencia_sk: dict[tuple[str, str], int],
    medio_recepcion_sk: dict[str, int],
    estado_sk: dict[str, int],
    alcance_sk: dict[str, int],
    problema_sk: dict[str, int],
    parentesco_sk: dict[str, int],
    tecnico_sk: dict[str, int],
    usuario_sk: dict[str, int],
    persona_sk_por_idx: dict[int, int],
) -> None:
    # `source_rows` viene ORDER BY fecha_registro globalmente — para cualquier
    # suministro dado, los reclamos aparecen en orden temporal, así que
    # incrementar un contador por suministro reproduce exactamente
    # ROW_NUMBER() OVER (PARTITION BY suministro ORDER BY fecha_registro).
    # Iteramos en el orden original para que el índice `i` calce con
    # persona_sk_por_idx (armado sobre el mismo orden).
    orden_por_sum: dict[str, int] = defaultdict(int)

    rows: list[tuple[Any, ...]] = []
    tickets_invalidos = 0
    for i, r in enumerate(source_rows):
        # Grano = reclamo. `ticket_id` bigint = int(ticket_original) — el
        # source_rows ya viene deduplicado por ticket_original (DISTINCT ON en
        # _leer_source), así que la unicidad está garantizada. Usamos el TICKET
        # de 5 dígitos como PK para que se pueda buscar por número humano en
        # los reportes ("¿qué pasó con el ticket 15234?" → SELECT * FROM
        # fact_tickets WHERE ticket_id = 15234).
        try:
            ticket_id = int(r["ticket_original"])
        except (ValueError, TypeError):
            tickets_invalidos += 1
            continue

        fr: datetime = r["fecha_registro"]
        fs: datetime | None = r["fecha_solucion"]
        horas = dias = None
        estado_str = ESTADO_CREADO
        fecha_sol_sk = None
        hora_sol_sk = None
        if fs is not None:
            delta = fs - fr
            horas = round(delta.total_seconds() / 3600, 2)
            dias = round(delta.total_seconds() / 86400, 2)
            estado_str = ESTADO_FINALIZADO
            fecha_sol_sk = _fecha_sk(fs.date())
            hora_sol_sk = fs.hour

        orden_por_sum[r["suministro_codigo"]] += 1
        orden = orden_por_sum[r["suministro_codigo"]]

        # `dur_valida`: heredado del análisis de Fabiana (ver comentario del DDL).
        # Sin criterio confirmado en este pipeline, dejamos True — si más adelante
        # se define un filtro (ej. dias negativos / > umbral), se aplica acá.
        dur_valida = True

        rows.append((
            ticket_id,
            _fecha_sk(fr.date()), fr.hour,
            fecha_sol_sk, hora_sol_sk,
            distrito_sk[r["distrito"]],
            georef_sk.get((r["suministro_codigo"], r["tipo_grupo"])),
            suministro_sk[r["suministro_codigo"]],
            orden,
            tipo_incidencia_sk[(r["tipo_grupo"], r["tipo_de_atencion"])],
            medio_recepcion_sk.get(r["medio_recepcion"]),
            estado_sk[estado_str],
            _semaforo_sk_para_dias(dias, r["tipo_grupo"]),
            tecnico_sk.get(r["tecnico_nombre"]) if r["tecnico_nombre"] else None,
            usuario_sk.get(r["usuario_registra"]),
            usuario_sk.get(r["usuario_soluciona"]) if r["usuario_soluciona"] else None,
            alcance_sk.get(r["alcance"]),
            problema_sk.get(r["problema"]) if r["problema"] else None,
            parentesco_sk.get(r["parentesco"]),
            persona_sk_por_idx.get(i),
            horas, dias,
            dur_valida, bool(r["es_robo"]),
            None, None,  # horas/dias_desde_anterior — pendiente
            None, None,  # score_criticidad, score_version
            r["detalle_del_ticket"], r["detalle_solucion"],
        ))

    if tickets_invalidos:
        print(f"  ⚠ {tickets_invalidos} reclamos con ticket_original no-numérico "
              f"saltados (no caben en bigint)")

    await dm.executemany(
        """
        INSERT INTO gota_dm.fact_tickets
            (ticket_id, fecha_registro_sk, hora_registro_sk, fecha_solucion_sk,
             hora_solucion_sk, distrito_sk, georef_sk, suministro_sk,
             orden_ticket_suministro, tipo_incidencia_sk, medio_recepcion_sk,
             estado_sk, semaforo_sk, tecnico_sk, usuario_registra_sk,
             usuario_soluciona_sk, alcance_sk, problema_sk, parentesco_sk,
             persona_sk, horas, dias, dur_valida, es_robo,
             horas_desde_anterior, dias_desde_anterior,
             score_criticidad, score_version,
             detalle_del_ticket, detalle_de_solucion)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,
                $19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)
        """,
        rows,
    )
    print(f"  fact_tickets: {len(rows)} filas insertadas")


async def _cargar_fact_historial(
    dm: asyncpg.Connection,
    propia: asyncpg.Connection,
    *,
    ticket_por_incidente: dict[str, int],
    estado_sk_por_codigo: dict[str, int],
    usuario_sk: dict[str, int],
) -> None:
    """1 fila = 1 evento de estado_incidente_evento. Se enlaza al fact_tickets
    del primer reclamo del incidente (por eso ticket_por_incidente)."""
    eventos = await propia.fetch(
        """
        SELECT e.incidente_id::text AS incidente_id,
               e.fecha,
               ce.codigo AS estado_codigo,
               u.username AS usuario_username
        FROM estado_incidente_evento e
        JOIN catalogo_estado ce ON ce.estado_id = e.estado_resultante_id
        LEFT JOIN usuario u ON u.usuario_id = e.usuario_id
        ORDER BY e.fecha
        """
    )
    rows: list[tuple[Any, ...]] = []
    huerfanos = 0
    for e in eventos:
        ticket_id = ticket_por_incidente.get(e["incidente_id"])
        if ticket_id is None:
            huerfanos += 1
            continue
        # Mapear código operacional ('CREADO'/'FINALIZADO'/…) al estado del datamart.
        # Fuera de esos dos, agrupar como 'Creado' (estado intermedio) o
        # 'Finalizado' según el código. Simple v1.
        codigo = e["estado_codigo"]
        estado_str = ESTADO_FINALIZADO if codigo == "FINALIZADO" else ESTADO_CREADO
        f: datetime = e["fecha"]
        rows.append((
            ticket_id,
            estado_sk_por_codigo[estado_str],
            _fecha_sk(f.date()),
            f.hour,
            usuario_sk.get(e["usuario_username"]) if e["usuario_username"] else None,
        ))
    if rows:
        await dm.executemany(
            """
            INSERT INTO gota_dm.fact_historial_estados
                (ticket_id, estado_sk, fecha_cambio_sk, hora_cambio_sk, usuario_cambio_sk)
            VALUES ($1, $2, $3, $4, $5)
            """,
            rows,
        )
    print(f"  fact_historial_estados: {len(rows)} eventos insertados "
          f"({huerfanos} eventos huérfanos saltados)")


async def _leer_source(propia: asyncpg.Connection) -> list[dict]:
    """Un solo SELECT que trae todos los reclamos ya con sus catálogos resueltos
    a texto — para no tener que hacer joins nuevamente en Python.

    Doble blindaje contra el JOIN:
      1. `DISTINCT ON (r.ticket_original)` en el subquery interno: si en
         `gota.reclamo` hay dos filas con el MISMO ticket_original (no hay
         UNIQUE constraint en la DDL, la unicidad depende del loader), nos
         quedamos con el reclamo más viejo (`ORDER BY … creado_en`). Esto
         permite usar `ticket_original` directo como `ticket_id` en el fact,
         que es lo natural para "buscar por número de ticket" en reportes.
      2. Después reordenamos por `fecha_registro` en el envoltorio para que
         el contador `orden_ticket_suministro` funcione correcto.

    Si algún ticket_original aparece más de una vez en reclamo, se imprime
    diagnóstico (ver `_diagnosticar_duplicados`)."""
    await _diagnosticar_duplicados(propia)
    reclamos_totales = await propia.fetchval("SELECT COUNT(*) FROM reclamo")
    rows = await propia.fetch(
        """
        SELECT * FROM (
            SELECT DISTINCT ON (r.ticket_original)
                r.reclamo_id::text AS reclamo_id,
                r.ticket_original,
                r.incidente_id::text AS incidente_id,
                r.fecha_registro,
                r.persona, r.dni, r.celular, r.telefono_fijo, r.correo,
                r.problema, r.tecnico_nombre, r.es_robo,
                r.detalle_del_ticket,
                r.distrito,
                i.suministro_codigo,
                i.fecha_solucion,
                i.detalle_solucion,
                cta.nombre AS tipo_de_atencion,
                ctg.codigo AS tipo_grupo,
                cmr.codigo AS medio_recepcion,
                ca.codigo  AS alcance,
                cp.codigo  AS parentesco,
                u_reg.username AS usuario_registra,
                u_sol.username AS usuario_soluciona
            FROM reclamo r
            JOIN incidente i ON i.incidente_id = r.incidente_id
            JOIN catalogo_tipo_atencion cta ON cta.tipo_atencion_id = i.tipo_atencion_id
            JOIN catalogo_tipo_grupo    ctg ON ctg.tipo_grupo_id = cta.tipo_grupo_id
            JOIN catalogo_medio_recepcion cmr ON cmr.medio_recepcion_id = r.medio_recepcion_id
            JOIN catalogo_alcance    ca ON ca.alcance_id = r.alcance_id
            JOIN catalogo_parentesco cp ON cp.parentesco_id = r.parentesco_id
            LEFT JOIN usuario u_reg ON u_reg.usuario_id = r.usuario_registra_id
            LEFT JOIN usuario u_sol ON u_sol.usuario_id = i.usuario_soluciona_id
            ORDER BY r.ticket_original, r.creado_en
        ) sub
        ORDER BY sub.fecha_registro
        """
    )
    if len(rows) != reclamos_totales:
        print(f"  ⚠ gota.reclamo tiene {reclamos_totales} filas, pero el datamart "
              f"cargará {len(rows)} (dedup por ticket_original — ver diagnóstico "
              f"arriba)")
    return [dict(r) for r in rows]


async def _diagnosticar_duplicados(propia: asyncpg.Connection) -> None:
    """Imprime cuántos ticket_original duplicados hay en `gota.reclamo` y algunos
    ejemplos. La DDL no tiene UNIQUE constraint sobre ticket_original — la
    unicidad depende del loader — así que si hubo cargas concurrentes o inserts
    manuales pueden aparecer duplicados. El datamart los colapsa (nos quedamos
    con el reclamo más viejo por ticket), pero conviene que Fabiana los vea para
    limpiarlos en la BD operacional si corresponde."""
    dupes = await propia.fetch(
        """
        SELECT ticket_original, COUNT(*) AS n
        FROM reclamo
        GROUP BY ticket_original
        HAVING COUNT(*) > 1
        ORDER BY n DESC, ticket_original
        LIMIT 10
        """
    )
    if not dupes:
        return
    total_dupes = await propia.fetchval(
        """
        SELECT COALESCE(SUM(n - 1), 0) FROM (
            SELECT COUNT(*) AS n FROM reclamo
            GROUP BY ticket_original HAVING COUNT(*) > 1
        ) x
        """
    )
    print(f"  ⚠ {total_dupes} filas sobrantes en gota.reclamo por ticket_original "
          f"repetido (top 10 tickets con más duplicados):")
    for d in dupes:
        print(f"      TICKET {d['ticket_original']}: {d['n']} filas")
    print("    → El datamart se queda con la fila más vieja por ticket "
          "(desempate por creado_en). Para limpiar la BD operacional, borrar "
          "los duplicados manualmente por reclamo_id.")


async def main() -> None:
    if not settings.datamart_db_url:
        raise RuntimeError(
            "DATAMART_NAME no está configurado en .env — no hay a dónde cargar."
        )

    propia = await asyncpg.connect(
        dsn=_to_asyncpg_dsn(settings.propia_db_url),
        server_settings=propia_connect_args()["server_settings"],
    )
    dm = await asyncpg.connect(dsn=_to_asyncpg_dsn(settings.datamart_db_url))

    try:
        source_rows = await _leer_source(propia)
        print(f"Reclamos leídos de gota: {len(source_rows)}")
        if not source_rows:
            print("Nada que cargar — la BD operacional no tiene reclamos.")
            return

        async with dm.transaction():
            await _truncar_datamart(dm)

            # --- dims estáticas ---
            print("Sembrando dims estáticas…")
            await _seed_dim_hora(dm)
            await _seed_dim_semaforo(dm)
            estado_sk = await _seed_dim_estado(dm)

            # --- dim_fecha (rango observado) ---
            fechas = [r["fecha_registro"].date() for r in source_rows] + [
                r["fecha_solucion"].date() for r in source_rows if r["fecha_solucion"]
            ]
            await _seed_dim_fecha(dm, min(fechas), max(fechas))

            # --- dims simples (natural key = 1 columna) ---
            print("Sembrando dims desde datos…")
            distrito_sk = await _seed_dim_simple(
                dm, "dim_distrito", "distrito",
                {r["distrito"] for r in source_rows},
            )
            medio_recepcion_sk = await _seed_dim_simple(
                dm, "dim_medio_recepcion", "medio_recepcion",
                {r["medio_recepcion"] for r in source_rows},
            )
            alcance_sk = await _seed_dim_simple(
                dm, "dim_alcance", "alcance",
                {r["alcance"] for r in source_rows},
            )
            parentesco_sk = await _seed_dim_simple(
                dm, "dim_parentesco", "parentesco",
                {r["parentesco"] for r in source_rows},
            )
            problema_sk = await _seed_dim_simple(
                dm, "dim_problema", "problema",
                {r["problema"] for r in source_rows if r["problema"]},
            )
            tecnico_sk = await _seed_dim_simple(
                dm, "dim_tecnico", "tecnico",
                {r["tecnico_nombre"] for r in source_rows if r["tecnico_nombre"]},
            )
            usernames = (
                {r["usuario_registra"] for r in source_rows if r["usuario_registra"]}
                | {r["usuario_soluciona"] for r in source_rows if r["usuario_soluciona"]}
            )
            usuario_sk = await _seed_dim_simple(dm, "dim_usuario", "usuario", usernames)

            # --- dims con lógica extra ---
            tipo_incidencia_sk = await _seed_dim_tipo_incidencia(
                dm,
                {(r["tipo_grupo"], r["tipo_de_atencion"]) for r in source_rows},
            )
            suministro_sk = await _seed_dim_suministro(dm, source_rows)
            persona_sk_por_idx = await _seed_dim_persona(dm, source_rows)
            print(f"  dim_persona: {len(set(persona_sk_por_idx.values()))} personas únicas "
                  f"({len(source_rows)} reclamos)")

            # --- dim_georef (cruce con sig.cajaagua/cajadesague) ---
            print("Cargando dim_georef desde sig…")
            georef_sk = await _seed_dim_georef(dm, propia, source_rows)

            # --- fact_tickets ---
            print("Cargando fact_tickets…")
            await _cargar_fact_tickets(
                dm, source_rows,
                distrito_sk=distrito_sk,
                suministro_sk=suministro_sk,
                georef_sk=georef_sk,
                tipo_incidencia_sk=tipo_incidencia_sk,
                medio_recepcion_sk=medio_recepcion_sk,
                estado_sk=estado_sk,
                alcance_sk=alcance_sk,
                problema_sk=problema_sk,
                parentesco_sk=parentesco_sk,
                tecnico_sk=tecnico_sk,
                usuario_sk=usuario_sk,
                persona_sk_por_idx=persona_sk_por_idx,
            )

            # --- fact_historial_estados ---
            print("Cargando fact_historial_estados…")
            # Mapa incidente_id → ticket_id (BIGINT del primer reclamo del incidente).
            # Un incidente puede agrupar N reclamos por dedup 72h; para el historial
            # de estados uso el ticket_id "principal" (el primer reclamo del incidente
            # ordenado por fecha_registro).
            ticket_por_incidente: dict[str, int] = {}
            for r in source_rows:
                try:
                    tid = int(r["ticket_original"])
                except (ValueError, TypeError):
                    continue
                # source_rows ya viene ORDER BY fecha_registro; el primero gana.
                ticket_por_incidente.setdefault(r["incidente_id"], tid)

            await _cargar_fact_historial(
                dm, propia,
                ticket_por_incidente=ticket_por_incidente,
                estado_sk_por_codigo=estado_sk,
                usuario_sk=usuario_sk,
            )

        print("\n✓ Datamart cargado.")
    finally:
        await propia.close()
        await dm.close()


if __name__ == "__main__":
    asyncio.run(main())
