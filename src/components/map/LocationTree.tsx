import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useState, type CSSProperties } from 'react';

import type { ApiBbox, ApiDistrito, ApiProvincia, ApiSector } from '@/api/types';
import {
  distritosSinSectorDeProvincia,
  estadoVisibilidad,
  sectoresDeDistrito,
  sectoresDeProvincia,
} from '@/components/map/mapLayers';
import { DISTRITO_DEFAULT, PROVINCIA_DEFAULT, useUbicacionStore } from '@/state/ubicacionStore';
import { useMapSearchStore } from '@/state/mapSearchStore';

type Visibilidad = 'on' | 'off' | 'mixed';

/**
 * Árbol de UBICACIÓN estilo panel de capas de Figma (rediseño 2026-08-12,
 * reemplaza a los 3 `LocationDropdown` de Provincia/Distrito/Sector). Cada fila:
 * - Expand/collapse (cuadradito +/-) — solo navegación, no filtra.
 * - Ojito — ES el filtro real: prende/apaga y pinta ese nivel; en Provincia/
 *   Distrito cascada a TODOS sus descendientes (como la visibilidad de un grupo
 *   de capas en Figma).
 * - Lupa — solo mueve la cámara al bbox del nivel, nunca toca el filtro.
 *
 * Autocontenido: lee `useUbicacionStore`/`useMapSearchStore` directo, sin props.
 */
