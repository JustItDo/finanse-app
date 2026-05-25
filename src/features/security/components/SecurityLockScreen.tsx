import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { normalizePin } from '@/src/features/security/data/security';
import { colors, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';

type SecurityLockScreenProps = {
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricLabel: string;
  isUnlocking: boolean;
  onUnlockWithBiometrics: () => Promise<boolean>;
  onUnlockWithPin: (pin: string) => Promise<boolean>;
};

export function SecurityLockScreen({
  biometricAvailable,
  biometricEnabled,
  biometricLabel,
  isUnlocking,
  onUnlockWithBiometrics,
  onUnlockWithPin,
}: SecurityLockScreenProps) {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const submitPin = async () => {
    setErrorMessage(null);
    const unlocked = await onUnlockWithPin(pin);

    if (!unlocked) {
      setErrorMessage('PIN jest nieprawidłowy.');
      setPin('');
    }
  };

  const submitBiometrics = async () => {
    setErrorMessage(null);
    const unlocked = await onUnlockWithBiometrics();

    if (!unlocked) {
      setErrorMessage(
        `Nie udało się potwierdzić ${biometricLabel.toLowerCase()}.`,
      );
    }
  };

  return (
    <View style={styles.overlay}>
      <AppCard>
        <Text style={styles.eyebrow}>Bezpieczeństwo MVP</Text>
        <Text style={styles.title}>Aplikacja jest zablokowana</Text>
        <Text style={styles.description}>
          Dane pozostają lokalnie na urządzeniu, ale po wznowieniu wymagają
          ponownego odblokowania wejścia do aplikacji.
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>PIN</Text>
          <AppInput
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isUnlocking}
            inputMode="numeric"
            keyboardType="number-pad"
            maxLength={4}
            onChangeText={(value) => setPin(normalizePin(value))}
            onSubmitEditing={submitPin}
            placeholder="Wpisz 4-cyfrowy PIN"
            secureTextEntry
            value={pin}
          />
        </View>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {isUnlocking ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} size="small" />
            <Text style={styles.loadingText}>Sprawdzam dostęp...</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            disabled={pin.length !== 4 || isUnlocking}
            label="Odblokuj PIN-em"
            onPress={submitPin}
          />
          {biometricEnabled && biometricAvailable ? (
            <AppButton
              disabled={isUnlocking}
              label={`Użyj ${biometricLabel}`}
              onPress={submitBiometrics}
            />
          ) : null}
        </View>
      </AppCard>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(31, 41, 51, 0.96)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  form: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '600',
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});
