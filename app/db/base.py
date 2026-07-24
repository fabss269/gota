from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Base declarativa de los modelos ORM de la BD propia.

    `sig` (bd_conhydra) no tiene modelos ORM propios — es de solo lectura y se
    consulta con SQL explícito (ver app/db/sig.py), para dejar clarísimo en el código
    que nunca se le hace INSERT/UPDATE/DELETE desde este servicio.
    """
