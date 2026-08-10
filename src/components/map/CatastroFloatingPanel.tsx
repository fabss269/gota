import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Image as RNImage } from 'react-native';

import { useCapasStore, type CapaKey } from '@/state/capasStore';

const RESERVORIO_ELEVADO_URI = RNImage.resolveAssetSource(
  require('@/assets/images/icons/reservorio_elevado.png'),
).uri;

type CapaItem = { key: CapaKey; label: string; icon: ReactNode };

const PREDIO: CapaItem[] = [
  { key: 'manzanas', label: 'Manzanas', icon: <ColorSquare color="#BDBDBD" border="#9E9E9E" /> },
  { key: 'lotes', label: 'Lotes', icon: <ColorSquare color="white" border="#BDBDBD" /> },
];

const ALCANTARILLADO: CapaItem[] = [
  { key: 'red_primaria_desague', label: 'Primaria', icon: <SolidLine color="#5D4037" /> },
  { key: 'red_secundaria_desague', label: 'Secundaria', icon: <SolidLine color="#A1887F" /> },
  { key: 'flujo_desague', label: 'Flujo', icon: <Triangle color="#B71C1C" /> },
  { key: 'conexion_desague', label: 'Conexión', icon: <DashedLine color="#FB8C00" /> },
  { key: 'caja_desague', label: 'Caja', icon: <ColorCircle color="#795548" /> },
  { key: 'buzones', label: 'Buzones', icon: <ColorCircle color="#757575" /> },
];

const AGUA: CapaItem[] = [
  { key: 'red_potable', label: 'Red potable', icon: <SolidLine color="#29B6F6" /> },
  { key: 'conexion_agua', label: 'Conexión', icon: <DashedLine color="#60A5FA" /> },
  { key: 'caja_agua', label: 'Caja', icon: <ColorCircle color="#06B6D4" /> },
  { key: 'accesorios', label: 'Accesorios', icon: <ColorCircle color="#9C27B0" /> },
];

const INFRAESTRUCTURA: CapaItem[] = [
  {
    key: 'reservorios',
    label: 'Reservorios',
    icon: (
      <img
        src={RESERVORIO_ELEVADO_URI}
        alt=""
        style={{ width: 18, height: 18, objectFit: 'contain' }}
      />
    ),
  },
];

const TODAS_LAS_CAPAS = [...PREDIO, ...ALCANTARILLADO, ...AGUA, ...INFRAESTRUCTURA];

/**
 * Panel flotante inferior del mapa desktop con las capas de Catastro (Predio,
 * Alcantarillado, Agua) — antes vivían dentro de FiltersSidebar; se sacaron a un
 * panel flotante estilo Figma para no competir por espacio vertical con
 * FILTROS/UBICACIÓN y para que "mostrar/quitar redes" se sienta como una acción
 * sobre el mapa, no un filtro de búsqueda.
 *
 * Colapsado por defecto (una píldora "Capas · N activas") para no tapar el mapa
 * permanentemente — se expande hacia arriba al hacer clic (por eso la flecha
 * apunta hacia arriba en reposo) y se cierra al tocar afuera o al volver a
 * tocar la píldora. Cada grupo dentro del panel expandido usa una grilla de 2
 * filas fijas (el número de columnas sale de la cantidad de capas del grupo)
 * para que Predio/Alcantarillado/Agua queden con la misma altura visual.
 *
 * Solo versión desktop — CapasTab.tsx (móvil) queda intacto.
 */
export function CatastroFloatingPanel() {
  const { capasVisibles, aplicarCapas } = useCapasStore();
  const [abierto, setAbierto] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  const isCapa = (key: CapaKey) => capasVisibles.has(key);
  const toggleCapa = (key: CapaKey) => {
    const next = new Set(capasVisibles);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    aplicarCapas(next);
  };

  const activas = TODAS_LAS_CAPAS.filter((c) => isCapa(c.key)).length;

  return (
    <div ref={containerRef} style={container}>
      {abierto && (
        <div style={panel}>
          <CapaGroup title="Predio" items={PREDIO} isCapa={isCapa} onToggle={toggleCapa} />
          <div style={colDivider} />
          <CapaGroup title="Alcantarillado" items={ALCANTARILLADO} isCapa={isCapa} onToggle={toggleCapa} />
          <div style={colDivider} />
          <CapaGroup title="Agua" items={AGUA} isCapa={isCapa} onToggle={toggleCapa} />
          <div style={colDivider} />
          <CapaGroup title="Infraestructura no lineal" items={INFRAESTRUCTURA} isCapa={isCapa} onToggle={toggleCapa} />
        </div>
      )}

      <button type="button" style={pill} onClick={() => setAbierto((v) => !v)}>
        <span style={pillLabel}>Capas</span>
        <span style={pillCount}>{activas} activas</span>
        {/* Apunta hacia arriba en reposo (el panel se abre hacia arriba) y se invierte al expandir. */}
        <span style={{ ...pillChevron, transform: abierto ? 'rotate(0deg)' : 'rotate(180deg)' }}>▾</span>
      </button>
    </div>
  );
}

