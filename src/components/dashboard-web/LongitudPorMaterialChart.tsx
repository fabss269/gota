import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bar, Pie } from 'react-chartjs-2';

import { getDistritos, getProvincias, getSectores } from '@/api/catalogos';
import type { GrupoRed } from '@/api/dashboardGeo';
import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { ChartCard, ChartTable, type ChartTableColumn } from '@/components/dashboard-web/ChartCard';
import { Colors, Spacing } from '@/constants/theme';
import { useLongitudPorMaterial } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

function metros(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)} km`;
  return `${n.toFixed(0)} m`;
}

const valueLabels = makeBarValueLabelsPlugin(metros);

type Row = { material: string; metros: number };

const COLUMNAS: ChartTableColumn<Row>[] = [
  { header: 'Material', render: (r) => r.material },
  { header: 'Longitud', align: 'right', render: (r) => metros(r.metros) },
];

/** Longitud de tubería por material — barra horizontal, filtrable por
 * sector/distrito/provincia y diámetro (solo agua). Muchas categorías
 * potenciales de material con nombres largos → barra horizontal. */
export function LongitudPorMaterialChart() {
  const [grupo, setGrupo] = useState<GrupoRed>('agua');
  const [distritoId, setDistritoId] = useState<string | null>(null);
  const [provinciaId, setProvinciaId] = useState<string | null>(null);
  const [sectorId, setSectorId] = useState<string | null>(null);
  const [diametro, setDiametro] = useState<string>('');

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
  const { data: sectores } = useQuery({
    queryKey: ['catalogos', 'sectores', distritoId],
    queryFn: () => getSectores(distritoId ?? undefined),
    staleTime: 5 * 60_000,
  });

  const distritosFiltrados = useMemo(
    () => (provinciaId ? (distritos ?? []).filter((d) => d.provinciaId === provinciaId) : distritos ?? []),
    [distritos, provinciaId]
  );

  const diametroNum = grupo === 'agua' && diametro !== '' ? Number(diametro) : null;
  const { data, isLoading } = useLongitudPorMaterial({
    grupo, distritoId, provinciaId, sectorId, diametro: diametroNum,
  });
  const rows = [...(data ?? [])].sort((a, b) => b.metros - a.metros);
  const colorGrupo = grupo === 'agua' ? Colors.agua : Colors.desague;

  const barData = {
    labels: rows.map((r) => r.material),
    datasets: [{ label: 'Metros de tubería', data: rows.map((r) => r.metros), backgroundColor: colorGrupo, borderRadius: 4 }],
  };
  const barOptions: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 48 } },
    scales: { x: { beginAtZero: true, grid: { color: '#e5e7eb' } }, y: { grid: { display: false } } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx: any) => ` ${metros(ctx.parsed.x)}` } } },
  };

  const pieData = {
    labels: rows.map((r) => r.material),
    datasets: [{ data: rows.map((r) => r.metros), backgroundColor: colorGrupo, borderColor: Colors.surface, borderWidth: 2 }],
  };
  const pieOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom' as const },
      tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${metros(ctx.parsed)}` } },
    },
  };

  const filtros = (
    <View style={styles.filtros}>
      <View style={styles.pillGroup}>
        {(['agua', 'alcantarillado'] as const).map((g) => (
          <Pressable
            key={g}
            style={[styles.pill, grupo === g && styles.pillActivo]}
            onPress={() => setGrupo(g)}
          >
            <Text style={[styles.pillText, grupo === g && styles.pillTextActivo]}>
              {g === 'agua' ? 'Agua' : 'Alcantarillado'}
            </Text>
          </Pressable>
        ))}
      </View>

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
        onChange={(e) => {
          setDistritoId(e.target.value || null);
          setSectorId(null);
        }}
        style={selectStyle as any}
      >
        <option value="">Todos los distritos</option>
        {distritosFiltrados.map((d) => (
          <option key={d.id} value={d.id}>{d.nombre}</option>
        ))}
      </select>

      <select
        value={sectorId ?? ''}
        onChange={(e) => setSectorId(e.target.value || null)}
        style={selectStyle as any}
      >
        <option value="">Todos los sectores</option>
        {(sectores ?? []).map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>

      {grupo === 'agua' && (
        <input
          type="number"
          placeholder="Diámetro (pulg.)"
          value={diametro}
          onChange={(e) => setDiametro(e.target.value)}
          style={{ ...selectStyle, width: 130 } as any}
          min={0}
          step={0.5}
        />
      )}
    </View>
  );

  return (
    <ChartCard
      titulo="Longitud de red por material"
      subtitulo="Metros de tubería instalada, por tipo de material"
      modos={['bar', 'pie', 'table']}
      cargando={isLoading}
      vacio={rows.length === 0}
      vacioMensaje="Sin datos para este filtro"
      height={420}
      filtros={filtros}
    >
      {{
        // @ts-ignore
        bar: <Bar data={barData} options={barOptions} plugins={[valueLabels]} />,
        // @ts-ignore
        pie: <Pie data={pieData} options={pieOptions} />,
        table: <ChartTable columnas={COLUMNAS} filas={rows} />,
      }}
    </ChartCard>
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
  filtros: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.sm },
  pillGroup: {
    flexDirection: 'row',
    backgroundColor: Colors.border,
    borderRadius: 999,
    padding: 2,
  },
  pill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: 999 },
  pillActivo: { backgroundColor: Colors.accent },
  pillText: { fontSize: 12, color: Colors.textMuted, fontWeight: '600' },
  pillTextActivo: { color: Colors.white },
});
