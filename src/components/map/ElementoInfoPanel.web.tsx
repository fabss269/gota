import { Ionicons } from '@expo/vector-icons';
import type { CSSProperties, ReactNode } from 'react';

import { EditableNumberField, EditableSelectField, EditableSwitchField } from '@/components/shared/EditableField';
import { SkeletonBlock } from '@/components/shared/Skeleton';
import type { ElementoRedTipo } from '@/components/map/mapLayers';
import {
  useAccesorioClasificaciones,
  useAccesorioTipos,
  useElementoRed,
  useMaterialesRed,
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

// Grupo de sig.materiales por tipo — mismo mapeo que GRUPO_MATERIAL_POR_TIPO en
// app/modules/red/service.py (backend), no se puede editar material fuera de estos 2.
const GRUPO_MATERIAL: Partial<Record<ElementoRedTipo, string>> = {
  tuberia: 'AGUA POTABLE',
  tramo: 'ALCANTARILLADO',
};

type Props = { tipo: ElementoRedTipo; id: number; onClose: () => void };

/** Panel lateral derecho con la info de un elemento de catastro (click en el mapa
 * fuera de modo simulación). Todo campo es editable salvo el identificador (código/
 * id, mostrado en el título) y ubicación (sector/distrito, derivados de la geometría
 * — el backend no los expone en la whitelist de PATCH). Cada control (switch/combo/
 * input) está siempre visible; cambiarlo abre un modal de confirmación antes de
 * guardar (ver EditableField.web.tsx y la decisión de Edgar 2026-08-10). */
export function ElementoInfoPanel({ tipo, id, onClose }: Props) {
  const { data, isLoading, isError } = useElementoRed({ tipo, id });

  if (isLoading) {
    return (
      <div style={panel}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <SkeletonBlock width={120} height={10} />
            <div style={closeBtn} />
          </div>
          <div style={{ marginTop: 8 }}>
            <SkeletonBlock width={160} height={20} />
          </div>
        </div>
        <div style={scrollable}>
          <div style={{ padding: '14px 16px' }}>
            <SkeletonBlock width={110} height={20} radius={999} />
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <SkeletonFieldRow />
              <SkeletonFieldRow />
              <SkeletonFieldRow />
            </div>
          </div>
          <Divider />
          <div style={{ padding: '14px 16px' }}>
            <SkeletonBlock width={90} height={20} radius={999} />
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <SkeletonUbicacionRow />
              <SkeletonUbicacionRow />
            </div>
          </div>
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

  const identificador = data.codigo ?? (data.id !== undefined ? String(data.id) : null);
  const tieneDatosTecnicos = ['tuberia', 'tramo', 'cajaagua', 'cajadesague', 'accesorio', 'buzon'].includes(tipo);

  return (
    <div style={panel}>
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={badge}>{TIPO_LABEL[tipo].toUpperCase()}</span>
          <button style={closeBtn} onClick={onClose} aria-label="Cerrar panel">×</button>
        </div>
        <div style={titleStyle}>{identificador ? `#${identificador}` : data.nombre ?? '—'}</div>
      </div>

      <div style={scrollable}>
        {tieneDatosTecnicos && (
          <Section title="Datos técnicos">
            <DatosTecnicos tipo={tipo} id={id} data={data} />
          </Section>
        )}

        {(tipo === 'manzana' || tipo === 'lote') && (
          <Section title="Datos">
            {filaTexto('Nombre', data.nombre)}
            {filaTexto('Tipo', data.tipoNombre)}
            {filaNumero('Área', data.area, ' m²')}
            {filaNumero('Perímetro', data.perimetro, ' m')}
          </Section>
        )}

        <Divider />

        <Section title="Ubicación">
          <UbicacionRow icon="location-outline" label="Sector" value={data.sectorNombre} />
          <UbicacionRow icon="business-outline" label="Distrito" value={data.distritoNombre} />
        </Section>
      </div>
    </div>
  );
}

type ElementoData = ReturnType<typeof useElementoRed>['data'];

function DatosTecnicos({ tipo, id, data }: { tipo: ElementoRedTipo; id: number; data: NonNullable<ElementoData> }) {
  const grupoMaterial = GRUPO_MATERIAL[tipo] ?? null;
  const materialesQuery = useMaterialesRed(grupoMaterial, grupoMaterial !== null);
  const accesorioTiposQuery = useAccesorioTipos(null, tipo === 'accesorio');
  const accesorioClasifQuery = useAccesorioClasificaciones(tipo === 'accesorio');

  if (tipo === 'tramo') {
    return (
      <>
        <EditableSwitchField
          tipo={tipo}
          id={id}
          label="Clasificación"
          campo="primaria"
          value={data.primaria ?? false}
          offLabel="Secundaria"
          onLabel="Primaria"
        />
        <EditableSelectField
          tipo={tipo}
          id={id}
          label="Material"
          campo="materialId"
          valueId={data.materialId}
          valueLabel={data.material}
          options={materialesQuery.data}
          loading={materialesQuery.isLoading}
        />
        <EditableNumberField tipo={tipo} id={id} label="Pendiente" campo="pendiente" value={data.pendiente} suffix="%" />
        <EditableNumberField tipo={tipo} id={id} label="Distancia" campo="distancia" value={data.distancia} suffix=" m" />
      </>
    );
  }

  if (tipo === 'tuberia') {
    return (
      <>
        <EditableSelectField
          tipo={tipo}
          id={id}
          label="Material"
          campo="materialId"
          valueId={data.materialId}
          valueLabel={data.material}
          options={materialesQuery.data}
          loading={materialesQuery.isLoading}
        />
        <EditableNumberField
          tipo={tipo}
          id={id}
          label="Diámetro"
          campo="diametroPulgadas"
          value={data.diametroPulgadas}
          suffix='"'
        />
        <EditableNumberField tipo={tipo} id={id} label="Distancia" campo="distancia" value={data.distancia} suffix=" m" />
      </>
    );
  }

  if (tipo === 'accesorio') {
    return (
      <>
        <EditableSelectField
          tipo={tipo}
          id={id}
          label="Tipo"
          campo="accesorioTipoId"
          valueId={data.accesorioTipoId}
          valueLabel={data.tipoNombre}
          options={accesorioTiposQuery.data}
          loading={accesorioTiposQuery.isLoading}
        />
        <EditableNumberField
          tipo={tipo}
          id={id}
          label="Diámetro"
          campo="diametroPulgadas"
          value={data.diametroPulgadas}
          suffix='"'
        />
        <EditableNumberField
          tipo={tipo}
          id={id}
          label="Profundidad"
          campo="profundidad"
          value={data.profundidad}
          suffix=" m"
        />
        <EditableSelectField
          tipo={tipo}
          id={id}
          label="Clasificación"
          campo="accesorioClasificacionId"
          valueId={data.accesorioClasificacionId}
          valueLabel={data.accesorioClasificacion}
          options={accesorioClasifQuery.data}
          loading={accesorioClasifQuery.isLoading}
        />
      </>
    );
  }

  if (tipo === 'cajaagua' || tipo === 'cajadesague') {
    return <EditableNumberField tipo={tipo} id={id} label="Cota" campo="cota" value={data.cota} suffix=" m" />;
  }

  if (tipo === 'buzon') {
    return (
      <>
        <EditableNumberField tipo={tipo} id={id} label="Tapa" campo="tapa" value={data.cota} suffix=" m" />
        <EditableNumberField tipo={tipo} id={id} label="Fondo" campo="fondo" value={data.cotaFondo} suffix=" m" />
      </>
    );
  }

  return null;
}

function filaTexto(label: string, value: string | null | undefined): ReactNode {
  if (!value) return null;
  return <DataRow label={label} value={value} />;
}

function filaNumero(label: string, value: number | null | undefined, sufijo: string): ReactNode {
  if (value === null || value === undefined) return null;
  return <DataRow label={label} value={`${value}${sufijo}`} />;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const hijos = Array.isArray(children) ? children.filter(Boolean) : children;
  if (Array.isArray(hijos) && hijos.length === 0) return null;
  return (
    <div style={{ padding: '14px 16px' }}>
      <span style={sectionBadge}>{title.toUpperCase()}</span>
      <div style={{ marginTop: 14 }}>{children}</div>
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

function UbicacionRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div style={ubicacionRow}>
      <div style={ubicacionIconWrap}>
        <Ionicons name={icon} size={16} color="var(--map-accent)" />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--map-text-muted)', fontWeight: '600' }}>{label}</div>
        <div style={{ fontSize: 13, color: 'var(--map-text)', fontWeight: '600' }}>{value ?? 'Sin dato'}</div>
      </div>
    </div>
  );
}

function SkeletonFieldRow() {
  return (
    <div>
      <SkeletonBlock width={70} height={9} style={{ marginBottom: 6 }} />
      <SkeletonBlock height={34} radius={8} />
    </div>
  );
}

function SkeletonUbicacionRow() {
  return (
    <div style={ubicacionRow}>
      <SkeletonBlock width={32} height={32} radius={16} />
      <div style={{ flex: 1 }}>
        <SkeletonBlock width={50} height={9} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={100} height={12} />
      </div>
    </div>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────

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

const badge: CSSProperties = {
  fontSize: 10,
  fontWeight: '700',
  color: 'var(--map-accent)',
  letterSpacing: 0.5,
};

const titleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: '700',
  color: 'var(--map-text)',
  marginTop: 6,
};

const scrollable: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
};

const sectionBadge: CSSProperties = {
  display: 'inline-block',
  fontSize: 10,
  fontWeight: '700',
  color: 'var(--map-text-muted)',
  letterSpacing: 0.5,
  backgroundColor: 'var(--map-surface-alt)',
  padding: '4px 10px',
  borderRadius: 999,
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

const ubicacionRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
};

const ubicacionIconWrap: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: 'var(--map-accent-bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};
