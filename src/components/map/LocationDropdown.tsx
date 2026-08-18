import { useState, type CSSProperties } from 'react';

export type LocationDropdownOption = { id: string; nombre: string };

type Props = {
  options: LocationDropdownOption[];
  value: string | null;
  onSelect: (id: string | null) => void;
  placeholder: string;
  disabled?: boolean;
  clearLabel?: string;
  // Solo la instancia de Sector en FiltersSidebar pasa estas dos — 👁 pinta el
  // contorno del sector en el mapa (ver ubicacionStore.previsualizarSector /
  // applySectorHighlight) sin tocar la selección real; 🔍 solo mueve la cámara
  // (ver mapSearchStore.flyToBounds). Ninguna de las dos dispara fetch de datos —
  // eso solo pasa al elegir la fila (onSelect).
  onPreview?: (id: string | null) => void;
  onZoom?: (id: string) => void;
};

/**
 * Dropdown anclado (no modal fullscreen) en CSS plano — mismo estilo visual que el
 * resto de FiltersSidebar.tsx (que es 100% div/CSSProperties). No reusa
 * SearchableCombo porque ese es un Modal de React Native pensado para overlay
 * centrado, no para un combo inline con iconos por fila.
 *
 * Usado 3 veces en FiltersSidebar (Provincia/Distrito/Sector) — solo Sector pasa
 * onPreview/onZoom.
 */
export function LocationDropdown({
  options,
  value,
  onSelect,
  placeholder,
  disabled,
  clearLabel = 'Todos',
  onPreview,
  onZoom,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  // Preview "fijado" por clic en el ojito (toggle) — para quien no puede hacer
  // hover (touch). Mientras haya uno fijado, el hover de otras filas no lo pisa.
  const [pinnedPreview, setPinnedPreview] = useState<string | null>(null);
  const seleccionado = options.find((o) => o.id === value) ?? null;

  const cerrar = () => {
    setAbierto(false);
    setPinnedPreview(null);
    onPreview?.(null);
  };

  const handleRowMouseEnter = (id: string) => {
    if (pinnedPreview) return;
    onPreview?.(id);
  };
  const handleRowMouseLeave = () => {
    if (pinnedPreview) return;
    onPreview?.(null);
  };
  const handleEyeClick = (id: string) => {
    const next = pinnedPreview === id ? null : id;
    setPinnedPreview(next);
    onPreview?.(next);
  };

  return (
    <div style={wrapper}>
      <button
        type="button"
        style={disabled ? { ...trigger, ...triggerDisabled } : trigger}
        onClick={() => !disabled && setAbierto((v) => !v)}
        disabled={disabled}
        aria-expanded={abierto}
      >
        <span style={seleccionado ? triggerLabel : triggerPlaceholder}>
          {seleccionado?.nombre ?? placeholder}
        </span>
        <span style={chevron}>{abierto ? '▴' : '▾'}</span>
      </button>

      {abierto && (
        <>
          {/* Backdrop invisible full-screen: cerrar al clickear afuera, mismo
              patrón que un <select> nativo sin depender de una librería. */}
          <div style={backdrop} onClick={cerrar} />
          <div style={panel}>
            <button
              type="button"
              style={value === null ? { ...optionRow, ...optionRowActive } : optionRow}
              onClick={() => {
                onSelect(null);
                cerrar();
              }}
            >
              {clearLabel}
            </button>

            {options.length === 0 && <div style={emptyMsg}>Sin opciones</div>}

            {options.map((o) => (
              <div
                key={o.id}
                style={rowContainer}
                onMouseEnter={() => handleRowMouseEnter(o.id)}
                onMouseLeave={handleRowMouseLeave}
              >
                <button
                  type="button"
                  style={o.id === value ? { ...optionRowMain, ...optionRowActive } : optionRowMain}
                  onClick={() => {
                    onSelect(o.id);
                    cerrar();
                  }}
                >
                  {o.nombre}
                </button>
                {(onPreview || onZoom) && (
                  <span style={iconsGroup}>
                    {onPreview && (
                      <button
                        type="button"
                        style={pinnedPreview === o.id ? { ...iconBtn, ...iconBtnActive } : iconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEyeClick(o.id);
                        }}
                        title={`Previsualizar ${o.nombre} en el mapa`}
                        aria-label={`Previsualizar ${o.nombre} en el mapa`}
                      >
                        👁
                      </button>
                    )}
                    {onZoom && (
                      <button
                        type="button"
                        style={iconBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          onZoom(o.id);
                        }}
                        title={`Acercar a ${o.nombre}`}
                        aria-label={`Acercar a ${o.nombre}`}
                      >
                        🔍
                      </button>
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

const wrapper: CSSProperties = {
  position: 'relative',
};

const trigger: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 10px',
  fontSize: 12.5,
  borderRadius: 8,
  border: '1px solid var(--map-border)',
  backgroundColor: 'var(--map-surface)',
  color: 'var(--map-text)',
  cursor: 'pointer',
};

const triggerDisabled: CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

const triggerLabel: CSSProperties = {
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const triggerPlaceholder: CSSProperties = {
  ...triggerLabel,
  fontWeight: 400,
  color: 'var(--map-text-muted)',
};

const chevron: CSSProperties = {
  fontSize: 10,
  color: 'var(--map-text-muted)',
  flexShrink: 0,
};

const backdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 19,
};

const panel: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  zIndex: 20,
  maxHeight: 260,
  overflowY: 'auto',
  backgroundColor: 'var(--map-surface)',
  borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
  border: '1px solid var(--map-border)',
  padding: 4,
};

const optionRow: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '7px 8px',
  fontSize: 12.5,
  color: 'var(--map-text)',
  border: 'none',
  borderRadius: 6,
  backgroundColor: 'transparent',
  cursor: 'pointer',
};

const optionRowActive: CSSProperties = {
  backgroundColor: 'var(--map-accent)',
  color: '#FFFFFF',
};

const rowContainer: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
};

const optionRowMain: CSSProperties = {
  ...optionRow,
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const iconsGroup: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
  paddingRight: 4,
};

const iconBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  fontSize: 12,
  border: 'none',
  borderRadius: 5,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  opacity: 0.5,
};

const iconBtnActive: CSSProperties = {
  opacity: 1,
  backgroundColor: 'var(--map-surface-alt)',
};

const emptyMsg: CSSProperties = {
  padding: '8px',
  fontSize: 12,
  color: 'var(--map-text-muted)',
  textAlign: 'center',
};
