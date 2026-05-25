import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  normalizePin,
  SECURITY_SESSION_GRACE_PERIOD_MINUTES,
} from '@/src/features/security/data/security';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
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
  const showBiometricAction = biometricEnabled && biometricAvailable;

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
        <View style={styles.pillRow}>
          <StatusPill
            label={`Sesja ${SECURITY_SESSION_GRACE_PERIOD_MINUTES} min`}
          />
          {showBiometricAction ? (
            <StatusPill label={biometricLabel} tone="positive" />
          ) : null}
        </View>
        <Text style={styles.title}>Odblokuj aplikację</Text>
        <Text style={styles.description}>
          Po przerwie wrócisz tu PIN-em albo biometrią.
        </Text>

        {showBiometricAction ? (
          <View style={styles.biometricSection}>
            <AppButton
              disabled={isUnlocking}
              label={`Użyj ${biometricLabel}`}
              onPress={submitBiometrics}
            />
            <Text style={styles.dividerText}>albo PIN</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>
            {showBiometricAction ? 'PIN zapasowy' : 'PIN'}
          </Text>
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
            style={styles.pinInput}
            value={pin}
          />
          {showBiometricAction ? (
            <Text style={styles.pinHint}>
              Użyj go tylko, gdy biometria nie zadziała.
            </Text>
          ) : null}
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
            label={showBiometricAction ? 'Odblokuj PIN-em' : 'Odblokuj'}
            onPress={submitPin}
            variant={showBiometricAction ? 'secondary' : 'primary'}
          />
        </View>
      </AppCard>
    </View>
  );
}

function StatusPill({
  label,
  tone = 'default',
}: {
  label: string;
  tone?: 'default' | 'positive';
}) {
  return (
    <View
      style={[styles.pill, tone === 'positive' ? styles.pillPositive : null]}
    >
      <Text
        style={[
          styles.pillLabel,
          tone === 'positive' ? styles.pillLabelPositive : null,
        ]}
      >
        {label}
      </Text>
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
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '700',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillPositive: {
    backgroundColor: colors.primarySoft,
  },
  pillLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
  },
  pillLabelPositive: {
    color: colors.primary,
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  biometricSection: {
    gap: spacing.sm,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: typography.caption,
    textAlign: 'center',
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
  pinInput: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 10,
    paddingHorizontal: spacing.md,
    textAlign: 'center',
  },
  pinHint: {
    color: colors.textMuted,
    fontSize: typography.caption,
  },
});
