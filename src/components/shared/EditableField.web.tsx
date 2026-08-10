import { useState, type CSSProperties } from 'react';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SearchableCombo, type ComboOption } from '@/components/shared/SearchableCombo';
import { useToast } from '@/components/shared/ToastProvider';
import type { ElementoRedPatch } from '@/api/redElemento';
import type { ElementoRedTipo } from '@/components/map/mapLayers';
import { useActualizarElementoRed } from '@/hooks/useElementoRed';

/** Los 3 campos editables del panel de elemento (número/combo/switch) comparten la
 * misma mecánica: el control siempre está visible (ver decisión de Edgar
 * 2026-08-10 — coincide con el mockup, no con el modo lápiz "estilo Jira"
 * anterior), cambiarlo abre `ConfirmDialog` con "¿cambiar X de A a B?", confirmar
 * dispara el PATCH + toast, cancelar revierte al valor anterior sin llamar al
 * backend. Este hook centraliza esa mecánica para las 3 variantes de abajo. */
function useCampoEditable<T>(params: {
  tipo: ElementoRedTipo;
  id: number;
  label: string;
  campo: keyof ElementoRedPatch;
  valorActual: T;
  formatear: (valor: T) => string;
}) {
  const { tipo, id, label, campo, valorActual, formatear } = params;
  const [pendiente, setPendiente] = useState<T | null>(null);
  const mutation = useActualizarElementoRed();
  const { showToast } = useToast();

  const solicitarCambio = (nuevoValor: T) => {
    setPendiente(nuevoValor);
  };

  const cancelar = () => setPendiente(null);

  const confirmar = () => {
    if (pendiente === null) return;
    mutation.mutate(
      { tipo, id, patch: { [campo]: pendiente } as ElementoRedPatch },
      {
        onSuccess: () => {
          showToast(`${label} actualizado`, 'success');
          setPendiente(null);
        },
        onError: () => {
          showToast(`No se pudo actualizar ${label.toLowerCase()}`, 'error');
          setPendiente(null);
        },
      }
    );
  };

  const mensaje =
    pendiente !== null
      ? `¿Estás seguro de que deseas guardar los cambios realizados en el campo ${label} de ${formatear(valorActual)} a ${formatear(pendiente)}?`
      : '';

  return {
    solicitarCambio,
    dialog: (
      <ConfirmDialog
        open={pendiente !== null}
        message={mensaje}
        loading={mutation.isPending}
        onConfirm={confirmar}
        onCancel={cancelar}
      />
    ),
  };
}

// ── Campo numérico (diámetro, pendiente, distancia, profundidad, cota, tapa, fondo) ──

type NumberFieldProps = {
  tipo: ElementoRedTipo;
  id: number;
  label: string;
  campo: keyof ElementoRedPatch;
  value: number | null;
  suffix?: string;
};

export function EditableNumberField({ tipo, id, label, campo, value, suffix = '' }: NumberFieldProps) {
  const [draft, setDraft] = useState(value !== null ? String(value) : '');
  // Resincroniza el draft cuando `value` cambia por fuera (ej. refetch tras un PATCH
  // exitoso) sin useEffect — comparación durante el render, patrón recomendado por
  // React para "adjusting state when a prop changes" (evita el render en cascada que
  // sí produce un setState dentro de un efecto).
  const [valorSincronizado, setValorSincronizado] = useState(value);
  if (value !== valorSincronizado) {
    setValorSincronizado(value);
    setDraft(value !== null ? String(value) : '');
  }

  const { solicitarCambio, dialog } = useCampoEditable<number>({
    tipo,
    id,
    label,
    campo,
    valorActual: value ?? 0,
    formatear: (v) => `${v}${suffix}`,
  });

  const confirmarDraft = () => {
    const numero = Number(draft);
    if (draft.trim() === '' || Number.isNaN(numero) || numero === value) {
      setDraft(value !== null ? String(value) : '');
      return;
    }
    solicitarCambio(numero);
  };

  return (
    <div style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <div style={numberInputWrap}>
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={confirmarDraft}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setDraft(value !== null ? String(value) : '');
          }}
          style={numberInput}
        />
        {suffix && <span style={numberSuffix}>{suffix}</span>}
      </div>
      {dialog}
    </div>
  );
}

