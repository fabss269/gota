import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useKpis } from '@/hooks/useDashboardGeo';
import { PERIODO_ACTUAL, useDashboardFilters } from '@/state/dashboardFilters';

import { KpiCard } from './KpiCard';

// Días del período seleccionado, para el KPI "promedio/día" — no hay endpoint
// nuevo, se deriva del volumen que useKpis() ya trae.
function diasDelPeriodo(periodo: 'anual' | 'mensual', anio: number, mes: number): number {
  if (periodo === 'mensual') return new Date(anio, mes, 0).getDate();
  const esBisiesto = (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
  return esBisiesto ? 366 : 365;
}

export function KpiRow() {
  const { data, isLoading } = useKpis();
  const { periodo, anio, mes } = useDashboardFilters();

  // "Sin resolver" solo tiene sentido en el mes actual (los históricos ya se
  // resolvieron o son casos permanentes). Se muestra solo cuando la vista es
  // mensual del mes/año en curso.
  const esMesActual =
    periodo === 'mensual' &&
    anio === PERIODO_ACTUAL.anio &&
    mes === PERIODO_ACTUAL.mes;

  const dias = diasDelPeriodo(periodo, anio, mes);
  const promedioDia = data?.volumen.valor != null ? data.volumen.valor / dias : null;

  return (
    <View style={styles.row}>
      <KpiCard
        titulo="Volumen incidencias"
        valor={data?.volumen.valor ?? 0}
        deltaAbs={data?.volumen.delta_abs ?? null}
        sparkline={data?.volumen.sparkline ?? []}
        color="#0D2B52"
        icono="stats-chart-outline"
        cargando={isLoading}
      />
      <KpiCard
        titulo="Promedio/día"
        valor={promedioDia != null ? promedioDia.toFixed(1) : '—'}
        deltaAbs={null}
        color="#0152AC"
        icono="calendar-outline"
        cargando={isLoading}
      />
      <KpiCard
        titulo="Tiempo mediano"
        valor={data?.tiempo_mediano_dias.valor ? data.tiempo_mediano_dias.valor.toFixed(1) : '—'}
        unidad="días"
        deltaAbs={data?.tiempo_mediano_dias.delta_abs ?? null}
        buenoSiBaja
        sparkline={data?.tiempo_mediano_dias.sparkline ?? []}
        color="#166534"
        icono="time-outline"
        cargando={isLoading}
      />
      <KpiCard
        titulo="Robos de medidor"
        valor={data?.robos.valor ?? 0}
        deltaAbs={data?.robos.delta_abs ?? null}
        buenoSiBaja
        sparkline={data?.robos.sparkline ?? []}
        color="#EF4444"
        icono="alert-circle-outline"
        cargando={isLoading}
      />
      {esMesActual && (
        <KpiCard
          titulo="Sin resolver"
          valor={data?.sin_solucion.valor ?? 0}
          deltaAbs={data?.sin_solucion.delta_abs ?? null}
          buenoSiBaja
          color="#F59E0B"
          icono="hourglass-outline"
          cargando={isLoading}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    flexWrap: 'wrap',
  },
});
