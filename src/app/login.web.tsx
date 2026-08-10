import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthContext';
import { ComingSoonModal } from '@/components/shared/ComingSoonModal';
import { resolveAsset } from '@/utils/resolveAsset';

const schema = z.object({
  correo: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

// Paleta y tipografías tomadas del design system.
// Ver docs/ESTADO_PROYECTO.md; el resto de la app usa `Colors` del proyecto,
const T = {
  primary: '#001430',
  primaryContainer: '#002855',
  secondary: '#00677f',
  secondaryFocus: '#00d1ff',
  surface: '#f7f9fb',
  surfaceLowest: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVariant: '#43474f',
  outline: '#747780',
  outlineVariant: '#c4c6d0',
  error: '#ba1a1a',
  onPrimary: '#ffffff',
  imageSrc: require('@/assets/images/epsel/planta-tratamiento.png') as { uri?: string },
  logoSrc: require('@/assets/images/epsel/epsel-logo.png') as { uri?: string },
};

const FONT_HEAD = 'Manrope, "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_BODY = '"Hanken Grotesk", "Helvetica Neue", Helvetica, Arial, sans-serif';
const FONT_DISPLAY = 'Montserrat, "Helvetica Neue", Helvetica, Arial, sans-serif';

/** Login — variante web (Spec 02). Diseño Stitch "Creative Login Redesign". */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'correo' | 'password' | null>(null);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    // Credenciales precargadas de prueba (mock: ver src/mocks/authMock.ts).
    // Quitar antes de conectar contra la API real.
    defaultValues: {
      correo: 'supervisor@epsel.gob.pe',
      password: 'epsel2026',
    },
  });

  const openComingSoon = (e: React.MouseEvent) => {
    e.preventDefault();
    setComingSoonOpen(true);
  };

  const onSubmit = async (data: FormData) => {
    setServerError(null);
    try {
      await signIn(data.correo, data.password);
      router.replace('/(app)/mapa');
    } catch (err) {
      if (err instanceof Error && err.name === 'CREDENCIALES_INVALIDAS') {
        setServerError('Correo o contraseña incorrectos');
      } else {
        setServerError('No se pudo conectar. Verifica tu conexión.');
      }
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: FONT_BODY,
        color: T.onSurface,
        backgroundColor: T.surfaceLowest,
        overflow: 'hidden',
      }}
    >
      <LeftPanel />

      <div
        style={{
          flex: '1 1 40%',
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          backgroundColor: T.surfaceLowest,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '24px 32px',
            minHeight: 0,
          }}
        >
          <div style={{ width: '100%', maxWidth: 384, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <img
                src={resolveAsset(T.logoSrc)}
                alt="Logotipo EPSEL"
                style={{ height: 72, objectFit: 'contain' }}
              />
            </div>

            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h1
                style={{
                  fontFamily: FONT_HEAD,
                  fontSize: 24,
                  lineHeight: '32px',
                  fontWeight: 600,
                  color: T.primary,
                  margin: '0 0 4px',
                }}
              >
                Bienvenido
              </h1>
              <p
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  lineHeight: '20px',
                  color: T.onSurfaceVariant,
                  margin: 0,
                }}
              >
                Ingresa tus credenciales para acceder
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Controller
                control={control}
                name="correo"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    id="email"
                    type="email"
                    label="Correo electrónico"
                    placeholder="usuario@epsel.gob.pe"
                    icon={<MailIcon />}
                    autoComplete="email"
                    value={value}
                    onChange={(v) => onChange(v)}
                    onFocus={() => setFocused('correo')}
                    onBlur={() => {
                      setFocused(null);
                      onBlur();
                    }}
                    isFocused={focused === 'correo'}
                    hasError={!!errors.correo}
                    errorMessage={errors.correo?.message}
                  />
                )}
              />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Field
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    label="Contraseña"
                    placeholder="••••••••"
                    icon={<LockIcon />}
                    autoComplete="current-password"
                    value={value}
                    onChange={(v) => onChange(v)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => {
                      setFocused(null);
                      onBlur();
                    }}
                    isFocused={focused === 'password'}
                    hasError={!!errors.password}
                    errorMessage={errors.password?.message}
                    trailing={
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        style={{
                          position: 'absolute',
                          right: 12,
                          top: 0,
                          bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          color: T.outline,
                        }}
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    }
                  />
                )}
              />

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <label
                  htmlFor="remember-me"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: 'pointer',
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    lineHeight: '16px',
                    fontWeight: 500,
                    color: T.onSurfaceVariant,
                  }}
                >
                  <input
                    id="remember-me"
                    name="remember-me"
                    type="checkbox"
                    style={{
                      width: 16,
                      height: 16,
                      accentColor: T.primary,
                      cursor: 'pointer',
                    }}
                  />
                  Recordarme
                </label>
                <a
                  href="#"
                  onClick={openComingSoon}
                  style={{
                    fontFamily: FONT_BODY,
                    fontSize: 12,
                    lineHeight: '16px',
                    fontWeight: 500,
                    color: T.secondary,
                    textDecoration: 'none',
                    cursor: 'pointer',
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </a>
              </div>

              {serverError && (
                <div
                  role="alert"
                  style={{
                    color: T.error,
                    fontFamily: FONT_BODY,
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'center',
                    marginTop: -8,
                  }}
                >
                  {serverError}
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: 4,
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: 9999,
                  backgroundColor: isSubmitting ? T.primaryContainer : T.primary,
                  color: T.onPrimary,
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  cursor: isSubmitting ? 'default' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                  transition: 'background-color 200ms, transform 200ms',
                }}
              >
                {isSubmitting ? 'Iniciando…' : 'Iniciar Sesión'}
              </button>
            </form>

            <div
              style={{
                marginTop: 20,
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  borderTop: `1px solid ${T.outlineVariant}4d`,
                }}
              />
              <span
                style={{
                  position: 'relative',
                  padding: '0 12px',
                  backgroundColor: T.surfaceLowest,
                  color: T.onSurfaceVariant,
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                O
              </span>
            </div>

            <p
              style={{
                marginTop: 20,
                marginBottom: 0,
                textAlign: 'center',
                fontFamily: FONT_BODY,
                fontSize: 14,
                color: T.onSurfaceVariant,
              }}
            >
              ¿No tienes una cuenta?{' '}
              <a
                href="#"
                onClick={openComingSoon}
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: T.secondary,
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                Crear una cuenta
              </a>
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '10px 16px',
            textAlign: 'center',
            fontFamily: FONT_BODY,
            fontSize: 11,
            color: `${T.onSurfaceVariant}cc`,
            flexShrink: 0,
          }}
        >
          © 2024 EPSEL S.A. Todos los derechos reservados.
        </div>
      </div>

      <ComingSoonModal open={comingSoonOpen} onClose={() => setComingSoonOpen(false)} />
    </div>
  );
}

