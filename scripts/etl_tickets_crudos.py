"""ETL de tickets crudos (xlsx tal como llega, sin normalizar) a la BD propia.

A diferencia de `load_tickets_historico.py` (que parte de un parquet ya normalizado),
este script hace la normalización él mismo, para que sirva con cualquier exportación
cruda futura de tickets, no solo con la que ya teníamos procesada:

1. Deduplica por TICKET (se han visto exportaciones que se solapan).
2. Descarta filas sin SUMINISTRO (no hay forma de ubicarlas en el catastro).
3. Normaliza DETALLE DE SOLUCIÓN: decenas de variantes con errores de tipeo
   (ATENDIDA/ATENDIDA./ATENIDIDO/SE ATENDIÓ/FINALIZO/SOLUCIONADO/...) -> 'ATENDIDO' si
   hay algo, 'SIN_DATO' si está vacío (ambos casos ya se tratan igual en la carga:
   el ticket sí se resolvió, ver tickets_loader.py).
4. Extrae de DETALLE DEL TICKET (con regex, decisión de Edgar 2026-07-30: más simple
   que armar un diccionario de frases, acepta ~91-95% de acierto en el split
   problema/dirección — verificado contra tickets_v3_normalizado.parquet, que trae el
   resultado correcto de este mismo proceso sobre este mismo archivo, usado acá solo
   como referencia de validación, no como dependencia del script):
   - técnico: todo lo que sigue a "TEC." se busca contra apellidos conocidos.
   - problema / dirección_detalle: se parte en la primera "EN" de palabra completa
     (antes de "TEC."). Si no queda texto de dirección, se guarda el placeholder
     'SIN DETALLE DE DIRECCIÓN' (mismo valor que ya usaba el dataset de referencia).
   - es_robo: contiene "ROBO".
5. Carga progresiva: reutiliza `scripts/tickets_loader.cargar_dataframe`, que ya salta
   los tickets cuyo código ya existe en `incidente`.

Uso:
    .venv/bin/python -m scripts.etl_tickets_crudos ["ruta/al/archivo.xlsx"]
    (sin argumento, usa el xlsx que Edgar dejó en ~/Documentos)
"""

import argparse
import asyncio
import re
import unicodedata
from pathlib import Path

import pandas as pd

from scripts.tickets_loader import cargar_dataframe

DEFAULT_XLSX_PATH = Path.home() / "Documentos" / "tickets (1) (1) (1).xlsx"

COLUMNAS_RENOMBRADAS = {
    "MEDIO RECEPCIÓN": "MEDIO_RECEPCION",
    "FECHA REGISTRO": "FECHA_REGISTRO",
    "USUARIO REGISTRA": "USUARIO_REGISTRA",
    "TELEFONO FIJO": "TELEFONO_FIJO",
    "CORREO ELECTRÓNICO": "CORREO_ELECTRONICO",
    "TIPO GRUPO": "TIPO_GRUPO",
    "TIPO DE ATENCION": "TIPO_DE_ATENCION",
    "DETALLE DEL TICKET": "DETALLE_DEL_TICKET",
    "USUARIO SOLUCIONA": "USUARIO_SOLUCIONA",
    "DETALLE DE SOLUCIÓN": "DETALLE_DE_SOLUCION",
    "FECHA SOLUCION": "FECHA_SOLUCION",
}
# GRUPO/CATEGORÍA/ESTADO DEL TICKET no se usan en el esquema propio — se descartan.
COLUMNAS_A_DESCARTAR = ["GRUPO", "CATEGORÍA", "ESTADO DEL TICKET"]

SIN_DETALLE_DIRECCION = "SIN DETALLE DE DIRECCIÓN"

TEC_SPLIT_RE = re.compile(r"\bTEC\.?\s*", re.IGNORECASE)
EN_RE = re.compile(r"\bEN\b", re.IGNORECASE)

