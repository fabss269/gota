import { Ionicons } from '@expo/vector-icons';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ApiElementoRedDetalle } from '@/api/types';
import { EditableField } from '@/components/shared/EditableField';
import type { ComboOption } from '@/components/shared/SearchableCombo';
import { useToast } from '@/components/shared/Toast';
import type { ElementoRedTipo } from '@/components/map/mapLayers';
import { Colors, Radius, Spacing } from '@/constants/theme';
import {
  useAccesorioClasificaciones,
  useAccesorioTipos,
  useActualizarElementoRed,
  useElementoRed,
  useMateriales,
} from '@/hooks/useElementoRed';

const TIPO_LABEL: Record<ElementoRedTipo, string> = {
  tuberia: 'Tubería de agua',
  tramo: 'Tubería de alcantarillado',
  buzon: 'Buzón',
  accesorio: 'Accesorio',
  cajaagua: 'Caja de agua',
  cajadesague: 'Caja de desagüe',
  manzana: 'Manzana',
  lote: 'Lote',
};

type Props = { tipo: ElementoRedTipo; id: number; onClose: () => void };

/**
 * Detalle de un elemento de catastro — variante nativa con BottomSheet
 * (@gorhom/bottom-sheet). Contenido idéntico al panel web
 * (ElementoInfoPanel.web.tsx) pero adaptado a la interacción mobile.
 */
