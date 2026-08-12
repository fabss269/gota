import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import type { ApiSector } from '@/api/types';
import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useThemeColors } from '@/state/themeStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

/**
 * Selector de UBICACIÓN del tab "Capas" (Bottom Sheet móvil) — Distrito y Sector
 * como combo box de selección única en cascada (rediseño 2026-08-11, ver
 * ubicacionStore.ts — antes el sector era multi-select con chips).
 *
 * Reemplaza el árbol Provincia→Distrito→Sector con checkboxes anidados (versión
 * anterior): en una pantalla angosta esa jerarquía completa se sentía muy pesada —
 * acá se asume la provincia por defecto (Chiclayo, ver ubicacionStore) sin exponerla
 * en la UI, igual que ya hacía FiltrosTab con "Chiclayo · Todos los distritos...".
 */
export function UbicacionPicker() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const distritos = useUbicacionStore((s) => s.distritos);
  const sectores = useUbicacionStore((s) => s.sectores);
  const cargando = useUbicacionStore((s) => s.cargando);
  const provinciaActiva = useUbicacionStore((s) => s.provinciaActiva);
  const distritoActivoId = useUbicacionStore((s) => s.distritoActivo);
  const sectorActivoId = useUbicacionStore((s) => s.sectorActivo);
  const cargar = useUbicacionStore((s) => s.cargar);
  const seleccionarDistrito = useUbicacionStore((s) => s.seleccionarDistrito);
  const seleccionarSector = useUbicacionStore((s) => s.seleccionarSector);
  const previsualizarSector = useUbicacionStore((s) => s.previsualizarSector);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const [distritoModalAbierto, setDistritoModalAbierto] = useState(false);
  const [sectorModalAbierto, setSectorModalAbierto] = useState(false);

  const distritosDisponibles = useMemo(
    () => distritos.filter((d) => d.provinciaId === provinciaActiva),
    [distritos, provinciaActiva]
  );

  const distritoActivo = distritosDisponibles.find((d) => d.id === distritoActivoId) ?? null;

  const sectoresDelDistrito = useMemo(
    () => (distritoActivoId ? sectores.filter((s) => s.distritoId === distritoActivoId) : []),
    [sectores, distritoActivoId]
  );

  const sectorActivo = sectoresDelDistrito.find((s) => s.id === sectorActivoId) ?? null;

  if (cargando && distritosDisponibles.length === 0) {
    return (
      <View style={styles.loadingRow}>
        <ActivityIndicator size="small" color={t.textMuted} />
        <Text style={styles.loadingLabel}>Cargando ubicaciones…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.fieldLabel}>Distrito</Text>
      <Pressable style={styles.comboBox} onPress={() => setDistritoModalAbierto(true)}>
        <Text style={styles.comboValue}>{distritoActivo?.nombre ?? 'Todos los distritos'}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      {distritoActivoId && sectoresDelDistrito.length > 0 && (
        <>
          <Text style={styles.fieldLabel}>Sector</Text>
          <Pressable style={styles.comboBox} onPress={() => setSectorModalAbierto(true)}>
            <Text style={styles.comboValue}>{sectorActivo?.nombre ?? 'Todos los sectores'}</Text>
            <Text style={styles.chevron}>▾</Text>
          </Pressable>
        </>
      )}

      <DistritoModal
        styles={styles}
        visible={distritoModalAbierto}
        onClose={() => setDistritoModalAbierto(false)}
        distritos={distritosDisponibles}
        seleccionado={distritoActivoId}
        onSeleccionar={seleccionarDistrito}
      />
      <SectorModal
        styles={styles}
        colors={t}
        visible={sectorModalAbierto}
        onClose={() => {
          previsualizarSector(null);
          setSectorModalAbierto(false);
        }}
        sectores={sectoresDelDistrito}
        seleccionado={sectorActivoId}
        onSeleccionar={seleccionarSector}
        onPreview={previsualizarSector}
      />
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

// ── Combo box de distrito (selección única) ──────────────────────────

function DistritoModal({
  styles,
  visible,
  onClose,
  distritos,
  seleccionado,
  onSeleccionar,
}: {
  styles: Styles;
  visible: boolean;
  onClose: () => void;
  distritos: { id: string; nombre: string }[];
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <View style={styles.modalCard}>
          <Pressable
            style={styles.modalOption}
            onPress={() => {
              onSeleccionar(null);
              onClose();
            }}
          >
            <Text style={[styles.modalOptionLabel, seleccionado === null && styles.modalOptionLabelActive]}>
              Todos los distritos
            </Text>
          </Pressable>
          {distritos.map((d) => (
            <Pressable
              key={d.id}
              style={styles.modalOption}
              onPress={() => {
                onSeleccionar(d.id);
                onClose();
              }}
            >
              <Text style={[styles.modalOptionLabel, seleccionado === d.id && styles.modalOptionLabelActive]}>
                {d.nombre}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Combo box de sector (selección única) con búsqueda + ojito de preview ──
//
// El 👁 de cada fila solo llama a `previsualizarSector` (pinta el contorno del
// sector en el mapa, ver applySectorHighlight/buildEffectiveStyle) sin cerrar el
// modal ni tocar la selección real — tocar la fila en sí es lo que selecciona el
// sector (cierra el modal y sí dispara fetch, vía seleccionarSector). Mismo
// contrato que el 👁/🔍 del dropdown de sector en FiltersSidebar (web).
function SectorModal({
  styles,
  colors,
  visible,
  onClose,
  sectores,
  seleccionado,
  onSeleccionar,
  onPreview,
}: {
  styles: Styles;
  colors: ColorPalette;
  visible: boolean;
  onClose: () => void;
  sectores: ApiSector[];
  seleccionado: string | null;
  onSeleccionar: (id: string | null) => void;
  onPreview: (id: string | null) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [previsualizado, setPrevisualizado] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    if (!texto) return sectores;
    return sectores.filter((s) => s.nombre.toLowerCase().includes(texto));
  }, [sectores, busqueda]);

  const togglePreview = (id: string) => {
    const next = previsualizado === id ? null : id;
    setPrevisualizado(next);
    onPreview(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.sectorModalCard} onPress={(e) => e.stopPropagation()}>
          <TextInput
            style={styles.searchInput}
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar sector…"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <ScrollView style={styles.sectorList}>
            <Pressable
              style={styles.sectorRow}
              onPress={() => {
                onSeleccionar(null);
                onClose();
              }}
            >
              <View style={[styles.checkbox, seleccionado === null && styles.checkboxChecked]}>
                {seleccionado === null && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.sectorRowLabel}>Todos los sectores</Text>
            </Pressable>
            {filtrados.length === 0 && <Text style={styles.noResults}>Sin resultados</Text>}
            {filtrados.map((s) => {
              const activo = seleccionado === s.id;
              const preview = previsualizado === s.id;
              return (
                <View key={s.id} style={styles.sectorRow}>
                  <Pressable
                    style={styles.sectorRowMain}
                    onPress={() => {
                      onSeleccionar(s.id);
                      onClose();
                    }}
                  >
                    <View style={[styles.checkbox, activo && styles.checkboxChecked]}>
                      {activo && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.sectorRowLabel}>{s.nombre}</Text>
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => togglePreview(s.id)}>
                    <Text style={[styles.previewIcon, preview && styles.previewIconActive]}>👁</Text>
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
          <Pressable style={styles.doneButton} onPress={onClose}>
            <Text style={styles.doneButtonLabel}>Listo</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    container: { gap: 4 },
    loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.xs },
    loadingLabel: { fontSize: 12, color: t.textMuted },
    fieldLabel: { fontSize: 11, fontWeight: '700', color: t.textMuted, marginTop: Spacing.xs },

    comboBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 10,
    },
    comboValue: { fontSize: 13, fontWeight: '600', color: t.textBody },
    chevron: { color: t.textMuted, fontSize: 12 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(13, 43, 82, 0.25)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: 260,
      maxHeight: '70%',
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      paddingVertical: Spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    modalOption: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
    modalOptionLabel: { fontSize: 15, fontWeight: '700', color: t.primaryDark },
    modalOptionLabelActive: { color: t.accent },

    sectorModalCard: {
      width: 280,
      maxHeight: '75%',
      backgroundColor: t.surface,
      borderRadius: Radius.lg,
      padding: Spacing.sm,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    searchInput: {
      borderWidth: 1,
      borderColor: t.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 8,
      fontSize: 13,
      color: t.textBody,
      marginBottom: Spacing.xs,
    },
    sectorList: { maxHeight: 280 },
    noResults: { fontSize: 12, color: t.textMuted, paddingVertical: Spacing.sm, textAlign: 'center' },
    sectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.xs,
      paddingVertical: 8,
    },
    sectorRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    previewIcon: { fontSize: 16, opacity: 0.35 },
    previewIconActive: { opacity: 1 },
    checkbox: {
      width: 18,
      height: 18,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: t.accent, borderColor: t.accent },
    checkmark: { color: t.white, fontSize: 12, fontWeight: '700' },
    sectorRowLabel: { fontSize: 13, color: t.textBody, flex: 1 },
    doneButton: {
      marginTop: Spacing.xs,
      backgroundColor: t.accent,
      borderRadius: Radius.pill,
      paddingVertical: 10,
      alignItems: 'center',
    },
    doneButtonLabel: { color: t.white, fontWeight: '700', fontSize: 14 },
  });
}
