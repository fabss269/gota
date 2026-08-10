import { Ionicons } from '@expo/vector-icons';
import { useState, type CSSProperties, type ReactNode } from 'react';

import type { ApiElementoRedDetalle } from '@/api/types';
import { EditableField } from '@/components/shared/EditableField';
import type { ComboOption } from '@/components/shared/SearchableCombo';
import { SkeletonBlock } from '@/components/shared/Skeleton';
import { useToast } from '@/components/shared/Toast';
import type { ElementoRedTipo } from '@/components/map/mapLayers';
import { Colors } from '@/constants/theme';
import {
  useAccesorioClasificaciones,
  useAccesorioTipos,
  useActualizarElementoRed,
  useElementoRed,
  useMateriales,
} from '@/hooks/useElementoRed';

type Props = { tipo: ElementoRedTipo; id: number; onClose: () => void };

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

/**
 * Sidebar derecho con detalle de un elemento de catastro. Ver los 6 layouts en
 * el markup — un componente por tipo (renderXxx) porque cada tipo tiene su set
 * de campos + qué es editable (whitelist backend, ver `service.py`).
 */
export function ElementoInfoPanel({ tipo, id, onClose }: Props) {
  const { data, isLoading, isError } = useElementoRed({ tipo, id });

  if (isLoading) {
    return (
      <aside style={panel}>
        <div style={headerStyle}>
          <div style={headerRow}>
            <SkeletonBlock width={120} height={10} style={skeletonColor} />
            <div style={closeBtn} />
          </div>
          <div style={{ marginTop: 8 }}>
            <SkeletonBlock width={160} height={20} style={skeletonColor} />
          </div>
        </div>
        <div style={scrollable}>
          <div style={section}>
            <SkeletonBlock width={90} height={12} style={skeletonColor} />
            <div style={{ ...sectionBody, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SkeletonFieldRow />
              <SkeletonFieldRow />
              <SkeletonFieldRow />
            </div>
          </div>
          <div style={section}>
            <SkeletonBlock width={70} height={12} style={skeletonColor} />
            <div style={sectionBody}>
              <SkeletonUbicacionRow />
              <SkeletonUbicacionRow />
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (isError || !data) {
    return (
      <aside style={panel}>
        <div style={statusBox}>
          <span style={{ color: Colors.textMuted, fontSize: 13 }}>No se encontró el elemento.</span>
          <button type="button" style={linkBtn} onClick={onClose}>Cerrar panel</button>
        </div>
      </aside>
    );
  }

  return (
    <aside style={panel}>
      <Header tipo={tipo} data={data} onClose={onClose} />
      <div style={scrollable}>
        <TipoRenderer tipo={tipo} data={data} />
      </div>
    </aside>
  );
}

// ── Header con badge de tipo + código/id ─────────────────────────────────────

function Header({ tipo, data, onClose }: { tipo: ElementoRedTipo; data: ApiElementoRedDetalle; onClose: () => void }) {
  return (
    <header style={headerStyle}>
      <div style={headerRow}>
        <span style={badgeTipo}>{TIPO_LABEL[tipo]}</span>
        <button type="button" style={closeBtn} onClick={onClose} aria-label="Cerrar panel">
          <Ionicons name="close" size={18} color={Colors.textBody} />
        </button>
      </div>
      <div style={idLabel}>{codigoConPrefijo(tipo, data)}</div>
    </header>
  );
}

const PREFIJO_POR_TIPO: Record<ElementoRedTipo, string> = {
  tuberia: 'TAG', tramo: 'ALC', buzon: 'BZ', accesorio: 'ACC',
  cajaagua: 'CA', cajadesague: 'CD', manzana: 'MZ', lote: 'LT',
};

// Único punto que decide el título del sidebar. Prioridad:
// 1. Si el elemento tiene `codigo` en la BD -> "#PREFIJO-codigo" (ej "#TAG-1234").
// 2. Si tiene inscripcion/nombre -> "#inscripcion" o "#nombre".
// 3. Fallback al id numérico -> "#123".
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
    default: return <SoloUbicacion data={data} />;
  }
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
        <EditableField label="Tapa" displayValue={fmtNumero(data.cota, 'm')}
          suffix="m" kind="number" value={data.cota} step={0.01}
          saving={saving} onSave={(v) => saveField({ tapa: v })} />
        <EditableField label="Fondo" displayValue={fmtNumero(data.cotaFondo, 'm')}
          suffix="m" kind="number" value={data.cotaFondo} step={0.01}
          saving={saving} onSave={(v) => saveField({ fondo: v })} />
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

function SoloUbicacion({ data }: { data: ApiElementoRedDetalle }) {
  return <UbicacionSection data={data} />;
}

// Manzanas y lotes: solo lectura (área/perímetro se derivan de la geometría, no
// tiene sentido editarlos a mano — cualquier corrección debe venir del catastro).
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

// ── Sección de ubicación (solo lectura, común a todos) ───────────────────────

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
    <div style={readOnlyRow}>
      <span style={readOnlyLabel}>{label}</span>
      <span style={readOnlyValue}>{value}</span>
    </div>
  );
}

// ── Placeholders del estado de carga (isLoading) ─────────────────────────────

function SkeletonFieldRow() {
  return (
    <div>
      <SkeletonBlock width={70} height={9} style={{ ...skeletonColor, marginBottom: 6 }} />
      <SkeletonBlock height={34} radius={8} style={skeletonColor} />
    </div>
  );
}

function SkeletonUbicacionRow() {
  return (
    <div style={readOnlyRow}>
      <SkeletonBlock width={80} height={11} style={skeletonColor} />
      <SkeletonBlock width={110} height={13} style={skeletonColor} />
    </div>
  );
}

// ── Sección con título + fondo tenue ─────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={section}>
      <div style={sectionTitle}>{title}</div>
      <div style={sectionBody}>{children}</div>
    </div>
  );
}

