import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { SearchableCombo, type ComboOption } from '@/components/shared/SearchableCombo';
import { Colors, Radius, Spacing } from '@/constants/theme';

// Discriminated union: cada `kind` trae solo los props que le aplican, así el TS
// obliga a pasar `options` para 'combo' y no lo permite para 'number'.
export type EditableFieldProps<TValue> = {
  label: string;
  displayValue: string;          // Cómo se muestra en modo lectura ("4 m", "Sí", "Concreto")
  suffix?: string;                // Sufijo visual dentro del input ("m", "%", '"')
  readOnly?: boolean;             // Si true, no muestra el lápiz (para código/id/sector/distrito)
  saving?: boolean;               // Muestra spinner en los botones ✓/✗ mientras dura el PATCH
  onSave: (nuevoValor: TValue) => Promise<void> | void;
} & (
  | {
      kind: 'number';
      value: number | null;
      min?: number;
      max?: number;
      step?: number;
      decimals?: number;
    }
  | { kind: 'text'; value: string | null }
  | {
      kind: 'combo';
      value: number | null;
      options: ComboOption<number>[];
      comboTitle: string;
      loadingOptions?: boolean;
      onOpenCombo?: () => void;   // Dispara la carga lazy del catálogo al abrir
    }
  | { kind: 'toggle'; value: boolean; labelTrue: string; labelFalse: string }
);

/**
 * Campo editable con ícono lápiz. Al click activa la edición inline. El usuario
 * cambia el valor, aprieta ✓ para intentar guardar → aparece ConfirmDialog con
 * el mensaje "Cambiar X de A a B?". Si confirma, dispara `onSave`; el caller es
 * responsable del PATCH + toast (este componente es agnóstico al backend).
 * `readOnly` deja el campo sin lápiz (usado para código/id/sector/distrito).
 */
export function EditableField<TValue>(props: EditableFieldProps<TValue>) {
  const [editing, setEditing] = useState(false);
  // Draft es unknown porque cambia según kind — TS lo estrecha en cada rama.
  const [draft, setDraft] = useState<unknown>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  const { label, displayValue, readOnly, saving } = props;

  // Modo lectura ─────────────────────────────────────────────────────────────
  if (!editing || readOnly) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.readValueContainer}>
          <Text style={styles.readValue} numberOfLines={2}>{displayValue}</Text>
          {!readOnly && (
            <Pressable
              onPress={() => {
                setDraft(props.value);
                setEditing(true);
                if (props.kind === 'combo') {
                  props.onOpenCombo?.();
                  setComboOpen(true);
                }
              }}
              hitSlop={8}
              style={styles.pencilBtn}
            >
              <Ionicons name="pencil-outline" size={14} color={Colors.accent} />
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  // Modo edición ─────────────────────────────────────────────────────────────
  const cancelar = () => {
    setEditing(false);
    setComboOpen(false);
    setDraft(null);
  };

  const validarYConfirmar = () => {
    // Si el valor no cambió, cancela sin abrir modal.
    if (draft === props.value) return cancelar();
    if (draft === null || draft === undefined || draft === '') return cancelar();
    setConfirmOpen(true);
  };

  const guardar = async () => {
    try {
      await props.onSave(draft as TValue);
    } finally {
      setConfirmOpen(false);
      setEditing(false);
      setDraft(null);
      setComboOpen(false);
    }
  };

  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.editContainer}>
          <EditInput
            props={props}
            draft={draft}
            setDraft={setDraft}
            comboOpen={comboOpen}
            setComboOpen={setComboOpen}
          />
          <Pressable
            onPress={validarYConfirmar}
            hitSlop={8}
            style={[styles.actionBtn, styles.confirmBtn]}
            disabled={saving}
          >
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </Pressable>
          <Pressable
            onPress={cancelar}
            hitSlop={8}
            style={[styles.actionBtn, styles.cancelBtn]}
            disabled={saving}
          >
            <Ionicons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        </View>
      </View>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar cambio"
        message={mensajeConfirmacion(props, draft)}
        onConfirm={guardar}
        onCancel={() => setConfirmOpen(false)}
        loading={saving}
      />
    </>
  );
}

// ── Sub-componentes de input por kind ────────────────────────────────────────

