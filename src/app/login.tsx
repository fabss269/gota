import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { z } from 'zod';

import { GotaIcon } from '@/icons/GotaIcon';
import { useAuth } from '@/auth/AuthContext';
import { Colors, Radius, Spacing } from '@/constants/theme';

const schema = z.object({
  correo: z.string().min(1, 'Ingresa tu correo').email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});
type FormData = z.infer<typeof schema>;

/** Login (Spec 02). */
export default function LoginScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          <GotaIcon size={40} color={Colors.primary} />
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Correo</Text>
        <Controller
          control={control}
          name="correo"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              style={[styles.input, errors.correo && styles.inputError]}
              placeholder="correo@epsel.gob.pe"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        {errors.correo && <Text style={styles.fieldError}>{errors.correo.message}</Text>}

        <Text style={[styles.label, { marginTop: Spacing.md }]}>Contraseña</Text>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry={!showPassword}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.eyeButton}>
                <Text>{showPassword ? '🙈' : '👁️'}</Text>
              </Pressable>
            </View>
          )}
        />
        {errors.password && <Text style={styles.fieldError}>{errors.password.message}</Text>}

        {serverError && <Text style={styles.serverError}>{serverError}</Text>}

        <Pressable
          style={[styles.button, isSubmitting && styles.buttonDisabled]}
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color={Colors.white} />
          ) : (
            <Text style={styles.buttonLabel}>Iniciar sesión</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  header: {
    height: 220,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  logoCircle: {
    position: 'absolute',
    bottom: -40,
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: { paddingHorizontal: Spacing.lg, paddingTop: 64 },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textBody,
  },
  inputError: { borderColor: Colors.statusCritica },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 44 },
  eyeButton: { position: 'absolute', right: Spacing.md },
  fieldError: { color: Colors.statusCritica, fontSize: 12, marginTop: 4 },
  serverError: {
    color: Colors.statusCritica,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: Spacing.md,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonLabel: { color: Colors.white, fontWeight: '700', fontSize: 16 },
});