// ── Hook local: encapsula el mutate + toast ──────────────────────────────────

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

// ── Utilidades ───────────────────────────────────────────────────────────────

function fmtNumero(v: number | null, sufijo: string): string {
  if (v === null || v === undefined) return '—';
  return `${v}${sufijo}`;
}

function toComboOptions(items: { id: number; nombre: string }[] | undefined): ComboOption<number>[] {
  return items?.map((i) => ({ value: i.id, label: i.nombre })) ?? [];
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const skeletonColor: CSSProperties = { backgroundColor: '#F1F3F5' };

const panel: CSSProperties = {
  width: 340,
  minWidth: 340,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#FFFFFF',
  borderLeft: `1px solid ${Colors.border}`,
  overflow: 'hidden',
};

const statusBox: CSSProperties = {
  flex: 1, display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24,
};

const headerStyle: CSSProperties = {
  padding: '16px 20px 12px',
  borderBottom: `1px solid ${Colors.border}`,
  flexShrink: 0,
};

const headerRow: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const badgeTipo: CSSProperties = {
  fontSize: 11, fontWeight: 700, color: Colors.accent,
  letterSpacing: 0.4, textTransform: 'uppercase',
};

const idLabel: CSSProperties = {
  fontSize: 18, fontWeight: 700, color: Colors.textBody, marginTop: 6,
  letterSpacing: -0.2,
};

const closeBtn: CSSProperties = {
  width: 28, height: 28, borderRadius: 14,
  backgroundColor: '#F1F3F5', border: 'none',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};

const linkBtn: CSSProperties = {
  background: 'none', border: 'none',
  color: Colors.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

const scrollable: CSSProperties = {
  flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex',
  flexDirection: 'column', gap: 20,
};

const section: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };

const sectionTitle: CSSProperties = {
  fontSize: 10, fontWeight: 700, color: Colors.textMuted,
  letterSpacing: 0.6, textTransform: 'uppercase',
};

const sectionBody: CSSProperties = {
  border: `1px solid ${Colors.border}`,
  borderRadius: 8, padding: '4px 12px',
  backgroundColor: '#FAFBFC',
};

const readOnlyRow: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '8px 0', minHeight: 40, gap: 8,
};

const readOnlyLabel: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: Colors.textMuted,
  flexShrink: 0, width: 100,
};

const readOnlyValue: CSSProperties = {
  fontSize: 13, color: Colors.textBody, fontWeight: 500, textAlign: 'right',
};