export const ElementoInfoPanel = forwardRef<BottomSheet, Props>(function ElementoInfoPanel(
  { tipo, id, onClose },
) {
  const snapPoints = useMemo(() => ['45%', '85%'], []);
  const { data, isLoading, isError } = useElementoRed({ tipo, id });

  return (
    <BottomSheet
      snapPoints={snapPoints}
      index={0}
      enablePanDownToClose
      onClose={onClose}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBg}
    >
      <BottomSheetScrollView contentContainerStyle={styles.scrollContent}>
        {isLoading && <StatusText label="Cargando…" />}
        {isError && <StatusText label="No se encontró el elemento." />}
        {data && (
          <>
            <Header tipo={tipo} data={data} onClose={onClose} />
            <TipoRenderer tipo={tipo} data={data} />
          </>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});

function StatusText({ label }: { label: string }) {
  return (
    <View style={styles.statusBox}>
      <Text style={styles.statusText}>{label}</Text>
    </View>
  );
}

function Header({ tipo, data, onClose }: { tipo: ElementoRedTipo; data: ApiElementoRedDetalle; onClose: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        <Text style={styles.badgeTipo}>{TIPO_LABEL[tipo].toUpperCase()}</Text>
        <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
          <Ionicons name="close" size={20} color={Colors.textBody} />
        </Pressable>
      </View>
      <Text style={styles.idLabel}>{codigoConPrefijo(tipo, data)}</Text>
    </View>
  );
}

const PREFIJO_POR_TIPO: Record<ElementoRedTipo, string> = {
  tuberia: 'TAG', tramo: 'ALC', buzon: 'BZ', accesorio: 'ACC',
  cajaagua: 'CA', cajadesague: 'CD', manzana: 'MZ', lote: 'LT',
};

function codigoConPrefijo(tipo: ElementoRedTipo, data: ApiElementoRedDetalle): string {
  if (data.codigo) return `#${PREFIJO_POR_TIPO[tipo]}-${data.codigo}`;
  return `#${data.inscripcion ?? data.nombre ?? data.id}`;
}

// ── Renderer por tipo ────────────────────────────────────────────────────────

function TipoRenderer({ tipo, data }: { tipo: ElementoRedTipo; data: ApiElementoRedDetalle }) {
  switch (tipo) {
    case 'tuberia': return <TuberiaAgua tipo={tipo} data={data} />;
    case 'tramo': return <TuberiaAlcantarillado tipo={tipo} data={data} />;
    case 'buzon': return <Buzon tipo={tipo} data={data} />;
    case 'accesorio': return <Accesorio tipo={tipo} data={data} />;
    case 'cajaagua': return <CajaAgua tipo={tipo} data={data} />;
    case 'cajadesague': return <CajaDesague tipo={tipo} data={data} />;
    case 'manzana':
    case 'lote':
      return <PoligonoCatastral data={data} />;
    default: return <UbicacionSection data={data} />;
  }
}

// Manzanas y lotes: solo lectura (área/perímetro derivados de la geometría).
function PoligonoCatastral({ data }: { data: ApiElementoRedDetalle }) {
  return (
    <>
      <Section title="Datos técnicos">
        <ReadOnlyRow label="Área" value={fmtNumero(data.area, 'm²')} />
        <ReadOnlyRow label="Perímetro" value={fmtNumero(data.perimetro, 'm')} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

type ElementoProps = { tipo: ElementoRedTipo; data: ApiElementoRedDetalle };

function TuberiaAgua({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  const [openCombo, setOpenCombo] = useState(false);
  const materiales = useMateriales(openCombo ? 'AGUA POTABLE' : null);

  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Material" displayValue={data.material ?? '—'} kind="combo"
          value={data.materialId} options={toComboOptions(materiales.data)}
          comboTitle="Elegir material" loadingOptions={materiales.isLoading}
          onOpenCombo={() => setOpenCombo(true)} saving={saving}
          onSave={(v) => saveField({ materialId: v })} />
        <EditableField label="Diámetro" displayValue={fmtNumero(data.diametroPulgadas, '"')}
          suffix={'"'} kind="number" value={data.diametroPulgadas} min={0} step={0.5}
          saving={saving} onSave={(v) => saveField({ diametroPulgadas: v })} />
        <EditableField label="Distancia" displayValue={fmtNumero(data.distancia, 'm')}
          suffix="m" kind="number" value={data.distancia} min={0} step={0.5}
          saving={saving} onSave={(v) => saveField({ distancia: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

function TuberiaAlcantarillado({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  const [openCombo, setOpenCombo] = useState(false);
  const materiales = useMateriales(openCombo ? 'ALCANTARILLADO' : null);

  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Clasificación" displayValue={data.primaria ? 'Primaria' : 'Secundaria'}
          kind="toggle" value={data.primaria ?? false} labelTrue="Primaria" labelFalse="Secundaria"
          saving={saving} onSave={(v) => saveField({ primaria: v })} />
        <EditableField label="Material" displayValue={data.material ?? '—'} kind="combo"
          value={data.materialId} options={toComboOptions(materiales.data)}
          comboTitle="Elegir material" loadingOptions={materiales.isLoading}
          onOpenCombo={() => setOpenCombo(true)} saving={saving}
          onSave={(v) => saveField({ materialId: v })} />
        <EditableField label="Pendiente" displayValue={fmtNumero(data.pendiente, '%')}
          suffix="%" kind="number" value={data.pendiente} min={0} step={0.1}
          saving={saving} onSave={(v) => saveField({ pendiente: v })} />
        <EditableField label="Distancia" displayValue={fmtNumero(data.distancia, 'm')}
          suffix="m" kind="number" value={data.distancia} min={0} step={0.5}
          saving={saving} onSave={(v) => saveField({ distancia: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

function Buzon({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Tapa" displayValue={fmtNumero(data.cota, 'm')} suffix="m"
          kind="number" value={data.cota} step={0.01} saving={saving}
          onSave={(v) => saveField({ tapa: v })} />
        <EditableField label="Fondo" displayValue={fmtNumero(data.cotaFondo, 'm')} suffix="m"
          kind="number" value={data.cotaFondo} step={0.01} saving={saving}
          onSave={(v) => saveField({ fondo: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

function Accesorio({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  const [openTipoCombo, setOpenTipoCombo] = useState(false);
  const [openClasifCombo, setOpenClasifCombo] = useState(false);
  const tipos = useAccesorioTipos(openTipoCombo);
  const clasificaciones = useAccesorioClasificaciones(openClasifCombo);

  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Tipo" displayValue={data.tipoNombre ?? '—'} kind="combo"
          value={data.accesorioTipoId} options={toComboOptions(tipos.data)}
          comboTitle="Elegir tipo" loadingOptions={tipos.isLoading}
          onOpenCombo={() => setOpenTipoCombo(true)} saving={saving}
          onSave={(v) => saveField({ accesorioTipoId: v })} />
        <EditableField label="Clasificación" displayValue={data.accesorioClasificacion ?? '—'} kind="combo"
          value={data.accesorioClasificacionId} options={toComboOptions(clasificaciones.data)}
          comboTitle="Elegir clasificación" loadingOptions={clasificaciones.isLoading}
          onOpenCombo={() => setOpenClasifCombo(true)} saving={saving}
          onSave={(v) => saveField({ accesorioClasificacionId: v })} />
        <EditableField label="Profundidad" displayValue={fmtNumero(data.profundidad, 'm')}
          suffix="m" kind="number" value={data.profundidad} min={0} step={0.1}
          saving={saving} onSave={(v) => saveField({ profundidad: v })} />
        <EditableField label="Diámetro" displayValue={fmtNumero(data.diametroPulgadas, '"')}
          suffix={'"'} kind="number" value={data.diametroPulgadas} min={0} step={0.5}
          saving={saving} onSave={(v) => saveField({ diametroPulgadas: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

function CajaAgua({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Cota" displayValue={fmtNumero(data.cota, 'm')} suffix="m"
          kind="number" value={data.cota} step={0.01} saving={saving}
          onSave={(v) => saveField({ cota: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

function CajaDesague({ tipo, data }: ElementoProps) {
  const { saveField, saving } = useSaver(tipo, data.id);
  return (
    <>
      <Section title="Datos técnicos">
        <EditableField label="Cota" displayValue={fmtNumero(data.cota, 'm')} suffix="m"
          kind="number" value={data.cota} step={0.01} saving={saving}
          onSave={(v) => saveField({ cota: v })} />
      </Section>
      <UbicacionSection data={data} />
    </>
  );
}

// ── Ubicación (solo lectura, común a todos) ──────────────────────────────────

function UbicacionSection({ data }: { data: ApiElementoRedDetalle }) {
  return (
    <Section title="Ubicación">
      <ReadOnlyRow label="Sector" value={data.sectorNombre ?? '—'} />
      <ReadOnlyRow label="Distrito" value={data.distritoNombre ?? '—'} />
    </Section>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readOnlyRow}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ── Hook local: mutate + toast (idéntico al web) ─────────────────────────────

function useSaver(tipo: ElementoRedTipo, id: number) {
  const mutation = useActualizarElementoRed();
  const toast = useToast();

  const saveField = async (patch: Parameters<typeof mutation.mutate>[0]['patch']) => {
    try {
      await mutation.mutateAsync({ tipo, id, patch });
      toast.success('Cambio guardado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar el cambio');
      throw err;
    }
  };

  return { saveField, saving: mutation.isPending };
}

// ── Utils ────────────────────────────────────────────────────────────────────

function fmtNumero(v: number | null, sufijo: string): string {
  if (v === null || v === undefined) return '—';
  return `${v}${sufijo}`;
}

function toComboOptions(items: { id: number; nombre: string }[] | undefined): ComboOption<number>[] {
  return items?.map((i) => ({ value: i.id, label: i.nombre })) ?? [];
}

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#FFFFFF' },
  handle: { backgroundColor: Colors.border, width: 40 },
  scrollContent: { paddingBottom: Spacing.xl },
  statusBox: { padding: Spacing.xl, alignItems: 'center' },
  statusText: { fontSize: 13, color: Colors.textMuted },
  header: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badgeTipo: { fontSize: 11, fontWeight: '700', color: Colors.accent, letterSpacing: 0.4 },
  idLabel: { fontSize: 18, fontWeight: '700', color: Colors.textBody, marginTop: 6 },
  closeBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F1F3F5',
    alignItems: 'center', justifyContent: 'center',
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '700', color: Colors.textMuted,
    letterSpacing: 0.6, marginBottom: 8,
  },
  sectionBody: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: '#FAFBFC',
  },
  readOnlyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8, gap: 8, minHeight: 40,
  },
  readOnlyLabel: {
    fontSize: 12, fontWeight: '600', color: Colors.textMuted,
    flexShrink: 0, width: 100,
  },
  readOnlyValue: {
    fontSize: 13, color: Colors.textBody, fontWeight: '500', textAlign: 'right', flex: 1,
  },
});
