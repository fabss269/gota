import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';

import { buscarSuministro } from '@/api/catalogos';
import { ApiError } from '@/api/client';
import { buscarDireccion, type DireccionResultado } from '@/api/geocoding';
import { useMapSearchStore } from '@/state/mapSearchStore';

type Modo = 'direccion' | 'suministro';

const DEBOUNCE_MS = 600;
const MIN_QUERY_LEN = 3;

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

  const [modo, setModo] = useState<Modo>('direccion');
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

  // Búsqueda de dirección: debounced, cancela la petición anterior si el usuario
  // sigue escribiendo (evita que una respuesta vieja pise a una más nueva). El caso
  // "texto muy corto" se resuelve en el onChange del input, no acá — un efecto no
  // debería hacer setState síncrono en su cuerpo (react-hooks/set-state-in-effect).
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (modo === 'suministro') {
      buscarPorSuministro();
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
        if (modo === 'suministro') {
          // El código de suministro es una búsqueda exacta puntual: al terminar de
          // dictar, se dispara sola en vez de esperar que el usuario presione Enter.
          setTimeout(() => buscarPorSuministro(), 0);
        }
      }
    };
    recognition.onerror = () => setEscuchando(false);
    recognition.onend = () => setEscuchando(false);

    recognitionRef.current = recognition;
    setEscuchando(true);
    recognition.start();
  };

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo);
    setResultados([]);
    setMostrarResultados(false);
    setError(null);
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

  return (
    <div style={wrapper}>
      <div style={segmented}>
        <button
          type="button"
          style={{ ...segmentBtn, ...(modo === 'direccion' ? segmentBtnActive : {}) }}
          onClick={() => cambiarModo('direccion')}
        >
          Dirección
        </button>
        <button
          type="button"
          style={{ ...segmentBtn, ...(modo === 'suministro' ? segmentBtnActive : {}) }}
          onClick={() => cambiarModo('suministro')}
        >
          Suministro
        </button>
      </div>

      <form onSubmit={handleSubmit} style={formRow}>
        <span style={searchIcon}>🔍</span>
        <input
          style={input}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => resultados.length > 0 && setMostrarResultados(true)}
          placeholder={modo === 'direccion' ? 'Buscar dirección…' : 'Código de suministro…'}
        />
        <button
          type="button"
          style={micBtn}
          onClick={usarMiUbicacion}
          aria-label="Usar mi ubicación"
          title="Usar mi ubicación"
        >
          📍
        </button>
        {soportaVoz && (
          <button
            type="button"
            style={{ ...micBtn, ...(escuchando ? micBtnActive : {}) }}
            onClick={toggleVoz}
            aria-label="Dictar por voz"
            title="Dictar por voz"
          >
            🎤
          </button>
        )}
      </form>

      {buscando && <div style={statusMsg}>Buscando…</div>}
      {!buscando && error && <div style={{ ...statusMsg, color: '#C0392B' }}>{error}</div>}

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

const segmented: CSSProperties = {
  display: 'flex',
  width: 'fit-content',
  marginBottom: 6,
  borderRadius: 6,
  overflow: 'hidden',
  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
};

const segmentBtn: CSSProperties = {
  padding: '5px 12px',
  fontSize: 11,
  fontWeight: '600',
  border: 'none',
  cursor: 'pointer',
  backgroundColor: 'rgba(255,255,255,0.85)',
  color: '#8B9BB4',
};

const segmentBtnActive: CSSProperties = {
  backgroundColor: 'white',
  color: '#0D2B52',
};

const formRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  backgroundColor: 'white',
  borderRadius: 8,
  padding: '8px 10px',
  boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
};

const searchIcon: CSSProperties = {
  fontSize: 13,
  flexShrink: 0,
};

const input: CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  fontSize: 13,
  color: '#212121',
  backgroundColor: 'transparent',
};

const micBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: 2,
  borderRadius: 4,
  flexShrink: 0,
};

const micBtnActive: CSSProperties = {
  backgroundColor: '#FDECEC',
};

const statusMsg: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: '#8B9BB4',
  backgroundColor: 'white',
  padding: '4px 10px',
  borderRadius: 6,
  boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
  width: 'fit-content',
};

const dropdown: CSSProperties = {
  marginTop: 4,
  backgroundColor: 'white',
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
  color: '#212121',
  border: 'none',
  borderBottom: '1px solid #F5F6F8',
  backgroundColor: 'white',
  cursor: 'pointer',
};
