import { Ionicons } from '@expo/vector-icons';
import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';

import { RegistrarAvanceSheet } from '@/components/incident-actions/RegistrarAvanceSheet';
import { SeleccionarResponsableSheet } from '@/components/incident-actions/SeleccionarResponsableSheet';
import { FocoTab } from '@/components/incident-detail/FocoTab';
import { TrazabilidadTab } from '@/components/incident-detail/TrazabilidadTab';
import { SkeletonBlock } from '@/components/shared/Skeleton';
import { Colors } from '@/constants/theme';
import { useIncidentDetail } from '@/hooks/useIncidentDetail';
import type { IncidenciaDetalle } from '@/mocks/incidentDetailMock';
import { useMapSearchStore } from '@/state/mapSearchStore';

const ESTADO_LABEL: Record<string, string> = {
  CREADO: 'Creado',
  PENDIENTE: 'Pendiente',
  EN_PROGRESO: 'En progreso',
  ATENDIDO: 'Atendido',
};

// Zoom al que hacemos flyTo desde "Ver en el mapa" — nivel media manzana.
const ZOOM_VER_EN_MAPA = 19;

type ActiveSheet = 'avance' | null;
type Props = { incidenciaId: string; onClose: () => void };

/** Panel lateral derecho de detalle de incidencia — layout web desktop. */
export function DetailPanel({ incidenciaId, onClose }: Props) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const { data: incidencia, isLoading, isError } = useIncidentDetail(incidenciaId);

  if (isLoading) {
    return (
      <div style={panel}>
        <div style={header}>
          <div style={topRow}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBlock width={70} height={10} />
              <SkeletonBlock width={110} height={22} />
            </div>
            <SkeletonBlock width={70} height={22} radius={20} />
          </div>
          <div style={{ marginTop: 10 }}>
            <SkeletonBlock width={180} height={13} />
          </div>
          <div style={{ marginTop: 10 }}>
            <SkeletonBlock width="90%" height={12} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between' }}>
            <SkeletonBlock width={90} height={20} radius={999} />
            <SkeletonBlock width={110} height={20} radius={999} />
          </div>
        </div>
        <div style={scrollable}>
          <Section title="DATOS DEL RECLAMO (DANA)">
            <SkeletonFieldRow />
            <SkeletonFieldRow />
            <SkeletonFieldRow />
          </Section>
          <Divider />
          <Section title="TRAZABILIDAD">
            <SkeletonFieldRow />
            <SkeletonFieldRow />
          </Section>
          <Divider />
          <Section title="FOCO">
            <SkeletonFieldRow />
          </Section>
        </div>
      </div>
    );
  }

  if (isError || !incidencia) {
    return (
      <div style={panel}>
        <div style={statusBox}>
          <span style={{ color: Colors.textMuted, fontSize: 13 }}>No se encontró la incidencia.</span>
          <button style={linkBtn} onClick={onClose}>Cerrar panel</button>
        </div>
      </div>
    );
  }

  const fechaHora = separarFechaHora(incidencia.reclamo.fechaRegistro);
  const esRobo = incidencia.reclamo.esRobo;
  const detalleTicket = incidencia.reclamo.detalleTicket;

  const verEnMapa = () => {
    useMapSearchStore.getState().flyTo({
      lat: incidencia.lat, lon: incidencia.lon, zoom: ZOOM_VER_EN_MAPA,
    });
  };

  return (
    <div style={panel}>
      {/* ── Header fijo ──────────────────────────── */}
      <div style={header}>
        {/* Fila 1: SUMINISTRO (label + código) a la izquierda, estado + cerrar a la derecha */}
        <div style={topRow}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={suministroLabel}>Suministro</span>
            <span style={suministroValor}>{incidencia.codigoSuministro ?? 'Sin registro'}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <span style={estadoBadge}>{ESTADO_LABEL[incidencia.estado] ?? incidencia.estado}</span>
            <button type="button" style={closeBtn} onClick={onClose} aria-label="Cerrar panel">
              <Ionicons name="close" size={18} color={Colors.textBody} />
            </button>
          </div>
        </div>

        {/* Fila 2: tipo del reclamo + (si aplica) badge de robo de medidor */}
        <div style={tipoLine}>
          <span>{incidencia.tipo}</span>
          {esRobo && (
            <span style={roboBadge} title="Robo de medidor">
              <Ionicons name="warning-outline" size={12} color={Colors.statusCritica} />
              <span>Robo de medidor</span>
            </span>
          )}
        </div>

        {/* Fila 3: dirección con ícono + botón ver-en-mapa */}
        <div style={direccionRow}>
          <Ionicons name="location-outline" size={16} color={Colors.textMuted} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={direccionText}>{incidencia.direccion}</span>
          <button
            type="button"
            style={verMapaBtn}
            onClick={verEnMapa}
            title="Ver en el mapa"
            aria-label="Ver en el mapa"
          >
            <Ionicons name="locate" size={16} color={Colors.accent} />
          </button>
        </div>

        {/* Fila 4: chip del sector (izq) + técnico asignado con ícono usuario (der) */}
        <div style={sectorTecnicoRow}>
          <div style={sectorChip}>
            <Ionicons name="grid-outline" size={11} color={Colors.accent} />
            <span>{incidencia.sector}</span>
          </div>
          <SeleccionarResponsableSheet
            incidenciaId={incidencia.id}
            tecnicoActualId={incidencia.tecnicoAsignado?.id}
            tecnicoActualNombre={incidencia.tecnicoAsignado?.nombre ?? 'Sin asignar'}
          />
        </div>
      </div>

      {/* ── Contenido scrolleable ─────────────────── */}
      <div style={scrollable}>
        {/* DATOS DEL RECLAMO */}
        <Section title="DATOS DEL RECLAMO (DANA)">
          <DataRow label="Fecha de registro" value={fechaHora.fecha} />
          <DataRow label="Hora de registro" value={fechaHora.hora} />
          <DataRow
            label="En espera"
            value={`${incidencia.antiguedadDias} día${incidencia.antiguedadDias !== 1 ? 's' : ''}`}
            accent={incidencia.antiguedadDias > 1}
          />
          {detalleTicket && <DetalleBloque texto={detalleTicket} />}
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

        {/* PREDIO — mensaje simple, sin sección titulada */}
        <PredioMensaje incidencia={incidencia} />
      </div>

      {/* ── Acción única al fondo ─────────────────── */}
      <div style={footer}>
        <button type="button" style={btnPrimary} onClick={() => setActiveSheet('avance')}>
          Registrar avance
        </button>
      </div>

      <RegistrarAvanceSheet
        visible={activeSheet === 'avance'}
        incidenciaId={incidencia.id}
        incidenciaLabel={`${incidencia.tipo}  ·  ${incidencia.direccion}`}
        transicion={null}
        estadoActual={incidencia.estado}
        tecnicoActualId={incidencia.tecnicoAsignado?.id}
        onClose={() => setActiveSheet(null)}
        onRegistrado={() => setActiveSheet(null)}
      />
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────

function PredioMensaje({ incidencia }: { incidencia: IncidenciaDetalle }) {
  const noReincidente = incidencia.predio.noReincidente;
  const historico = incidencia.predio.historico;
  const cantidad = historico.length;
  return (
    <div style={{ padding: '14px 16px' }}>
      {noReincidente ? (
        <div style={predioNoReinc}>
          <Ionicons name="checkmark-circle-outline" size={16} color={Colors.statusATiempo} />
          <span>No es predio reincidente</span>
        </div>
      ) : (
        <div style={predioReinc}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.statusAlerta} style={{ flexShrink: 0, marginTop: 2 }} />
          <span style={{ flex: 1 }}>
            <strong>Predio reincidente:</strong> {cantidad} incidencia{cantidad !== 1 ? 's' : ''} anterior{cantidad !== 1 ? 'es' : ''} registrada{cantidad !== 1 ? 's' : ''}
          </span>
          <PredioInfoPopover historico={historico} />
        </div>
      )}
    </div>
  );
}