// ── Panel izquierdo (foto + overlay "GOTA") ─────────────────────

function LeftPanel() {
  return (
    <div
      style={{
        flex: '1 1 60%',
        minWidth: 0,
        position: 'relative',
        backgroundImage: `url(${resolveAsset(T.imageSrc)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className="gota-left-panel"
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to right, ${T.primary}66, ${T.primary}1a)`,
          mixBlendMode: 'multiply',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(to bottom, transparent, ${T.primary}4d)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          padding: 48,
          zIndex: 10,
          maxWidth: 640,
        }}
      >
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 'clamp(72px, 8vw, 112px)',
            fontWeight: 900,
            lineHeight: 1,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            color: T.onPrimary,
            textShadow: '0 4px 12px rgba(0,0,0,0.5)',
            margin: '0 0 8px',
          }}
        >
          GOTA
        </h2>
        <p
          style={{
            fontFamily: FONT_BODY,
            fontSize: 22,
            lineHeight: '32px',
            fontWeight: 500,
            color: `${T.onPrimary}f2`,
            textShadow: '0 2px 8px rgba(0,0,0,0.35)',
            margin: 0,
          }}
        >
          Gestión Operacional, Trazabilidad y Atención de incidencias
        </p>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media (max-width: 768px) {
              .gota-left-panel { display: none; }
            }
          `,
        }}
      />
    </div>
  );
}

// ── Campo con ícono, label y error ───────────────────────────────

type FieldProps = {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  isFocused: boolean;
  hasError: boolean;
  errorMessage?: string;
  autoComplete?: string;
  trailing?: React.ReactNode;
};

function Field({
  id,
  type,
  label,
  placeholder,
  icon,
  value,
  onChange,
  onFocus,
  onBlur,
  isFocused,
  hasError,
  errorMessage,
  autoComplete,
  trailing,
}: FieldProps) {
  const borderColor = hasError
    ? T.error
    : isFocused
      ? T.secondaryFocus
      : `${T.secondary}33`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label
        htmlFor={id}
        style={{
          fontFamily: FONT_BODY,
          fontSize: 14,
          lineHeight: '20px',
          fontWeight: 600,
          letterSpacing: '0.05em',
          color: `${T.primary}cc`,
          marginLeft: 4,
        }}
      >
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <span
          style={{
            position: 'absolute',
            left: 12,
            top: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            color: T.outline,
            pointerEvents: 'none',
          }}
        >
          {icon}
        </span>
        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          value={value}
          autoComplete={autoComplete}
          autoCapitalize="none"
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 40px 12px 40px',
            border: `1px solid ${borderColor}`,
            borderRadius: 8,
            backgroundColor: T.surface,
            color: T.onSurface,
            fontFamily: FONT_BODY,
            fontSize: 16,
            lineHeight: '24px',
            outline: 'none',
            boxShadow: isFocused && !hasError ? `0 0 0 3px ${T.secondaryFocus}33` : 'none',
            transition: 'border-color 200ms, box-shadow 200ms',
            boxSizing: 'border-box',
          }}
        />
        {trailing}
      </div>
      {hasError && errorMessage && (
        <span
          style={{
            display: 'block',
            color: T.error,
            fontFamily: FONT_BODY,
            fontSize: 12,
            marginTop: 2,
            paddingLeft: 4,
          }}
        >
          {errorMessage}
        </span>
      )}
    </div>
  );
}

// ── Íconos SVG (mail / lock / eye) ────────────────────────────────

function MailIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {open ? (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </>
      ) : (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      )}
    </svg>
  );
}
