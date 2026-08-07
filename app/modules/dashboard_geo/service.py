"""Service del dashboard operativo.

Convierte los rows crudos del repository en schemas Pydantic y encapsula la
lógica de "período" (anual / mensual) que compara ventana actual vs. previa.
"""
from datetime import datetime, timedelta
from typing import Literal

from sqlalchemy import text

from app.core.exceptions import NoEncontradoError
from app.modules.dashboard_geo.repository import DashboardGeoRepository
from app.modules.dashboard_geo.schemas import (
    AlertaOut,
    HeatmapSectorOut,
    IncidenciaPopupOut,
    KpiOut,
    KpiPuntoSparklineOut,
    KpisOut,
    MultiReclamoOut,
    ParentescoSliceOut,
    PrediccionSectorOut,
    ReclamoDetalleOut,
    ReincidenteOut,
    SectorRankOut,
    SerieMensualOut,
    SeriePuntoOut,
    SerieStackedOut,
    SerieStackedPuntoOut,
    SerieTiempoResolucionOut,
    SinSolucionRowOut,
    StorytellingOut,
    TramoRankOut,
)

# ============ Helpers de período ============
#
# Toda la data histórica llega hasta 2026-08-04 (aprox). No usamos now() como
# ancla porque en dev/demo la fecha real (2026-08-07) sería posterior a la
# última data. Anclamos al máximo timestamp de la MV para que las ventanas
# tengan siempre data adentro.

async def _fecha_ancla_desde_mv(repo: DashboardGeoRepository) -> datetime:
    res = (
        await repo._session.execute(
            text("SELECT COALESCE(MAX(creado_en), now()) AS ancla FROM gota.mv_incidente_enriquecido")
        )
    ).scalar_one()
    return res if isinstance(res, datetime) else datetime.combine(res, datetime.min.time())


async def _fecha_min_desde_mv(repo: DashboardGeoRepository) -> datetime | None:
    """Fecha del primer incidente en la MV — para saber si un período previo
    está totalmente antes de que existan datos."""
    res = (
        await repo._session.execute(
            text("SELECT MIN(creado_en) AS min FROM gota.mv_incidente_enriquecido")
        )
    ).scalar_one_or_none()
    return res if isinstance(res, datetime) else None


def _rangos_periodo(
    periodo: Literal["anual", "mensual"],
    ancla: datetime,
    anio: int | None = None,
    mes: int | None = None,
):
    """Devuelve (actual_desde, actual_hasta, previo_desde, previo_hasta).

    Si `anio` (y `mes` cuando mensual) están definidos, se usan; caso contrario
    se toma el año/mes de la fecha ancla (último con data).
    """
    # Los timestamps `creado_en` en la BD son naive (timestamp without time zone),
    # así que los rangos también se construyen naive.
    if periodo == "anual":
        y = anio or ancla.year
        actual_desde = datetime(y, 1, 1)          # noqa: DTZ001
        actual_hasta = datetime(y + 1, 1, 1)      # noqa: DTZ001
        previo_desde = datetime(y - 1, 1, 1)      # noqa: DTZ001
        previo_hasta = datetime(y, 1, 1)          # noqa: DTZ001
    else:  # mensual
        y = anio or ancla.year
        m = mes or ancla.month
        actual_desde = datetime(y, m, 1)          # noqa: DTZ001
        actual_hasta = (
            datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)   # noqa: DTZ001
        )
        if m == 1:
            previo_desde = datetime(y - 1, 12, 1)  # noqa: DTZ001
            previo_hasta = datetime(y, 1, 1)       # noqa: DTZ001
        else:
            previo_desde = datetime(y, m - 1, 1)   # noqa: DTZ001
            previo_hasta = datetime(y, m, 1)       # noqa: DTZ001
    return actual_desde, actual_hasta, previo_desde, previo_hasta


def _delta_pct(actual: float | None, previo: float | None) -> float | None:
    if actual is None or previo is None or previo == 0:
        return None
    return round(((actual - previo) / previo) * 100, 1)


def _delta_abs(actual: float | None, previo: float | None) -> float | None:
    if actual is None or previo is None:
        return None
    return round(actual - previo, 1)


