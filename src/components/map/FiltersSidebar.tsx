import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, type CSSProperties } from 'react';

import { getTiposGrupo } from '@/api/catalogos';
import type { ApiTipoGrupo } from '@/api/types';
import { LocationDropdown } from '@/components/map/LocationDropdown';
import { LocationTree } from '@/components/map/LocationTree';
import { TotalIncidenciasCard } from '@/components/map/TotalIncidenciasCard';
import { Colors } from '@/constants/theme';
import type { Categoria, EstadoIncidencia, Prioridad } from '@/mocks/incidentsMock';
import { useFiltersStore } from '@/state/filtersStore';
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
  const provincias = useUbicacionStore((s) => s.provincias);
  const ubicacionCargando = useUbicacionStore((s) => s.cargando);
  const cargarUbicacion = useUbicacionStore((s) => s.cargar);

  useEffect(() => {
    cargarUbicacion();
  }, [cargarUbicacion]);

  return (
    <div style={sidebar}>
      <TotalIncidenciasCard />

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

      {/* Prioridad — semáforo verde/amarillo/rojo, mínimo 1 activo (store lo protege).
          Círculo relleno = activo (se está mostrando); círculo hueco con borde de
          color = inactivo — más parecido a un check real que a "atenuado" (antes
          era opacidad baja, se sentía ambiguo entre "apagado" y "deshabilitado"). */}
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
                backgroundColor: activo ? p.color : 'transparent',
                border: `2px solid ${p.color}`,
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

      {ubicacionCargando && provincias.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--map-text-muted)', padding: '2px 0 4px' }}>Cargando…</div>
      ) : (
        <LocationTree />
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
        <Ionicons name={icon.name} size={13} color={iconColor} />
      ) : (
        <MaterialCommunityIcons name={icon.name} size={13} color={iconColor} />
      )}
      <span>{grupo.nombre}</span>
      {/* Checkmark cuando está activo — refuerza "esto se está mostrando" sin
          depender solo del color de fondo (mismo click de siempre, solo feedback
          visual más claro). */}
      {activo && <MaterialCommunityIcons name="check" size={13} color="#FFFFFF" />}
    </button>
  );
}

// ── Estilos ───────────────────────────────────────────────

// Ancho subido de 220→268 (pedido de Edgar 2026-08-12): los nombres de sector
// ("Chiclayo - Sector 06") se cortaban en el árbol de UBICACIÓN — ver también
// los tamaños reducidos en LocationTree.tsx, ambos ajustes juntos para que
// entre todo sin que el sidebar quede demasiado ancho.
const sidebar: CSSProperties = {
  width: 268,
  minWidth: 268,
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
  fontSize: 9.5,
  fontWeight: '700',
  color: 'var(--map-text-muted)',
  letterSpacing: 0.8,
};

const ubicacionHeader: CSSProperties = {
  marginBottom: 8,
};

const grupoSectionLabel: CSSProperties = {
  fontSize: 9.5,
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
  width: 22,
  height: 22,
  minWidth: 22,
  minHeight: 22,
  borderRadius: '50%',
  padding: 0,
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'background-color 150ms',
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
  padding: '6px 9px',
  fontSize: 12,
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
