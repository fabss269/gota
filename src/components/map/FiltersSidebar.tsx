import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';

import { getTiposGrupo } from '@/api/catalogos';
import type { ApiDistrito, ApiSector, ApiTipoGrupo } from '@/api/types';
import { Colors } from '@/constants/theme';
import type { Categoria, Prioridad } from '@/mocks/incidentsMock';
import { useCapasStore, type CapaKey } from '@/state/capasStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

// Colores del semáforo de prioridad — mismos tokens que el resto del proyecto.
const PRIORIDADES: { codigo: Prioridad; nombre: string; color: string }[] = [
  { codigo: 'a_tiempo', nombre: 'A tiempo', color: Colors.statusATiempo },
  { codigo: 'alerta',   nombre: 'Alerta',   color: Colors.statusAlerta },
  { codigo: 'critica',  nombre: 'Crítica',  color: Colors.statusCritica },
];

// Íconos por código de grupo. Se cae a un default seguro si el catálogo trae
// grupos futuros que aún no tienen ícono asignado. Soporta dos familias porque
// Ionicons no tiene un ícono decente para desagüe (tubería/alcantarillado).
type IconDef =
  | { family: 'ionicons'; name: keyof typeof Ionicons.glyphMap }
  | { family: 'material-community'; name: keyof typeof MaterialCommunityIcons.glyphMap };

const ICONO_POR_GRUPO: Record<string, IconDef> = {
  agua: { family: 'ionicons', name: 'water' },
  desague: { family: 'material-community', name: 'pipe' },
};
const ICONO_DEFAULT: IconDef = { family: 'ionicons', name: 'apps-outline' };

/**
 * Sidebar fija izquierda del layout web del mapa — Filtros + Ubicación.
 * Catastro (Predio/Alcantarillado/Agua) vive en un panel flotante aparte,
 * ver CatastroFloatingPanel.
 */
export function FiltersSidebar() {
  const reset = useFiltersStore((s) => s.reset);
  const categorias = useFiltersStore((s) => s.categorias);
  const toggleCategoria = useFiltersStore((s) => s.toggleCategoria);
  const prioridades = useFiltersStore((s) => s.prioridades);
  const togglePrioridad = useFiltersStore((s) => s.togglePrioridad);
  const { data: tiposGrupo = [] } = useQuery({
    queryKey: ['tipos-grupo'],
    queryFn: getTiposGrupo,
    // Catálogo casi estático — evita refetch en cada mount del sidebar.
    staleTime: 60 * 60 * 1000,
  });
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
        <button
          type="button"
          style={clearBtn}
          onClick={reset}
          title="Limpiar filtros"
          aria-label="Limpiar filtros"
        >
          <MaterialCommunityIcons name="broom" size={16} color="var(--map-text-muted)" />
        </button>
      </div>

      {/* Grupo de incidencia — pills toggle, mínimo 1 activo (el store lo protege) */}
      <div style={grupoSectionLabel}>GRUPO DE INCIDENCIA</div>
      <div style={grupoRow}>
        {tiposGrupo.map((g) => (
          <GrupoPill
            key={g.id}
            grupo={g}
            activo={categorias.includes(g.codigo as Categoria)}
            onToggle={() => toggleCategoria(g.codigo as Categoria)}
          />
        ))}
      </div>

      {/* Prioridad — semáforo verde/amarillo/rojo, mínimo 1 activo (store lo protege) */}
      <div style={grupoSectionLabel}>PRIORIDAD</div>
      <div style={prioridadRow}>
        {PRIORIDADES.map((p) => {
          const activo = prioridades.includes(p.codigo);
          return (
            <button
              key={p.codigo}
              type="button"
              onClick={() => togglePrioridad(p.codigo)}
              style={{
                ...prioridadDot,
                backgroundColor: p.color,
                opacity: activo ? 1 : 0.28,
              }}
              aria-pressed={activo}
              aria-label={p.nombre}
              title={p.nombre}
            />
          );
        })}
      </div>

      <div style={divider} />

      {/* ── UBICACIÓN ─────────────────────────────── */}
      <div style={ubicacionHeader}>
        <span style={sectionLabel}>UBICACIÓN</span>
      </div>

      <CapaRow
        label="Resaltar sector en el mapa"
        value={isCapa('resaltar_sector')}
        onChange={() => toggleCapa('resaltar_sector')}
      />

      {ubicacionCargando && provincias.length === 0 ? (
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
      )}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────

function GrupoPill({
  grupo,
  activo,
  onToggle,
}: {
  grupo: ApiTipoGrupo;
  activo: boolean;
  onToggle: () => void;
}) {
  const icon = ICONO_POR_GRUPO[grupo.codigo] ?? ICONO_DEFAULT;
  const iconColor = activo ? '#FFFFFF' : 'var(--map-text)';
  return (
    <button
      type="button"
      onClick={onToggle}
      style={activo ? grupoPillActivo : grupoPillInactivo}
      aria-pressed={activo}
      title={grupo.nombre}
    >
      {icon.family === 'ionicons' ? (
        <Ionicons name={icon.name} size={14} color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={icon.name} size={14} color={iconColor} />
      )}
      <span>{grupo.nombre}</span>
    </button>
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

const ubicacionHeader: CSSProperties = {
  marginBottom: 8,
};

const chevron: CSSProperties = {
  fontSize: 11,
  color: 'var(--map-text-muted)',
  transition: 'transform 150ms',
};

const grupoSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--map-text-muted)',
  letterSpacing: 0.8,
  marginTop: 8,
  marginBottom: 8,
};

const grupoRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'stretch',
};

const prioridadRow: CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  justifyContent: 'space-evenly',
};

const prioridadDot: CSSProperties = {
  width: 24,
  height: 24,
  minWidth: 24,
  minHeight: 24,
  borderRadius: 6,
  border: 'none',
  padding: 0,
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'opacity 150ms',
  flexShrink: 0,
};

const grupoPillBase: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  padding: '7px 10px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 8,
  cursor: 'pointer',
  transition: 'background-color 150ms, color 150ms, border-color 150ms',
};

const grupoPillActivo: CSSProperties = {
  ...grupoPillBase,
  backgroundColor: 'var(--map-accent)',
  color: '#FFFFFF',
  border: '1px solid var(--map-accent)',
};

const grupoPillInactivo: CSSProperties = {
  ...grupoPillBase,
  backgroundColor: 'var(--map-surface)',
  color: 'var(--map-text)',
  border: '1px solid var(--map-border)',
};

const clearBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  borderRadius: 6,
  backgroundColor: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
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