function EditInput<TValue>({
  props,
  draft,
  setDraft,
  comboOpen,
  setComboOpen,
}: {
  props: EditableFieldProps<TValue>;
  draft: unknown;
  setDraft: (v: unknown) => void;
  comboOpen: boolean;
  setComboOpen: (v: boolean) => void;
}) {
  if (props.kind === 'number') {
    return (
      <View style={styles.inputBox}>
        <TextInput
          value={draft === null ? '' : String(draft)}
          onChangeText={(t) => setDraft(t === '' ? null : Number(t))}
          keyboardType="decimal-pad"
          style={styles.numberInput}
          autoFocus
        />
        {props.suffix && <Text style={styles.suffix}>{props.suffix}</Text>}
      </View>
    );
  }

  if (props.kind === 'text') {
    return (
      <TextInput
        value={(draft as string | null) ?? ''}
        onChangeText={(t) => setDraft(t)}
        style={styles.textInput}
        autoFocus
      />
    );
  }

  if (props.kind === 'toggle') {
    const bool = draft as boolean;
    return (
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>{bool ? props.labelTrue : props.labelFalse}</Text>
        <Switch
          value={bool}
          onValueChange={(v) => setDraft(v)}
          trackColor={{ false: Colors.border, true: Colors.accent }}
          thumbColor="#FFFFFF"
        />
      </View>
    );
  }

  // combo
  const selected = draft as number | null;
  const option = props.options.find((o) => o.value === selected);
  return (
    <>
      <Pressable
        onPress={() => setComboOpen(true)}
        style={[styles.inputBox, styles.comboBox]}
      >
        <Text style={styles.comboLabel} numberOfLines={1}>
          {option?.label ?? (props.loadingOptions ? 'Cargando…' : 'Seleccionar…')}
        </Text>
        <Ionicons name="chevron-down" size={14} color={Colors.textMuted} />
      </Pressable>
      <SearchableCombo
        open={comboOpen}
        title={props.comboTitle}
        options={props.options}
        selected={selected}
        loading={props.loadingOptions}
        onSelect={(v) => {
          setDraft(v);
          setComboOpen(false);
        }}
        onClose={() => setComboOpen(false)}
      />
    </>
  );
}

// ── Mensaje del modal de confirmación ────────────────────────────────────────

function mensajeConfirmacion<TValue>(props: EditableFieldProps<TValue>, draft: unknown): string {
  const anterior = formatearValorAnterior(props);
  const nuevo = formatearValorNuevo(props, draft);
  return `¿Estás seguro de cambiar el campo "${props.label}" de ${anterior} a ${nuevo}?`;
}

function formatearValorAnterior<TValue>(props: EditableFieldProps<TValue>): string {
  if (props.kind === 'combo') {
    const opt = props.options.find((o) => o.value === props.value);
    return opt ? `"${opt.label}"` : '(sin valor)';
  }
  if (props.kind === 'toggle') return props.value ? `"${props.labelTrue}"` : `"${props.labelFalse}"`;
  if (props.value === null || props.value === '') return '(sin valor)';
  return `"${props.displayValue}"`;
}

function formatearValorNuevo<TValue>(props: EditableFieldProps<TValue>, draft: unknown): string {
  if (props.kind === 'combo') {
    const opt = props.options.find((o) => o.value === draft);
    return opt ? `"${opt.label}"` : '(sin valor)';
  }
  if (props.kind === 'toggle') return draft ? `"${props.labelTrue}"` : `"${props.labelFalse}"`;
  if (draft === null || draft === '') return '(sin valor)';
  const suffix = 'suffix' in props && props.suffix ? ` ${props.suffix}` : '';
  return `"${draft}${suffix}"`;
}

// ── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    gap: Spacing.sm,
    minHeight: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    flexShrink: 0,
    width: 100,
  },
  readValueContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  readValue: {
    fontSize: 13,
    color: Colors.textBody,
    fontWeight: '500',
    textAlign: 'right',
  },
  pencilBtn: { padding: 2 },
  editContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    backgroundColor: '#FFFFFF',
    minWidth: 100,
    maxWidth: 180,
  },
  numberInput: {
    fontSize: 13,
    color: Colors.textBody,
    flex: 1,
    padding: 0,
    textAlign: 'right',
  },
  suffix: { fontSize: 12, color: Colors.textMuted, marginLeft: 4 },
  textInput: {
    fontSize: 13,
    color: Colors.textBody,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flex: 1,
    maxWidth: 180,
    backgroundColor: '#FFFFFF',
  },
  comboBox: { gap: 6, cursor: 'pointer' as any },
  comboLabel: { fontSize: 13, color: Colors.textBody, flex: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 13, color: Colors.textBody, fontWeight: '500' },
  actionBtn: {
    width: 26,
    height: 26,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtn: { backgroundColor: Colors.accent },
  cancelBtn: { backgroundColor: '#F1F3F5', borderWidth: 1, borderColor: Colors.border },
});
