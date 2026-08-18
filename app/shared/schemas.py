from pydantic import BaseModel


class Page[ItemT](BaseModel):
    items: list[ItemT]
    page: int
    page_size: int
    total: int
