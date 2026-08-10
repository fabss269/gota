import { useEffect } from 'react';

import { resolveAsset } from '@/utils/resolveAsset';

const MASCOT_SRC = require('@/assets/images/figura-agua/gotita-pulgar-arriba.png') as { uri?: string };

const T = {
  primary: '#001430',
  onPrimary: '#ffffff',
  surfaceLowest: '#ffffff',
  onSurfaceVariant: '#43474f',
  outlineVariant: '#c4c6d0',
};

const FONT_HEAD = 'Manrope, "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_BODY = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actionLabel?: string;
};

/**
 *  Se usa para links y botones cuyas features aún no están construidas .
 */
export function ComingSoonModal({
  open,
  onClose,
  title = 'Próximamente',
  message = 'Esta funcionalidad estará disponible en la versión 2.0 de nuestra plataforma.',
  actionLabel = 'Entendido',
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: `${T.primary}66`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 384,
          backgroundColor: `${T.surfaceLowest}cc`,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: `1px solid ${T.outlineVariant}4d`,
          borderRadius: 8,
          boxShadow: '0 4px 28px rgba(0,0,0,0.08)',
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            marginTop: -80,
            marginBottom: 24,
            width: 128,
            height: 128,
            borderRadius: '50%',
            backgroundColor: T.surfaceLowest,
            border: `1px solid ${T.outlineVariant}33`,
            padding: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
          }}
        >
          <img
            src={resolveAsset(MASCOT_SRC)}
            alt="Mascota GOTA"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>

        <h2
          id="coming-soon-title"
          style={{
            fontFamily: FONT_HEAD,
            fontSize: 24,
            lineHeight: '32px',
            fontWeight: 600,
            color: T.primary,
            margin: '0 0 8px',
          }}
        >
          {title}
        </h2>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 16,
            lineHeight: '24px',
            color: T.onSurfaceVariant,
            margin: '0 0 32px',
          }}
        >
          {message}
        </p>

        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 16px',
            border: 'none',
            borderRadius: 9999,
            backgroundColor: T.primary,
            color: T.onPrimary,
            fontFamily: FONT_BODY,
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: '0.05em',
            cursor: 'pointer',
            boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
          }}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}
