import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

export type ComboOption = { id: number; nombre: string };

type Props = {
  value: number | null;
  options: ComboOption[] | undefined;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  onSelect: (option: ComboOption) => void;
};

/** Combo con buscador — reemplaza un <select> nativo cuando la lista es larga
 * (materiales, tipos de accesorio, clasificación). El input de búsqueda filtra en
 * vez de obligar a scrollear. Sin portal (mismo criterio que ConfirmDialog/Toast):
 * el panel flotante es `position: absolute` dentro de un wrapper `relative`. */
export function SearchableCombo({
  value,
  options,
  loading = false,
  disabled = false,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const seleccionado = options?.find((o) => o.id === value) ?? null;

  const filtradas = useMemo(() => {
    if (!options) return [];
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.nombre.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} style={container}>
      <button
        type="button"
        style={{ ...trigger, opacity: disabled ? 0.6 : 1 }}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={triggerLabel}>{seleccionado?.nombre ?? placeholder}</span>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="var(--map-text-muted)" />
      </button>

      {open && (
        <div style={panel}>
          <div style={searchRow}>
            <Ionicons name="search-outline" size={14} color="var(--map-text-muted)" />
            <input
              ref={inputRef}
              style={searchInput}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div style={list}>
            {loading && <div style={emptyState}>Cargando…</div>}
            {!loading && filtradas.length === 0 && <div style={emptyState}>Sin resultados</div>}
            {!loading &&
              filtradas.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  style={{
                    ...item,
                    backgroundColor: opt.id === value ? 'var(--map-accent-bg)' : 'transparent',
                    color: opt.id === value ? 'var(--map-accent)' : 'var(--map-text)',
                  }}
                  onClick={() => {
                    setOpen(false);
                    setQuery('');
                    if (opt.id !== value) onSelect(opt);
                  }}
                >
                  {opt.nombre}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

const FONT: CSSProperties['fontFamily'] = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';

const container: CSSProperties = { position: 'relative', width: '100%' };

const trigger: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--map-border)',
  backgroundColor: 'var(--map-surface)',
  cursor: 'pointer',
  fontFamily: FONT,
};

const triggerLabel: CSSProperties = {
  fontSize: 13,
  color: 'var(--map-text)',
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const panel: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 50,
  backgroundColor: 'var(--map-surface)',
  border: '1px solid var(--map-border)',
  borderRadius: 8,
  boxShadow: '0 8px 24px var(--map-shadow)',
  overflow: 'hidden',
};

const searchRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 10px',
  borderBottom: '1px solid var(--map-border)',
};

const searchInput: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: 13,
  fontFamily: FONT,
  color: 'var(--map-text)',
};

const list: CSSProperties = {
  maxHeight: 176,
  overflowY: 'auto',
};

const item: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 12px',
  border: 'none',
  fontSize: 13,
  fontFamily: FONT,
  cursor: 'pointer',
};

const emptyState: CSSProperties = {
  padding: '12px',
  fontSize: 12.5,
  color: 'var(--map-text-muted)',
  textAlign: 'center',
};
