import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { normalizePin } from '@/src/features/security/data/security';
import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard } from '@/src/shared/ui';

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
  const inputRef = useRef<TextInput | null>(null);
  const showBiometricAction = biometricEnabled && biometricAvailable;
  const description = showBiometricAction
    ? 'Po przerwie wrócisz tu PIN-em lub biometrią.'
    : 'Po przerwie wrócisz tu PIN-em.';
  const focusPinInput = () => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  useEffect(() => {
    focusPinInput();
  }, []);

  useEffect(() => {
    if (!isUnlocking) {
      focusPinInput();
    }
  }, [isUnlocking]);

  const submitPin = async () => {
    setErrorMessage(null);
    const unlocked = await onUnlockWithPin(pin);

    if (!unlocked) {
      setErrorMessage('PIN jest nieprawidłowy.');
      setPin('');
      focusPinInput();
    }
  };

  const submitBiometrics = async () => {
    setErrorMessage(null);
    const unlocked = await onUnlockWithBiometrics();

    if (!unlocked) {
      setErrorMessage(
        `Nie udało się potwierdzić ${biometricLabel.toLowerCase()}.`,
      );
      focusPinInput();
    }
  };

  return (
    <View style={styles.overlay}>
      <AppCard>
        <Text style={styles.title}>Odblokuj aplikację</Text>
        <Text style={styles.description}>{description}</Text>

        {showBiometricAction ? (
          <View style={styles.biometricSection}>
            <AppButton
              disabled={isUnlocking}
              label="Użyj biometrii"
              onPress={submitBiometrics}
            />
            <Text style={styles.dividerText}>albo PIN</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          <Text style={styles.label}>PIN</Text>
          <Pressable onPress={focusPinInput} style={styles.pinFieldPressable}>
            <View style={styles.pinSlots}>
              {Array.from({ length: 4 }, (_, index) => {
                const filled = index < pin.length;

                return (
                  <View key={index} style={styles.pinSlot}>
                    <View
                      style={[
                        styles.pinSlotLine,
                        filled ? styles.pinSlotLineFilled : null,
                      ]}
                    />
                    {filled ? <View style={styles.pinDot} /> : null}
                  </View>
                );
              })}
            </View>
            <TextInput
              ref={inputRef}
              autoCapitalize="none"
              autoCorrect={false}
              caretHidden
              contextMenuHidden
              editable={!isUnlocking}
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => setPin(normalizePin(value))}
              onSubmitEditing={submitPin}
              secureTextEntry
              style={styles.hiddenInput}
              value={pin}
            />
          </Pressable>
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
  pinFieldPressable: {
    alignSelf: 'stretch',
  },
  pinSlots: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  pinSlot: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    height: 68,
    justifyContent: 'center',
    position: 'relative',
  },
  pinSlotLine: {
    backgroundColor: colors.textMuted,
    borderRadius: radius.pill,
    height: 3,
    width: 18,
  },
  pinSlotLineFilled: {
    backgroundColor: colors.primary,
    opacity: 0,
  },
  pinDot: {
    backgroundColor: colors.text,
    borderRadius: radius.pill,
    height: 12,
    position: 'absolute',
    width: 12,
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    color: 'transparent',
    opacity: 0.02,
    position: 'absolute',
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
