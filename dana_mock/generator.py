"""Generador determinístico de tickets sintéticos.

No hay BD ni estado persistente acá — este servicio simula el sistema de tickets de
DANA mientras ellos no nos dan acceso a su API real (ver dana_mock/main.py). Un
ticket nuevo "llega" cada TICK_SEGUNDOS segundos de reloj real desde EPOCH — cada
tick es determinístico por su índice (mismo tick -> mismo ticket siempre, sin
importar cuándo se consulte ni cuántas veces se reinicie el proceso), así que no
hace falta guardar nada en disco: re-generar es gratis y da el mismo resultado.

Decisión 2026-08-04 con Edgar: cadencia rápida (5s) para que el pipeline completo
(mock -> ingest -> mapa) sea observable en minutos en vez de esperar días reales —
reemplaza el modelo anterior de "lote diario" (3-12 tickets por día calendario).

**Límite real a tener en cuenta**: `gota.incidente.codigo`/`reclamo.ticket_original`
son `varchar(5)` con `CHECK ~ '^[0-9]{5}$'` — exactamente 5 dígitos. Este generador
usa el rango reservado 90000-99999 (10.000 códigos, ver TICKET_BASE) para no chocar
con el histórico real (que ya ocupa 10000-19999 densamente). A 1 ticket/5s (12/min),
ese rango se agota en ~14 horas de operación continua — pasado ese punto los
`ticket_id` empiezan a repetirse y el dedup por TICKET del loader los empieza a
tratar como "ya cargados" (silenciosamente, no rompe nada, pero deja de haber
tickets nuevos reales hasta reiniciar el servicio con un EPOCH más nuevo).

`suministro`/`distrito`/`tipo_grupo` salen de `data/suministros_seed.json`, una
muestra real de `sig.cajaagua`/`sig.cajadesague.inscripcion` (excluyendo el sentinel
'00000000') — así los tickets sintéticos resuelven a un lat/lon real en
`CatastroEnrichmentService` del backend y sí aparecen pineados en el mapa, en vez de
quedar con latitud/longitud NULL como pasaría con un suministro inventado.
"""

from __future__ import annotations

import json
import random
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

SEED_PATH = Path(__file__).parent / "data" / "suministros_seed.json"
_SUMINISTROS: list[dict[str, str]] = json.loads(SEED_PATH.read_text(encoding="utf-8"))

# Un ticket nuevo cada TICK_SEGUNDOS de reloj real, contados desde EPOCH. Fijo en el
# código (no "ahora" al importar) para que el resultado sea reproducible entre
# reinicios del proceso — si se reinicia el servicio, sigue exactamente donde iba,
# no arranca de 0.
#
# Bajado de 5s a 60s el 2026-08-04 (pedido de Edgar, "que no se sobrecargue" — el
# rango reservado de 10.000 códigos de 5 dígitos se agotaba en ~14h a 5s/ticket;
# a 60s dura ~7 días). EPOCH reseteado a este cambio: mismo tick-index puede
# corresponder a un ticket distinto que antes (el contenido depende solo del índice,
# pero fecha_registro = EPOCH + tick*TICK_SEGUNDOS sí cambia con el rate) — no hay
# problema real porque el dedup de tickets_loader es por TICKET (string), no por
# contenido, así que lo ya cargado con el rate viejo se sigue salteando igual.
EPOCH = datetime(2026, 8, 4, 17, 7, 0)  # noqa: DTZ001 — naive a propósito, ver módulo
TICK_SEGUNDOS = 60


def _ahora_utc_naive() -> datetime:
    """"Ahora", siempre en UTC aunque el proceso corra en otro huso horario —
    `datetime.now()` a secas devuelve la hora LOCAL del sistema (naive), lo que
    rompe la comparación contra EPOCH (fijo, pensado como UTC) si este servicio
    corre en una máquina que no esté en UTC (ej. un sandbox de dev en horario de
    Perú, -05, vs. el contenedor desplegado que sí corre en UTC) — se detectó en
    vivo 2026-08-04: en dev daba 0 tickets porque "ahora" local quedaba 5h
    "antes" de EPOCH. Naive al final (sin tzinfo) para no romper la comparación
    directa con `fecha_registro`/EPOCH, que también son naive-pero-UTC."""
    return datetime.now(UTC).replace(tzinfo=None)

# Rango reservado para este simulador (ver límite de 5 dígitos en el docstring).
TICKET_BASE = 90_000
TICKET_MAX = 99_999

# Técnicos reales ya sembrados en gota (ver scripts/seed_dev.py y
# etl_tickets_crudos.TECNICO_ALIASES) — usar estos apellidos en detalle_del_ticket
# hace que extraer_tecnico() los resuelva de verdad, no a "Otro/no identificado".
TECNICOS = [
    "GONZALES", "BENITES", "RIVAS", "FLORES", "BAELLA", "CARDOZO",
]

TIPOS_ATENCION = {
    "AGUA": [
        "FUGA DE AGUA EN VIA PUBLICA",
        "FALTA DE AGUA",
        "BAJA PRESION DE AGUA",
        "FUGA EN CONEXION DOMICILIARIA",
    ],
    "DESAGUE": [
        "ATORO EN COLECTORES Y/O DESBORDE ALCANTARILLADO",
        "FUGA EN VEREDA",
        "ATORO EN CONEXION DOMICILIARIA",
        "DESBORDE DE BUZON",
    ],
}

MEDIOS_RECEPCION = [
    "presencial", "telefono", "app", "correo electrónico",
    "formulario web", "redes sociales",
]
PARENTESCOS = ["TITULAR", "TITULAR", "TITULAR", "FAMILIAR", "INQUILINO", "EXTRAÑO"]

