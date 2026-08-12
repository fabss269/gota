import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type CSSProperties } from 'react';

import { Colors } from '@/constants/theme';
import { useReasignarResponsable } from '@/hooks/useReasignarResponsable';
import { useUsuarios } from '@/hooks/useUsuarios';
import type { Usuario } from '@/mocks/usuariosMock';

const ROL_LABEL: Record<Usuario['rol'], string> = {
  tecnico: 'Técnico',
  supervisor: 'Supervisora',
};

type Props = {
  incidenciaId: string;
  tecnicoActualId?: string;
  tecnicoActualNombre: string;
  onReasignado?: () => void;
};

function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function iniciales(nombre: string): string {
  return nombre.split(' ').slice(0, 2).map((w) => w[0]).join('');
}

/**
 * Versión web de `SeleccionarResponsableSheet` (Spec 07, RF-07.8 a RF-07.10) — pedido
 * de Edgar 2026-08-12: el modal centrado de móvil se sentía invasivo en desktop.
 * Autocontenida (incluye su propio botón disparador, no un `Modal` controlado desde
 * afuera) — mismo shell que `LocationDropdown.tsx`: wrapper `position:relative` +
 * backdrop `fixed` para cerrar al click afuera + panel `absolute` anclado debajo.
 */
export function SeleccionarResponsableSheet({
  incidenciaId,
  tecnicoActualId,
  tecnicoActualNombre,
  onReasignado,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const { data: usuarios = [], isLoading } = useUsuarios();
  const reasignar = useReasignarResponsable();

  const filtrados = useMemo(() => {
    const q = normalizar(busqueda);
    if (!q) return usuarios;
    return usuarios.filter((u) => normalizar(u.nombre).includes(q));
  }, [usuarios, busqueda]);

  const cerrar = () => {
    setAbierto(false);
    setBusqueda('');
  };

  const handleSelect = (usuario: Usuario) => {
    reasignar.mutate(
      { id: incidenciaId, usuario },
      {
        onSuccess: () => {
          onReasignado?.();
          cerrar();
        },
      }
    );
  };

  return (
    <div style={wrapper}>
      <button type="button" style={triggerBtn} onClick={() => setAbierto((v) => !v)}>
        <Ionicons name="person-circle-outline" size={16} color={Colors.textBody} />
        <span>{tecnicoActualNombre}</span>
        <Ionicons name="chevron-forward" size={12} color={Colors.textMuted} />
      </button>
      {abierto && (
        <>
          <div style={backdrop} onClick={cerrar} />
          <div style={panel}>
            <div style={searchRow}>
              <Ionicons name="search-outline" size={14} color={Colors.textMuted} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar técnico…"
                style={searchInput}
                autoFocus
              />
            </div>
            <div style={listWrap}>
              {isLoading ? (
                <div style={emptyMsg}>Cargando…</div>
              ) : filtrados.length === 0 ? (
                <div style={emptyMsg}>Sin resultados</div>
              ) : (
                filtrados.map((u) => {
                  const seleccionado = u.id === tecnicoActualId;
                  return (
                    <button
                      key={u.id}
                      type="button"
                      style={seleccionado ? { ...optionRow, ...optionRowSelected } : optionRow}
                      onClick={() => handleSelect(u)}
                      disabled={reasignar.isPending}
                    >
                      <span style={avatar}>{iniciales(u.nombre)}</span>
                      <span style={optionInfo}>
                        <span style={optionNombre}>{u.nombre}</span>
                        <span style={optionSub}>
                          {ROL_LABEL[u.rol]} · {u.cuadrilla ?? u.sector}
                        </span>
                      </span>
                      {seleccionado && <Ionicons name="checkmark" size={14} color={Colors.accent} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const wrapper: CSSProperties = { position: 'relative' };

const triggerBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none',
  border: `1px solid ${Colors.border}`,
  borderRadius: 20,
  padding: '4px 10px 4px 6px', fontSize: 12, color: Colors.textBody,
  cursor: 'pointer',
};

const backdrop: CSSProperties = { position: 'fixed', inset: 0, zIndex: 19 };

const panel: CSSProperties = {
  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 20,
  width: 260, maxHeight: 320, display: 'flex', flexDirection: 'column',
  backgroundColor: '#FFFFFF', borderRadius: 8,
  boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: `1px solid ${Colors.border}`,
  overflow: 'hidden',
};

const searchRow: CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 10px', borderBottom: `1px solid ${Colors.border}`, flexShrink: 0,
};

const searchInput: CSSProperties = {
  flex: 1, border: 'none', outline: 'none', fontSize: 12.5, color: Colors.textBody,
};

const listWrap: CSSProperties = { overflowY: 'auto', padding: 4 };

const emptyMsg: CSSProperties = { fontSize: 12, color: Colors.textMuted, padding: 12, textAlign: 'center' };

const optionRow: CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
  background: 'none', border: 'none', borderRadius: 6,
  padding: '6px 6px', cursor: 'pointer', textAlign: 'left',
};

const optionRowSelected: CSSProperties = { backgroundColor: Colors.accentBg };

const avatar: CSSProperties = {
  width: 26, height: 26, borderRadius: 13, flexShrink: 0,
  backgroundColor: Colors.accent, color: Colors.white,
  fontSize: 10.5, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const optionInfo: CSSProperties = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 };

const optionNombre: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: Colors.textBody,
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
};

const optionSub: CSSProperties = { fontSize: 10.5, color: Colors.textMuted };