export function LocationTree() {
  const provincias = useUbicacionStore((s) => s.provincias);
  const distritos = useUbicacionStore((s) => s.distritos);
  const sectores = useUbicacionStore((s) => s.sectores);
  const sectoresVisibles = useUbicacionStore((s) => s.sectoresVisibles);
  const distritosSinSectorVisibles = useUbicacionStore((s) => s.distritosSinSectorVisibles);
  const toggleSectorVisible = useUbicacionStore((s) => s.toggleSectorVisible);
  const toggleDistritoVisible = useUbicacionStore((s) => s.toggleDistritoVisible);
  const toggleProvinciaVisible = useUbicacionStore((s) => s.toggleProvinciaVisible);
  const flyToBounds = useMapSearchStore((s) => s.flyToBounds);

  // Sembrado con la ascendencia del default (Provincia/Distrito de Chiclayo) para
  // que el sector 28 se vea sin clicks extra, igual que el comportamiento previo.
  const [expandido, setExpandido] = useState<Set<string>>(
    () => new Set([`prov:${PROVINCIA_DEFAULT}`, `dist:${DISTRITO_DEFAULT}`])
  );

  const toggleExpandido = (key: string) => {
    setExpandido((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div style={arbol}>
      {provincias.map((provincia) => (
        <ProvinciaFila
          key={provincia.id}
          provincia={provincia}
          distritos={distritos.filter((d) => d.provinciaId === provincia.id)}
          sectores={sectores}
          todosDistritos={distritos}
          sectoresVisibles={sectoresVisibles}
          distritosSinSectorVisibles={distritosSinSectorVisibles}
          expandido={expandido}
          onToggleExpandido={toggleExpandido}
          onToggleOjo={() => toggleProvinciaVisible(provincia.id)}
          onZoom={() => flyToBounds(provincia.bbox)}
          onToggleOjoDistrito={toggleDistritoVisible}
          onToggleOjoSector={toggleSectorVisible}
          onZoomDistrito={(bbox) => flyToBounds(bbox)}
          onZoomSector={(bbox) => flyToBounds(bbox)}
        />
      ))}
    </div>
  );
}

// ── Fila Provincia ───────────────────────────────────────

function ProvinciaFila({
  provincia,
  distritos,
  sectores,
  todosDistritos,
  sectoresVisibles,
  distritosSinSectorVisibles,
  expandido,
  onToggleExpandido,
  onToggleOjo,
  onZoom,
  onToggleOjoDistrito,
  onToggleOjoSector,
  onZoomDistrito,
  onZoomSector,
}: {
  provincia: ApiProvincia;
  distritos: ApiDistrito[];
  sectores: ApiSector[];
  todosDistritos: ApiDistrito[];
  sectoresVisibles: Set<string>;
  distritosSinSectorVisibles: Set<string>;
  expandido: Set<string>;
  onToggleExpandido: (key: string) => void;
  onToggleOjo: () => void;
  onZoom: () => void;
  onToggleOjoDistrito: (id: string) => void;
  onToggleOjoSector: (id: string) => void;
  onZoomDistrito: (bbox: ApiBbox) => void;
  onZoomSector: (bbox: ApiBbox) => void;
}) {
  const key = `prov:${provincia.id}`;
  const abierta = expandido.has(key);
  const tieneHijos = distritos.length > 0;

  const idsSectores = sectoresDeProvincia(sectores, todosDistritos, provincia.id);
  const idsDistritosSinSector = distritosSinSectorDeProvincia(todosDistritos, sectores, provincia.id);
  const visiblesCombinado = new Set([...sectoresVisibles, ...distritosSinSectorVisibles]);
  const visibilidad = estadoVisibilidad([...idsSectores, ...idsDistritosSinSector], visiblesCombinado);

  return (
    <div>
      <FilaBase
        nivel={0}
        nombre={provincia.nombre}
        expandible={tieneHijos}
        abierta={abierta}
        visibilidad={visibilidad}
        onToggleExpandir={() => onToggleExpandido(key)}
        onToggleOjo={onToggleOjo}
        onZoom={onZoom}
      />
      {abierta && (
        <div style={hijos}>
          {distritos.map((distrito) => (
            <DistritoFila
              key={distrito.id}
              distrito={distrito}
              sectores={sectores.filter((s) => s.distritoId === distrito.id)}
              sectoresVisibles={sectoresVisibles}
              distritosSinSectorVisibles={distritosSinSectorVisibles}
              expandido={expandido}
              onToggleExpandido={onToggleExpandido}
              onToggleOjo={() => onToggleOjoDistrito(distrito.id)}
              onZoom={() => onZoomDistrito(distrito.bbox)}
              onToggleOjoSector={onToggleOjoSector}
              onZoomSector={onZoomSector}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fila Distrito ─────────────────────────────────────────

function DistritoFila({
  distrito,
  sectores,
  sectoresVisibles,
  distritosSinSectorVisibles,
  expandido,
  onToggleExpandido,
  onToggleOjo,
  onZoom,
  onToggleOjoSector,
  onZoomSector,
}: {
  distrito: ApiDistrito;
  sectores: ApiSector[];
  sectoresVisibles: Set<string>;
  distritosSinSectorVisibles: Set<string>;
  expandido: Set<string>;
  onToggleExpandido: (key: string) => void;
  onToggleOjo: () => void;
  onZoom: () => void;
  onToggleOjoSector: (id: string) => void;
  onZoomSector: (bbox: ApiBbox) => void;
}) {
  const key = `dist:${distrito.id}`;
  const abierta = expandido.has(key);
  const tieneHijos = sectores.length > 0;

  const idsSectores = sectoresDeDistrito(sectores, distrito.id);
  const visibilidad: Visibilidad = tieneHijos
    ? estadoVisibilidad(idsSectores, sectoresVisibles)
    : distritosSinSectorVisibles.has(distrito.id)
      ? 'on'
      : 'off';

  return (
    <div>
      <FilaBase
        nivel={1}
        nombre={distrito.nombre}
        expandible={tieneHijos}
        abierta={abierta}
        visibilidad={visibilidad}
        onToggleExpandir={() => onToggleExpandido(key)}
        onToggleOjo={onToggleOjo}
        onZoom={onZoom}
      />
      {abierta && tieneHijos && (
        <div style={hijos}>
          {sectores.map((sector) => (
            <FilaBase
              key={sector.id}
              nivel={2}
              nombre={sector.nombre}
              expandible={false}
              abierta={false}
              visibilidad={sectoresVisibles.has(sector.id) ? 'on' : 'off'}
              onToggleExpandir={() => {}}
              onToggleOjo={() => onToggleOjoSector(sector.id)}
              onZoom={() => onZoomSector(sector.bbox)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fila base (Provincia/Distrito/Sector comparten look) ─────────────────

function FilaBase({
  nivel,
  nombre,
  expandible,
  abierta,
  visibilidad,
  onToggleExpandir,
  onToggleOjo,
  onZoom,
}: {
  nivel: 0 | 1 | 2;
  nombre: string;
  expandible: boolean;
  abierta: boolean;
  visibilidad: Visibilidad;
  onToggleExpandir: () => void;
  onToggleOjo: () => void;
  onZoom: () => void;
}) {
  const ojoIcono = visibilidad === 'on' ? 'eye' : visibilidad === 'mixed' ? 'eye-outline' : 'eye-off-outline';

  return (
    <div style={{ ...fila, paddingLeft: nivel * 16 }}>
      <button
        type="button"
        style={expandible ? expandirBtn : expandirBtnOculto}
        onClick={onToggleExpandir}
        disabled={!expandible}
        aria-label={expandible ? (abierta ? `Colapsar ${nombre}` : `Expandir ${nombre}`) : undefined}
        aria-hidden={!expandible}
        tabIndex={expandible ? 0 : -1}
      >
        {expandible && (
          <MaterialCommunityIcons
            name={abierta ? 'minus-box-outline' : 'plus-box-outline'}
            size={14}
            color="var(--map-text-muted)"
          />
        )}
      </button>

      <button type="button" style={nombreBtn} onClick={onToggleExpandir} disabled={!expandible}>
        <span style={nivel === 2 ? nombreTextoHoja : nombreTexto}>{nombre}</span>
      </button>

      <span style={iconosRow}>
        <button
          type="button"
          style={visibilidad !== 'off' ? { ...iconBtn, ...iconBtnActivo } : iconBtn}
          onClick={onToggleOjo}
          title={visibilidad === 'off' ? `Mostrar ${nombre}` : `Ocultar ${nombre}`}
          aria-label={visibilidad === 'off' ? `Mostrar ${nombre}` : `Ocultar ${nombre}`}
        >
          <MaterialCommunityIcons
            name={ojoIcono}
            size={15}
            color={visibilidad !== 'off' ? 'var(--map-accent)' : 'var(--map-text-muted)'}
          />
        </button>
        <button
          type="button"
          style={iconBtn}
          onClick={onZoom}
          title={`Acercar a ${nombre}`}
          aria-label={`Acercar a ${nombre}`}
        >
          <MaterialCommunityIcons name="magnify" size={15} color="var(--map-text-muted)" />
        </button>
      </span>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

const arbol: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const hijos: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  borderLeft: '1.5px solid var(--map-border)',
  marginLeft: 6,
};

const fila: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  paddingTop: 3,
  paddingBottom: 3,
};

const expandirBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  flexShrink: 0,
  border: 'none',
  background: 'none',
  padding: 0,
  cursor: 'pointer',
};

const expandirBtnOculto: CSSProperties = {
  ...expandirBtn,
  cursor: 'default',
};

const nombreBtn: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  border: 'none',
  background: 'none',
  padding: '2px 0',
  textAlign: 'left',
  cursor: 'pointer',
};

const nombreTexto: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'var(--map-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const nombreTextoHoja: CSSProperties = {
  ...nombreTexto,
  fontWeight: 400,
  fontSize: 11,
  color: 'var(--map-text-muted)',
};

const iconosRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  flexShrink: 0,
};

const iconBtn: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 22,
  height: 22,
  border: 'none',
  borderRadius: 5,
  background: 'none',
  padding: 0,
  cursor: 'pointer',
};

const iconBtnActivo: CSSProperties = {
  backgroundColor: 'var(--map-surface-alt)',
};
