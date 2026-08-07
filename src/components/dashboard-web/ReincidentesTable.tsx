import { View } from 'react-native';

import { useReincidentes, useReincidentesRobo } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';
import { Spacing } from '@/constants/theme';

import { DataTable } from './DataTable';
import { OptionSlider } from './Slider';

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: '2-digit' });
}

function labelVentana(m: number) {
  return m >= 240 ? 'Todo' : `${m}m`;
}

export function ReincidentesTable() {
  const { data, isLoading } = useReincidentes();
  const { reincMeses, reincMinimo, setReincParams } = useDashboardFilters();

  return (
    <DataTable
      titulo="Suministros reincidentes"
      subtitulo={
        reincMeses >= 240
          ? `Suministros con ≥${reincMinimo} incidencias — histórico completo (2025-2026)`
          : `Suministros con ≥${reincMinimo} incidencias en los últimos ${reincMeses} meses`
      }
      extraHeader={
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <OptionSlider
            label="Ventana"
            opciones={[3, 6, 12, 24, 240] as const}
            valor={reincMeses}
            onChange={(m) => setReincParams(m, reincMinimo)}
            formato={labelVentana}
          />
          <OptionSlider
            label="Mín."
            opciones={[2, 3, 5, 10] as const}
            valor={reincMinimo}
            onChange={(min) => setReincParams(reincMeses, min)}
          />
        </View>
      }
      columnas={[
        { header: 'Suministro', width: 1.2, render: (r) => r.suministro },
        { header: 'Dirección', width: 2.5, render: (r) => r.direccion ?? '—' },
        { header: 'Sector', width: 1.5, render: (r) => r.sector ?? '—' },
        { header: 'Tipo dominante', width: 2, render: (r) => r.tipo_dominante },
        { header: '# inc.', width: 0.6, align: 'right', render: (r) => r.n_incidencias },
        { header: 'Última', width: 0.8, align: 'right', render: (r) => formatFecha(r.ultima_fecha) },
      ]}
      filas={data ?? []}
      cargando={isLoading}
      minHeight={340}
    />
  );
}

export function ReincidentesRoboTable() {
  const { data, isLoading } = useReincidentesRobo();
  const { reincRoboMeses, reincRoboMinimo, setReincRoboParams } = useDashboardFilters();

  return (
    <DataTable
      titulo="Reincidentes de robo"
      subtitulo={
        reincRoboMeses >= 240
          ? `Suministros con ≥${reincRoboMinimo} robos — histórico completo (2025-2026)`
          : `Suministros con ≥${reincRoboMinimo} robos en los últimos ${reincRoboMeses} meses`
      }
      extraHeader={
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <OptionSlider
            label="Ventana"
            opciones={[3, 6, 12, 240] as const}
            valor={reincRoboMeses}
            onChange={(m) => setReincRoboParams(m, reincRoboMinimo)}
            formato={labelVentana}
          />
          <OptionSlider
            label="Mín."
            opciones={[2, 3, 5] as const}
            valor={reincRoboMinimo}
            onChange={(min) => setReincRoboParams(reincRoboMeses, min)}
          />
        </View>
      }
      columnas={[
        { header: 'Suministro', width: 1.2, render: (r) => r.suministro },
        { header: 'Dirección', width: 2.5, render: (r) => r.direccion ?? '—' },
        { header: 'Sector', width: 1.5, render: (r) => r.sector ?? '—' },
        { header: '# robos', width: 0.7, align: 'right', render: (r) => r.n_incidencias },
        { header: 'Último', width: 0.8, align: 'right', render: (r) => formatFecha(r.ultima_fecha) },
      ]}
      filas={data ?? []}
      cargando={isLoading}
      minHeight={340}
    />
  );
}
