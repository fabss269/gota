import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type CSSProperties } from 'react';
import { View } from 'react-native';

import { TecnicoOptionsList } from '@/components/incident-actions/TecnicoOptionsList';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Colors } from '@/constants/theme';
import { useReasignarResponsable } from '@/hooks/useReasignarResponsable';
import { useRegistrarAvance } from '@/hooks/useRegistrarAvance';
import {
  AREA_OPTIONS,
  EQUIPO_OPTIONS,
  MOTIVOS_AVANCE,
  type MotivoAvance,
  type TransicionEstado,
} from '@/mocks/estadoWorkflowMock';
import type { Usuario } from '@/mocks/usuariosMock';

type Props = {
  visible: boolean;
  incidenciaId: string;
  incidenciaLabel: string;
  /** Siempre el self-loop EN_PROGRESO→EN_PROGRESO — "Registrar avance" nunca
   * cambia de estado, solo deja constancia de qué pasó (ver diagrama de
   * estados de Edgar 2026-08-12: Registrado→Pendiente y Pendiente→En progreso
   * son transiciones simples sin formulario, manejadas en `DetailPanel.tsx`
   * directo con `useCambiarEstado`; "Finalizar"→Atendido vive en
   * `CulminarAtencionDialog`). No hay selector de "siguiente estado" acá
   * porque ya no hace falta — el caller siempre sabe qué transición es.
   */
  transicion: TransicionEstado;
  tecnicoActualId?: string;
  onClose: () => void;
  onRegistrado: () => void;
};

/**
 * Versión web de `RegistrarAvanceSheet` (Spec 07, RF-07.3 a RF-07.7) — pedido de
 * Edgar 2026-08-12: el bottom-sheet de móvil se sentía invasivo en desktop. Mismo
 * shell centrado que `ConfirmDialog.web.tsx` (overlay fixed + blur + card centrada),
 * mismos campos/hooks/catálogo que la versión nativa. Cancelar con algo tipeado o
 * seleccionado pasa por `ConfirmDialog` (el mismo componente que usa la edición de
 * datos catastrales) antes de cerrar — pedido explícito de Edgar.
 */
export function RegistrarAvanceSheet({
  visible,
  incidenciaId,
  incidenciaLabel,
  transicion,
  tecnicoActualId,
  onClose,
  onRegistrado,
}: Props) {
  const [motivo, setMotivo] = useState<MotivoAvance | null>(null);
  const [equipo, setEquipo] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [tecnico, setTecnico] = useState<Usuario | null>(null);
  const [nota, setNota] = useState('');
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);

  const registrarAvance = useRegistrarAvance();
  const reasignarResponsable = useReasignarResponsable();

  const hayCambiosSinGuardar = !!(motivo || nota.trim() || equipo || area || tecnico);

  const resetState = () => {
    setMotivo(null);
    setEquipo(null);
    setArea(null);
    setTecnico(null);
    setNota('');
  };

  const handleCancelarClick = () => {
    if (hayCambiosSinGuardar) {
      setConfirmarCancelar(true);
    } else {
      resetState();
      onClose();
    }
  };

  useEffect(() => {
    if (!visible || confirmarCancelar) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (motivo || nota.trim() || equipo || area || tecnico) {
        setConfirmarCancelar(true);
        return;
      }
      setMotivo(null);
      setEquipo(null);
      setArea(null);
      setTecnico(null);
      setNota('');
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, confirmarCancelar, motivo, nota, equipo, area, tecnico, onClose]);

  if (!visible) return null;

  const faltaCampoDependiente =
    (motivo === 'REQUIERE_EQUIPO' && !equipo) ||
    (motivo === 'DERIVAR_OTRA_AREA' && !area) ||
    (motivo === 'REASIGNAR_TECNICO' && !tecnico);

  const handleConfirm = () => {
    if (!motivo || faltaCampoDependiente) return;

    const notaFinal = [
      motivo === 'REQUIERE_EQUIPO' && equipo ? `Equipo requerido: ${equipo}.` : null,
      motivo === 'DERIVAR_OTRA_AREA' && area ? `Área: ${area}.` : null,
      nota.trim() || null,
    ]
      .filter(Boolean)
      .join(' ');

    registrarAvance.mutate(
      { id: incidenciaId, motivo, nota: notaFinal, siguienteEstado: transicion.hacia },
      {
        onSuccess: () => {
          if (motivo === 'REASIGNAR_TECNICO' && tecnico) {
            reasignarResponsable.mutate({ id: incidenciaId, usuario: tecnico });
          }
          resetState();
          onRegistrado();
        },
      }
    );
  };

  const deshabilitarConfirmar = !motivo || faltaCampoDependiente || registrarAvance.isPending;

  return (
    <>
      <div role="dialog" aria-modal="true" aria-labelledby="registrar-avance-title" onClick={handleCancelarClick} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={card}>
          <div style={head}>
            <div style={{ minWidth: 0 }}>
              <h2 id="registrar-avance-title" style={titleStyle}>Registrar avance</h2>
              <p style={subtitleStyle}>{incidenciaLabel}</p>
            </div>
            <button type="button" style={closeBtn} onClick={handleCancelarClick} aria-label="Cerrar">
              <Ionicons name="close" size={16} color={Colors.textMuted} />
            </button>
          </div>

          <div style={body}>
            <span style={sectionLabel}>¿QUÉ PASÓ?</span>
            <div style={grid}>
              {MOTIVOS_AVANCE.map((m) => (
                <Chip key={m.value} label={m.label} active={motivo === m.value} onClick={() => setMotivo(m.value)} />
              ))}
            </div>

            {motivo === 'REQUIERE_EQUIPO' && (
              <>
                <span style={sectionLabel}>EQUIPO</span>
                <div style={grid}>
                  {EQUIPO_OPTIONS.map((opt) => (
                    <Chip key={opt} label={opt} active={equipo === opt} onClick={() => setEquipo(opt)} />
                  ))}
                </div>
              </>
            )}

            {motivo === 'DERIVAR_OTRA_AREA' && (
              <>
                <span style={sectionLabel}>ÁREA</span>
                <div style={grid}>
                  {AREA_OPTIONS.map((opt) => (
                    <Chip key={opt} label={opt} active={area === opt} onClick={() => setArea(opt)} />
                  ))}
                </div>
              </>
            )}

            {motivo === 'REASIGNAR_TECNICO' && (
              <>
                <span style={sectionLabel}>REASIGNAR A</span>
                <View>
                  <TecnicoOptionsList selectedId={tecnico?.id ?? tecnicoActualId} onSelect={setTecnico} />
                </View>
              </>
            )}

            <span style={sectionLabel}>NOTA (OPCIONAL)</span>
            <textarea
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Solo si hace falta un detalle extra…"
              style={notaBox}
            />
          </div>

          <div style={buttonsRow}>
            <button type="button" style={cancelBtn} onClick={handleCancelarClick}>
              Cancelar
            </button>
            <button
              type="button"
              style={{ ...confirmBtn, opacity: deshabilitarConfirmar ? 0.5 : 1, cursor: deshabilitarConfirmar ? 'default' : 'pointer' }}
              onClick={handleConfirm}
              disabled={deshabilitarConfirmar}
            >
              {registrarAvance.isPending ? 'Guardando…' : 'Registrar avance'}
            </button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmarCancelar}
        title="¿Cancelar registro de avance?"
        message="Se perderán los cambios sin guardar."
        confirmLabel="Sí, cancelar"
        cancelLabel="Seguir editando"
        destructive
        onConfirm={() => {
          setConfirmarCancelar(false);
          resetState();
          onClose();
        }}
        onCancel={() => setConfirmarCancelar(false)}
      />
    </>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" style={active ? { ...chip, ...chipActive } : chip} onClick={onClick}>
      {label}
    </button>
  );
}

