import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bar } from 'react-chartjs-2';

import { getDistritos, getProvincias, getSectores } from '@/api/catalogos';
import type { GrupoRed } from '@/api/dashboardGeo';
import { makeBarValueLabelsPlugin } from '@/components/dashboard-web/barValueLabelsPlugin';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useLongitudPorMaterial } from '@/hooks/useDashboardGeo';

import { ensureChartRegistered } from './ChartSetup';

ensureChartRegistered();

function metros(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)} km`;
  return `${n.toFixed(0)} m`;
}

const valueLabels = makeBarValueLabelsPlugin(metros);

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

  const chartData = {
    labels: rows.map((r) => r.material),
    datasets: [
      {
        label: 'Metros de tubería',
        data: rows.map((r) => r.metros),
        backgroundColor: grupo === 'agua' ? Colors.agua : Colors.desague,
        borderRadius: 4,
      },
    ],
  };

  const options: any = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { right: 48 } },
    scales: {
      x: { beginAtZero: true, grid: { color: '#e5e7eb' } },
      y: { grid: { display: false } },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${metros(ctx.parsed.x)}`,
        },
      },
    },
  };

  return (
    <View style={styles.card}>
      <Text style={styles.titulo}>Longitud de red por material</Text>
      <Text style={styles.subtitulo}>Metros de tubería instalada, por tipo de material</Text>

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

      <View style={styles.chartWrap}>
        {isLoading ? (
          <Text style={styles.muted}>Cargando…</Text>
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>Sin datos para este filtro</Text>
        ) : (
          // @ts-ignore
          <Bar data={chartData} options={options} plugins={[valueLabels]} />
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
    height: 420,
  },
  titulo: { fontSize: 14, fontWeight: '700', color: Colors.textBody },
  subtitulo: { fontSize: 11, color: Colors.textMuted, marginTop: 2, marginBottom: 8 },
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
  chartWrap: { flex: 1 },
  muted: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.lg },
});
