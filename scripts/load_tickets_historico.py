"""Carga histórica de tickets ya normalizados
(`~/Documentos/tickets_v3_normalizado.parquet`) a la BD propia.

Toda la lógica de carga (catálogos, usuarios, geo, inserts) vive en
`scripts/tickets_loader.py` — este script solo lee el parquet y se lo pasa. Para
tickets crudos (sin normalizar) ver `scripts/etl_tickets_crudos.py`.

Uso: .venv/bin/python -m scripts.load_tickets_historico
"""

import asyncio
from pathlib import Path

import pandas as pd

from scripts.tickets_loader import cargar_dataframe

PARQUET_PATH = Path.home() / "Documentos" / "tickets_v3_normalizado.parquet"


async def main() -> None:
    df = pd.read_parquet(PARQUET_PATH)
    await cargar_dataframe(df)


if __name__ == "__main__":
    asyncio.run(main())
