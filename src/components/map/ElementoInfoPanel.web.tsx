import type { CSSProperties, ReactNode } from 'react';

import type { ElementoRedTipo } from '@/components/map/mapLayers';
import { useElementoRed } from '@/hooks/useElementoRed';

const TIPO_LABEL: Record<ElementoRedTipo, string> = {
  tuberia: 'Tubería de agua',
  tramo: 'Tramo de alcantarillado',
  buzon: 'Buzón',
  accesorio: 'Accesorio',
  cajaagua: 'Caja de agua',
  cajadesague: 'Caja de desagüe',
  manzana: 'Manzana',
  lote: 'Lote',
};

type Props = { tipo: ElementoRedTipo; id: number; onClose: () => void };

/** Panel lateral derecho de solo lectura con la info de un elemento de catastro
 * (click en el mapa fuera de modo simulación) — misma estructura visual que
 * DetailPanel.tsx (incidencias), sin las acciones/sheets de esa. */
export function ElementoInfoPanel({ tipo, id, onClose }: Props) {
  const { data, isLoading, isError } = useElementoRed({ tipo, id });

  if (isLoading) {
    return (
      <div style={panel}>
        <div style={statusBox}>
          <span style={{ color: 'var(--map-text-muted)', fontSize: 13 }}>Cargando…</span>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div style={panel}>
        <div style={statusBox}>
          <span style={{ color: 'var(--map-text-muted)', fontSize: 13 }}>No se encontró el elemento.</span>
          <button style={linkBtn} onClick={onClose}>Cerrar panel</button>
        </div>
      </div>
    );
  }

  return (
    <div style={panel}>
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, fontWeight: '700', color: 'var(--map-accent)' }}>
            {TIPO_LABEL[tipo]}
          </span>
          <button style={closeBtn} onClick={onClose} aria-label="Cerrar panel">×</button>
        </div>
        <div style={{ fontSize: 17, fontWeight: '700', color: 'var(--map-text)', marginTop: 6 }}>
          {data.codigo ?? data.inscripcion ?? data.nombre ?? `#${data.id}`}
        </div>
      </div>

      <div style={scrollable}>
        <Section title="DATOS">
          {filaTexto('Código', data.codigo)}
          {filaTexto('Inscripción', data.inscripcion)}
          {filaTexto('Nombre', data.nombre)}
          {filaTexto('Tipo', data.tipoNombre)}
          {filaTexto('Material', data.material)}
          {data.primaria !== null && <DataRow label="Red" value={data.primaria ? 'Primaria' : 'Secundaria'} />}
          {filaNumero('Diámetro', data.diametroPulgadas, '"')}
          {filaNumero('Profundidad', data.profundidad, ' m')}
          {filaNumero('Cota tapa', data.cota, ' m')}
          {filaNumero('Cota fondo', data.cotaFondo, ' m')}
          {filaTexto('Referencia', data.referencia)}
          {filaNumero('Área', data.area, ' m²')}
          {filaNumero('Perímetro', data.perimetro, ' m')}
        </Section>

        <Divider />

        <Section title="UBICACIÓN">
          {filaTexto('Sector', data.sectorNombre)}
          {filaTexto('Distrito', data.distritoNombre)}
        </Section>
      </div>
    </div>
  );
}

function filaTexto(label: string, value: string | null): ReactNode {
  if (!value) return null;
  return <DataRow label={label} value={value} />;
}

function filaNumero(label: string, value: number | null, sufijo: string): ReactNode {
  if (value === null) return null;
  return <DataRow label={label} value={`${value}${sufijo}`} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const hijos = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(hijos) && hijos.length === 0) return null;
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: 'var(--map-border)' }} />;
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--map-text-muted)', fontWeight: '600', flexShrink: 0, width: 90 }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: 'var(--map-text)', textAlign: 'right' }}>{value}</span>
    </div>
  );
}

// ── Estilos (idénticos a DetailPanel.tsx para que el panel derecho se sienta igual
// sea cual sea el tipo de selección) ───────────────────────────────────────

const panel: CSSProperties = {
  width: 320,
  minWidth: 320,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: 'var(--map-surface)',
  borderLeft: '1px solid var(--map-border)',
  overflow: 'hidden',
};

const statusBox: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: 24,
};

const header: CSSProperties = {
  padding: '14px 16px 12px',
  borderBottom: '1px solid var(--map-border)',
  flexShrink: 0,
};

const scrollable: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const sectionTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: '700',
  color: 'var(--map-text-muted)',
  letterSpacing: 0.6,
  marginBottom: 10,
};

const closeBtn: CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 12,
  backgroundColor: 'var(--map-surface-alt)',
  border: 'none',
  fontSize: 18,
  lineHeight: '24px',
  cursor: 'pointer',
  color: 'var(--map-text)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: '700',
  padding: 0,
};

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--map-accent)',
  fontSize: 13,
  fontWeight: '700',
  cursor: 'pointer',
};
