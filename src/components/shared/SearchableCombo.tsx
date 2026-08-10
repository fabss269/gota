import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

export type ComboOption<TValue = number> = { value: TValue; label: string };

type Props<TValue> = {
  open: boolean;
  title: string;
  placeholder?: string;
  options: ComboOption<TValue>[];
  selected: TValue | null;
  loading?: boolean;
  emptyMessage?: string;
  onSelect: (value: TValue) => void;
  onClose: () => void;
};

/**
 * Combo con buscador tipo "picker". Se abre como modal fullscreen (mismo en web y
 * nativo). La búsqueda es case/acento-insensitive sobre `label`.
 */
export function SearchableCombo<TValue = number>({
  open,
  title,
  placeholder = 'Buscar…',
  options,
  selected,
  loading = false,
  emptyMessage = 'Sin resultados',
  onSelect,
  onClose,
}: Props<TValue>) {
  const [query, setQuery] = useState('');

  const filtradas = useMemo(() => {
    const q = normalizar(query);
    if (!q) return options;
    return options.filter((o) => normalizar(o.label).includes(q));
  }, [options, query]);

  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={Colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={placeholder}
              placeholderTextColor={Colors.textMuted}
              style={styles.searchInput}
              autoFocus
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </Pressable>
            )}
          </View>

          {loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Cargando…</Text>
            </View>
          ) : filtradas.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          ) : (
            <FlatList
              data={filtradas}
              keyExtractor={(item) => String(item.value)}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = item.value === selected;
                return (
                  <Pressable
                    onPress={() => onSelect(item.value)}
                    style={({ pressed }) => [
                      styles.item,
                      isSelected && styles.itemSelected,
                      pressed && styles.itemPressed,
                    ]}
                  >
                    <Text style={[styles.itemLabel, isSelected && styles.itemLabelSelected]}>
                      {item.label}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={18} color={Colors.accent} />}
                  </Pressable>
                );
              }}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Búsqueda robusta: minúsculas + sin diacríticos, así "válvula" matchea "Valvula".
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: 15, fontWeight: '700', color: Colors.textBody },
  closeBtn: { padding: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    margin: Spacing.md,
    marginBottom: Spacing.sm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    backgroundColor: '#F8F9FA',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: Colors.textBody,
    padding: 0,
  },
  list: { maxHeight: 400 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemSelected: { backgroundColor: Colors.accentBg },
  itemPressed: { backgroundColor: '#F1F3F5' },
  itemLabel: { fontSize: 14, color: Colors.textBody, flex: 1 },
  itemLabelSelected: { color: Colors.accent, fontWeight: '600' },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: 13, color: Colors.textMuted },
});
