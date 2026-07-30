import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { useAuth } from '@/auth/AuthContext';
import { Colors } from '@/constants/theme';
import { GotaIcon } from '@/icons/GotaIcon';

const schema = z.object({
  correo: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

/** Login — variante web (Spec 02). */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [focused, setFocused] = useState<'correo' | 'password' | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { correo: '', password: '' },
  });

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
    // Fondo: mitad superior azul oscuro, mitad inferior gris claro
    <div style={{
      background: `linear-gradient(to bottom, ${Colors.primaryDark} 35%, #EEF1F6 35%)`,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      paddingTop: '35vh',
      paddingBottom: 60,
      boxSizing: 'border-box',
    }}>
      {/* Wrapper de la card — logo posicionado 44px por encima */}
      <div style={{
        position: 'relative',
        width: 480,
        maxWidth: '90vw',
      }}>
        {/* Logo: se solapa con la línea que divide header y fondo */}
        <div style={{
          position: 'absolute',
          top: -44,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 88,
          height: 88,
          borderRadius: 44,
          backgroundColor: 'white',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
          <GotaIcon size={38} color={Colors.primaryDark} />
        </div>

        {/* Card */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: 16,
          boxShadow: '0 4px 28px rgba(0,0,0,0.08)',
          padding: '64px 40px 40px',
        }}>

          {/* Campo: Correo */}
          <Controller
            control={control}
            name="correo"
            render={({ field: { onChange, onBlur, value } }) => (
              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>Correo</label>
                <input
                  type="email"
                  placeholder="correo@epsel.gob.pe"
                  value={value}
                  autoComplete="email"
                  autoCapitalize="none"
                  onChange={(e) => onChange(e.target.value)}
                  onFocus={() => setFocused('correo')}
                  onBlur={() => { setFocused(null); onBlur(); }}
                  style={{
                    ...inputBase,
                    borderColor: errors.correo
                      ? Colors.statusCritica
                      : focused === 'correo'
                        ? Colors.accent
                        : '#D0D7E3',
                    outline: 'none',
                  }}
                />
                {errors.correo && (
                  <span style={fieldErrorStyle}>{errors.correo.message}</span>
                )}
              </div>
            )}
          />

          {/* Campo: Contraseña */}
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <div style={{ marginBottom: 28 }}>
                <label style={labelStyle}>Contraseña</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={value}
                    autoComplete="current-password"
                    onChange={(e) => onChange(e.target.value)}
                    onFocus={() => setFocused('password')}
                    onBlur={() => { setFocused(null); onBlur(); }}
                    style={{
                      ...inputBase,
                      paddingRight: 48,
                      borderColor: errors.password
                        ? Colors.statusCritica
                        : focused === 'password'
                          ? Colors.accent
                          : '#D0D7E3',
                      outline: 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    style={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {errors.password && (
                  <span style={fieldErrorStyle}>{errors.password.message}</span>
                )}
              </div>
            )}
          />

          {serverError && (
            <div style={{
              color: Colors.statusCritica,
              fontSize: 13,
              fontWeight: '600',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              {serverError}
            </div>
          )}

          {/* Botón */}
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleSubmit(onSubmit)}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: isSubmitting ? '#4A6A9E' : Colors.primaryDark,
              color: 'white',
              border: 'none',
              borderRadius: 50,
              fontSize: 16,
              fontWeight: '700',
              cursor: isSubmitting ? 'default' : 'pointer',
              transition: 'background-color 150ms',
              letterSpacing: 0.3,
            }}
          >
            {isSubmitting ? 'Iniciando…' : 'Iniciar sesión'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Icono ojo ─────────────────────────────────────────────

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C62828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

// ── Estilos compartidos ───────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: '600',
  color: '#8B9BB4',
  marginBottom: 8,
};

const inputBase: React.CSSProperties = {
  width: '100%',
  padding: '14px 18px',
  border: '1.5px solid #D0D7E3',
  borderRadius: 50,
  fontSize: 15,
  color: '#212121',
  backgroundColor: 'white',
  boxSizing: 'border-box',
  transition: 'border-color 150ms',
  fontFamily: 'inherit',
};

const fieldErrorStyle: React.CSSProperties = {
  display: 'block',
  color: Colors.statusCritica,
  fontSize: 12,
  marginTop: 6,
  paddingLeft: 4,
};
