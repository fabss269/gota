export type Rol = 'tecnico' | 'supervisor';

export type Usuario = {
  id: string;
  nombre: string;
  rol: Rol;
  cuadrilla?: string;
  sector: string;
};

/**
 * Usuarios (docs/API.md § 6 `GET /usuarios?rol=tecnico,supervisor`). Contenido
 * alineado 1:1 con el board Penpot `Overlay - Seleccionar Responsable` (Spec 07).
 * Sin filtro por sector (decisión confirmada con Edgar): la lista de responsables
 * siempre muestra el pool completo.
 */
export const USUARIOS: Usuario[] = [
  { id: 'u_001', nombre: 'Juan Gonzales Rubio', rol: 'tecnico', cuadrilla: 'Cuadrilla 5', sector: 'Sector 5' },
  { id: 'u_002', nombre: 'Luis Dominguez', rol: 'tecnico', cuadrilla: 'Cuadrilla 2', sector: 'Sector 3' },
  { id: 'u_003', nombre: 'María Paredes', rol: 'supervisor', sector: 'Sector 5' },
];
