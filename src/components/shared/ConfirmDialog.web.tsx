import { useEffect, type CSSProperties } from 'react';

type Props = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal de confirmación reutilizable — "¿Estás seguro de cambiar X de Y a Z?".
 * Mismo patrón que ComingSoonModal.web.tsx (overlay `position: fixed`, sin portal:
 * verificado en docs/ESTADO_PROYECTO.md §4 que ningún modal necesita portar fuera
 * del PhoneFrame en esta combinación de versiones). Usa los tokens `--map-*` en vez
 * de colores propios porque vive dentro del panel de elemento del mapa. */
export function ConfirmDialog({
  open,
  title = 'Confirmar cambio',
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      onClick={loading ? undefined : onCancel}
      style={overlay}
    >
      <div onClick={(e) => e.stopPropagation()} style={card}>
        <h2 id="confirm-dialog-title" style={titleStyle}>
          {title}
        </h2>
        <p style={messageStyle}>{message}</p>
        <div style={actions}>
          <button type="button" style={cancelBtn} onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button type="button" style={confirmBtn} onClick={onConfirm} disabled={loading}>
            {loading ? 'Guardando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const FONT: CSSProperties['fontFamily'] = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  backgroundColor: 'rgba(10, 20, 40, 0.45)',
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 320,
  backgroundColor: 'var(--map-surface)',
  border: '1px solid var(--map-border)',
  borderRadius: 12,
  boxShadow: '0 8px 32px var(--map-shadow)',
  padding: 20,
  fontFamily: FONT,
};

const titleStyle: CSSProperties = {
  margin: '0 0 8px',
  fontSize: 16,
  fontWeight: 700,
  color: 'var(--map-text)',
};

const messageStyle: CSSProperties = {
  margin: '0 0 20px',
  fontSize: 13,
  lineHeight: '19px',
  color: 'var(--map-text-muted)',
};

const actions: CSSProperties = {
  display: 'flex',
  gap: 10,
};

const buttonBase: CSSProperties = {
  flex: 1,
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 700,
  fontFamily: FONT,
  cursor: 'pointer',
};

const cancelBtn: CSSProperties = {
  ...buttonBase,
  backgroundColor: 'var(--map-surface)',
  color: 'var(--map-text)',
  border: '1px solid var(--map-border)',
};

const confirmBtn: CSSProperties = {
  ...buttonBase,
  backgroundColor: 'var(--map-accent)',
  color: '#FFFFFF',
  border: '1px solid var(--map-accent)',
};
