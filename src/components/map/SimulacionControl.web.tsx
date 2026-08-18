import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { AfectadoRow } from '@/components/shared/AfectadoRow';
import { useSimulacionStore } from '@/state/simulacionStore';
import { useThemeColors } from '@/state/themeStore';

/** Control flotante del modo simulación (web) — botón redondo con ícono de ojo
 * (cerrado = normal, abierto = activa, Ionicons de @expo/vector-icons, no un emoji)
 * + selector de falla para buzones (colapso vs. tapa faltante; tramos/tuberías/
 * accesorios/caja desagüe infieren su falla del tipo de elemento clickeado, no
 * necesitan selector) + resumen del resultado. Vive junto a CatastroFloatingPanel
 * (abajo), no arriba a la derecha — incidencia real: el toggle de texto competía por
 * atención arriba mientras el resto de controles del mapa vive abajo. Tras un click
 * exitoso entra a modo vista: bloquea el resto de la pantalla (ver mapa/index.web.tsx)
 * y solo queda el botón ← + la lista de afectados. */
export function SimulacionControl() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
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

        <Pressable style={styles.backBtn} onPress={salirModoVista}>
          <Text style={styles.backBtnLabel}>← Salir de modo vista</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container} pointerEvents="box-none">
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

      <Pressable
        style={[styles.toggle, activo && styles.toggleActive]}
        onPress={toggleActivo}
        aria-label={activo ? 'Salir de modo simulación' : 'Entrar en modo simulación'}
      >
        <Ionicons
          name={activo ? 'eye-outline' : 'eye-off-outline'}
          size={20}
          color={activo ? t.white : t.textBody}
        />
      </Pressable>
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    // bottom-right, junto a CatastroFloatingPanel (bottom-center) — bottom-right de
    // NavigationControl de MapLibre ya ocupado, por eso queda un poco más arriba.
    container: {
      position: 'absolute',
      bottom: 84,
      right: Spacing.md,
      alignItems: 'flex-end',
      gap: Spacing.xs,
      zIndex: 10,
    },
    toggle: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.surface,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    toggleActive: { backgroundColor: t.accent },
    panel: {
      backgroundColor: t.surface,
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
    panelTitle: { fontSize: 11, color: t.textMuted },
    panelLabel: { fontSize: 10.5, fontWeight: '600', color: t.textBody, marginTop: 2 },
    buzonPicker: { flexDirection: 'row', gap: 6 },
    buzonOpt: { flex: 1, paddingVertical: 6, borderRadius: Radius.sm, backgroundColor: t.border, alignItems: 'center' },
    buzonOptActive: { backgroundColor: t.accent },
    buzonOptLabel: { fontSize: 10.5, fontWeight: '600', color: t.textBody },
    buzonOptLabelActive: { color: t.white },
    resultRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
    status: { fontSize: 12, fontWeight: '600', color: t.textBody },
    clearLink: { fontSize: 11, color: t.accent, fontWeight: '600' },
    backBtn: {
      backgroundColor: t.surface,
      borderRadius: Radius.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 4,
    },
    backBtnLabel: { fontSize: 12.5, fontWeight: '700', color: t.textBody },
    panelVista: {
      backgroundColor: t.surface,
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
}
