import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { CambiarEstadoSheet } from '@/components/incident-actions/CambiarEstadoSheet';
import { RegistrarAvanceSheet } from '@/components/incident-actions/RegistrarAvanceSheet';
import { SeleccionarResponsableSheet } from '@/components/incident-actions/SeleccionarResponsableSheet';
import { FocoTab } from '@/components/incident-detail/FocoTab';
import { PredioTab } from '@/components/incident-detail/PredioTab';
import { TrazabilidadTab } from '@/components/incident-detail/TrazabilidadTab';
import { Colors } from '@/constants/theme';
import { useIncidentDetail } from '@/hooks/useIncidentDetail';
import type { TransicionEstado } from '@/mocks/estadoWorkflowMock';
import { useMapSearchStore } from '@/state/mapSearchStore';

const PRIORIDAD_COLOR: Record<string, string> = {
  a_tiempo: Colors.statusATiempo,
  alerta: Colors.statusAlerta,
  critica: Colors.statusCritica,
};
const PRIORIDAD_LABEL: Record<string, string> = {
  a_tiempo: 'A tiempo',
  alerta: 'Alerta',
  critica: 'Crítica',
};

type ActiveSheet = 'estado' | 'avance' | 'responsable' | null;

type Props = { incidenciaId: string; onClose: () => void };

/** Panel lateral derecho de detalle de incidencia — layout web desktop. */
export function DetailPanel({ incidenciaId, onClose }: Props) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [pendingTransicion, setPendingTransicion] = useState<TransicionEstado | null>(null);

  const { data: incidencia, isLoading, isError } = useIncidentDetail(incidenciaId);

  if (isLoading) {
    return (
      <div style={panel}>
        <div style={statusBox}>
          <span style={{ color: 'var(--map-text-muted)', fontSize: 13 }}>Cargando…</span>
        </div>
      </div>
    );
  }

  if (isError || !incidencia) {
    return (
      <div style={panel}>
        <div style={statusBox}>
          <span style={{ color: 'var(--map-text-muted)', fontSize: 13 }}>No se encontró la incidencia.</span>
          <button style={linkBtn} onClick={onClose}>Cerrar panel</button>
        </div>
      </div>
    );
  }

  const prioColor = PRIORIDAD_COLOR[incidencia.prioridad] ?? 'var(--map-text-muted)';

  return (
    <div style={panel}>
      {/* ── Header fijo ──────────────────────────── */}
      <div style={header}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: prioColor, display: 'inline-block', flexShrink: 0 }} />
            <span style={{ fontSize: 11, fontWeight: '700', color: prioColor }}>
              {PRIORIDAD_LABEL[incidencia.prioridad]}
            </span>
            <span style={{ fontSize: 11, color: 'var(--map-text-muted)' }}>DANA #{incidencia.id}</span>
          </div>
          <button style={closeBtn} onClick={onClose} aria-label="Cerrar panel">×</button>
        </div>

        <div style={{ fontSize: 17, fontWeight: '700', color: 'var(--map-text)', marginTop: 6, lineHeight: 1.25 }}>
          {incidencia.tipo}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--map-text-muted)' }}>
            {incidencia.direccion} · {incidencia.sector.split('·')[0].trim()}
          </span>
          <button
            style={centrarBtn}
            onClick={() => useMapSearchStore.getState().flyTo({ lat: incidencia.lat, lon: incidencia.lon })}
          >
            Ver en el mapa
          </button>
        </div>

        {/* Estado + técnico asignado */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <button
            style={estadoChip}
            onClick={() => setActiveSheet('estado')}
          >
            {incidencia.estado.replace('_', ' ')} ▾
          </button>
          <button
            style={reassignBtn}
            onClick={() => setActiveSheet('responsable')}
          >
            {incidencia.tecnicoAsignado?.nombre ?? 'Sin asignar'} →
          </button>
        </div>
      </div>

      {/* ── Contenido scrolleable ─────────────────── */}
      <div style={scrollable}>

        {/* DATOS DEL RECLAMO */}
        <Section title="DATOS DEL RECLAMO (DANA)">
          <DataRow label="Tipo" value={incidencia.tipo} />
          <DataRow label="Registrado" value={incidencia.reclamo.fechaRegistro} />
          <DataRow
            label="Estado"
            value={incidencia.estado.replace('_', ' ')}
            accent={incidencia.estado === 'PENDIENTE' || incidencia.estado === 'CREADO'}
          />
          <DataRow
            label="Antigüedad"
            value={`${incidencia.antiguedadDias} día${incidencia.antiguedadDias !== 1 ? 's' : ''}`}
            accent={incidencia.antiguedadDias > 1}
          />
          <DataRow label="Medio" value={incidencia.reclamo.medioRecepcion} />
        </Section>

        <Divider />

        {/* CATASTRO TÉCNICO */}
        <Section title="CATASTRO TÉCNICO (GIS)">
          <DataRow label="Sector" value={incidencia.sector} />
          <DataRow label="Red" value={incidencia.catastro.redAsociada} />
          <DataRow label="Diámetro" value={`${incidencia.catastro.diametroMm} mm`} />
          <DataRow label="Material" value={incidencia.catastro.material} />
          <DataRow label="Buzón cercano" value={incidencia.catastro.buzonCercano} />
        </Section>

        <Divider />

        {/* TRAZABILIDAD */}
        <Section title="TRAZABILIDAD">
          <View><TrazabilidadTab incidencia={incidencia} /></View>
        </Section>

        <Divider />

        {/* FOCO */}
        <Section title="FOCO">
          <View><FocoTab incidencia={incidencia} /></View>
        </Section>

        <Divider />

        {/* PREDIO */}
        <Section title="HISTORIAL DEL PREDIO">
          <View><PredioTab incidencia={incidencia} /></View>
        </Section>
      </div>

      {/* ── Acciones fijas al fondo ────────────────── */}
      <div style={footer}>
        <button
          style={btnPrimary}
          onClick={() => Alert.alert('Asignar cuadrilla', 'Funcionalidad en desarrollo.')}
        >
          ★ Asignar cuadrilla
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSecondary} onClick={() => setActiveSheet('estado')}>
            Cambiar estado
          </button>
          <button style={btnSecondary} onClick={() => setActiveSheet('avance')}>
            Registrar avance
          </button>
        </div>
      </div>

      {/* Action sheets (RN Modal, funcional en web) */}
      <CambiarEstadoSheet
        visible={activeSheet === 'estado'}
        incidenciaId={incidencia.id}
        estado={incidencia.estado}
        onClose={() => setActiveSheet(null)}
        onAbrirAvance={(transicion) => {
          setPendingTransicion(transicion);
          setActiveSheet('avance');
        }}
      />
      <RegistrarAvanceSheet
        visible={activeSheet === 'avance'}
        incidenciaId={incidencia.id}
        incidenciaLabel={`${incidencia.tipo}  ·  ${incidencia.direccion}`}
        transicion={pendingTransicion}
        tecnicoActualId={incidencia.tecnicoAsignado?.id}
        onClose={() => setActiveSheet(null)}
        onRegistrado={() => setActiveSheet(null)}
      />
      <SeleccionarResponsableSheet
        visible={activeSheet === 'responsable'}
        incidenciaId={incidencia.id}
        tecnicoActualId={incidencia.tecnicoAsignado?.id}
        onClose={() => setActiveSheet(null)}
        onReasignado={() => setActiveSheet(null)}
      />
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
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

function DataRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', gap: 8 }}>
      <span style={{ fontSize: 11, color: 'var(--map-text-muted)', fontWeight: '600', flexShrink: 0, width: 90 }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: accent ? '#D32F2F' : 'var(--map-text)', fontWeight: accent ? '600' : '400', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

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

const footer: CSSProperties = {
  padding: '12px 16px',
  borderTop: '1px solid var(--map-border)',
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flexShrink: 0,
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

const estadoChip: CSSProperties = {
  backgroundColor: 'var(--map-accent-bg)',
  color: 'var(--map-accent)',
  border: 'none',
  borderRadius: 20,
  padding: '4px 10px',
  fontSize: 11,
  fontWeight: '700',
  cursor: 'pointer',
};

const reassignBtn: CSSProperties = {
  background: 'none',
  border: '1px solid var(--map-border)',
  borderRadius: 20,
  padding: '4px 10px',
  fontSize: 11,
  color: 'var(--map-text)',
  cursor: 'pointer',
};

const centrarBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--map-accent)',
  fontSize: 11,
  fontWeight: '700',
  cursor: 'pointer',
  padding: 0,
  whiteSpace: 'nowrap',
  flexShrink: 0,
};

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--map-accent)',
  fontSize: 13,
  fontWeight: '700',
  cursor: 'pointer',
};

const btnPrimary: CSSProperties = {
  backgroundColor: 'var(--map-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 8,
  padding: '12px',
  fontSize: 14,
  fontWeight: '700',
  cursor: 'pointer',
  width: '100%',
};

const btnSecondary: CSSProperties = {
  flex: 1,
  backgroundColor: 'var(--map-surface-alt)',
  color: 'var(--map-text)',
  border: 'none',
  borderRadius: 8,
  padding: '10px',
  fontSize: 13,
  fontWeight: '600',
  cursor: 'pointer',
};
