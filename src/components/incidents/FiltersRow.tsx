import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { useIncidentsListFiltersStore } from '@/state/incidentsListFiltersStore';
import { ChipMultiSelect } from '@/components/incidents/ChipMultiSelect';
import { FiltersOverlay } from '@/components/incidents/FiltersOverlay';

const PRIORIDAD_OPTIONS: { value: Prioridad; label: string; dotColor: string }[] = [
  { value: 'a_tiempo', label: 'A tiempo', dotColor: Colors.statusATiempo },
  { value: 'alerta', label: 'Alerta', dotColor: Colors.statusAlerta },
  { value: 'critica', label: 'Crítica', dotColor: Colors.statusCritica },
];

const ESTADO_OPTIONS: { value: EstadoIncidencia; label: string }[] = [
  { value: 'CREADO', label: 'Creado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
];

/** Fila de chips de la Lista de Incidencias (Spec 05, RF-05.3). */
export function FiltersRow() {
  const [overlayVisible, setOverlayVisible] = useState(false);
  const prioridades = useIncidentsListFiltersStore((s) => s.prioridades);
  const togglePrioridad = useIncidentsListFiltersStore((s) => s.togglePrioridad);
  const estados = useIncidentsListFiltersStore((s) => s.estados);
  const toggleEstado = useIncidentsListFiltersStore((s) => s.toggleEstado);

  return (
    <View style={styles.row}>
      <ChipMultiSelect label="Prioridad" options={PRIORIDAD_OPTIONS} selected={prioridades} onToggle={togglePrioridad} />
      <ChipMultiSelect label="Estado" options={ESTADO_OPTIONS} selected={estados} onToggle={toggleEstado} />
      <Pressable style={styles.masFiltrosChip} onPress={() => setOverlayVisible(true)}>
        <Text style={styles.masFiltrosLabel}>⚙ Más filtros</Text>
      </Pressable>

      <FiltersOverlay visible={overlayVisible} onClose={() => setOverlayVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.xs },
  masFiltrosChip: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  masFiltrosLabel: { fontSize: 11.5, fontWeight: '600', color: Colors.white },
});
