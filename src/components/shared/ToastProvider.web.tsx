import { createContext, useCallback, useContext, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type ToastVariant = 'success' | 'error';
type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3000;

/** Notificaciones flotantes (éxito/error), invocables desde cualquier componente
 * vía `useToast()`. `position: fixed` sin portal — mismo patrón verificado que
 * ConfirmDialog/ComingSoonModal (docs/ESTADO_PROYECTO.md §4: queda contenido
 * dentro del PhoneFrame sin hack extra). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = nextId.current++;
    setItems((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={stack} aria-live="polite">
        {items.map((item) => (
          <div key={item.id} style={item.variant === 'error' ? toastError : toastSuccess}>
            {item.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

const FONT: CSSProperties['fontFamily'] = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';

const stack: CSSProperties = {
  position: 'fixed',
  top: 16,
  left: 0,
  right: 0,
  zIndex: 300,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  pointerEvents: 'none',
  padding: '0 16px',
};

const toastBase: CSSProperties = {
  maxWidth: 360,
  padding: '10px 16px',
  borderRadius: 999,
  fontFamily: FONT,
  fontSize: 13,
  fontWeight: 600,
  boxShadow: '0 4px 16px var(--map-shadow)',
  textAlign: 'center',
};

const toastSuccess: CSSProperties = {
  ...toastBase,
  backgroundColor: 'var(--map-accent)',
  color: '#FFFFFF',
};

const toastError: CSSProperties = {
  ...toastBase,
  backgroundColor: 'var(--map-danger-bg)',
  color: 'var(--map-danger-text)',
  border: '1px solid var(--map-danger-text)',
};
