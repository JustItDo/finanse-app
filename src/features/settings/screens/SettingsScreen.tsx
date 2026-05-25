import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  normalizePin,
  SECURITY_SESSION_GRACE_PERIOD_MINUTES,
} from '@/src/features/security/data/security';
import { useSecurity } from '@/src/features/security/providers/SecurityProvider';
import { colors, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard, AppInput } from '@/src/shared/ui';

function getProtectionSummary(hasPin: boolean, biometricEnabled: boolean) {
  if (!hasPin) {
    return 'Wyłączona';
  }

  if (biometricEnabled) {
    return 'PIN + biometria';
  }

  return 'PIN';
}

export function SettingsScreen() {
  const {
    capabilities,
    enablePin,
    settings,
    changePin,
    disableSecurity,
    setBiometricEnabled,
  } = useSecurity();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirmNextPin, setConfirmNextPin] = useState('');
  const [disablePin, setDisablePin] = useState('');
  const [wantsBiometrics, setWantsBiometrics] = useState(
    capabilities.biometricAvailable,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const protectionSummary = useMemo(
    () => getProtectionSummary(settings.hasPin, settings.biometricEnabled),
    [settings.biometricEnabled, settings.hasPin],
  );

  const clearMessages = () => {
    setFeedback(null);
    setErrorMessage(null);
  };

  const handleEnablePin = async () => {
    clearMessages();

    if (newPin !== confirmPin) {
      setErrorMessage('Powtórzony PIN musi być taki sam.');
      return;
    }

    setIsSaving(true);

    try {
      await enablePin(newPin, wantsBiometrics);
      setNewPin('');
      setConfirmPin('');
      setFeedback('Blokada włączona.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się włączyć blokady.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePin = async () => {
    clearMessages();

    if (nextPin !== confirmNextPin) {
      setErrorMessage('Nowy PIN i powtórzenie muszą być takie same.');
      return;
    }

    setIsSaving(true);

    try {
      await changePin(currentPin, nextPin);
      setCurrentPin('');
      setNextPin('');
      setConfirmNextPin('');
      setFeedback('PIN zmieniony.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Nie udało się zmienić PIN-u.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableSecurity = async () => {
    clearMessages();
    setIsSaving(true);

    try {
      await disableSecurity(disablePin);
      setDisablePin('');
      setFeedback('Blokada wyłączona.');
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się wyłączyć blokady.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBiometrics = async () => {
    clearMessages();
    setIsSaving(true);

    try {
      await setBiometricEnabled(!settings.biometricEnabled);
      setFeedback(
        settings.biometricEnabled
          ? 'Biometria wyłączona.'
          : 'Biometria włączona.',
      );
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zmienić ustawienia biometrii.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.title}>Bezpieczeństwo</Text>
        <Text style={styles.description}>
          PIN i biometria chronią wejście do aplikacji po dłuższej przerwie.
        </Text>
      </View>

      <AppCard>
        <Text style={styles.sectionTitle}>Stan ochrony</Text>
        <View style={styles.metricList}>
          <SecurityRow label="Wejście do aplikacji" value={protectionSummary} />
          <SecurityRow
            label="Blokada po wznowieniu"
            value={
              settings.hasPin && settings.autoLockOnResume
                ? 'Włączona'
                : 'Wyłączona'
            }
          />
          <SecurityRow
            label="Biometria"
            value={
              capabilities.biometricAvailable
                ? settings.biometricEnabled
                  ? 'Włączona'
                  : 'Dostępna, ale wyłączona'
                : 'Niedostępna na tym urządzeniu'
            }
          />
          <SecurityRow
            label="Ochrona danych lokalnych"
            value="PIN jest poza SQLite. Baza i pliki nie są jeszcze szyfrowane."
          />
          {settings.hasPin ? (
            <SecurityRow
              label="Aktywna sesja"
              value={`Do ${SECURITY_SESSION_GRACE_PERIOD_MINUTES} min po odblokowaniu`}
            />
          ) : null}
        </View>
      </AppCard>

      {feedback ? (
        <AppCard>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </AppCard>
      ) : null}

      {errorMessage ? (
        <AppCard>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </AppCard>
      ) : null}

      {!settings.hasPin ? (
        <AppCard>
          <Text style={styles.sectionTitle}>Włącz blokadę aplikacji</Text>
          <Text style={styles.helperText}>
            Ustaw 4 cyfry. Biometrię możesz dodać od razu.
          </Text>

          <View style={styles.formBlock}>
            <Text style={styles.label}>Nowy PIN</Text>
            <AppInput
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => setNewPin(normalizePin(value))}
              placeholder="4 cyfry"
              secureTextEntry
              value={newPin}
            />
          </View>

          <View style={styles.formBlock}>
            <Text style={styles.label}>Powtórz PIN</Text>
            <AppInput
              inputMode="numeric"
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={(value) => setConfirmPin(normalizePin(value))}
              placeholder="Powtórz PIN"
              secureTextEntry
              value={confirmPin}
            />
          </View>

          {capabilities.biometricAvailable ? (
            <AppButton
              disabled={isSaving}
              label={wantsBiometrics ? 'Biometria: tak' : 'Biometria: nie'}
              onPress={() => setWantsBiometrics((current) => !current)}
              variant="secondary"
            />
          ) : null}

          <AppButton
            disabled={
              isSaving || newPin.length !== 4 || confirmPin.length !== 4
            }
            label="Włącz blokadę"
            onPress={handleEnablePin}
          />
        </AppCard>
      ) : (
        <>
          <AppCard>
            <Text style={styles.sectionTitle}>Zmiana PIN-u</Text>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Aktualny PIN</Text>
              <AppInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => setCurrentPin(normalizePin(value))}
                placeholder="Aktualny PIN"
                secureTextEntry
                value={currentPin}
              />
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Nowy PIN</Text>
              <AppInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => setNextPin(normalizePin(value))}
                placeholder="Nowy PIN"
                secureTextEntry
                value={nextPin}
              />
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Powtórz nowy PIN</Text>
              <AppInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => setConfirmNextPin(normalizePin(value))}
                placeholder="Powtórz nowy PIN"
                secureTextEntry
                value={confirmNextPin}
              />
            </View>

            <AppButton
              disabled={
                isSaving ||
                currentPin.length !== 4 ||
                nextPin.length !== 4 ||
                confirmNextPin.length !== 4
              }
              label="Zmień PIN"
              onPress={handleChangePin}
            />
          </AppCard>

          {capabilities.biometricAvailable ? (
            <AppCard>
              <Text style={styles.sectionTitle}>Biometria</Text>
              <Text style={styles.helperText}>
                Przyspiesza wejście. PIN zostaje awaryjnie.
              </Text>
              <AppButton
                disabled={isSaving}
                label={
                  settings.biometricEnabled
                    ? 'Wyłącz biometrię'
                    : `Włącz ${capabilities.biometricLabel}`
                }
                onPress={handleToggleBiometrics}
              />
            </AppCard>
          ) : null}

          <AppCard>
            <Text style={styles.sectionTitle}>Wyłączenie blokady</Text>
            <Text style={styles.helperText}>
              Usuwa lokalny sekret wejścia. Dane w bazie i załącznikach
              pozostają bez dodatkowego szyfrowania tego etapu.
            </Text>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Potwierdź aktualnym PIN-em</Text>
              <AppInput
                inputMode="numeric"
                keyboardType="number-pad"
                maxLength={4}
                onChangeText={(value) => setDisablePin(normalizePin(value))}
                placeholder="Aktualny PIN"
                secureTextEntry
                value={disablePin}
              />
            </View>

            <AppButton
              disabled={isSaving || disablePin.length !== 4}
              label="Wyłącz blokadę"
              onPress={handleDisableSecurity}
            />
          </AppCard>
        </>
      )}
    </ScrollView>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  hero: {
    gap: spacing.sm,
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
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  helperText: {
    color: colors.textMuted,
    lineHeight: 22,
  },
  metricList: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  metricRow: {
    gap: spacing.xs,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  metricValue: {
    color: colors.text,
    lineHeight: 22,
  },
  formBlock: {
    gap: spacing.sm,
  },
  label: {
    color: colors.text,
    fontSize: typography.caption,
    fontWeight: '600',
  },
  feedbackText: {
    color: colors.primary,
    fontWeight: '700',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
});
