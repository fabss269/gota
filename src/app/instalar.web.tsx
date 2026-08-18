import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type CSSProperties } from 'react';

import { GotaIcon } from '@/icons/GotaIcon';
import { Colors } from '@/constants/theme';
import { isIOS, usePwaInstall } from '@/utils/pwa';

/**
 * Landing de instalación PWA — visible solo en web mobile cuando la app no
 * está corriendo en modo standalone (ver index.tsx). Android/Chrome dispara
 * el prompt nativo con el botón "Instalar app"; iOS no expone la API, así
 * que se muestran las instrucciones manuales.
 */
export default function InstalarScreen() {
  const router = useRouter();
  const { canInstall, install } = usePwaInstall();
  const [ultimoIntento, setUltimoIntento] = useState<'accepted' | 'dismissed' | 'unavailable' | null>(null);
  const esIOS = isIOS();

  const handleInstalar = async () => {
    const resultado = await install();
    setUltimoIntento(resultado);
    if (resultado === 'accepted') {
      // Al instalar, el navegador ya suele reabrir la app en modo standalone;
      // acá solo la redirigimos por si sigue en el mismo tab.
      router.replace('/');
    }
  };

  const continuarEnNavegador = () => {
    // Marca en sessionStorage para no volver a redirigir en este tab —
    // sessionStorage se limpia al cerrar la pestaña, así en la próxima
    // visita móvil sí volvemos a mostrar el landing.
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('gota:omitir-instalar', '1');
    }
    router.replace('/');
  };

  return (
    <LinearGradient colors={[Colors.primary, '#153C74']} style={container}>
      <div style={card}>
        <div style={logoCircle}>
          <GotaIcon size={40} color={Colors.primary} />
        </div>
        <h1 style={titulo}>Instalá GOTA en tu teléfono</h1>
        <p style={descripcion}>
          Se abre en pantalla completa, sin la barra del navegador, y aparece como una app más en tu
          pantalla de inicio.
        </p>

        {esIOS ? <InstruccionesIOS /> : <InstruccionesAndroid canInstall={canInstall} onInstalar={handleInstalar} />}

        {ultimoIntento === 'dismissed' && (
          <p style={aviso}>No se instaló. Podés intentar de nuevo cuando quieras.</p>
        )}
        {ultimoIntento === 'unavailable' && !esIOS && (
          <p style={aviso}>
            Tu navegador todavía no ofreció instalar. Refrescá la página o usá Chrome / Edge.
          </p>
        )}

        <button type="button" style={secundario} onClick={continuarEnNavegador}>
          Continuar en el navegador
        </button>
      </div>
    </LinearGradient>
  );
}

function InstruccionesAndroid({ canInstall, onInstalar }: { canInstall: boolean; onInstalar: () => void }) {
  return (
    <>
      <button
        type="button"
        style={{ ...primario, opacity: canInstall ? 1 : 0.55, cursor: canInstall ? 'pointer' : 'not-allowed' }}
        onClick={onInstalar}
        disabled={!canInstall}
      >
        <Ionicons name="download-outline" size={18} color={Colors.white} />
        <span>Instalar app</span>
      </button>
      {!canInstall && (
        <p style={ayuda}>
          Si el botón no está disponible, tocá el menú <Ionicons name="ellipsis-vertical" size={12} /> del navegador y
          elegí <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.
        </p>
      )}
    </>
  );
}

function InstruccionesIOS() {
  return (
    <ol style={pasos}>
      <li>
        Tocá <Ionicons name="share-outline" size={14} color={Colors.textBody} /> <strong>Compartir</strong> en la
        barra del navegador.
      </li>
      <li>
        Elegí <strong>Añadir a pantalla de inicio</strong>.
      </li>
      <li>
        Confirmá <strong>Añadir</strong>. GOTA queda como app en tu inicio.
      </li>
    </ol>
  );
}

const container: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const card: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  backgroundColor: '#FFFFFF',
  borderRadius: 16,
  padding: '28px 22px',
  boxShadow: '0 20px 40px rgba(0,0,0,0.25)',
  textAlign: 'center',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 12,
};

const logoCircle: CSSProperties = {
  width: 88,
  height: 88,
  borderRadius: 44,
  backgroundColor: '#E6F0FA',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginBottom: 4,
};

const titulo: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  color: Colors.textBody,
  margin: 0,
  lineHeight: 1.25,
};

const descripcion: CSSProperties = {
  fontSize: 13.5,
  color: Colors.textMuted,
  margin: 0,
  lineHeight: 1.5,
};

const primario: CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '13px',
  border: 'none',
  borderRadius: 999,
  backgroundColor: Colors.primary,
  color: Colors.white,
  fontSize: 14,
  fontWeight: 700,
  marginTop: 8,
};

const secundario: CSSProperties = {
  background: 'none',
  border: 'none',
  color: Colors.accent,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  padding: '8px 0',
  marginTop: 4,
};

const ayuda: CSSProperties = {
  fontSize: 12,
  color: Colors.textMuted,
  margin: '0 4px',
  lineHeight: 1.5,
};

const aviso: CSSProperties = {
  fontSize: 12.5,
  color: Colors.statusAlerta,
  margin: 0,
  fontWeight: 600,
};

const pasos: CSSProperties = {
  textAlign: 'left',
  paddingLeft: 18,
  fontSize: 13,
  color: Colors.textBody,
  lineHeight: 1.6,
  margin: '4px 0 0',
};
