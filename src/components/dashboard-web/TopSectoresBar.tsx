import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { getDistritos, getProvincias } from '@/api/catalogos';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useTopSectores } from '@/hooks/useDashboardGeo';
import { useDashboardFilters } from '@/state/dashboardFilters';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

export function TopSectoresBar() {
  const [provinciaId, setProvinciaId] = useState<string | null>(null);
  const [distritoId, setDistritoId] = useState<string | null>(null);

  const { data: provincias } = useQuery({
    queryKey: ['catalogos', 'provincias'],
    queryFn: getProvincias,
    staleTime: 5 * 60_000,
  });
  const { data: distritos } = useQuery({
    queryKey: ['catalogos', 'distritos'],
    queryFn: getDistritos,
    staleTime: 5 * 60_000,
  });
  const distritosFiltrados = useMemo(
    () => (provinciaId ? (distritos ?? []).filter((d) => d.provinciaId === provinciaId) : distritos ?? []),
    [distritos, provinciaId]
  );

  const { data, isLoading } = useTopSectores(10, { distritoId, provinciaId });
  const seleccionarSector = useDashboardFilters((s) => s.seleccionarSector);

  const rows = data ?? [];
  const chartData = {
    labels: rows.map((r) => r.sector.replace('CHICLAYO - ', '')),
    datasets: [
      {
        label: 'Agua',
        data: rows.map((r) => r.n_agua),
        backgroundColor: '#0D2B52',
        stack: 'a',
      },
      {
        label: 'Desagüe',
        data: rows.map((r) => r.n_desague),
        backgroundColor: '#166534',
        stack: 'a',
      },
    ],
  };

  const options: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 36 } },
    onClick: (_: any, elements: any[]) => {
      if (!elements?.length) return;
      const idx = elements[0].index;
      const row = rows[idx];
      if (row?.sectorid) seleccionarSector(row.sectorid, row.sector);
    },
    scales: {
      x: { stacked: true, grid: { color: '#e5e7eb' } },
      y: { stacked: true, grid: { display: false } },
    },
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: {
        callbacks: {
          footer: (items: any) => {
            const total = items.reduce((s: number, i: any) => s + (i.parsed?.x || 0), 0);
            return `Total: ${total}`;
          },
        },
      },
      // Muestra el total de la fila stackeada al extremo derecho. `anchor` y
      // `align` con 'end' + `clamp` evita que se corte si un valor tira mucho.
      datalabels: {
        display: (ctx: any) => ctx.datasetIndex === ctx.chart.data.datasets.length - 1,
        anchor: 'end' as const,
        align: 'end' as const,
        color: '#0D2B52',
        font: { weight: 700 as const, size: 10 },
        formatter: (_v: number, ctx: any) => {
          const datasets = ctx.chart.data.datasets;
          const total = datasets.reduce((s: number, d: any) => s + (Number(d.data?.[ctx.dataIndex]) || 0), 0);
          return total.toLocaleString('es-PE');
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Sectores con más incidencias</Text>
      <Text style={styles.subtitulo}>Click en una barra para filtrar el dashboard por ese sector</Text>

      <View style={styles.filtros}>
        <select
          value={provinciaId ?? ''}
          onChange={(e) => {
            setProvinciaId(e.target.value || null);
            setDistritoId(null);
          }}
          style={selectStyle as any}
        >
          <option value="">Todas las provincias</option>
          {(provincias ?? []).map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
        <select
          value={distritoId ?? ''}
          onChange={(e) => setDistritoId(e.target.value || null)}
          style={selectStyle as any}
        >
          <option value="">Todos los distritos</option>
          {distritosFiltrados.map((d) => (
            <option key={d.id} value={d.id}>{d.nombre}</option>
          ))}
        </select>
      </View>

      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Sin datos</Text>
        ) : (
          // @ts-ignore - Bar props typing en react-chartjs-2 con any-options
          <Bar data={chartData} options={options} />
        )}
      </View>
    </View>
  );
}

const selectStyle = {
  fontSize: 12,
  color: Colors.textBody,
  backgroundColor: Colors.border,
  border: 'none',
  borderRadius: 999,
  padding: '6px 10px',
  fontFamily: 'system-ui, sans-serif',
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    flex: 1,
    height: 380,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
  filtros: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
