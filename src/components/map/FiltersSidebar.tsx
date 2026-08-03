import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import type { ApiDistrito, ApiSector } from '@/api/types';
import type { EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { useCapasStore, type CapaKey } from '@/state/capasStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

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

/** Sidebar fija izquierda del layout web del mapa — Filtros + capas de catastro. */
export function FiltersSidebar() {
  const { tipoAtencion, setTipoAtencion, estado, setEstado, prioridades, setPrioridades, reset } =
    useFiltersStore();
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
        <button style={clearBtn} onClick={reset}>Limpiar</button>
      </div>

      <FilterField label="Tipo de incidencia">
        <select
          style={selectBase}
          value={tipoAtencion ?? ''}
          onChange={(e) => setTipoAtencion(e.target.value || null)}
        >
          <option value="">Todos</option>
          {TIPO_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Estado">
        <select
          style={selectBase}
          value={estado ?? ''}
          onChange={(e) => setEstado((e.target.value as EstadoIncidencia) || null)}
        >
          {ESTADO_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </FilterField>

      <FilterField label="Prioridad">
        <select
          style={selectBase}
          value={prioridadValue}
          onChange={(e) => handlePrioridad(e.target.value)}
        >
          <option value="todas">Todas</option>
          <option value="critica">Crítica</option>
          <option value="alerta">Alerta</option>
          <option value="a_tiempo">A tiempo</option>
        </select>
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
          <div style={{ fontSize: 12, color: '#8B9BB4', padding: '2px 0 4px' }}>Cargando…</div>
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

      <div style={divider} />

      {/* ── CATASTRO ──────────────────────────────── */}
      <div style={sectionHeaderRow}>
        <span style={sectionLabel}>CATASTRO</span>
      </div>

      <div style={subsectionLabel}>Predio</div>

      <CapaRow
        icon={<ColorSquare color="#BDBDBD" border="#9E9E9E" />}
        label="Manzanas"
        value={isCapa('manzanas')}
        onChange={() => toggleCapa('manzanas')}
      />
      <CapaRow
        icon={<ColorSquare color="white" border="#BDBDBD" />}
        label="Lotes"
        value={isCapa('lotes')}
        onChange={() => toggleCapa('lotes')}
      />

      <div style={subsectionLabel}>Alcantarillado</div>

      <CapaRow
        icon={<SolidLine color="#E53935" />}
        label="Red primaria (colectores)"
        value={isCapa('red_primaria_desague')}
        onChange={() => toggleCapa('red_primaria_desague')}
      />
      <CapaRow
        icon={<SolidLine color="#FB8C00" />}
        label="Red secundaria"
        value={isCapa('red_secundaria_desague')}
        onChange={() => toggleCapa('red_secundaria_desague')}
      />
      <CapaRow
        icon={<Triangle color="#B71C1C" />}
        label="Dirección de flujo"
        value={isCapa('flujo_desague')}
        onChange={() => toggleCapa('flujo_desague')}
      />
      <CapaRow
        icon={<DashedLine color="#FB8C00" />}
        label="Conexión desagüe"
        value={isCapa('conexion_desague')}
        onChange={() => toggleCapa('conexion_desague')}
      />
      <CapaRow
        icon={<ColorCircle color="#795548" />}
        label="Caja desagüe"
        value={isCapa('caja_desague')}
        onChange={() => toggleCapa('caja_desague')}
      />
      <CapaRow
        icon={<ColorCircle color="#757575" />}
        label="Buzones"
        value={isCapa('buzones')}
        onChange={() => toggleCapa('buzones')}
      />

      <div style={subsectionLabel}>Agua</div>

      <CapaRow
        icon={<SolidLine color="#2563EB" />}
        label="Red de agua potable"
        value={isCapa('red_potable')}
        onChange={() => toggleCapa('red_potable')}
      />
      <CapaRow
        icon={<DashedLine color="#60A5FA" />}
        label="Conexión agua"
        value={isCapa('conexion_agua')}
        onChange={() => toggleCapa('conexion_agua')}
      />
      <CapaRow
        icon={<ColorCircle color="#06B6D4" />}
        label="Caja agua"
        value={isCapa('caja_agua')}
        onChange={() => toggleCapa('caja_agua')}
      />
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
        <span style={{ fontSize: 12, color: '#212121' }}>{label}</span>
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
        backgroundColor: value ? '#0152AC' : '#D1D5DB',
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
          backgroundColor: 'white',
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

function SolidLine({ color }: { color: string }) {
  return <div style={{ width: 20, height: 2.5, backgroundColor: color, borderRadius: 1 }} />;
}

function DashedLine({ color }: { color: string }) {
  return <div style={{ width: 20, height: 0, borderTop: `2px dashed ${color}` }} />;
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
        borderLeft: '5px solid transparent',
        borderRight: '5px solid transparent',
        borderBottom: `9px solid ${color}`,
      }}
    />
  );
}

// ── Estilos ───────────────────────────────────────────────

const sidebar: CSSProperties = {
  width: 220,
  minWidth: 220,
  height: '100%',
  overflowY: 'auto',
  backgroundColor: 'white',
  borderRight: '1px solid #E3E7EE',
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
  color: '#8B9BB4',
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
  color: '#8B9BB4',
  transition: 'transform 150ms',
};

const subsectionLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: '600',
  color: '#3A4453',
  margin: '10px 0 6px',
};

const clearBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: 12,
  fontWeight: '600',
  color: '#0152AC',
  cursor: 'pointer',
  padding: 0,
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: '600',
  color: '#8B9BB4',
  marginBottom: 4,
};

const selectBase: CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #E3E7EE',
  borderRadius: 8,
  fontSize: 13,
  color: '#212121',
  backgroundColor: 'white',
  cursor: 'pointer',
  outline: 'none',
};

const divider: CSSProperties = {
  height: 1,
  backgroundColor: '#E3E7EE',
  margin: '12px 0',
};

const capaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingTop: 7,
  paddingBottom: 7,
  borderBottom: '1px solid #F5F6F8',
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
  color: '#212121',
};

const distritoList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 22,
  paddingLeft: 10,
  borderLeft: '1.5px solid #E3E7EE',
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
  color: '#4B5768',
};

const sectorList: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  marginLeft: 20,
  paddingLeft: 9,
  borderLeft: '1.5px solid #EEF1F5',
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
  color: '#6B7684',
};

const checkboxInput: CSSProperties = {
  width: 15,
  height: 15,
  accentColor: '#0152AC',
  cursor: 'pointer',
  flexShrink: 0,
};

const checkboxInputSmall: CSSProperties = {
  width: 13,
  height: 13,
  accentColor: '#0152AC',
  cursor: 'pointer',
  flexShrink: 0,
};

const checkboxInputTiny: CSSProperties = {
  width: 12,
  height: 12,
  accentColor: '#0152AC',
  cursor: 'pointer',
  flexShrink: 0,
};