// Ícono de info + popover pequeño anclado al ícono (no modal centrado) — mismo
// shell (wrapper relative + backdrop fixed para cerrar al click afuera + panel
// absolute) que `LocationDropdown.tsx`, adaptado a los estilos de este panel.
function PredioInfoPopover({ historico }: { historico: IncidenciaDetalle['predio']['historico'] }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div style={predioInfoWrapper}>
      <button
        type="button"
        style={predioInfoBtn}
        onClick={() => setAbierto((v) => !v)}
        title="Ver incidencias anteriores"
        aria-label="Ver incidencias anteriores"
      >
        <Ionicons name="information-circle-outline" size={16} color={Colors.statusAlerta} />
      </button>
      {abierto && (
        <>
          <div style={predioPopoverBackdrop} onClick={() => setAbierto(false)} />
          <div style={predioPopoverPanel}>
            {historico.length === 0 ? (
              <div style={predioPopoverVacio}>Sin incidencias registradas.</div>
            ) : (
              historico.map((h) => (
                <div key={h.id} style={predioPopoverItem}>
                  <span style={predioPopoverFecha}>{separarFechaHora(h.fecha).fecha}</span>
                  <span style={predioPopoverDetalle}>{h.detalleTicket ?? 'Sin detalle registrado.'}</span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, backgroundColor: Colors.border }} />;
}

function DetalleBloque({ texto }: { texto: string }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, color: Colors.textMuted, fontWeight: 600, marginBottom: 4 }}>
        Detalle del ticket
      </div>
      <div style={detalleTextoStyle}>{texto}</div>
    </div>
  );
}

function SkeletonFieldRow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', gap: 8 }}>
      <SkeletonBlock width={90} height={11} />
      <SkeletonBlock width={70} height={12} />
    </div>
  );
}

function DataRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '5px 0', gap: 8 }}>
      <span style={{ fontSize: 11, color: Colors.textMuted, fontWeight: '600', flexShrink: 0, width: 110 }}>
        {label}
      </span>
      <span style={{ fontSize: 12.5, color: accent ? Colors.statusCritica : Colors.textBody, fontWeight: accent ? '600' : '400', textAlign: 'right' }}>
        {value}
      </span>
    </div>
  );
}

