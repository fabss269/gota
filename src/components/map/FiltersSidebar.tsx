import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import type { ApiDistrito, ApiSector } from '@/api/types';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { useCapasStore, type CapaKey } from '@/state/capasStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

import { ThemeToggleButton } from './ThemeToggleButton.web';

const TIPO_OPTIONS = [
  'Atoro en colector',
  'Fuga en vereda',
  'Fuga de agua',
  'Falta de agua',
];

const ESTADO_OPTIONS: { value: EstadoIncidencia | ''; label: string }[] = [
  { value: '', label: 'Todos' },
  { value: 'CREADO', label: 'Creado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
];

/**
 * Sidebar fija izquierda del layout web del mapa — Filtros + Ubicación.
 * Catastro (Predio/Alcantarillado/Agua) vive en un panel flotante aparte,
 * ver CatastroFloatingPanel.
 */
export function FiltersSidebar() {
  const {
    tipoAtencion,
    setTipoAtencion,
    estado,
    setEstado,
    prioridades,
    setPrioridades,
    soloNoResueltas,
    setSoloNoResueltas,
    reset,
  } = useFiltersStore();
  const { capasVisibles, aplicarCapas } = useCapasStore();
  const {
    provincias,
    distritos,
    sectores,
    cargando: ubicacionCargando,
    provinciasActivas,
    distritosActivos,
    sectoresActivos,
    cargar: cargarUbicacion,
    toggleProvincia,
    toggleDistrito,
    toggleSector,
  } = useUbicacionStore();

  useEffect(() => {
    cargarUbicacion();
  }, [cargarUbicacion]);

  const [ubicacionAbierta, setUbicacionAbierta] = useState(true);

  const prioridadValue =
    prioridades.length === 3 ? 'todas'
    : prioridades.length === 1 ? prioridades[0]
    : 'todas';

  const handlePrioridad = (value: string) => {
    if (value === 'todas') {
      setPrioridades(['a_tiempo', 'alerta', 'critica']);
    } else {
      setPrioridades([value as Prioridad]);
    }
  };

  const isCapa = (key: CapaKey) => capasVisibles.has(key);

  const toggleCapa = (key: CapaKey) => {
    const next = new Set(capasVisibles);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    aplicarCapas(next);
  };

  return (
    <div style={sidebar}>
      {/* ── FILTROS ───────────────────────────────── */}
      <div style={sectionHeaderRow}>
        <span style={sectionLabel}>FILTROS</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button style={clearBtn} onClick={reset}>Limpiar</button>
          <ThemeToggleButton />
        </div>
      </div>

      <CapaRow
        label="Solo no resueltas"
        value={soloNoResueltas}
        onChange={() => setSoloNoResueltas(!soloNoResueltas)}
      />

      <FilterField label="Tipo de incidencia">
        <Dropdown
          value={tipoAtencion ?? ''}
          options={[{ value: '', label: 'Todos' }, ...TIPO_OPTIONS.map((t) => ({ value: t, label: t }))]}
          onChange={(v) => setTipoAtencion(v || null)}
        />
      </FilterField>

      <FilterField label="Estado">
        <Dropdown
          value={estado ?? ''}
          options={ESTADO_OPTIONS}
          onChange={(v) => setEstado((v as EstadoIncidencia) || null)}
        />
      </FilterField>

      <FilterField label="Prioridad">
        <Dropdown
          value={prioridadValue}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'critica', label: 'Crítica' },
            { value: 'alerta', label: 'Alerta' },
            { value: 'a_tiempo', label: 'A tiempo' },
          ]}
          onChange={handlePrioridad}
        />
      </FilterField>

      <div style={divider} />

      {/* ── UBICACIÓN ─────────────────────────────── */}
      <button
        type="button"
        style={collapsibleHeaderRow}
        onClick={() => setUbicacionAbierta((v) => !v)}
        aria-expanded={ubicacionAbierta}
      >
        <span style={sectionLabel}>UBICACIÓN</span>
        <span style={{ ...chevron, transform: ubicacionAbierta ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          ▾
        </span>
      </button>

      <CapaRow
        label="Resaltar sector en el mapa"
        value={isCapa('resaltar_sector')}
        onChange={() => toggleCapa('resaltar_sector')}
      />

      {ubicacionAbierta &&
        (ubicacionCargando && provincias.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--map-text-muted)', padding: '2px 0 4px' }}>Cargando…</div>
        ) : (
          provincias.map((provincia) => (
            <ProvinciaGroup
              key={provincia.id}
              nombre={provincia.nombre}
              activa={provinciasActivas.has(provincia.id)}
              onToggle={() => toggleProvincia(provincia.id)}
              distritos={distritos.filter((d) => d.provinciaId === provincia.id)}
              distritosActivos={distritosActivos}
              onToggleDistrito={toggleDistrito}
              sectores={sectores}
              sectoresActivos={sectoresActivos}
              onToggleSector={toggleSector}
            />
          ))
        ))}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={fieldLabel}>{label}</div>
      {children}
    </div>
  );
}

