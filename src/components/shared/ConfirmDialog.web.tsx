import { useEffect, type CSSProperties } from 'react';

import { Colors } from '@/constants/theme';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Modal de confirmación reutilizable (Web).
 * Cierra con Escape, click en el overlay, o botón Cancelar. Enter confirma.
 * `destructive: true` pinta el botón de confirmar en rojo (para eliminar/borrar).
 */
export function ConfirmDialog({
  open,
  title = 'Confirmar cambio',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter' && !loading) onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onConfirm, onCancel]);

  if (!open) return null;

  const confirmBg = destructive ? Colors.statusCritica : Colors.accent;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={loading ? undefined : onCancel}
      style={overlay}
    >
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h2 id="confirm-dialog-title" style={titleStyle}>{title}</h2>
        <p style={messageStyle}>{message}</p>
        <div style={buttonsRow}>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            style={{ ...btn, ...cancelBtn, opacity: loading ? 0.6 : 1 }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            style={{
              ...btn,
              ...confirmBtn,
              backgroundColor: confirmBg,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'default' : 'pointer',
            }}
          >
            {loading ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
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
  borderRadius: 8,
  boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  padding: '24px 24px 20px',
};

const titleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: Colors.textBody,
  margin: '0 0 10px',
};

const messageStyle: CSSProperties = {
  fontSize: 14,
  color: Colors.textMuted,
  lineHeight: '20px',
  margin: '0 0 24px',
};

const buttonsRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const btn: CSSProperties = {
  padding: '10px 20px',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 600,
  border: 'none',
  cursor: 'pointer',
  minWidth: 100,
};

const cancelBtn: CSSProperties = {
  backgroundColor: '#FFFFFF',
  color: Colors.textBody,
  border: `1px solid ${Colors.border}`,
};

const confirmBtn: CSSProperties = {
  color: '#FFFFFF',
};