# Apellido/nombre reconocido (en el texto tras "TEC.") -> técnico canónico. Incluye
# alias de errores de tipeo frecuentes (EBNITES) y casos donde solo se escribió el
# nombre de pila (EVELIO) — verificado contra tickets_v3_normalizado.parquet.
TECNICO_ALIASES = {
    "GONZALES": "Juan Gonzales Rubio",
    "BENITES": "Luis Benites Urdiales",
    "EBNITES": "Luis Benites Urdiales",
    "RIVAS": "Guillermo Rivas Sanchez",
    "FLORES": "Evelio Flores Maluquis",
    "EVELIO": "Evelio Flores Maluquis",
    "BAELLA": "Jose Baella Delgado",
    "CARDOZO": "Oscar Cardozo Llatas",
}


def _ascii_upper(texto: str) -> str:
    return unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii").upper()


def extraer_problema_direccion(detalle: str) -> tuple[str, str]:
    cuerpo = TEC_SPLIT_RE.split(detalle, maxsplit=1)[0]
    match = EN_RE.search(cuerpo)
    if not match:
        return cuerpo.strip(), SIN_DETALLE_DIRECCION
    problema = cuerpo[: match.end()].strip()
    direccion = cuerpo[match.end() :].strip()
    return problema, direccion or SIN_DETALLE_DIRECCION


def extraer_tecnico(detalle: str) -> str:
    partes = TEC_SPLIT_RE.split(detalle, maxsplit=1)
    if len(partes) < 2 or not partes[1].strip():
        return "SIN_TECNICO"
    texto = _ascii_upper(partes[1])
    for alias, nombre in TECNICO_ALIASES.items():
        if alias in texto:
            return nombre
    return "Otro/no identificado"


def es_robo(detalle: str) -> bool:
    return "ROBO" in _ascii_upper(detalle)


def normalizar_detalle_solucion(valor: object) -> str:
    return "SIN_DATO" if pd.isna(valor) else "ATENDIDO"


def _excel_serial_a_datetime(columna: pd.Series) -> pd.Series:
    return pd.to_datetime(columna, unit="D", origin="1899-12-30")


def normalizar(df_crudo: pd.DataFrame) -> pd.DataFrame:
    df = df_crudo.rename(columns=COLUMNAS_RENOMBRADAS).drop(columns=COLUMNAS_A_DESCARTAR)
    # incidente.codigo/reclamo.ticket_original son varchar — comparar como texto, si
    # no la carga progresiva nunca detecta lo ya cargado (int64 vs varchar no calzan).
    df["TICKET"] = df["TICKET"].astype(str)

    antes = len(df)
    df = df.drop_duplicates(subset="TICKET", keep="first")
    print(f"Duplicados por TICKET descartados: {antes - len(df)}")

    antes = len(df)
    df = df[df["SUMINISTRO"].notna()].copy()
    print(f"Filas sin SUMINISTRO descartadas: {antes - len(df)}")

    df["SUMINISTRO"] = df["SUMINISTRO"].astype("int64").astype(str).str.zfill(8)
    df["DNI"] = df["DNI"].astype("int64").astype(str).str.zfill(8)
    df["CELULAR"] = df["CELULAR"].astype("int64").astype(str)
    df["TELEFONO_FIJO"] = df["TELEFONO_FIJO"].apply(
        lambda v: None if pd.isna(v) else str(int(v))
    )
    df["FECHA_SOLUCION"] = _excel_serial_a_datetime(df["FECHA_SOLUCION"])
    df["DETALLE_DE_SOLUCION"] = df["DETALLE_DE_SOLUCION"].apply(normalizar_detalle_solucion)

    extraido = df["DETALLE_DEL_TICKET"].apply(extraer_problema_direccion)
    df["problema"] = extraido.apply(lambda t: t[0])
    df["direccion_detalle"] = extraido.apply(lambda t: t[1])
    df["tecnico"] = df["DETALLE_DEL_TICKET"].apply(extraer_tecnico)
    df["es_robo"] = df["DETALLE_DEL_TICKET"].apply(es_robo)

    return df


async def main(xlsx_path: Path) -> None:
    df_crudo = pd.read_excel(xlsx_path)
    print(f"Filas leídas de {xlsx_path.name}: {len(df_crudo)}")
    df = normalizar(df_crudo)
    await cargar_dataframe(df)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "xlsx_path",
        nargs="?",
        default=str(DEFAULT_XLSX_PATH),
        help="Ruta al xlsx crudo de tickets (default: %(default)s)",
    )
    args = parser.parse_args()
    asyncio.run(main(Path(args.xlsx_path)))
