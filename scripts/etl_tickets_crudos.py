"""ETL de tickets crudos (xlsx tal como llega, sin normalizar) a la BD propia.

A diferencia de `load_tickets_historico.py` (que parte de un parquet ya normalizado),
este script hace la normalización él mismo, para que sirva con cualquier exportación
cruda futura de tickets, no solo con la que ya teníamos procesada:

1. Deduplica por TICKET (se han visto exportaciones que se solapan).
2. Filas sin SUMINISTRO: se separan del flujo principal y se guardan en
   gota.reclamo_sin_suministro (decisión Fabiana 2026-08-02). NO van a
   gota.incidente/reclamo porque ensuciarian los KPIs; NO van al datamart porque
   no aportan a analitica; pero se preservan para auditoria/regulatorio.
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

from scripts.tickets_loader import cargar_dataframe, cargar_sin_suministro

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


def normalizar(df_crudo: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Normaliza el df crudo. Retorna (df_con_suministro, df_sin_suministro).

    Los sin suministro NO se descartan: van al segundo df para persistirlos aparte
    en gota.reclamo_sin_suministro (auditoría/regulatorio, sin llegar al datamart).
    """
    df = df_crudo.rename(columns=COLUMNAS_RENOMBRADAS).drop(columns=COLUMNAS_A_DESCARTAR)
    # incidente.codigo/reclamo.ticket_original son varchar — comparar como texto, si
    # no la carga progresiva nunca detecta lo ya cargado (int64 vs varchar no calzan).
    df["TICKET"] = df["TICKET"].astype(str)

    antes = len(df)
    df = df.drop_duplicates(subset="TICKET", keep="first")
    print(f"Duplicados por TICKET descartados: {antes - len(df)}")

    # Separar el DataFrame en 2: con suministro (flujo normal) y sin suministro
    # (van a gota.reclamo_sin_suministro, NO al datamart).
    sin_sum_mask = df["SUMINISTRO"].isna()
    df_sin_suministro = df[sin_sum_mask].copy()
    df = df[~sin_sum_mask].copy()
    print(f"Con SUMINISTRO:    {len(df):,}  -> gota.incidente/reclamo")
    print(f"Sin SUMINISTRO:    {len(df_sin_suministro):,}  -> gota.reclamo_sin_suministro")

    df["SUMINISTRO"] = df["SUMINISTRO"].astype("int64").astype(str).str.zfill(8)
    df["DNI"] = df["DNI"].astype("int64").astype(str).str.zfill(8)
    df["CELULAR"] = df["CELULAR"].astype("int64").astype(str)
    df["TELEFONO_FIJO"] = df["TELEFONO_FIJO"].apply(
        lambda v: None if pd.isna(v) else str(int(v))
    )
    # FECHA_SOLUCION y USUARIO_SOLUCIONA pueden estar vacíos si el ticket todavía no
    # está resuelto (típico cuando llega por API — el operador crea el reclamo, el
    # técnico lo cierra después). Se manejan como NaT / None y el loader los guarda
    # como NULL en incidente + estado_actual_id = 'CREADO'.
    # Convertimos serial Excel -> datetime en toda la columna. `errors='coerce'` deja
    # NaT para los valores 0 o NaN. En pandas 3.x no se puede asignar un DatetimeArray
    # a un slice de columna float64, hay que convertir la columna entera.
    df["FECHA_SOLUCION"] = df["FECHA_SOLUCION"].replace(0, pd.NA)
    df["FECHA_SOLUCION"] = pd.to_datetime(
        df["FECHA_SOLUCION"], unit="D", origin="1899-12-30", errors="coerce"
    )
    df["USUARIO_SOLUCIONA"] = df["USUARIO_SOLUCIONA"].where(
        df["USUARIO_SOLUCIONA"].notna(), None
    )
    df["DETALLE_DE_SOLUCION"] = df["DETALLE_DE_SOLUCION"].apply(normalizar_detalle_solucion)

    extraido = df["DETALLE_DEL_TICKET"].apply(extraer_problema_direccion)
    df["problema"] = extraido.apply(lambda t: t[0])
    df["direccion_detalle"] = extraido.apply(lambda t: t[1])
    df["tecnico"] = df["DETALLE_DEL_TICKET"].apply(extraer_tecnico)
    df["es_robo"] = df["DETALLE_DEL_TICKET"].apply(es_robo)

    # Aplicar las mismas transformaciones al df sin suministro (excepto SUMINISTRO)
    if not df_sin_suministro.empty:
        df_sin_suministro["DNI"] = df_sin_suministro["DNI"].astype("int64").astype(str).str.zfill(8)
        df_sin_suministro["CELULAR"] = df_sin_suministro["CELULAR"].astype("int64").astype(str)
        df_sin_suministro["TELEFONO_FIJO"] = df_sin_suministro["TELEFONO_FIJO"].apply(
            lambda v: None if pd.isna(v) else str(int(v))
        )
        df_sin_suministro["FECHA_SOLUCION"] = df_sin_suministro["FECHA_SOLUCION"].replace(0, pd.NA)
        df_sin_suministro["FECHA_SOLUCION"] = pd.to_datetime(
            df_sin_suministro["FECHA_SOLUCION"], unit="D", origin="1899-12-30", errors="coerce"
        )
        df_sin_suministro["USUARIO_SOLUCIONA"] = df_sin_suministro["USUARIO_SOLUCIONA"].where(
            df_sin_suministro["USUARIO_SOLUCIONA"].notna(), None
        )
        df_sin_suministro["DETALLE_DE_SOLUCION"] = df_sin_suministro["DETALLE_DE_SOLUCION"].apply(
            normalizar_detalle_solucion
        )
        extraido_ss = df_sin_suministro["DETALLE_DEL_TICKET"].apply(extraer_problema_direccion)
        df_sin_suministro["problema"] = extraido_ss.apply(lambda t: t[0])
        df_sin_suministro["direccion_detalle"] = extraido_ss.apply(lambda t: t[1])
        df_sin_suministro["tecnico"] = df_sin_suministro["DETALLE_DEL_TICKET"].apply(extraer_tecnico)
        df_sin_suministro["es_robo"] = df_sin_suministro["DETALLE_DEL_TICKET"].apply(es_robo)

    return df, df_sin_suministro


async def main(xlsx_path: Path) -> None:
    df_crudo = pd.read_excel(xlsx_path)
    print(f"Filas leídas de {xlsx_path.name}: {len(df_crudo)}")
    df, df_sin_suministro = normalizar(df_crudo)
    await cargar_dataframe(df)
    if not df_sin_suministro.empty:
        await cargar_sin_suministro(df_sin_suministro)


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
