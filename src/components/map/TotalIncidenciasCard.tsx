import type { CSSProperties } from 'react';

import type { ApiDistrito, ApiProvincia, ApiSector } from '@/api/types';
import {
  distritosSinSectorDeProvincia,
  estadoVisibilidad,
  sectoresDeDistrito,
  sectoresDeProvincia,
} from '@/components/map/mapLayers';
import { useIncidentsToday } from '@/hooks/useIncidentsToday';
import { useUbicacionStore } from '@/state/ubicacionStore';

/**
 * Colapsa `sectoresVisibles`/`distritosSinSectorVisibles` al conjunto MÍNIMO de
 * nombres que cubre exactamente lo que está prendido — mismo criterio que el
 * ícono de ojo de cada fila (`estadoVisibilidad`, mapLayers.ts): si una
 * Provincia/Distrito está COMPLETAMENTE prendida, se muestra un solo nombre
 * (el de ese nivel) en vez de listar cada sector individual por separado.
 * Pedido de Edgar 2026-08-12: "colocar los nombres de los sectores uno debajo
 * del otro" — con este colapso, prender una provincia entera (ej. 42 sectores)
 * no imprime 42 líneas, imprime 1.
 */
function calcularEtiquetasVisibles(
  provincias: ApiProvincia[],
  distritos: ApiDistrito[],
  sectores: ApiSector[],
  sectoresVisibles: Set<string>,
  distritosSinSectorVisibles: Set<string>
): string[] {
  const etiquetas: string[] = [];
  const visiblesCombinado = new Set([...sectoresVisibles, ...distritosSinSectorVisibles]);

  for (const provincia of provincias) {
    const idsSectores = sectoresDeProvincia(sectores, distritos, provincia.id);
    const idsDistritosSinSector = distritosSinSectorDeProvincia(distritos, sectores, provincia.id);
    const idsRelevantes = [...idsSectores, ...idsDistritosSinSector];
    if (idsRelevantes.length === 0) continue;

    const estadoProvincia = estadoVisibilidad(idsRelevantes, visiblesCombinado);
    if (estadoProvincia === 'off') continue;
    if (estadoProvincia === 'on') {
      etiquetas.push(provincia.nombre);
      continue;
    }

    // 'mixed' — bajar un nivel y repetir el mismo criterio por distrito.
    for (const distrito of distritos.filter((d) => d.provinciaId === provincia.id)) {
      const idsSectoresDistrito = sectoresDeDistrito(sectores, distrito.id);
      if (idsSectoresDistrito.length === 0) {
        if (distritosSinSectorVisibles.has(distrito.id)) etiquetas.push(distrito.nombre);
        continue;
      }
      const estadoDistrito = estadoVisibilidad(idsSectoresDistrito, sectoresVisibles);
      if (estadoDistrito === 'off') continue;
      if (estadoDistrito === 'on') {
        etiquetas.push(distrito.nombre);
        continue;
      }
      // 'mixed' — listar los sectores individuales prendidos de este distrito.
      for (const sector of sectores.filter((s) => s.distritoId === distrito.id)) {
        if (sectoresVisibles.has(sector.id)) etiquetas.push(sector.nombre);
      }
    }
  }

  return etiquetas;
}

/**
 * KPI fijo arriba del sidebar (no flota sobre el mapa, pedido de Edgar
 * 2026-08-12) — mismo total que ya alimenta el mapa/lista (misma queryKey,
 * React Query dedupea el fetch, no pide nada nuevo al backend) así que
 * respeta TODOS los filtros activos (Grupo, Prioridad, Estado, Rango de
 * fechas), no solo Ubicación.
 */
export function TotalIncidenciasCard() {
  const { data, isLoading } = useIncidentsToday();
  const provincias = useUbicacionStore((s) => s.provincias);
  const distritos = useUbicacionStore((s) => s.distritos);
  const sectores = useUbicacionStore((s) => s.sectores);
  const sectoresVisibles = useUbicacionStore((s) => s.sectoresVisibles);
  const distritosSinSectorVisibles = useUbicacionStore((s) => s.distritosSinSectorVisibles);

  const etiquetas = calcularEtiquetasVisibles(
    provincias,
    distritos,
    sectores,
    sectoresVisibles,
    distritosSinSectorVisibles
  );

  return (
    <div style={card}>
      <span style={label}>TOTAL DE INCIDENCIAS ACTIVAS</span>
      {etiquetas.length > 0 ? (
        <div style={ubicacionesRow}>
          {etiquetas.map((nombre) => (
            <span key={nombre} style={ubicacionTexto}>
              {nombre}
            </span>
          ))}
        </div>
      ) : (
        <span style={ubicacionTexto}>Sin ubicación seleccionada</span>
      )}
      <span style={numero}>{isLoading ? '—' : (data?.total ?? 0)}</span>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

const card: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  padding: '12px 14px',
  marginBottom: 16,
  borderRadius: 10,
  backgroundColor: 'var(--map-surface-alt)',
  border: '1px solid var(--map-border)',
};

const label: CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  color: 'var(--map-text-muted)',
  letterSpacing: 0.8,
};

const ubicacionesRow: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const ubicacionTexto: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--map-text)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const numero: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  color: 'var(--map-accent)',
  lineHeight: 1.2,
  marginTop: 2,
};
