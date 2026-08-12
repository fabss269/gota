import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, type CSSProperties, type ReactNode } from 'react';

import { getTiposGrupo } from '@/api/catalogos';
import type { ApiTipoGrupo } from '@/api/types';
import { LocationDropdown } from '@/components/map/LocationDropdown';
import { Colors } from '@/constants/theme';
import type { Categoria, EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { useCapasStore, type CapaKey } from '@/state/capasStore';
import { useFiltersStore } from '@/state/filtersStore';
import { useMapSearchStore } from '@/state/mapSearchStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

// Colores del semáforo de prioridad — mismos tokens que el resto del proyecto.
const PRIORIDADES: { codigo: Prioridad; nombre: string; color: string }[] = [
  { codigo: 'a_tiempo', nombre: 'A tiempo', color: Colors.statusATiempo },
  { codigo: 'alerta',   nombre: 'Alerta',   color: Colors.statusAlerta },
  { codigo: 'critica',  nombre: 'Crítica',  color: Colors.statusCritica },
];

// Mismos valores/labels que ya usa el Bottom Sheet móvil (FiltrosTab.tsx) — no
// existe un catálogo real de estados todavía (docs/API.md § 2), así que se
// hardcodea igual que allá.
const ESTADO_OPTIONS: { value: EstadoIncidencia; label: string }[] = [
  { value: 'CREADO', label: 'Creado' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'EN_PROGRESO', label: 'En progreso' },
  { value: 'ATENDIDO', label: 'Atendido' },
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
  const estado = useFiltersStore((s) => s.estado);
  const setEstado = useFiltersStore((s) => s.setEstado);
  const fechaDesde = useFiltersStore((s) => s.fechaDesde);
  const fechaHasta = useFiltersStore((s) => s.fechaHasta);
  const setFechaDesde = useFiltersStore((s) => s.setFechaDesde);
  const setFechaHasta = useFiltersStore((s) => s.setFechaHasta);
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
    provinciaActiva,
    distritoActivo,
    sectorActivo,
    cargar: cargarUbicacion,
    seleccionarProvincia,
    seleccionarDistrito,
    seleccionarSector,
    previsualizarSector,
  } = useUbicacionStore();
  const flyToBounds = useMapSearchStore((s) => s.flyToBounds);

  useEffect(() => {
    cargarUbicacion();
  }, [cargarUbicacion]);

  const isCapa = (key: CapaKey) => capasVisibles.has(key);

  const toggleCapa = (key: CapaKey) => {
    const next = new Set(capasVisibles);
    if (next.has(key)) { next.delete(key); } else { next.add(key); }
    aplicarCapas(next);
  };

  const distritosDeLaProvincia = distritos.filter((d) => d.provinciaId === provinciaActiva);
  const sectoresDelDistrito = sectores.filter((s) => s.distritoId === distritoActivo);

  // 🔍 lupa de la fila de Sector — solo mueve la cámara (mapSearchStore), nunca
  // toca sectorActivo/sectorPreview ni dispara fetch.
  const handleZoomSector = (sectorId: string) => {
    const sector = sectores.find((s) => s.id === sectorId);
    if (sector?.bbox) flyToBounds(sector.bbox);
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

      {/* Estado — dropdown simple, un solo valor (null = Todos) */}
      <div style={grupoSectionLabel}>ESTADO</div>
      <LocationDropdown
        options={ESTADO_OPTIONS.map((o) => ({ id: o.value, nombre: o.label }))}
        value={estado}
        onSelect={(id) => setEstado(id as EstadoIncidencia | null)}
        placeholder="Todos"
        clearLabel="Todos"
      />

      {/* Rango de fechas — dos <input type="date"> nativos, sin librería nueva (no
          hay ningún date-picker en el proyecto). Vacío = usa el preset de siempre
          (rangoFechas), ver useIncidentsToday.paramsDeFecha. */}
      <div style={grupoSectionLabel}>RANGO DE FECHAS</div>
      <div style={fechaRow}>
        <input
          type="date"
          style={fechaInput}
          value={fechaDesde ?? ''}
          onChange={(e) => setFechaDesde(e.target.value || null)}
          aria-label="Desde"
        />
        <span style={fechaSeparador}>–</span>
        <input
          type="date"
          style={fechaInput}
          value={fechaHasta ?? ''}
          onChange={(e) => setFechaHasta(e.target.value || null)}
          aria-label="Hasta"
        />
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
        <>
          <div style={fieldLabel}>Provincia</div>
          <LocationDropdown
            options={provincias.map((p) => ({ id: p.id, nombre: p.nombre }))}
            value={provinciaActiva}
            onSelect={seleccionarProvincia}
            placeholder="Todas las provincias"
            clearLabel="Todas"
          />

          <div style={fieldLabel}>Distrito</div>
          <LocationDropdown
            options={distritosDeLaProvincia.map((d) => ({ id: d.id, nombre: d.nombre }))}
            value={distritoActivo}
            onSelect={seleccionarDistrito}
            placeholder="Todos los distritos"
            clearLabel="Todos"
            disabled={!provinciaActiva}
          />

          <div style={fieldLabel}>Sector</div>
          <LocationDropdown
            options={sectoresDelDistrito.map((s) => ({ id: s.id, nombre: s.nombre }))}
            value={sectorActivo}
            onSelect={seleccionarSector}
            placeholder="Todos los sectores"
            clearLabel="Todos"
            disabled={!distritoActivo}
            onPreview={previsualizarSector}
            onZoom={handleZoomSector}
          />
        </>
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

const grupoSectionLabel: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--map-text-muted)',
  letterSpacing: 0.8,
  marginTop: 8,
  marginBottom: 8,
};

const fieldLabel: CSSProperties = {
  fontSize: 11,
  color: 'var(--map-text-muted)',
  marginTop: 8,
  marginBottom: 4,
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

const fechaRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const fechaInput: CSSProperties = {
  flex: 1,
  minWidth: 0,
  padding: '6px 6px',
  fontSize: 11.5,
  borderRadius: 8,
  border: '1px solid var(--map-border)',
  backgroundColor: 'var(--map-surface)',
  color: 'var(--map-text)',
};

const fechaSeparador: CSSProperties = {
  fontSize: 12,
  color: 'var(--map-text-muted)',
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