// ── Campo combo con buscador (material, tipo de accesorio, clasificación) ──

type SelectFieldProps = {
  tipo: ElementoRedTipo;
  id: number;
  label: string;
  campo: keyof ElementoRedPatch;
  valueId: number | null;
  valueLabel: string | null;
  options: ComboOption[] | undefined;
  loading: boolean;
};

// El PATCH solo necesita el id de la opción elegida (`{materialId: 5}`), no el
// objeto completo — no usa `useCampoEditable` genérico porque el valor que se
// muestra en el mensaje de confirmación (`nombre`) y el que se manda al backend
// (`id`) son campos distintos del mismo option.
export function EditableSelectField({ tipo, id, label, campo, valueId, valueLabel, options, loading }: SelectFieldProps) {
  const [pendiente, setPendiente] = useState<{ id: number; nombre: string } | null>(null);
  const mutation = useActualizarElementoRed();
  const { showToast } = useToast();

  const confirmar = () => {
    if (pendiente === null) return;
    mutation.mutate(
      { tipo, id, patch: { [campo]: pendiente.id } as ElementoRedPatch },
      {
        onSuccess: () => {
          showToast(`${label} actualizado`, 'success');
          setPendiente(null);
        },
        onError: () => {
          showToast(`No se pudo actualizar ${label.toLowerCase()}`, 'error');
          setPendiente(null);
        },
      }
    );
  };

  return (
    <div style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <SearchableCombo
        value={valueId}
        options={options}
        loading={loading}
        placeholder="Sin dato"
        onSelect={(opt: ComboOption) => setPendiente(opt)}
      />
      <ConfirmDialog
        open={pendiente !== null}
        message={`¿Estás seguro de que deseas guardar los cambios realizados en el campo ${label} de ${valueLabel ?? 'Sin dato'} a ${pendiente?.nombre}?`}
        loading={mutation.isPending}
        onConfirm={confirmar}
        onCancel={() => setPendiente(null)}
      />
    </div>
  );
}

// ── Campo switch (primaria/secundaria) ──

type SwitchFieldProps = {
  tipo: ElementoRedTipo;
  id: number;
  label: string;
  campo: keyof ElementoRedPatch;
  value: boolean;
  offLabel: string;
  onLabel: string;
};

export function EditableSwitchField({ tipo, id, label, campo, value, offLabel, onLabel }: SwitchFieldProps) {
  const { solicitarCambio, dialog } = useCampoEditable<boolean>({
    tipo,
    id,
    label,
    campo,
    valorActual: value,
    formatear: (v) => (v ? onLabel : offLabel),
  });

  return (
    <div style={fieldWrap}>
      <span style={fieldLabel}>{label}</span>
      <div style={switchRow}>
        <span style={{ ...switchOption, color: !value ? 'var(--map-text)' : 'var(--map-text-muted)' }}>{offLabel}</span>
        <div
          role="switch"
          aria-checked={value}
          onClick={() => solicitarCambio(!value)}
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
        <span style={{ ...switchOption, color: value ? 'var(--map-text)' : 'var(--map-text-muted)' }}>{onLabel}</span>
      </div>
      {dialog}
    </div>
  );
}

// ── Estilos compartidos ──

const FONT: CSSProperties['fontFamily'] = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';

const fieldWrap: CSSProperties = { marginBottom: 14 };

const fieldLabel: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--map-text-muted)',
  marginBottom: 6,
};

const numberInputWrap: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 12px',
  borderRadius: 8,
  border: '1px solid var(--map-border)',
  backgroundColor: 'var(--map-surface)',
};

const numberInput: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  fontSize: 13,
  fontFamily: FONT,
  color: 'var(--map-text)',
  width: '100%',
};

const numberSuffix: CSSProperties = {
  fontSize: 12,
  color: 'var(--map-text-muted)',
  flexShrink: 0,
};

const switchRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
};

const switchOption: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  fontFamily: FONT,
};
