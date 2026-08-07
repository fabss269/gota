import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useKpis } from '@/hooks/useDashboardGeo';
import { PERIODO_ACTUAL, useDashboardFilters } from '@/state/dashboardFilters';

import { KpiCard } from './KpiCard';

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