// Dropdown propio en vez de <select> nativo: el <select> del navegador no daba
// garantías de abrir de forma consistente (reporte de Edgar) y además un <select>
// nativo no se puede themear en modo oscuro de forma confiable entre navegadores
// — este popover sí, y además queda visualmente consistente con el resto del panel.
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const onClickFuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  const seleccionado = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={dropdownWrap}>
      <button type="button" style={dropdownTrigger} onClick={() => setAbierto((v) => !v)}>
        <span style={dropdownTriggerLabel}>{seleccionado?.label ?? value}</span>
        <span style={{ ...chevron, transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
      </button>

      {abierto && (
        <div style={dropdownMenu}>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              style={{ ...dropdownOption, ...(o.value === value ? dropdownOptionActive : {}) }}
              onClick={() => {
                onChange(o.value);
                setAbierto(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Grupo colapsable provincia → distritos: marcar la provincia expande la lista de
// sus distritos; desmarcarla la colapsa y limpia la selección de distritos (y de los
// sectores dentro de ellos, ver ubicacionStore.toggleProvincia) para no dejar
// selección "invisible" en un grupo cerrado.
function ProvinciaGroup({
  nombre,
  activa,
  onToggle,
  distritos,
  distritosActivos,
  onToggleDistrito,
  sectores,
  sectoresActivos,
  onToggleSector,
}: {
  nombre: string;
  activa: boolean;
  onToggle: () => void;
  distritos: ApiDistrito[];
  distritosActivos: Set<string>;
  onToggleDistrito: (id: string) => void;
  sectores: ApiSector[];
  sectoresActivos: Set<string>;
  onToggleSector: (id: string) => void;
}) {
  // Expansion visual (chevron) separada del filtro (check): permite ver las 3
  // provincias siempre y expandir solo una sin perder los filtros activos de otra.
  const [abierta, setAbierta] = useState(activa);
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={provinciaRow}>
        <input
          type="checkbox"
          checked={activa}
          onChange={onToggle}
          style={checkboxInput}
          aria-label={`Filtrar por ${nombre}`}
        />
        <button
          type="button"
          onClick={() => setAbierta((v) => !v)}
          aria-expanded={abierta}
          style={provinciaToggleBtn}
        >
          <span style={provinciaLabel}>{nombre}</span>
          <span style={{ ...chevron, transform: abierta ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
            ▾
          </span>
        </button>
      </div>

      {abierta && (
        <div style={distritoList}>
          {distritos.map((distrito) => (
            <DistritoGroup
              key={distrito.id}
              nombre={distrito.nombre}
              activa={distritosActivos.has(distrito.id)}
              onToggle={() => onToggleDistrito(distrito.id)}
              sectores={sectores.filter((s) => s.distritoId === distrito.id)}
              sectoresActivos={sectoresActivos}
              onToggleSector={onToggleSector}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Mismo patrón un nivel abajo: solo se ve la sublista de sectores si el distrito
// tiene alguno (la mayoría no tiene ninguno — sectores es un catastro comercial
// parcial, ver decisión en la conversación).
function DistritoGroup({
  nombre,
  activa,
  onToggle,
  sectores,
  sectoresActivos,
  onToggleSector,
}: {
  nombre: string;
  activa: boolean;
  onToggle: () => void;
  sectores: ApiSector[];
  sectoresActivos: Set<string>;
  onToggleSector: (id: string) => void;
}) {
  return (
    <div>
      <label style={distritoRow}>
        <input type="checkbox" checked={activa} onChange={onToggle} style={checkboxInputSmall} />
        <span style={distritoLabel}>{nombre}</span>
      </label>

      {activa && sectores.length > 0 && (
        <div style={sectorList}>
          {sectores.map((sector) => (
            <label key={sector.id} style={sectorRow}>
              <input
                type="checkbox"
                checked={sectoresActivos.has(sector.id)}
                onChange={() => onToggleSector(sector.id)}
                style={checkboxInputTiny}
              />
              <span style={sectorLabel}>{sector.nombre}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function CapaRow({
  icon,
  label,
  value,
  onChange,
}: {
  icon?: ReactNode;
  label: string;
  value: boolean;
  onChange: () => void;
}) {
  return (
    <div style={capaRow}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
        {icon !== undefined && (
          <div style={{ width: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {icon}
          </div>
        )}
        <span style={{ fontSize: 12, color: 'var(--map-text)' }}>{label}</span>
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <div
      role="switch"
      aria-checked={value}
      onClick={onChange}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        backgroundColor: value ? 'var(--map-accent)' : 'var(--map-border)',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background-color 150ms',
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: 'var(--map-surface)',
          position: 'absolute',
          top: 2,
          left: value ? 18 : 2,
          transition: 'left 150ms',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }}
      />
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

const sidebar: CSSProperties = {
  width: 220,
  minWidth: 220,
  height: '100%',
  overflowY: 'auto',
  backgroundColor: 'var(--map-surface)',
  borderRight: '1px solid var(--map-border)',
  padding: '20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
};

const sectionHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 8,
};

const sectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: '700',
  color: 'var(--map-text-muted)',
  letterSpacing: 0.8,
};

const collapsibleHeaderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  marginBottom: 8,
  padding: 0,
  border: 'none',
  background: 'none',
  cursor: 'pointer',
};

const chevron: CSSProperties = {
  fontSize: 11,
  color: 'var(--map-text-muted)',
  transition: 'transform 150ms',
};

const clearBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  fontWeight: '600',
  color: 'var(--map-accent)',
  cursor: 'pointer',
  padding: 0,
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: '600',
  color: 'var(--map-text-muted)',
  marginBottom: 4,
};

const dropdownWrap: CSSProperties = {
  position: 'relative',
};

const dropdownTrigger: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 10px',
  border: '1px solid var(--map-border)',
  borderRadius: 8,
  fontSize: 13,
  color: 'var(--map-text)',
  backgroundColor: 'var(--map-surface)',
  cursor: 'pointer',
  textAlign: 'left',
};

const dropdownTriggerLabel: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const dropdownMenu: CSSProperties = {
  position: 'absolute',
  top: 'calc(100% + 4px)',
  left: 0,
  right: 0,
  backgroundColor: 'var(--map-surface)',
  border: '1px solid var(--map-border)',
  borderRadius: 8,
  boxShadow: '0 4px 16px var(--map-shadow)',
  padding: 4,
  zIndex: 20,
  maxHeight: 240,
  overflowY: 'auto',
};

const dropdownOption: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: 'none',
  background: 'none',
  borderRadius: 6,
  padding: '7px 8px',
  fontSize: 13,
  color: 'var(--map-text)',
  cursor: 'pointer',
};

const dropdownOptionActive: CSSProperties = {
  backgroundColor: 'var(--map-accent-bg)',
  color: 'var(--map-accent)',
  fontWeight: 600,
};

const divider: CSSProperties = {
  height: 1,
  backgroundColor: 'var(--map-border)',
  margin: '12px 0',
};

const capaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 7,
  paddingBottom: 7,
  borderBottom: '1px solid var(--map-surface-alt)',
};

const provinciaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 6,
  paddingBottom: 6,
};

const provinciaToggleBtn: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  textAlign: 'left',
};

const provinciaLabel: CSSProperties = {
  fontSize: 12.5,
  fontWeight: '600',
  color: 'var(--map-text)',
};

const distritoList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 22,
  paddingLeft: 10,
  borderLeft: '1.5px solid var(--map-border)',
  marginBottom: 4,
};

const distritoRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  paddingTop: 4,
  paddingBottom: 4,
  cursor: 'pointer',
};

const distritoLabel: CSSProperties = {
  fontSize: 12,
  color: 'var(--map-text-muted)',
};

const sectorList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 20,
  paddingLeft: 9,
  borderLeft: '1.5px solid var(--map-surface-alt)',
  marginBottom: 2,
};

const sectorRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 7,
  paddingTop: 3,
  paddingBottom: 3,
  cursor: 'pointer',
};

const sectorLabel: CSSProperties = {
  fontSize: 11.5,
  color: 'var(--map-text-muted)',
};

const checkboxInput: CSSProperties = {
  width: 15,
  height: 15,
  accentColor: 'var(--map-accent)',
  cursor: 'pointer',
  flexShrink: 0,
};

const checkboxInputSmall: CSSProperties = {
  width: 13,
  height: 13,
  accentColor: 'var(--map-accent)',
  cursor: 'pointer',
  flexShrink: 0,
};

const checkboxInputTiny: CSSProperties = {
  width: 12,
  height: 12,
  accentColor: 'var(--map-accent)',
  cursor: 'pointer',
  flexShrink: 0,
};