NOMBRES = [
    "CARRASCO ESPINAR TOMAS", "MENDOZA RUIZ LUCIA", "VASQUEZ CASTRO JORGE",
    "SANTISTEBAN DIAZ ROSA", "CHAPOÑAN LLONTOP PEDRO", "FIESTAS NUÑEZ MARIA",
    "PEREZ TORRES CARLOS", "DAMIAN SILVA ANGELICA", "CUSTODIO REQUE MANUEL",
    "BURGA SALDAÑA ELENA",
]
OPERADORES = ["PEDRO.GARCIA", "MARIA.TORRES", "LUIS.DIAZ", "ANA.RAMOS"]

CALLES = [
    "LOS FAIQUES", "SANTA VICTORIA", "LOS INCAS", "SAN MARTIN",
    "LOS ANGELES", "TUPAC AMARU", "GRAU", "BOLOGNESI", "LEONCIO PRADO",
]


def _rng_del_tick(tick: int) -> random.Random:
    """RNG determinístico por índice de tick — el mismo tick siempre produce el
    mismo ticket, sin importar cuándo o cuántas veces se llame."""
    return random.Random(f"dana-mock-tick-{tick}")


def _direccion_del_suministro(suministro: str) -> str:
    """Determinística por SUMINISTRO (no por tick): una dirección es del predio/
    conexión, no cambia entre reclamos. Bug real encontrado 2026-08-04 — antes se
    sorteaba calle/número con el RNG del tick, así que el mismo suministro (mismo
    punto exacto en el mapa, reusado entre varios tickets porque el pool de
    suministros es chico) podía reportar una dirección distinta en cada ticket."""
    rng = random.Random(f"dana-mock-direccion-{suministro}")
    calle = rng.choice(CALLES)
    numero = rng.randint(100, 999)
    return f"{calle} NRO. {numero}"


def _generar_ticket(tick: int) -> dict[str, Any]:
    rng = _rng_del_tick(tick)
    fecha_registro = EPOCH + timedelta(seconds=tick * TICK_SEGUNDOS)

    suministro_info = rng.choice(_SUMINISTROS)
    tipo_grupo = suministro_info["tipo_grupo"]
    tipo_atencion = rng.choice(TIPOS_ATENCION[tipo_grupo])
    tecnico = rng.choice(TECNICOS)
    direccion = _direccion_del_suministro(suministro_info["suministro"])
    distrito = suministro_info["distrito"]

    # Rango reservado (ver docstring del módulo): módulo para que, si se agota,
    # siga respondiendo en vez de generar códigos de más de 5 dígitos — a partir de
    # ahí empiezan a repetirse ids y el dedup del loader los trata como "ya
    # cargados" (no rompe nada, simplemente deja de haber tickets nuevos).
    ticket_id = TICKET_BASE + (tick % (TICKET_MAX - TICKET_BASE + 1))

    ticket: dict[str, Any] = {
        "ticket": ticket_id,
        "alcance": "particular" if rng.random() < 0.85 else "general",
        "medio_recepcion": rng.choice(MEDIOS_RECEPCION),
        "fecha_registro": fecha_registro.isoformat(),
        "usuario_registra": rng.choice(OPERADORES),
        "distrito": distrito,
        "suministro": suministro_info["suministro"],
        "direccion": direccion,
        "persona": rng.choice(NOMBRES),
        "dni": str(rng.randint(10_000_000, 79_999_999)),
        "celular": f"9{rng.randint(10_000_000, 99_999_999)}",
        "telefono_fijo": None,
        "correo": None,
        "parentesco": rng.choice(PARENTESCOS),
        "grupo": "OPERACIONES",
        "tipo_grupo": tipo_grupo,
        "categoria": "RECLAMO OPERACIONAL",
        "tipo_de_atencion": tipo_atencion,
        "detalle_del_ticket": (
            f"USUARIO ESTA COMUNICANDO {tipo_atencion} EN {direccion.replace('NRO.', 'N°')} "
            f"{distrito}. TEC. {tecnico}"
        ),
        "estado_del_ticket": "Creado",
    }

    # ~40% de los tickets ya resueltos al momento de consultarlos — la demora de
    # resolución sigue siendo realista en horas/días (un técnico tarda lo que
    # tarda, independiente de qué tan rápido "llegan" tickets nuevos al sistema).
    # Nunca resolver "en el futuro": un ticket recién llegado puede caer en la
    # ventana de demora sorteada pero todavía no le tocó.
    if rng.random() < 0.4:
        demora = timedelta(hours=rng.randint(2, 96))
        fecha_solucion = fecha_registro + demora
        if fecha_solucion <= _ahora_utc_naive():
            ticket["usuario_soluciona"] = rng.choice(OPERADORES)
            ticket["detalle_de_solucion"] = rng.choice(["ATENDIDO", "SE ATENDIÓ", "SOLUCIONADO"])
            ticket["fecha_solucion"] = fecha_solucion.isoformat()
            ticket["estado_del_ticket"] = "Atendido"

    return ticket


def generar_tickets_hasta(ahora: datetime) -> list[dict[str, Any]]:
    """Todos los tickets "ya llegados" hasta `ahora` (todo tick cuyo fecha_registro
    calculado no supere `ahora`). Determinístico: llamar dos veces con el mismo
    `ahora` (o cualquier `ahora` dentro del mismo tick de 5s) da exactamente el
    mismo resultado."""
    tick_max = int((ahora - EPOCH).total_seconds() // TICK_SEGUNDOS)
    if tick_max < 0:
        return []
    return [_generar_ticket(tick) for tick in range(tick_max + 1)]
