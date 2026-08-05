import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, type ColorPalette } from '@/constants/theme';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { useThemeColors } from '@/state/themeStore';

const ESTADO_LABEL: Record<EstadoIncidencia, string> = {
  CREADO: 'Creado',
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  ATENDIDO: 'Atendido',
};

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Foco" (Spec 06, RF-06.6). */
export function FocoTab({ incidencia }: Props) {
  const router = useRouter();
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const ESTADO_PILL: Record<EstadoIncidencia, { bg: string; text: string }> = {
    CREADO: { bg: t.border, text: t.textMuted },
    PENDIENTE: { bg: t.border, text: t.textMuted },
    EN_PROGRESO: { bg: t.accentBg, text: t.accent },
    ATENDIDO: { bg: '#DCF7E3', text: '#1E8E3E' },
  };

  if (!incidencia.foco) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incidencias del mismo foco</Text>
        <Text style={styles.emptyText}>Esta incidencia no está asociada a un foco común.</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Incidencias del mismo foco</Text>
      <Text style={styles.descripcion}>{incidencia.foco.descripcion}</Text>

      {incidencia.foco.incidenciasRelacionadas.map((rel) => {
        const pill = ESTADO_PILL[rel.estado];
        return (
          <Pressable
            key={rel.id}
            style={styles.row}
            onPress={() => router.push({ pathname: '/incidencia/[id]', params: { id: rel.id } })}
          >
            <View style={styles.rowTextCol}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {rel.tipo}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={1}>
                {rel.direccion} · {rel.sector.split('·')[0].trim()}
              </Text>
            </View>
            <View style={[styles.pill, { backgroundColor: pill.bg }]}>
              <Text style={[styles.pillLabel, { color: pill.text }]}>{ESTADO_LABEL[rel.estado]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    card: { gap: Spacing.sm },
    cardTitle: { fontSize: 13, fontWeight: '700', color: t.accent },
    descripcion: { fontSize: 12.5, color: t.textBody },
    emptyText: { fontSize: 13, color: t.textMuted },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: 6 },
    rowTextCol: { flex: 1, gap: 2 },
    rowTitle: { fontSize: 13, fontWeight: '600', color: t.textBody },
    rowSubtitle: { fontSize: 11, color: t.textMuted },
    pill: { borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
    pillLabel: { fontSize: 11, fontWeight: '600' },
  });
}