class DashboardGeoService:
    def __init__(self, repo: DashboardGeoRepository) -> None:
        self._repo = repo

    # ---------------- Popup ----------------

    async def popup(self, codigo: str) -> IncidenciaPopupOut:
        row = await self._repo.popup_incidencia(codigo)
        if row is None:
            raise NoEncontradoError(f"Incidencia {codigo} no existe")
        reclamos = [
            ReclamoDetalleOut(fecha=r["fecha"], detalle=r.get("detalle"))
            for r in (row["reclamos"] or [])
        ]
        return IncidenciaPopupOut(
            codigo=row["codigo"],
            suministro=row["suministro_codigo"],
            direccion=row["direccion"],
            tipo_atencion=row["tipo_atencion"],
            grupo=row["grupo"],
            sector=row["sector_nombre"],
            creado_en=row["creado_en"],
            fecha_solucion=row["fecha_solucion"],
            dias_hasta_solucion=row["dias_hasta_solucion"],
            sin_solucion=row["sin_solucion"],
            reclamos=reclamos,
        )

    # ---------------- KPIs ----------------

    async def kpis(
        self,
        periodo: Literal["anual", "mensual"],
        grupo: str | None,
        sectorid: int | None,
        anio: int | None = None,
        mes: int | None = None,
    ) -> KpisOut:
        ancla = await _fecha_ancla_desde_mv(self._repo)
        a_desde, a_hasta, p_desde, p_hasta = _rangos_periodo(periodo, ancla, anio, mes)

        actual = await self._repo._agregado_ventana(a_desde, a_hasta, grupo, sectorid)

        # Si el período previo está totalmente antes de que exista data, no
        # hay con qué comparar → devolvemos ceros que resultarán en delta=null
        # via _delta_pct/_delta_abs (que devuelven None si previo es None).
        min_fecha = await _fecha_min_desde_mv(self._repo)
        if min_fecha and p_hasta <= min_fecha:
            previo = {"volumen": None, "sin_solucion": None,
                      "tiempo_mediano_dias": None, "robos": None}
        else:
            previo = await self._repo._agregado_ventana(p_desde, p_hasta, grupo, sectorid)

        bucket = "month" if periodo == "anual" else "week"
        spark_vol = await self._repo.sparkline_volumen(a_desde, a_hasta, grupo, sectorid, bucket)
        spark_robos = await self._repo.sparkline_robos(a_desde, a_hasta, grupo, sectorid, bucket)
        spark_tm = await self._repo.sparkline_tiempo_mediano(a_desde, a_hasta, grupo, sectorid, bucket)

        def _to_spark(rows):
            return [KpiPuntoSparklineOut(x=str(r["x"]), y=float(r["y"] or 0)) for r in rows]

        # Nota: previo puede ser None (período previo sin data). Los valores
        # actuales sí se defaultean a 0 cuando la MV devuelve nulls.
        vol_a = actual["volumen"] or 0
        vol_p = previo["volumen"]
        tm_a = float(actual["tiempo_mediano_dias"]) if actual["tiempo_mediano_dias"] is not None else None
        tm_p = float(previo["tiempo_mediano_dias"]) if previo["tiempo_mediano_dias"] is not None else None
        rob_a = actual["robos"] or 0
        rob_p = previo["robos"]
        ss_a = actual["sin_solucion"] or 0
        ss_p = previo["sin_solucion"]

        volumen = KpiOut(
            valor=float(vol_a),
            delta_pct=_delta_pct(vol_a, vol_p),
            delta_abs=_delta_abs(vol_a, vol_p),
            sparkline=_to_spark(spark_vol),
        )
        tiempo = KpiOut(
            valor=float(tm_a or 0),
            delta_pct=_delta_pct(tm_a, tm_p),
            delta_abs=_delta_abs(tm_a, tm_p),
            sparkline=_to_spark(spark_tm),
        )
        robos = KpiOut(
            valor=float(rob_a),
            delta_pct=_delta_pct(rob_a, rob_p),
            delta_abs=_delta_abs(rob_a, rob_p),
            sparkline=_to_spark(spark_robos),
        )
        sin_sol = KpiOut(
            valor=float(ss_a),
            delta_pct=_delta_pct(ss_a, ss_p),
            delta_abs=_delta_abs(ss_a, ss_p),
            sparkline=[],
        )
        return KpisOut(volumen=volumen, tiempo_mediano_dias=tiempo, robos=robos, sin_solucion=sin_sol)

    # ---------------- Storytelling ----------------

    async def storytelling(
        self,
        periodo: Literal["anual", "mensual"],
        grupo: str | None,
        sectorid: int | None,
        anio: int | None = None,
        mes: int | None = None,
    ) -> StorytellingOut:
        ancla = await _fecha_ancla_desde_mv(self._repo)
        a_desde, a_hasta, p_desde, p_hasta = _rangos_periodo(periodo, ancla, anio, mes)
        actual = await self._repo._agregado_ventana(a_desde, a_hasta, grupo, sectorid)
        previo = await self._repo._agregado_ventana(p_desde, p_hasta, grupo, sectorid)

        top = await self._repo.sectores_ranking(limite=1, grupo=grupo)
        top_sector = top[0]["sector"] if top else None
        top_pct = None
        if top and actual["volumen"]:
            top_pct = round(top[0]["n_incidencias"] * 100 / actual["volumen"], 1)

        delta_vol = _delta_pct(actual["volumen"], previo["volumen"])
        delta_tm = _delta_pct(
            float(actual["tiempo_mediano_dias"]) if actual["tiempo_mediano_dias"] is not None else None,
            float(previo["tiempo_mediano_dias"]) if previo["tiempo_mediano_dias"] is not None else None,
        )

        periodo_lbl = "este año" if periodo == "anual" else "este mes"
        partes = [f"{int(actual['volumen'])} incidencias {periodo_lbl}"]
        if delta_vol is not None:
            signo = "↑" if delta_vol > 0 else "↓"
            partes.append(f"{signo} {abs(delta_vol)}% vs. período anterior")
        if top_sector and top_pct:
            partes.append(f"{top_sector} concentra {top_pct}%")
        if actual["tiempo_mediano_dias"]:
            tm = round(float(actual["tiempo_mediano_dias"]), 1)
            frase = f"tiempo mediano de resolución: {tm} días"
            if delta_tm is not None:
                signo = "↑" if delta_tm > 0 else "↓"
                frase += f" ({signo} {abs(delta_tm)}%)"
            partes.append(frase)
        if actual["robos"]:
            partes.append(f"{int(actual['robos'])} robos de medidor")

        return StorytellingOut(
            periodo=("Año " + str(ancla.year)) if periodo == "anual"
                    else ancla.strftime("Mes %Y-%m"),
            texto=" · ".join(partes),
        )

    # ---------------- Sectores ----------------

    async def sectores(self, limite: int, grupo: str | None) -> list[SectorRankOut]:
        rows = await self._repo.sectores_ranking(limite, grupo)
        return [
            SectorRankOut(
                sectorid=r["sectorid"], sector=r["sector"],
                n_incidencias=r["n_incidencias"],
                n_agua=r["n_agua"], n_desague=r["n_desague"],
            )
            for r in rows
        ]

    async def heatmap_sectores(self, grupo: str | None) -> list[HeatmapSectorOut]:
        rows = await self._repo.heatmap_sectores(grupo)
        return [
            HeatmapSectorOut(
                sectorid=r["sectorid"], sector=r["sector"],
                n_incidencias=r["n_incidencias"] or 0,
                densidad_por_km2=float(r["densidad_por_km2"] or 0),
            )
            for r in rows
        ]

    async def top_calles(
        self, limite: int, grupo: str | None, sectorid: int | None
    ) -> list[TramoRankOut]:
        rows = await self._repo.top_calles(limite, grupo, sectorid)
        return [
            TramoRankOut(
                tramo_id=r["tramo_id"], tramo_tipo=r["tramo_tipo"],
                direccion_muestra=r["direccion_muestra"],
                sectorid=r["sectorid"], sector=r["sector"],
                n_incidencias=r["n_incidencias"],
            )
            for r in rows
        ]

    # ---------------- Series ----------------

    async def serie_mensual(self, grupo: str | None, sectorid: int | None) -> SerieMensualOut:
        rows = await self._repo.serie_mensual_por_anio(grupo, sectorid)
        actual: list[SeriePuntoOut] = []
        anterior: list[SeriePuntoOut] = []
        for r in rows:
            anio = int(r["mes"][:4])
            punto = SeriePuntoOut(x=r["mes"], y=float(r["n"]))
            # Comparamos año más reciente con el previo
            (actual if anio == 2026 else anterior).append(punto)

        # Predicción — usa regresión por sector agregada
        pred = await self._prediccion_agregada(grupo, sectorid)
        return SerieMensualOut(actual=actual, anio_anterior=anterior, prediccion=pred)

    async def _prediccion_agregada(
        self, grupo: str | None, sectorid: int | None
    ) -> list[SeriePuntoOut]:
        """Predicción simple: extiende la tendencia global 2 meses hacia adelante."""
        from sqlalchemy import text
        gsql, gparams = await self._repo._filtro_grupo_sql(grupo)
        ssql, sparams = await self._repo._filtro_sector_sql(sectorid)
        row = (
            await self._repo._session.execute(
                text(
                    f"""
                    WITH mensual AS (
                        SELECT
                            EXTRACT(EPOCH FROM date_trunc('month', creado_en))::float AS t,
                            COUNT(*)::float AS n
                        FROM gota.mv_incidente_enriquecido
                        WHERE creado_en >= now() - interval '6 months'
                          {gsql} {ssql}
                        GROUP BY date_trunc('month', creado_en)
                    )
                    SELECT regr_slope(n, t) AS pendiente, regr_intercept(n, t) AS intercepto,
                           MAX(t) AS ultimo_t
                    FROM mensual
                    """
                ),
                {**gparams, **sparams},
            )
        ).mappings().first()
        if not row or row["pendiente"] is None:
            return []
        m, b, ult = float(row["pendiente"]), float(row["intercepto"]), float(row["ultimo_t"])
        pred: list[SeriePuntoOut] = []
        # Un mes en segundos (aprox 30.4 días)
        seg_mes = 30.4 * 86400
        base_dt = datetime.fromtimestamp(ult)  # noqa: DTZ006
        for i in (1, 2):
            t_i = ult + i * seg_mes
            y_i = max(0, m * t_i + b)
            fecha = (base_dt + timedelta(days=int(30.4 * i)))
            pred.append(SeriePuntoOut(x=fecha.strftime("%Y-%m"), y=round(y_i, 1)))
        return pred

    async def serie_robos_mensual(self, anio: int | None = None) -> SerieMensualOut:
        """Serie mensual de robos separada por año (actual vs anterior) —
        misma forma que serie_mensual, para renderizar con overlay 2 años."""
        rows = await self._repo.serie_robos_mensual()
        ancla = await _fecha_ancla_desde_mv(self._repo)
        y_actual = anio or ancla.year
        y_prev = y_actual - 1

        actual: list[SeriePuntoOut] = []
        anterior: list[SeriePuntoOut] = []
        for r in rows:
            y = int(r["x"][:4])
            punto = SeriePuntoOut(x=r["x"], y=float(r["y"]))
            if y == y_actual:
                actual.append(punto)
            elif y == y_prev:
                anterior.append(punto)
        return SerieMensualOut(actual=actual, anio_anterior=anterior, prediccion=[])

    async def tiempo_resolucion_mensual(
        self, grupo: str | None, sectorid: int | None
    ) -> SerieTiempoResolucionOut:
        rows = await self._repo.tiempo_resolucion_mensual(grupo, sectorid)
        return SerieTiempoResolucionOut(
            puntos=[SeriePuntoOut(x=r["x"], y=float(r["y"] or 0)) for r in rows]
        )

    async def tipo_atencion_mensual_stacked(
        self, grupo: str | None, sectorid: int | None
    ) -> SerieStackedOut:
        rows = await self._repo.tipo_atencion_mensual_stacked(grupo, sectorid)
        # Reorganizar en tipos + puntos por mes
        by_mes: dict[str, dict[str, float]] = {}
        tipos: set[str] = set()
        for r in rows:
            mes, tipo, n = r["mes"], r["tipo"], float(r["n"])
            by_mes.setdefault(mes, {})[tipo] = n
            tipos.add(tipo)
        tipos_ordenados = sorted(tipos)
        puntos = [
            SerieStackedPuntoOut(x=mes, valores={t: by_mes[mes].get(t, 0.0) for t in tipos_ordenados})
            for mes in sorted(by_mes)
        ]
        return SerieStackedOut(tipos=tipos_ordenados, puntos=puntos)

    # ---------------- Reincidentes ----------------

    async def reincidentes(
        self, meses: int, minimo: int, limite: int, solo_robo: bool
    ) -> list[ReincidenteOut]:
        rows = await self._repo.suministros_reincidentes(meses, minimo, limite, solo_robo)
        return [
            ReincidenteOut(
                suministro=r["suministro"], direccion=r["direccion"],
                sector=r["sector"], n_incidencias=r["n_incidencias"],
                tipo_dominante=r["tipo_dominante"] or "—",
                ultima_fecha=r["ultima_fecha"],
            )
            for r in rows
        ]

    async def sin_solucion(
        self, limite: int, grupo: str | None, sectorid: int | None
    ) -> list[SinSolucionRowOut]:
        rows = await self._repo.sin_solucion_ranking(limite, grupo, sectorid)
        return [
            SinSolucionRowOut(
                codigo=r["codigo"], tipo_atencion=r["tipo_atencion"],
                sector=r["sector"], direccion=r["direccion"],
                dias_sin_resolver=r["dias_sin_resolver"] or 0,
            )
            for r in rows
        ]

    async def multi_reclamos(
        self, minimo: int, limite: int, grupo: str | None, sectorid: int | None
    ) -> list[MultiReclamoOut]:
        rows = await self._repo.multi_reclamos(minimo, limite, grupo, sectorid)
        return [
            MultiReclamoOut(
                codigo=r["codigo"], direccion=r["direccion"], sector=r["sector"],
                n_reclamos=r["n_reclamos"], tipo_atencion=r["tipo_atencion"],
            )
            for r in rows
        ]

    async def parentesco(
        self, grupo: str | None, sectorid: int | None
    ) -> list[ParentescoSliceOut]:
        rows = await self._repo.parentesco_split(grupo, sectorid)
        total = sum(r["n"] for r in rows) or 1
        return [
            ParentescoSliceOut(parentesco=r["parentesco"], n=r["n"], pct=round(r["n"] * 100 / total, 1))
            for r in rows
        ]

    # ---------------- Regresión ----------------

    async def prediccion_sectores(self, lookback: int) -> list[PrediccionSectorOut]:
        rows = await self._repo.regresion_sectores(lookback)
        result = []
        for r in rows:
            # Umbral de 5% mensual para considerar "estable"
            cambio_pct = float(r["cambio_pct_mensual"] or 0)
            if cambio_pct > 5:
                tend = "creciente"
            elif cambio_pct < -5:
                tend = "decreciente"
            else:
                tend = "estable"
            result.append(PrediccionSectorOut(
                sectorid=r["sectorid"] or 0,
                sector=r["sector"] or "—",
                tendencia=tend,
                pred_proximo_mes=r["pred_proximo_mes"] or 0,
                cambio_pct_mensual=cambio_pct,
            ))
        return result

    # ---------------- Alertas ----------------

    async def alertas(self) -> list[AlertaOut]:
        alertas: list[AlertaOut] = []

        # 🔴 Backlog crítico
        backlog = await self._repo.alertas_backlog_critico(min_tickets=10, min_dias=7)
        for row in backlog:
            alertas.append(AlertaOut(
                nivel="rojo",
                mensaje=f"{row['sector']}: {row['n']} tickets abiertos hace >7 días",
                link=f"?sectorid={row['sectorid']}",
            ))

        # 🟡 Reincidencia alta
        reinc = await self._repo.alertas_reincidencia_alta(meses=3, minimo=5)
        for row in reinc:
            alertas.append(AlertaOut(
                nivel="amarillo",
                mensaje=f"Suministro {row['suministro_codigo']}: {row['n']} incidencias en 3 meses",
                link=None,
            ))

        # 🟢 Tendencia favorable
        tend = await self._repo.alertas_tendencia_favorable()
        if tend["total"] and tend["mejoras"] / tend["total"] >= 0.6:
            alertas.append(AlertaOut(
                nivel="verde",
                mensaje="Tiempo de resolución mejorando en las últimas semanas",
            ))
        return alertas
