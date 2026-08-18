import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CambiarEstadoSheet } from '@/components/incident-actions/CambiarEstadoSheet';
import { CulminarAtencionDialog } from '@/components/incident-actions/CulminarAtencionDialog';
import { RegistrarAvanceSheet } from '@/components/incident-actions/RegistrarAvanceSheet';
import { SeleccionarResponsableSheet } from '@/components/incident-actions/SeleccionarResponsableSheet';
import { DetalleTab } from '@/components/incident-detail/DetalleTab';
import { FocoTab } from '@/components/incident-detail/FocoTab';
import { ImpactoTab } from '@/components/incident-detail/ImpactoTab';
import { IncidentDetailHeader } from '@/components/incident-detail/IncidentDetailHeader';
import { PredioTab } from '@/components/incident-detail/PredioTab';
import { TabsBar, type DetailTab } from '@/components/incident-detail/TabsBar';
import { TrazabilidadTab } from '@/components/incident-detail/TrazabilidadTab';
import { Radius, Spacing, type ColorPalette } from '@/constants/theme';
import { useIncidentDetail } from '@/hooks/useIncidentDetail';
import type { TransicionEstado } from '@/mocks/estadoWorkflowMock';
import { useThemeColors } from '@/state/themeStore';

type ActiveSheet = 'estado' | 'avance' | 'responsable' | 'culminar' | null;

/** Detalle de Incidencia (Spec 06) — modal ruteado, accesible desde Mapa y Lista. */
export default function IncidenciaDetalleScreen() {
  const t = useThemeColors();
  const styles = useMemo(() => makeStyles(t), [t]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tab, setTab] = useState<DetailTab>('detalle');
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const [pendingTransicion, setPendingTransicion] = useState<TransicionEstado | null>(null);

  const { data: incidencia, isLoading, isError } = useIncidentDetail(id);

  return (
    <View style={styles.backdrop}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {isLoading && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>Cargando incidencia…</Text>
        </View>
      )}
      {(isError || !incidencia) && !isLoading && (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>No se encontró la incidencia.</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.backLink}>Volver</Text>
          </Pressable>
        </View>
      )}

      {incidencia && (
        <>
          <View style={styles.headerWrap}>
            <IncidentDetailHeader
              incidencia={incidencia}
              onClose={() => router.back()}
              onChangeEstadoPress={() => setActiveSheet('estado')}
              onReassignPress={() => setActiveSheet('responsable')}
            />
            <TabsBar active={tab} onChange={setTab} />
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {tab === 'detalle' && <DetalleTab incidencia={incidencia} />}
            {tab === 'trazabilidad' && <TrazabilidadTab incidencia={incidencia} />}
            {tab === 'foco' && <FocoTab incidencia={incidencia} />}
            {tab === 'impacto' && <ImpactoTab incidenciaId={incidencia.id} active={tab === 'impacto'} />}
            {tab === 'predio' && <PredioTab incidencia={incidencia} />}
          </ScrollView>

          <CambiarEstadoSheet
            visible={activeSheet === 'estado'}
            incidenciaId={incidencia.id}
            estado={incidencia.estado}
            onClose={() => setActiveSheet(null)}
            onAbrirAvance={(transicion) => {
              setPendingTransicion(transicion);
              setActiveSheet('avance');
            }}
            onAbrirCulminar={() => setActiveSheet('culminar')}
          />
          <CulminarAtencionDialog
            visible={activeSheet === 'culminar'}
            incidenciaId={incidencia.id}
            incidenciaLabel={`${incidencia.tipo}  ·  ${incidencia.direccion}`}
            onClose={() => setActiveSheet(null)}
            onCulminado={() => setActiveSheet(null)}
          />
          {pendingTransicion && (
            <RegistrarAvanceSheet
              visible={activeSheet === 'avance'}
              incidenciaId={incidencia.id}
              incidenciaLabel={`${incidencia.tipo}  ·  ${incidencia.direccion}`}
              transicion={pendingTransicion}
              tecnicoActualId={incidencia.tecnicoAsignado?.id}
              onClose={() => setActiveSheet(null)}
              onRegistrado={() => setActiveSheet(null)}
            />
          )}
          <SeleccionarResponsableSheet
            visible={activeSheet === 'responsable'}
            incidenciaId={incidencia.id}
            tecnicoActualId={incidencia.tecnicoAsignado?.id}
            onClose={() => setActiveSheet(null)}
            onReasignado={() => setActiveSheet(null)}
          />
        </>
      )}
      </SafeAreaView>
    </View>
  );
}

function makeStyles(t: ColorPalette) {
  return StyleSheet.create({
    // El "modal" no se notaba porque ocupaba toda la pantalla — este backdrop + el
    // margen/borderRadius de `container` son lo que lo hace leerse como modal, igual
    // que el resto de overlays de la app (CambiarEstadoSheet, FiltersOverlay, etc.).
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(13, 43, 82, 0.35)',
      padding: Spacing.sm,
    },
    container: {
      flex: 1,
      backgroundColor: t.background,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
      elevation: 12,
    },
    headerWrap: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
    body: { padding: Spacing.md, paddingTop: Spacing.md },
    statusBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    statusText: { color: t.textMuted, fontSize: 13 },
    backLink: { color: t.accent, fontWeight: '700' },
  });
}
