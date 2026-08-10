import { Ionicons } from '@expo/vector-icons';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; kind: ToastKind; message: string };

type Ctx = {
  show: (kind: ToastKind, message: string, durationMs?: number) => void;
  success: (message: string, durationMs?: number) => void;
  error: (message: string, durationMs?: number) => void;
  info: (message: string, durationMs?: number) => void;
};

const ToastCtx = createContext<Ctx | null>(null);

/** Envuelve el árbol para habilitar `useToast()` desde cualquier componente. */
export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback<Ctx['show']>((kind, message, durationMs = 3000) => {
    const id = nextIdRef.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    const timer = setTimeout(() => dismiss(id), durationMs);
    timersRef.current.set(id, timer);
  }, [dismiss]);

  const value = useMemo<Ctx>(() => ({
    show,
    success: (m, d) => show('success', m, d),
    error: (m, d) => show('error', m, d),
    info: (m, d) => show('info', m, d),
  }), [show]);

  useEffect(() => () => {
    for (const t of timersRef.current.values()) clearTimeout(t);
    timersRef.current.clear();
  }, []);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        style={[styles.container, Platform.OS === 'web' ? webContainer : null]}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </View>
    </ToastCtx.Provider>
  );
}

/** Hook para lanzar toasts desde cualquier componente. */
export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return ctx;
}

// ── ToastItem ────────────────────────────────────────────────────────────────

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const cfg = KIND_STYLE[toast.kind];
  return (
    <View style={[styles.toast, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
      <Ionicons name={cfg.icon} size={18} color={cfg.iconColor} style={styles.icon} />
      <Text style={[styles.message, { color: cfg.text }]} numberOfLines={3}>{toast.message}</Text>
      <Pressable onPress={onDismiss} hitSlop={8} style={styles.closeBtn}>
        <Ionicons name="close" size={16} color={cfg.text} />
      </Pressable>
    </View>
  );
}

type IconName = React.ComponentProps<typeof Ionicons>['name'];
type KindConfig = { icon: IconName; iconColor: string; bg: string; border: string; text: string };

const KIND_STYLE: Record<ToastKind, KindConfig> = {
  success: {
    icon: 'checkmark-circle',
    iconColor: '#0F5132',
    bg: '#D1E7DD',
    border: '#A3CFBB',
    text: '#0F5132',
  },
  error: {
    icon: 'alert-circle',
    iconColor: '#842029',
    bg: '#F8D7DA',
    border: '#F1AEB5',
    text: '#842029',
  },
  info: {
    icon: 'information-circle',
    iconColor: '#055160',
    bg: '#CFF4FC',
    border: '#9EEAF9',
    text: '#055160',
  },
};

// ── Estilos ──────────────────────────────────────────────────────────────────

// Contenedor superior centrado. En web usamos position:fixed via style inline
// para que quede por encima de todo el layout, en nativo usa position:absolute
// del propio RN (el Provider vive fuera de todos los layouts al ser root-level).
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 260,
    maxWidth: 460,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  icon: { flexShrink: 0 },
  message: { flex: 1, fontSize: 13, fontWeight: '600' },
  closeBtn: { padding: 2 },
});

// react-native-web transforma position:absolute a fixed automáticamente para
// elementos hijos de root, pero por si acaso este objeto override lo garantiza.
const webContainer = { position: 'fixed' as const };