function CapaGroup({
  title,
  items,
  isCapa,
  onToggle,
}: {
  title: string;
  items: CapaItem[];
  isCapa: (key: CapaKey) => boolean;
  onToggle: (key: CapaKey) => void;
}) {
  // 2 filas fijas siempre; el ancho del grupo sale de cuántas columnas hacen
  // falta para acomodar sus capas en esas 2 filas.
  const cols = Math.ceil(items.length / 2);
  return (
    <div style={group}>
      <span style={groupTitle}>{title}</span>
      <div style={{ ...grid, gridTemplateColumns: `repeat(${cols}, ${CHIP_W}px)` }}>
        {items.map((item) => (
          <CapaChip
            key={item.key}
            icon={item.icon}
            label={item.label}
            value={isCapa(item.key)}
            onChange={() => onToggle(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

function CapaChip({
  icon,
  label,
  value,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      style={{ ...chip, ...(value ? chipActive : chipInactive) }}
      onClick={onChange}
    >
      <div style={chipIconBox}>{icon}</div>
      <span style={chipLabel}>{label}</span>
    </button>
  );
}

function SolidLine({ color }: { color: string }) {
  return <div style={{ width: 18, height: 2.5, backgroundColor: color, borderRadius: 1 }} />;
}

function DashedLine({ color }: { color: string }) {
  return <div style={{ width: 18, height: 0, borderTop: `2px dashed ${color}` }} />;
}

function ColorSquare({ color, border }: { color: string; border: string }) {
  return (
    <div style={{ width: 12, height: 12, backgroundColor: color, border: `1.5px solid ${border}`, borderRadius: 2 }} />
  );
}

function ColorCircle({ color }: { color: string }) {
  return <div style={{ width: 10, height: 10, backgroundColor: color, borderRadius: 5 }} />;
}

function Triangle({ color }: { color: string }) {
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: '4.5px solid transparent',
        borderRight: '4.5px solid transparent',
        borderBottom: `8px solid ${color}`,
      }}
    />
  );
}

// ── Estilos ───────────────────────────────────────────────

const CHIP_W = 62;
const CHIP_H = 52;

const container: CSSProperties = {
  position: 'absolute',
  left: '50%',
  bottom: 20,
  transform: 'translateX(-50%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 8,
  zIndex: 10,
};

const panel: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  backgroundColor: 'var(--map-surface)',
  borderRadius: 14,
  boxShadow: '0 4px 20px var(--map-shadow)',
  border: '1px solid var(--map-border)',
  padding: '12px 16px',
};

const pill: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  backgroundColor: 'var(--map-surface)',
  borderRadius: 999,
  boxShadow: '0 4px 20px var(--map-shadow)',
  border: '1px solid var(--map-border)',
  padding: '10px 16px',
  cursor: 'pointer',
};

const pillLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--map-text)',
};

const pillCount: CSSProperties = {
  fontSize: 11,
  color: 'var(--map-text-muted)',
};

const pillChevron: CSSProperties = {
  fontSize: 11,
  color: 'var(--map-text-muted)',
  transition: 'transform 150ms',
};

const group: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
};

const colDivider: CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  backgroundColor: 'var(--map-border)',
  margin: '0 14px',
};

const groupTitle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--map-text-muted)',
  letterSpacing: 0.6,
  marginBottom: 8,
  textAlign: 'center',
};

const grid: CSSProperties = {
  display: 'grid',
  gridTemplateRows: `repeat(2, ${CHIP_H}px)`,
  gap: 4,
};

const chip: CSSProperties = {
  width: CHIP_W,
  height: CHIP_H,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'opacity 120ms, background-color 120ms, border-color 120ms',
};

const chipActive: CSSProperties = {
  border: '1px solid var(--map-accent)',
  backgroundColor: 'var(--map-accent-bg)',
  opacity: 1,
};

const chipInactive: CSSProperties = {
  border: '1px solid var(--map-border)',
  backgroundColor: 'transparent',
  opacity: 0.45,
};

const chipIconBox: CSSProperties = {
  height: 13,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const chipLabel: CSSProperties = {
  fontSize: 10,
  color: 'var(--map-text)',
  lineHeight: 1.1,
  textAlign: 'center',
};
