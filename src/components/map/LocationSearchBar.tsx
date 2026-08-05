import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { buscarSuministro } from '@/api/catalogos';
import { ApiError } from '@/api/client';
import { buscarDireccion, type DireccionResultado } from '@/api/geocoding';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMapSearchStore } from '@/state/mapSearchStore';

type Modo = 'direccion' | 'suministro';

const DEBOUNCE_DIRECCION_MS = 600;
const DEBOUNCE_SUMINISTRO_MS = 300;
const MIN_QUERY_LEN = 3;

/** El código de suministro es exactamente 8 dígitos (constraint chk_suministro_8digitos
 *  en la BD). Si el texto matchea ese patrón se trata como suministro; cualquier otra
 *  cosa es dirección. Autodetección → sin toggle en la UI. */
const detectarModo = (texto: string): Modo =>
  /^\d{8}$/.test(texto) ? 'suministro' : 'direccion';

/**
 * Buscador de ubicación (dirección vía Nominatim/OSM, o suministro vía backend) —
 * overlay sobre el mapa móvil. Equivalente RN de LocationSearchBar.web.tsx (esa
 * versión usa <input>/<button> y Web Speech API/navigator.geolocation, ninguno
 * disponible en nativo) — dictado por voz y "usar mi ubicación" quedan fuera de esta
 * pasada (no hay expo-location/expo-speech instalados todavía), solo texto.
 */
export function LocationSearchBar() {
  const flyTo = useMapSearchStore((state) => state.flyTo);

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<DireccionResultado[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  const modo = detectarModo(query.trim());

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }
    const texto = query.trim();
    if (!texto) return;
    const modoActual = detectarModo(texto);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (modoActual === 'suministro') {
      debounceRef.current = setTimeout(() => {
        void buscarPorSuministro();
      }, DEBOUNCE_SUMINISTRO_MS);
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }

    if (texto.length < MIN_QUERY_LEN) return;
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
    }, DEBOUNCE_DIRECCION_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const texto = value.trim();
    if (detectarModo(texto) === 'direccion' && texto.length < MIN_QUERY_LEN) {
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
      void buscarPorSuministro();
    } else if (resultados.length > 0) {
      seleccionarDireccion(resultados[0]);
    }
  };

  const hayTexto = query.trim().length > 0;

  return (
    <View style={styles.wrapper}>
      <View style={styles.formRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={handleQueryChange}
          onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
          onSubmitEditing={handleSubmit}
          placeholder="Buscar dirección o código de suministro (8 dígitos)…"
          placeholderTextColor={Colors.textMuted}
          returnKeyType="search"
        />
      </View>

      {hayTexto && !buscando && !error && (
        <View style={styles.modeChip}>
          <Ionicons
            name={modo === 'suministro' ? 'barcode-outline' : 'location-outline'}
            size={12}
            color={Colors.textMuted}
          />
          <Text style={styles.modeChipLabel}>
            {modo === 'suministro' ? 'Buscando por suministro' : 'Buscando por dirección'}
          </Text>
        </View>
      )}

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
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    elevation: 2,
  },
  modeChipLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted },
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
