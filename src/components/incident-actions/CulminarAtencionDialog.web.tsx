import { useEffect, useState, type CSSProperties } from 'react';

import { Colors } from '@/constants/theme';
import { useRegistrarAvance } from '@/hooks/useRegistrarAvance';

type Props = {
  visible: boolean;
  incidenciaId: string;
  incidenciaLabel: string;
  onClose: () => void;
  onCulminado: () => void;
};

/**
 * "Finalizar" del diagrama de estados (Edgar 2026-08-12): EN_PROGRESO→ATENDIDO.
 * Distinto de `RegistrarAvanceSheet` — no hay motivo que elegir, solo una nota
 * opcional. Internamente usa el mismo `POST /avances` con `motivo: 'SE_RESOLVIO'`
 * (mapea a ATENDIDO en el backend, `MOTIVO_ESTADO`) para poder guardar la nota —
 * `PATCH /estado` no tiene campo de nota.
 */
export function CulminarAtencionDialog({ visible, incidenciaId, incidenciaLabel, onClose, onCulminado }: Props) {
  const [nota, setNota] = useState('');
  const registrarAvance = useRegistrarAvance();

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  if (!visible) return null;

  const handleConfirm = () => {
    registrarAvance.mutate(
      { id: incidenciaId, motivo: 'SE_RESOLVIO', nota: nota.trim(), siguienteEstado: 'ATENDIDO' },
      {
        onSuccess: () => {
          setNota('');
          onCulminado();
        },
      }
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="culminar-atencion-title" onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h2 id="culminar-atencion-title" style={titleStyle}>Culminar atención</h2>
        <p style={subtitleStyle}>{incidenciaLabel}</p>

        <span style={sectionLabel}>NOTA (OPCIONAL)</span>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Detalle de la solución, si hace falta…"
          style={notaBox}
          autoFocus
        />

        <div style={buttonsRow}>
          <button type="button" style={cancelBtn} onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            style={{ ...confirmBtn, opacity: registrarAvance.isPending ? 0.6 : 1 }}
            onClick={handleConfirm}
            disabled={registrarAvance.isPending}
          >
            {registrarAvance.isPending ? 'Guardando…' : 'Culminar atención'}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  maxWidth: 420,
  backgroundColor: '#FFFFFF',
  borderRadius: 10,
  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  padding: '24px 24px 20px',
};

const titleStyle: CSSProperties = { fontSize: 17, fontWeight: 700, color: Colors.textBody, margin: 0 };

const subtitleStyle: CSSProperties = {
  fontSize: 12, color: Colors.textMuted, margin: '4px 0 0',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const sectionLabel: CSSProperties = {
  display: 'block', fontSize: 10.5, fontWeight: 700, color: Colors.textMuted, letterSpacing: 0.4,
  marginTop: 18, marginBottom: 6,
};

const notaBox: CSSProperties = {
  width: '100%',
  border: `1px solid ${Colors.border}`,
  borderRadius: 8,
  padding: 10,
  minHeight: 80,
  fontSize: 12.5,
  color: Colors.textBody,
  fontFamily: 'inherit',
  resize: 'vertical',
  boxSizing: 'border-box',
};

const buttonsRow: CSSProperties = {
  display: 'flex', gap: 10, marginTop: 20,
};

const cancelBtn: CSSProperties = {
  flex: 1, padding: '11px', borderRadius: 999,
  border: `1.5px solid ${Colors.accent}`, backgroundColor: '#FFFFFF',
  color: Colors.accent, fontSize: 13, fontWeight: 700, cursor: 'pointer',
};

const confirmBtn: CSSProperties = {
  flex: 1, padding: '11px', borderRadius: 999, border: 'none',
  backgroundColor: Colors.statusATiempo, color: '#FFFFFF', fontSize: 13, fontWeight: 700, cursor: 'pointer',
};
