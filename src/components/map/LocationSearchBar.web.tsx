import { Ionicons } from '@expo/vector-icons';
import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buscarSuministro } from '@/api/catalogos';
import { ApiError } from '@/api/client';
import { buscarDireccion, type DireccionResultado } from '@/api/geocoding';
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

// Web Speech API — no está en todos los navegadores (Firefox no la soporta, Safari
// parcialmente) ni tiene tipos oficiales en el lib DOM de TS, de ahí esta interfaz
// mínima con solo lo que usamos.
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = { results: { [i: number]: { [j: number]: SpeechRecognitionResultLike } } };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Buscador de ubicación (dirección vía Nominatim/OSM, o suministro vía backend) — overlay sobre el mapa web. */
export function LocationSearchBar() {
  const flyTo = useMapSearchStore((state) => state.flyTo);

  const [query, setQuery] = useState('');
  const [resultados, setResultados] = useState<DireccionResultado[]>([]);
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [escuchando, setEscuchando] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Al elegir un resultado, seleccionarDireccion() hace setQuery(label) — eso por sí
  // solo dispararía este mismo efecto de nuevo y reabriría el dropdown con la
  // etiqueta ya elegida como si el usuario la hubiera tecleado. Esta bandera hace que
  // esa única re-ejecución del efecto no busque nada.
  const skipNextSearchRef = useRef(false);
  const soportaVoz = getSpeechRecognitionCtor() !== null;

  const modo = detectarModo(query.trim());

  // Autodetecta modo según el texto: 8 dígitos → suministro (búsqueda puntual), otra
  // cosa → dirección (debounced Nominatim). Se cancela la petición anterior si el
  // usuario sigue escribiendo.
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
    // buscarPorSuministro se define abajo y lee query/flyTo del closure actual; no la
    // ponemos como dep porque generaría un loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    const texto = value.trim();
    // Limpiar dropdown/error cuando el texto es muy corto para buscar dirección
    // (y no aplica el modo suministro).
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === 'suministro') {
      void buscarPorSuministro();
    } else if (resultados.length > 0) {
      seleccionarDireccion(resultados[0]);
    }
  };

  const toggleVoz = () => {
    if (escuchando) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = 'es-PE';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) {
        setQuery(transcript);
        // El useEffect autodetecta si el transcript es un suministro (8 dígitos) o
        // una dirección y dispara la búsqueda apropiada; no hace falta forzar aquí.
      }
    };
    recognition.onerror = () => setEscuchando(false);
    recognition.onend = () => setEscuchando(false);

    recognitionRef.current = recognition;
    setEscuchando(true);
    recognition.start();
  };

  const usarMiUbicacion = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Tu navegador no soporta geolocalización.');
      return;
    }
    setBuscando(true);
    setError(null);
    setMostrarResultados(false);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        flyTo({ lat: pos.coords.latitude, lon: pos.coords.longitude, zoom: 17 });
        setBuscando(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Permiso de ubicación denegado. Habilítalo en el navegador para usar esta opción.'
            : 'No se pudo obtener tu ubicación. Intenta de nuevo.'
        );
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const hayTexto = query.trim().length > 0;

  return (
    <div style={wrapper}>
      <form onSubmit={handleSubmit} style={formRow}>
        <span style={searchIcon}>
          <Ionicons name="search-outline" size={16} color="var(--map-text-muted)" />
        </span>
        <input
          style={input}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
          placeholder="Buscar dirección o código de suministro (8 dígitos)…"
        />
        <button
          type="button"
          style={iconBtn}
          onClick={usarMiUbicacion}
          aria-label="Usar mi ubicación"
          title="Usar mi ubicación"
        >
          <Ionicons name="locate-outline" size={18} color="var(--map-accent)" />
        </button>
        {soportaVoz && (
          <button
            type="button"
            style={{ ...iconBtn, ...(escuchando ? iconBtnActive : {}) }}
            onClick={toggleVoz}
            aria-label="Dictar por voz"
            title="Dictar por voz"
          >
            <Ionicons name="mic-outline" size={18} color={escuchando ? 'var(--map-danger-text)' : 'var(--map-text-muted)'} />
          </button>
        )}
      </form>

      {hayTexto && !buscando && !error && (
        <div style={modeChip}>
          <Ionicons
            name={modo === 'suministro' ? 'barcode-outline' : 'location-outline'}
            size={12}
            color="var(--map-text-muted)"
          />
          <span>{modo === 'suministro' ? 'Buscando por suministro' : 'Buscando por dirección'}</span>
        </div>
      )}
      {buscando && <div style={statusMsg}>Buscando…</div>}
      {!buscando && error && <div style={{ ...statusMsg, color: 'var(--map-danger-text)' }}>{error}</div>}

      {modo === 'direccion' && mostrarResultados && resultados.length > 0 && (
        <div style={dropdown}>
          {resultados.map((item, i) => (
            <button
              type="button"
              key={`${item.lat},${item.lon},${i}`}
              style={resultRow}
              onClick={() => seleccionarDireccion(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────

const wrapper: CSSProperties = {
  position: 'absolute',
  top: 12,
  left: 12,
  zIndex: 10,
  width: 320,
  maxWidth: 'calc(100% - 24px)',
};

const modeChip: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  marginTop: 4,
  padding: '3px 8px',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--map-text-muted)',
  backgroundColor: 'rgba(255,255,255,0.92)',
  borderRadius: 6,
  boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  width: 'fit-content',
};

const formRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  backgroundColor: 'var(--map-surface)',
  borderRadius: 8,
  padding: '8px 10px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
};

const searchIcon: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  flexShrink: 0,
};

const input: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 13,
  color: 'var(--map-text)',
  backgroundColor: 'transparent',
};

const iconBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
  borderRadius: 4,
  flexShrink: 0,
};

const iconBtnActive: CSSProperties = {
  backgroundColor: 'var(--map-danger-bg)',
};

const statusMsg: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: 'var(--map-text-muted)',
  backgroundColor: 'var(--map-surface)',
  padding: '4px 10px',
  borderRadius: 6,
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  width: 'fit-content',
};

const dropdown: CSSProperties = {
  marginTop: 4,
  backgroundColor: 'var(--map-surface)',
  borderRadius: 8,
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  overflow: 'hidden',
  maxHeight: 220,
  overflowY: 'auto',
};

const resultRow: CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  fontSize: 12,
  color: 'var(--map-text)',
  border: 'none',
  borderBottom: '1px solid var(--map-surface-alt)',
  backgroundColor: 'var(--map-surface)',
  cursor: 'pointer',
};
