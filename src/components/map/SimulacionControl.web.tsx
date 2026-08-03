import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { AfectadoRow } from '@/components/shared/AfectadoRow';
import { useSimulacionStore } from '@/state/simulacionStore';

/** Control flotante del modo simulación (web) — toggle + selector de falla para
 * buzones (colapso vs. tapa faltante; tramos/tuberías/accesorios/caja desagüe infieren
 * su falla del tipo de elemento clickeado, no necesitan selector) + resumen del
 * resultado. Tras un click exitoso entra a modo vista: bloquea el resto de la pantalla
 * (ver mapa/index.web.tsx) y solo queda el botón ← + la lista de afectados. */
export function SimulacionControl() {
  const activo = useSimulacionStore((s) => s.activo);
  const modoVista = useSimulacionStore((s) => s.modoVista);
  const tipoFallaBuzon = useSimulacionStore((s) => s.tipoFallaBuzon);
  const resultado = useSimulacionStore((s) => s.resultado);
  const cargando = useSimulacionStore((s) => s.cargando);
  const toggleActivo = useSimulacionStore((s) => s.toggleActivo);
  const setTipoFallaBuzon = useSimulacionStore((s) => s.setTipoFallaBuzon);
  const limpiar = useSimulacionStore((s) => s.limpiar);
  const salirModoVista = useSimulacionStore((s) => s.salirModoVista);

  if (modoVista) {
    return (
      <View style={styles.container} pointerEvents="box-none">
        <Pressable style={styles.backBtn} onPress={salirModoVista}>
          <Text style={styles.backBtnLabel}>← Salir de modo vista</Text>
        </Pressable>

        {resultado && (
          <View style={styles.panelVista}>
            <Text style={styles.panelTitle}>
              {resultado.length} suministro{resultado.length === 1 ? '' : 's'} afectado
              {resultado.length === 1 ? '' : 's'}
            </Text>
            <ScrollView style={styles.vistaScroll}>
              {resultado.map((afectado) => (
                <AfectadoRow key={`${afectado.suministro}-${afectado.cajaId}`} afectado={afectado} />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable style={[styles.toggle, activo && styles.toggleActive]} onPress={toggleActivo}>
        <Text style={[styles.toggleLabel, activo && styles.toggleLabelActive]}>
          {activo ? 'Simulación: activa' : 'Modo simulación'}
        </Text>
      </Pressable>

      {activo && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Click en un elemento de red activo en Filtros</Text>

          <Text style={styles.panelLabel}>Falla en buzón:</Text>
          <View style={styles.buzonPicker}>
            {(['colapso_buzon', 'tapa_faltante'] as const).map((tipo) => {
              const isActive = tipoFallaBuzon === tipo;
              return (
                <Pressable
                  key={tipo}
                  style={[styles.buzonOpt, isActive && styles.buzonOptActive]}
                  onPress={() => setTipoFallaBuzon(tipo)}
                >
                  <Text style={[styles.buzonOptLabel, isActive && styles.buzonOptLabelActive]}>
                    {tipo === 'colapso_buzon' ? 'Colapso' : 'Tapa faltante'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {cargando && <Text style={styles.status}>Calculando…</Text>}
          {!cargando && resultado && (
            <View style={styles.resultRow}>
              <Text style={styles.status}>
                {resultado.length} suministro{resultado.length === 1 ? '' : 's'} afectado
                {resultado.length === 1 ? '' : 's'}
              </Text>
              <Pressable onPress={limpiar}>
                <Text style={styles.clearLink}>Limpiar</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // top-right: top-left ya lo ocupa la barra de búsqueda de dirección/suministro
  // (LocationSearchBar), bottom-right lo ocupa NavigationControl de MapLibre.
  container: { position: 'absolute', top: Spacing.md, right: Spacing.md, gap: Spacing.xs, zIndex: 10 },
  toggle: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  toggleActive: { backgroundColor: Colors.accent },
  toggleLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textBody },
  toggleLabelActive: { color: Colors.white },
  panel: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 6,
    maxWidth: 230,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  panelTitle: { fontSize: 11, color: Colors.textMuted },
  panelLabel: { fontSize: 10.5, fontWeight: '600', color: Colors.textBody, marginTop: 2 },
  buzonPicker: { flexDirection: 'row', gap: 6 },
  buzonOpt: { flex: 1, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: '#F1F3F8', alignItems: 'center' },
  buzonOptActive: { backgroundColor: Colors.accent },
  buzonOptLabel: { fontSize: 10.5, fontWeight: '600', color: Colors.textBody },
  buzonOptLabelActive: { color: Colors.white },
  resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  status: { fontSize: 12, fontWeight: '600', color: Colors.textBody },
  clearLink: { fontSize: 11, color: Colors.accent, fontWeight: '600' },
  backBtn: {
    backgroundColor: Colors.white,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-end',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  backBtnLabel: { fontSize: 12.5, fontWeight: '700', color: Colors.textBody },
  panelVista: {
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    gap: 6,
    width: 260,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  vistaScroll: { maxHeight: 320 },
});
