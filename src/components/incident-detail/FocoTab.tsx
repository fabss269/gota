import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { EstadoIncidencia } from '@/mocks/incidentsMock';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';

const ESTADO_LABEL: Record<EstadoIncidencia, string> = {
  CREADO: 'Creado',
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  ATENDIDO: 'Atendido',
};
const ESTADO_PILL: Record<EstadoIncidencia, { bg: string; text: string }> = {
  CREADO: { bg: '#E3E4E8', text: Colors.textMuted },
  PENDIENTE: { bg: '#E3E4E8', text: Colors.textMuted },
  EN_PROGRESO: { bg: '#E0E4FF', text: Colors.accent },
  ATENDIDO: { bg: '#DCF7E3', text: '#1E8E3E' },
};

type Props = { incidencia: IncidenciaDetalle };

/** Tab "Foco" (Spec 06, RF-06.6). */
export function FocoTab({ incidencia }: Props) {
  const router = useRouter();

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

const styles = StyleSheet.create({
  card: { gap: Spacing.sm },
  cardTitle: { fontSize: 13, fontWeight: '700', color: Colors.accent },
  descripcion: { fontSize: 12.5, color: Colors.textBody },
  emptyText: { fontSize: 13, color: Colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, paddingVertical: 6 },
  rowTextCol: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 13, fontWeight: '600', color: Colors.textBody },
  rowSubtitle: { fontSize: 11, color: Colors.textMuted },
  pill: { borderRadius: 20, paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  pillLabel: { fontSize: 11, fontWeight: '600' },
});
