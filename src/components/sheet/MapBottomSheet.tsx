import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { CapasTab } from '@/components/sheet/CapasTab';
import { FiltrosTab } from '@/components/sheet/FiltrosTab';
import { useCapasStore } from '@/state/capasStore';
import { useUbicacionStore } from '@/state/ubicacionStore';

type Tab = 'filtros' | 'capas';

type Props = {
  // Notifica el borde superior real (en px de pantalla) del sheet cada vez que cambia
  // de snap point. La usa el padre (mapa/index.tsx) para que el botón de modo de mapa
  // suba junto con el sheet en vez de quedar tapado por él.
  // (`animatedPosition` de @gorhom/bottom-sheet solo se actualiza en el montaje inicial
  // en la versión web de este stack — no en cambios de snap point posteriores — por eso
  // se usa `onChange`, que sí es confiable ahí.)
  onSheetPositionChange?: (position: number) => void;
};

/**
 * Bottom Sheet del Mapa (Spec 04). Estado "compressed" (snap point bajo, con las
 * pestañas Filtros/Capas) y estado expandido (snap point alto con el contenido).
 */
export const MapBottomSheet = forwardRef<BottomSheet, Props>(({ onSheetPositionChange }, forwardedRef) => {
  const [tab, setTab] = useState<Tab>('filtros');
  const snapPoints = useMemo(() => ['14%', '65%'], []);
  const sheetRef = useRef<BottomSheet>(null);

  // Colapsa el sheet al snap point bajo (14%) cuando cambia algo que afecta al mapa
  // (capas aplicadas o sector/distrito activo) — sin esto, el sheet se queda tapando
  // el mapa después del cambio y en mobile parece que "no hizo nada" (bug real: en
  // desktop el sidebar nunca tapa el mapa, así que ahí el mismo cambio sí se nota).
  // `onAplicar` de CapasTab ya no queda como no-op: acá es donde efectivamente hace
  // algo, sin necesidad de que el padre (mapa/index.web.tsx) haga nada con su propio
  // bottomSheetRef.
  const capasVisibles = useCapasStore((s) => s.capasVisibles);
  const sectoresActivos = useUbicacionStore((s) => s.sectoresActivos);
  const distritosActivos = useUbicacionStore((s) => s.distritosActivos);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    sheetRef.current?.snapToIndex(0);
  }, [capasVisibles, sectoresActivos, distritosActivos]);

  return (
    <BottomSheet
      ref={(instance) => {
        sheetRef.current = instance;
        if (typeof forwardedRef === 'function') forwardedRef(instance);
        else if (forwardedRef) forwardedRef.current = instance;
      }}
      index={0}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBackground}
      onChange={(_index, position) => onSheetPositionChange?.(position)}
    >
      <View style={styles.tabsRow}>
        <TabButton label="Filtros" active={tab === 'filtros'} onPress={() => setTab('filtros')} />
        <TabButton label="Capas" active={tab === 'capas'} onPress={() => setTab('capas')} />
      </View>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        {tab === 'filtros' ? <FiltrosTab /> : <CapasTab onAplicar={() => {}} />}
      </BottomSheetScrollView>
    </BottomSheet>
  );
});
MapBottomSheet.displayName = 'MapBottomSheet';

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tabButton, active && styles.tabButtonActive]} onPress={onPress}>
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Colors.white,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.md,
    backgroundColor: '#EEF1F6',
    borderRadius: Radius.pill,
    padding: 4,
    marginBottom: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabLabel: {
    fontWeight: '700',
    color: Colors.textMuted,
  },
  tabLabelActive: {
    color: Colors.white,
  },
  content: {
    paddingBottom: Spacing.xl,
  },
});