// ── Utilidades ───────────────────────────────────────

function separarFechaHora(iso: string): { fecha: string; hora: string } {
  // ISO tipo "2026-08-03T10:10:16" — evitamos toLocaleString para no depender del
  // locale del navegador; queremos formato estable "YYYY-MM-DD" y "hh:mm:ss AM/PM".
  const [f, h] = iso.split('T');
  const hms = (h ?? '').slice(0, 8);
  if (!hms) return { fecha: f ?? '—', hora: '—' };
  const [hh, mm, ss] = hms.split(':');
  const h24 = Number(hh);
  const sufijo = h24 >= 12 ? 'p. m.' : 'a. m.';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { fecha: f ?? '—', hora: `${String(h12).padStart(2, '0')}:${mm}:${ss} ${sufijo}` };
}

// ── Estilos ───────────────────────────────────────────────

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

const header: CSSProperties = {
  padding: '14px 16px 12px',
  borderBottom: `1px solid ${Colors.border}`,
  flexShrink: 0,
};

const topRow: CSSProperties = {
  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
};

const suministroLabel: CSSProperties = {
  fontSize: 10, fontWeight: 700, color: Colors.textMuted,
  letterSpacing: 0.6, textTransform: 'uppercase',
};

const suministroValor: CSSProperties = {
  fontSize: 24, fontWeight: 800, color: Colors.textBody,
  letterSpacing: -0.3, marginTop: 2, lineHeight: 1.1,
};

const tipoLine: CSSProperties = {
  fontSize: 13, color: Colors.textBody, fontWeight: 600,
  marginTop: 8, lineHeight: 1.3,
  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
};

const roboBadge: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 700, color: Colors.statusCritica,
  backgroundColor: '#FDECEA', border: `1px solid ${Colors.statusCritica}`,
  padding: '2px 8px', borderRadius: 999,
};

const direccionRow: CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 10,
};

const direccionText: CSSProperties = {
  flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 1.35,
};

const verMapaBtn: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 4, borderRadius: 4, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const sectorTecnicoRow: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  gap: 8, marginTop: 10, flexWrap: 'wrap',
};

const sectorChip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  backgroundColor: Colors.accentBg,
  color: Colors.accent,
  fontSize: 11, fontWeight: 600,
  padding: '3px 8px', borderRadius: 999,
};

const estadoBadge: CSSProperties = {
  backgroundColor: Colors.accentBg,
  color: Colors.accent,
  border: 'none', borderRadius: 20,
  padding: '4px 10px', fontSize: 11, fontWeight: 700,
};

const detalleTextoStyle: CSSProperties = {
  fontSize: 12.5, color: Colors.textBody, lineHeight: 1.45,
  backgroundColor: '#F8F9FA',
  padding: '10px 12px', borderRadius: 6,
  wordBreak: 'break-word',
};

const closeBtn: CSSProperties = {
  width: 24, height: 24, borderRadius: 12,
  backgroundColor: '#F1F3F5', border: 'none',
  cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 0,
};

const scrollable: CSSProperties = { flex: 1, overflowY: 'auto' };

const footer: CSSProperties = {
  padding: '12px 16px',
  borderTop: `1px solid ${Colors.border}`,
  flexShrink: 0,
};

const sectionTitle: CSSProperties = {
  fontSize: 10, fontWeight: 700, color: Colors.textMuted,
  letterSpacing: 0.6, marginBottom: 10,
};

const linkBtn: CSSProperties = {
  background: 'none', border: 'none',
  color: Colors.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

const btnPrimary: CSSProperties = {
  backgroundColor: Colors.accent,
  color: 'white', border: 'none', borderRadius: 8,
  padding: '12px', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', width: '100%',
};

const predioNoReinc: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8,
  fontSize: 13, color: Colors.textBody,
  padding: '10px 12px', backgroundColor: '#F0F9F4', borderRadius: 6,
};

const predioReinc: CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  fontSize: 13, color: Colors.textBody, lineHeight: 1.4,
  padding: '10px 12px', backgroundColor: '#FFF8E1', borderRadius: 6,
};

const predioInfoWrapper: CSSProperties = {
  position: 'relative', flexShrink: 0,
};

const predioInfoBtn: CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', padding: 2,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const predioPopoverBackdrop: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 19,
};

const predioPopoverPanel: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20,
  width: 260, maxHeight: 240, overflowY: 'auto',
  backgroundColor: '#FFFFFF', borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: `1px solid ${Colors.border}`,
  padding: 6,
};

const predioPopoverItem: CSSProperties = {
  padding: '6px 6px', borderBottom: `1px solid ${Colors.border}`,
};

const predioPopoverFecha: CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: Colors.textMuted, marginBottom: 2,
};

const predioPopoverDetalle: CSSProperties = {
  display: 'block', fontSize: 12, color: Colors.textBody, lineHeight: 1.35,
};

const predioPopoverVacio: CSSProperties = {
  fontSize: 12, color: Colors.textMuted, padding: 8,
};
