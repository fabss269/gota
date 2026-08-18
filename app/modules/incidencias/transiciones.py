"""Máquina de estados de `incidente` (specs/05-acciones-incidencia.md).

No es una regla de negocio fija en el backend — Edgar planea configurar esto desde un
futuro portal admin (API.md §5). Se modela como estructura de datos en Python, no
hardcodeada dentro de `service.py`, para que mover esto a una tabla configurable el día
de mañana sea cambiar esta función, no reescribir el flujo.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Transicion:
    hacia: str
    requiere_formulario: bool


TRANSICIONES: dict[str, list[Transicion]] = {
    "CREADO": [Transicion(hacia="PENDIENTE", requiere_formulario=False)],
    "PENDIENTE": [Transicion(hacia="EN_PROGRESO", requiere_formulario=False)],
    "EN_PROGRESO": [
        Transicion(hacia="EN_PROGRESO", requiere_formulario=True),
        Transicion(hacia="ATENDIDO", requiere_formulario=False),
    ],
    "ATENDIDO": [],
}

# Los 7 valores fijos de motivo (API.md §5). `POST /avances` no recibe un estado
# destino explícito en el request — el motivo lo implica. Este mapeo es una decisión
# de implementación de Fase 3 (no estaba escrito en specs/05 en detalle), documentada
# aquí porque es justo el tipo de regla que Edgar quiere mover a un admin configurable
# más adelante: cambia esta constante, no la lógica de `service.py`.
MOTIVO_ESTADO: dict[str, str] = {
    "CUADRILLA_EN_SITIO": "EN_PROGRESO",
    "SE_RESOLVIO": "ATENDIDO",
    "REQUIERE_EQUIPO": "EN_PROGRESO",
    "DERIVAR_OTRA_AREA": "EN_PROGRESO",
    "REASIGNAR_TECNICO": "EN_PROGRESO",
    "EN_ESPERA": "EN_PROGRESO",
    "NO_SE_PUDO_ATENDER": "EN_PROGRESO",
}


def transicion_permitida(estado_actual: str, estado_destino: str) -> bool:
    return any(t.hacia == estado_destino for t in TRANSICIONES.get(estado_actual, []))
