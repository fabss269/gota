import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { buscarSuministro } from '@/api/catalogos';
import { ApiError } from '@/api/client';
import { buscarDireccion, type DireccionResultado } from '@/api/geocoding';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMapSearchStore } from '@/state/mapSearchStore';

type Modo = 'direccion' | 'suministro';

const DEBOUNCE_MS = 600;
const MIN_QUERY_LEN = 3;

/**
 * Buscador de ubicación (dirección vía Nominatim/OSM, o suministro vía backend) —
 * overlay sobre el mapa móvil. Equivalente RN de LocationSearchBar.web.tsx (esa
 * versión usa <input>/<button> y Web Speech API/navigator.geolocation, ninguno
 * disponible en nativo) — dictado por voz y "usar mi ubicación" quedan fuera de esta
 * pasada (no hay expo-location/expo-speech instalados todavía), solo texto.
 */
export function LocationSearchBar() {
  const flyTo = useMapSearchStore((state) => state.flyTo);

  const [modo, setModo] = useState<Modo>('direccion');
  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<DireccionResultado[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    if (modo !== 'direccion') return;
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const texto = query.trim();
    if (texto.length < MIN_QUERY_LEN) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setBuscando(true);
      setError(null);
      buscarDireccion(texto, controller.signal)
        .then((items) => {
          setResultados(items);
          setMostrarResultados(true);
          if (items.length === 0) setError('No se encontraron direcciones.');
        })
        .catch((e: unknown) => {
          if (e instanceof DOMException && e.name === 'AbortError') return;
          setError('No se pudo buscar la dirección. Intenta de nuevo.');
        })
        .finally(() => setBuscando(false));
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, modo]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (modo === 'direccion' && value.trim().length < MIN_QUERY_LEN) {
      setResultados([]);
      setMostrarResultados(false);
      setError(null);
    }
  };

  const seleccionarDireccion = (item: DireccionResultado) => {
    skipNextSearchRef.current = true;
    setQuery(item.label);
    setResultados([]);
    setMostrarResultados(false);
    flyTo({ lat: item.lat, lon: item.lon, zoom: 18 });
  };

  const buscarPorSuministro = async () => {
    const codigo = query.trim();
    if (!codigo) return;
    setBuscando(true);
    setError(null);
    try {
      const resultado = await buscarSuministro(codigo);
      flyTo({ lat: resultado.lat, lon: resultado.lon, zoom: 19 });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setError('No se encontró una caja de agua con ese suministro.');
      } else {
        setError('No se pudo buscar el suministro. Intenta de nuevo.');
      }
    } finally {
      setBuscando(false);
    }
  };

  const handleSubmit = () => {
    if (modo === 'suministro') {
      buscarPorSuministro();
    } else if (resultados.length > 0) {
      seleccionarDireccion(resultados[0]);
    }
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setQuery('');
    setResultados([]);
    setMostrarResultados(false);
    setError(null);
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.segmented}>
        <Pressable
          style={[styles.segmentBtn, modo === 'direccion' && styles.segmentBtnActive]}
          onPress={() => cambiarModo('direccion')}
        >
          <Text style={[styles.segmentLabel, modo === 'direccion' && styles.segmentLabelActive]}>Dirección</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, modo === 'suministro' && styles.segmentBtnActive]}
          onPress={() => cambiarModo('suministro')}
        >
          <Text style={[styles.segmentLabel, modo === 'suministro' && styles.segmentLabelActive]}>Suministro</Text>
        </Pressable>
      </View>

      <View style={styles.formRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
          onSubmitEditing={handleSubmit}
          placeholder={modo === 'direccion' ? 'Buscar dirección…' : 'Código de suministro…'}
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
      </View>

      {buscando && (
        <View style={styles.statusMsg}>
          <Text style={styles.statusText}>Buscando…</Text>
        </View>
      )}
      {!buscando && error && (
        <View style={styles.statusMsg}>
          <Text style={[styles.statusText, styles.errorText]}>{error}</Text>
        </View>
      )}

      {modo === 'direccion' && mostrarResultados && resultados.length > 0 && (
        <View style={styles.dropdown}>
          {resultados.map((item, i) => (
            <Pressable
              key={`${item.lat},${item.lon},${i}`}
              style={styles.resultRow}
              onPress={() => seleccionarDireccion(item)}
            >
              <Text style={styles.resultLabel} numberOfLines={2}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {buscando && modo === 'suministro' && <ActivityIndicator style={styles.spinner} size="small" color={Colors.accent} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { width: '100%' },
  segmented: {
    flexDirection: 'row',
    width: 160,
    marginBottom: 6,
    borderRadius: 6,
    overflow: 'hidden',
    elevation: 3,
  },
  segmentBtn: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  segmentBtnActive: { backgroundColor: Colors.white },
  segmentLabel: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  segmentLabelActive: { color: Colors.primaryDark },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    elevation: 3,
  },
  searchIcon: { fontSize: 13 },
  input: { flex: 1, fontSize: 13, color: Colors.textBody, padding: 0 },
  statusMsg: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: Colors.white,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    elevation: 2,
  },
  statusText: { fontSize: 11, color: Colors.textMuted },
  errorText: { color: Colors.statusCritica },
  dropdown: {
    marginTop: 4,
    backgroundColor: Colors.white,
    borderRadius: Radius.sm,
    overflow: 'hidden',
    maxHeight: 220,
    elevation: 4,
  },
  resultRow: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  resultLabel: { fontSize: 12, color: Colors.textBody },
  spinner: { marginTop: 6, alignSelf: 'flex-start' },
});