// ── Estilos ───────────────────────────────────────────────

// z-index por debajo de ConfirmDialog (200) — cuando se pide confirmar cancelar,
// el diálogo de confirmación debe quedar SIEMPRE por encima de este overlay.
const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 150,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  backgroundColor: 'rgba(15, 23, 42, 0.4)',
  backdropFilter: 'blur(2px)',
  WebkitBackdropFilter: 'blur(2px)',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 480,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  overflow: 'hidden',
};

const head: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
  padding: '20px 24px 12px',
  flexShrink: 0,
};

const titleStyle: CSSProperties = { fontSize: 17, fontWeight: 700, color: Colors.textBody, margin: 0 };

const subtitleStyle: CSSProperties = {
  fontSize: 12, color: Colors.textMuted, margin: '4px 0 0',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const closeBtn: CSSProperties = {
  width: 26, height: 26, borderRadius: 13, flexShrink: 0,
  backgroundColor: '#F1F3F5', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
};

const body: CSSProperties = {
  padding: '4px 24px 20px',
  overflowY: 'auto',
  display: 'flex',
  flexDirection: 'column',
};

const sectionLabel: CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: Colors.textMuted, letterSpacing: 0.4,
  marginTop: 14, marginBottom: 6,
};

const grid: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8 };

const chip: CSSProperties = {
  border: `1px solid ${Colors.border}`,
  borderRadius: 999,
  padding: '8px 14px',
  fontSize: 12, fontWeight: 600, color: Colors.textBody,
  backgroundColor: '#FFFFFF', cursor: 'pointer',
};

const chipActive: CSSProperties = {
  backgroundColor: Colors.accent, borderColor: Colors.accent, color: '#FFFFFF',
};

const notaBox: CSSProperties = {
  border: `1px solid ${Colors.border}`,
  borderRadius: 8,
  padding: 10,
  minHeight: 70,
  fontSize: 12.5,
  color: Colors.textBody,
  fontFamily: 'inherit',
  resize: 'vertical',
};

const buttonsRow: CSSProperties = {
  display: 'flex', gap: 10,
  padding: '14px 24px', borderTop: `1px solid ${Colors.border}`, flexShrink: 0,
};

const cancelBtn: CSSProperties = {
  flex: 1, padding: '11px', borderRadius: 999,
  border: `1.5px solid ${Colors.accent}`, backgroundColor: '#FFFFFF',
  color: Colors.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

const confirmBtn: CSSProperties = {
  flex: 1, padding: '11px', borderRadius: 999, border: 'none',
  backgroundColor: Colors.accent, color: '#FFFFFF', fontSize: 13, fontWeight: 700,
};
