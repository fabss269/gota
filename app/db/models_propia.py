"""Modelos ORM del esquema `gota` (dentro de `bd_conhydra`).

Un único lugar de mapeo por tabla — los `repository.py` de cada módulo importan de
aquí lo que necesiten, en vez de redeclarar el mapeo (SQLAlchemy no permite dos clases
mapeadas independientes sobre la misma tabla física). Se agregan modelos a medida que
se implementan los módulos que los usan, no todos de una vez.
"""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Rol(Base):
    __tablename__ = "rol"

    rol_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    descripcion: Mapped[str | None]
    activo: Mapped[bool] = mapped_column(server_default=text("true"))


class Usuario(Base):
    __tablename__ = "usuario"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    dni: Mapped[str] = mapped_column(unique=True)
    username: Mapped[str] = mapped_column(unique=True)
    nombres: Mapped[str]
    apellidos: Mapped[str]
    email: Mapped[str | None] = mapped_column(unique=True)
    telefono: Mapped[str | None]
    password_hash: Mapped[str]
    rol_id: Mapped[int] = mapped_column(ForeignKey("rol.rol_id"))
    area_id: Mapped[int | None]
    activo: Mapped[bool] = mapped_column(server_default=text("true"))
    ultimo_login: Mapped[datetime | None]
    creado_en: Mapped[datetime] = mapped_column(server_default=text("now()"))
    # el DDL declara `avatarUrl` sin comillas -> Postgres lo pliega a minúsculas
    # (`avatarurl`); mapear con el nombre real, no el que aparece en el DDL.
    avatarurl: Mapped[str | None] = mapped_column("avatarurl")

    rol: Mapped[Rol] = relationship(lazy="joined")


class CatalogoEstado(Base):
    __tablename__ = "catalogo_estado"

    estado_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    color_hex: Mapped[str | None]
    orden: Mapped[int] = mapped_column(server_default=text("0"))
    activo: Mapped[bool] = mapped_column(server_default=text("true"))


class CatalogoTipoGrupo(Base):
    __tablename__ = "catalogo_tipo_grupo"

    tipo_grupo_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]


class CatalogoTipoAtencion(Base):
    __tablename__ = "catalogo_tipo_atencion"

    tipo_atencion_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    tipo_grupo_id: Mapped[int] = mapped_column(ForeignKey("catalogo_tipo_grupo.tipo_grupo_id"))
    activo: Mapped[bool] = mapped_column(server_default=text("true"))

    tipo_grupo: Mapped[CatalogoTipoGrupo] = relationship(lazy="joined")


class CatalogoPrioridad(Base):
    __tablename__ = "catalogo_prioridad"

    prioridad_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    color_hex: Mapped[str | None]
    orden: Mapped[int] = mapped_column(server_default=text("0"))


class Area(Base):
    __tablename__ = "area"

    area_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]
    color_hex: Mapped[str | None]
    activo: Mapped[bool] = mapped_column(server_default=text("true"))


class Incidente(Base):
    __tablename__ = "incidente"

    incidente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    codigo: Mapped[str] = mapped_column(unique=True)
    suministro_codigo: Mapped[str]
    direccion: Mapped[str | None]
    distrito: Mapped[str]
    tipo_atencion_id: Mapped[int] = mapped_column(
        ForeignKey("catalogo_tipo_atencion.tipo_atencion_id")
    )
    creado_en: Mapped[datetime] = mapped_column(server_default=text("now()"))
    latitud: Mapped[float | None]
    longitud: Mapped[float | None]

    tipo_atencion: Mapped[CatalogoTipoAtencion] = relationship(lazy="joined")


class Reclamo(Base):
    __tablename__ = "reclamo"

    reclamo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    ticket_original: Mapped[str]
    incidente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidente.incidente_id"))
    dni: Mapped[str | None]
    persona: Mapped[str]
    direccion_detalle: Mapped[str | None]
    detalle_del_ticket: Mapped[str | None]
    problema: Mapped[str | None]
    fecha_registro: Mapped[datetime]
    medio_recepcion_id: Mapped[int] = mapped_column(
        ForeignKey("catalogo_medio_recepcion.medio_recepcion_id")
    )

    medio_recepcion: Mapped["CatalogoMedioRecepcion"] = relationship(lazy="joined")


class CatalogoMedioRecepcion(Base):
    __tablename__ = "catalogo_medio_recepcion"

    medio_recepcion_id: Mapped[int] = mapped_column(primary_key=True)
    codigo: Mapped[str] = mapped_column(unique=True)
    nombre: Mapped[str]


class EstadoIncidenteEvento(Base):
    __tablename__ = "estado_incidente_evento"

    evento_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    incidente_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("incidente.incidente_id"))
    fecha: Mapped[datetime] = mapped_column(server_default=text("now()"))
    motivo: Mapped[str | None]
    nota: Mapped[str | None]
    estado_resultante_id: Mapped[int] = mapped_column(ForeignKey("catalogo_estado.estado_id"))
    usuario_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("usuario.usuario_id"))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("area.area_id"))

    estado_resultante: Mapped[CatalogoEstado] = relationship(lazy="joined")
    usuario: Mapped["Usuario | None"] = relationship(lazy="joined")
    area: Mapped[Area | None] = relationship(lazy="joined")
