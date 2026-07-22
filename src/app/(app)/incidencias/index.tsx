import { useNavigation, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Spacing } from '@/constants/theme';
import { FiltersRow } from '@/components/incidents/FiltersRow';
import { IncidentListItem } from '@/components/incidents/IncidentListItem';
import { Pagination } from '@/components/incidents/Pagination';
import { SearchBar } from '@/components/incidents/SearchBar';
import { useIncidentsList } from '@/hooks/useIncidentsList';
import type { Incidencia } from '@/mocks/incidentsMock';
import { openDrawer } from '@/navigation/openDrawer';
import { useIncidentsListFiltersStore } from '@/state/incidentsListFiltersStore';

/** Lista de Incidencias (Spec 05). */
export default function IncidenciasScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const setQ = useIncidentsListFiltersStore((s) => s.setQ);
  const page = useIncidentsListFiltersStore((s) => s.page);
  const setPage = useIncidentsListFiltersStore((s) => s.setPage);

  const { data, isLoading, isError, refetch } = useIncidentsList();
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handlePress = (incidencia: Incidencia) => {
    router.push({ pathname: '/incidencia/[id]', params: { id: incidencia.id } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => openDrawer(navigation)}>
          <Text style={styles.menuIcon}>☰</Text>
        </Pressable>
        <Text style={styles.title}>Incidencias</Text>
      </View>

      <View style={styles.toolbar}>
        <SearchBar onDebouncedChange={setQ} />
        <FiltersRow />
      </View>

      {isLoading && !data && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Cargando incidencias…</Text>
        </View>
      )}
      {isError && (
        <Pressable style={styles.statusBox} onPress={() => refetch()}>
          <Text style={styles.statusText}>No se pudo cargar. Toca para reintentar.</Text>
        </Pressable>
      )}
      {data && data.items.length === 0 && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>No hay incidencias con estos filtros.</Text>
        </View>
      )}

      <FlatList
        data={data?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => <IncidentListItem incidencia={item} onPress={() => handlePress(item)} />}
        ListFooterComponent={<Pagination page={page} totalPages={totalPages} onChange={setPage} />}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuIcon: { fontSize: 22, color: Colors.primaryDark },
  title: { fontSize: 20, fontWeight: '800', color: Colors.primaryDark },
  toolbar: { paddingHorizontal: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.xs },
  listContent: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  separator: { height: 2 },
  statusBox: { alignItems: 'center', paddingVertical: Spacing.lg },
  statusText: { color: Colors.textMuted, fontSize: 13 },
});
