"""Seed de datos de desarrollo para la BD propia local (`gota`).

Idempotente (ON CONFLICT DO NOTHING / verificación de existencia) — se puede correr
varias veces sin duplicar filas. Usa códigos `suministro_codigo` reales verificados
contra `sig` (inscripcion de cajaagua/cajadesague en Chiclayo) para que
`CatastroEnrichmentService` tenga datos reales con los que resolver durante pruebas.

Uso: .venv/bin/python -m scripts.seed_dev
"""

import asyncio
from datetime import UTC, datetime, timedelta

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import settings
from app.core.security import hash_password


async def main() -> None:
    engine = create_async_engine(settings.propia_db_url)
    async with engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO rol (codigo, nombre) VALUES ('supervisor', 'Supervisor') "
                 "ON CONFLICT (codigo) DO NOTHING")
        )

        await conn.execute(
            text(
                """
                INSERT INTO area (codigo, nombre) VALUES
                    ('CUAD-NORTE', 'Cuadrilla Norte'),
                    ('CUAD-SUR', 'Cuadrilla Sur'),
                    ('MESA-PARTES', 'Mesa de Partes')
                ON CONFLICT (codigo) DO NOTHING
                """
            )
        )

        await conn.execute(
            text(
                """
                INSERT INTO catalogo_motivo (codigo, nombre) VALUES
                    ('CUADRILLA_EN_SITIO', 'Cuadrilla en sitio'),
                    ('SE_RESOLVIO', 'Se resolvió'),
                    ('REQUIERE_EQUIPO', 'Requiere equipo adicional'),
                    ('DERIVAR_OTRA_AREA', 'Derivar a otra área'),
                    ('REASIGNAR_TECNICO', 'Reasignar técnico'),
                    ('EN_ESPERA', 'En espera'),
                    ('NO_SE_PUDO_ATENDER', 'No se pudo atender')
                """
            )
        )
        # catalogo_motivo.codigo no es unique en el DDL — evitar duplicar en reruns.
        existentes = await conn.execute(text("SELECT count(*) FROM catalogo_motivo"))
        if existentes.scalar() > 7:
            await conn.execute(
                text(
                    """
                    DELETE FROM catalogo_motivo a USING catalogo_motivo b
                    WHERE a.motivo_id > b.motivo_id AND a.codigo = b.codigo
                    """
                )
            )

        await conn.execute(
            text(
                """
                INSERT INTO catalogo_prioridad (codigo, nombre, orden) VALUES
                    ('a_tiempo', 'A tiempo', 1),
                    ('alerta', 'Alerta', 2),
                    ('critica', 'Crítica', 3)
                ON CONFLICT (codigo) DO NOTHING
                """
            )
        )

        await conn.execute(
            text(
                """
                INSERT INTO catalogo_parentesco (codigo, nombre) VALUES
                    ('titular', 'Titular'),
                    ('vecino', 'Vecino'),
                    ('familiar', 'Familiar')
                ON CONFLICT (codigo) DO NOTHING
                """
            )
        )

        await conn.execute(
            text(
                """
                INSERT INTO catalogo_alcance (codigo, nombre) VALUES
                    ('individual', 'Individual'),
                    ('masivo', 'Masivo')
                ON CONFLICT (codigo) DO NOTHING
                """
            )
        )

        await conn.execute(
            text(
                """
                INSERT INTO catalogo_medio_recepcion (codigo, nombre) VALUES
                    ('telefono', 'Teléfono'),
                    ('app', 'App móvil'),
                    ('presencial', 'Presencial')
                ON CONFLICT (codigo) DO NOTHING
                """
            )
        )

        supervisor_hash = hash_password("epsel2026")
        await conn.execute(
            text(
                """
                INSERT INTO usuario (dni, username, nombres, apellidos, email, password_hash, rol_id)
                SELECT '99999999', 'mparedes', 'María', 'Paredes', 'supervisor@epsel.gob.pe',
                       :password_hash, rol_id
                FROM rol WHERE codigo = 'supervisor'
                ON CONFLICT (username) DO NOTHING
                """
            ),
            {"password_hash": supervisor_hash},
        )

        tecnico_id = (
            await conn.execute(
                text("SELECT usuario_id FROM usuario WHERE username = 'jgonzales'")
            )
        ).scalar_one()
        area_norte_id = (
            await conn.execute(text("SELECT area_id FROM area WHERE codigo = 'CUAD-NORTE'"))
        ).scalar_one()
        tipo_fuga_id = (
            await conn.execute(
                text("SELECT tipo_atencion_id FROM catalogo_tipo_atencion WHERE codigo = 'fuga-agua'")
            )
        ).scalar_one()
        tipo_atoro_id = (
            await conn.execute(
                text(
                    "SELECT tipo_atencion_id FROM catalogo_tipo_atencion WHERE codigo = 'atoro-colector'"
                )
            )
        ).scalar_one()
        estados = dict(
            (await conn.execute(text("SELECT codigo, estado_id FROM catalogo_estado"))).all()
        )

        # (codigo, suministro, tipo_atencion_id, lat, lon) — puntos reales de sig (Chiclayo).
        incidentes = [
            ("EPS-00001", "01435687", tipo_fuga_id, -6.775152748982132, -79.84084749601648),
            ("EPS-00002", "01466924", tipo_fuga_id, -6.773364636433043, -79.84241710731592),
            ("EPS-00003", "01034808", tipo_atoro_id, -6.769285136973296, -79.86639137489172),
            ("EPS-00004", "01035207", tipo_atoro_id, -6.768949568682392, -79.86822014066566),
        ]

        now = datetime.now(UTC).replace(tzinfo=None)
        for codigo, suministro, tipo_id, lat, lon in incidentes:
            existe = await conn.execute(
                text("SELECT incidente_id FROM incidente WHERE codigo = :codigo"),
                {"codigo": codigo},
            )
            incidente_id = existe.scalar()
            if incidente_id is None:
                incidente_id = (
                    await conn.execute(
                        text(
                            """
                            INSERT INTO incidente
                                (codigo, suministro_codigo, direccion, distrito, tipo_atencion_id,
                                 creado_en, latitud, longitud)
                            VALUES (:codigo, :suministro, :direccion, 'Chiclayo', :tipo_id,
                                    :creado_en, :lat, :lon)
                            RETURNING incidente_id
                            """
                        ),
                        {
                            "codigo": codigo,
                            "suministro": suministro,
                            "direccion": f"Dirección de prueba {codigo}, Chiclayo",
                            "tipo_id": tipo_id,
                            "creado_en": now - timedelta(days=3),
                            "lat": lat,
                            "lon": lon,
                        },
                    )
                ).scalar_one()

                await conn.execute(
                    text(
                        """
                        INSERT INTO reclamo
                            (ticket_original, incidente_id, dni, persona, celular, parentesco_id,
                             direccion_detalle, distrito, alcance_id, medio_recepcion_id,
                             detalle_del_ticket, problema, fecha_registro, usuario_registra_id)
                        SELECT :ticket, :incidente_id, '12345678', 'Vecino de Prueba', '987654321',
                               p.parentesco_id, :direccion, 'Chiclayo', a.alcance_id, m.medio_recepcion_id,
                               'Ticket de prueba (seed)', 'Descripción de prueba (seed)',
                               :fecha_registro, :usuario_id
                        FROM catalogo_parentesco p, catalogo_alcance a, catalogo_medio_recepcion m
                        WHERE p.codigo = 'titular' AND a.codigo = 'individual' AND m.codigo = 'telefono'
                        """
                    ),
                    {
                        "ticket": f"{codigo}-OLD",
                        "incidente_id": incidente_id,
                        "direccion": f"Dirección de prueba {codigo}, Chiclayo",
                        "fecha_registro": now - timedelta(days=3),
                        "usuario_id": tecnico_id,
                    },
                )

                await conn.execute(
                    text(
                        """
                        INSERT INTO estado_incidente_evento (incidente_id, fecha, estado_resultante_id)
                        VALUES (:incidente_id, :fecha, :estado_id)
                        """
                    ),
                    {
                        "incidente_id": incidente_id,
                        "fecha": now - timedelta(days=3),
                        "estado_id": estados["CREADO"],
                    },
                )

                # EPS-00001: flujo completo hasta EN_PROGRESO con técnico asignado.
                # EPS-00003: hasta PENDIENTE. EPS-00004: flujo completo hasta ATENDIDO.
                # EPS-00002: se queda en CREADO.
                pasos: list[tuple[str, str | None, int | None]] = []
                if codigo == "EPS-00001":
                    pasos = [("PENDIENTE", None, None), ("EN_PROGRESO", str(tecnico_id), area_norte_id)]
                elif codigo == "EPS-00003":
                    pasos = [("PENDIENTE", None, None)]
                elif codigo == "EPS-00004":
                    pasos = [
                        ("PENDIENTE", None, None),
                        ("EN_PROGRESO", str(tecnico_id), area_norte_id),
                        ("ATENDIDO", str(tecnico_id), area_norte_id),
                    ]

                for i, (estado_codigo, usuario_id, area_id) in enumerate(pasos, start=1):
                    await conn.execute(
                        text(
                            """
                            INSERT INTO estado_incidente_evento
                                (incidente_id, fecha, estado_resultante_id, usuario_id, area_id, motivo)
                            VALUES (:incidente_id, :fecha, :estado_id, :usuario_id, :area_id, :motivo)
                            """
                        ),
                        {
                            "incidente_id": incidente_id,
                            "fecha": now - timedelta(days=3 - i, hours=i),
                            "estado_id": estados[estado_codigo],
                            "usuario_id": usuario_id,
                            "area_id": area_id,
                            "motivo": "CUADRILLA_EN_SITIO" if usuario_id else None,
                        },
                    )

                print(f"Sembrado {codigo} ({incidente_id})")
            else:
                print(f"{codigo} ya existía, no se reinsertó")

    await engine.dispose()
    print("Seed completo.")


if __name__ == "__main__":
    asyncio.run(main())
