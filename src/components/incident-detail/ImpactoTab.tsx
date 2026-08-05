import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Spacing, type ColorPalette } from '@/constants/theme';
import { AfectadoRow } from '@/components/shared/AfectadoRow';
import { useIncidentImpacto } from '@/hooks/useIncidentImpacto';
import { useThemeColors } from '@/state/themeStore';

type Props = { incidenciaId: string; active: boolean };

/** Tab "Impacto" — qué afecta esta incidencia aguas abajo/arriba, por causa raíz
 * hidráulica (grafo). Consulta propia, se pide solo con el tab activo. */
export function ImpactoTab({ incidenciaId, active }: Props) {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { data: impacto, isLoading, isError } = useIncidentImpacto(incidenciaId, active);

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Impacto</Text>
        <Text style={styles.emptyText}>Calculando impacto…</Text>
      </View>
    );
  }

  if (isError || !impacto) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Impacto</Text>
        <Text style={styles.emptyText}>No se pudo calcular el impacto de esta incidencia.</Text>
      </View>
    );
  }

  if (impacto.tipoFalla === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Impacto</Text>
        <Text style={styles.emptyText}>
          Este tipo de incidencia no tiene una simulación de impacto de red asociada.
        </Text>
      </View>
    );
  }

  if (impacto.afectados.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Impacto</Text>
        <Text style={styles.emptyText}>
          No se encontraron predios afectados aguas abajo/arriba de esta incidencia.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Impacto</Text>
      <Text style={styles.subtitle}>
        {impacto.afectados.length} suministro{impacto.afectados.length === 1 ? '' : 's'} afectado
        {impacto.afectados.length === 1 ? '' : 's'} · elemento #{impacto.elementoId}
      </Text>

      {impacto.afectados.map((afectado) => (
        <AfectadoRow key={`${afectado.suministro}-${afectado.cajaId}`} afectado={afectado} />
      ))}
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    card: { gap: Spacing.sm },
    cardTitle: { fontSize: 13, fontWeight: '700', color: t.accent },
    subtitle: { fontSize: 11.5, color: t.textMuted },
    emptyText: { fontSize: 13, color: t.textMuted },
  });
}
