import { useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  normalizePin,
  SECURITY_SESSION_GRACE_PERIOD_MINUTES,
} from '@/src/features/security/data/security';
import { useSecurity } from '@/src/features/security/providers/SecurityProvider';
import { colors, spacing, typography } from '@/src/shared/theme';
import {
  AppButton,
  AppCard,
  AppInput,
  useFocusedFieldScroll,
  useScreenContentInsets,
} from '@/src/shared/ui';

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
  const { contentBottomPadding, contentTopPadding } = useScreenContentInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const scrollToKeyboardTarget = (target: number, topOffset: number) => {
    scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard?.(
      target,
      topOffset,
      true,
    );
  };
  const { createFocusHandler, registerField, registerInputRef } =
    useFocusedFieldScroll(
      (y) => {
        scrollRef.current?.scrollTo({ animated: true, y });
      },
      { scrollToTarget: scrollToKeyboardTarget },
    );
  const {
    capabilities,
    enablePin,
    settings,
    changePin,
    disableSecurity,
    disableBiometricsWithBiometrics,
    disableBiometricsWithPin,
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
  const [disableBiometricPin, setDisableBiometricPin] = useState('');
  const [showDisableBiometricConfirm, setShowDisableBiometricConfirm] =
    useState(false);

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
    if (settings.biometricEnabled) {
      clearMessages();
      setShowDisableBiometricConfirm(true);
      return;
    }

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

  const handleDisableBiometricsWithBiometrics = async () => {
    clearMessages();
    setIsSaving(true);

    try {
      const disabled = await disableBiometricsWithBiometrics();

      if (!disabled) {
        setErrorMessage('Nie udało się potwierdzić wyłączenia biometrii.');
        return;
      }

      setShowDisableBiometricConfirm(false);
      setDisableBiometricPin('');
      setFeedback('Biometria wyłączona.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisableBiometricsWithPin = async () => {
    clearMessages();
    setIsSaving(true);

    try {
      const disabled = await disableBiometricsWithPin(disableBiometricPin);

      if (!disabled) {
        setErrorMessage('PIN jest nieprawidłowy.');
        setDisableBiometricPin('');
        return;
      }

      setShowDisableBiometricConfirm(false);
      setDisableBiometricPin('');
      setFeedback('Biometria wyłączona.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <ScrollView
        ref={scrollRef}
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomPadding, paddingTop: contentTopPadding },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Bezpieczeństwo</Text>
          <Text style={styles.description}>
            PIN i biometria chronią wejście do aplikacji po dłuższej przerwie.
          </Text>
        </View>

        <AppCard>
          <Text style={styles.sectionTitle}>Stan ochrony</Text>
          <View style={styles.metricList}>
            <SecurityRow
              label="Wejście do aplikacji"
              value={protectionSummary}
            />
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
              <View onLayout={registerField('enable_new_pin')}>
                <AppInput
                  ref={registerInputRef('enable_new_pin')}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => setNewPin(normalizePin(value))}
                  onFocus={createFocusHandler('enable_new_pin')}
                  placeholder="4 cyfry"
                  secureTextEntry
                  value={newPin}
                />
              </View>
            </View>

            <View style={styles.formBlock}>
              <Text style={styles.label}>Powtórz PIN</Text>
              <View onLayout={registerField('enable_confirm_pin')}>
                <AppInput
                  ref={registerInputRef('enable_confirm_pin')}
                  inputMode="numeric"
                  keyboardType="number-pad"
                  maxLength={4}
                  onChangeText={(value) => setConfirmPin(normalizePin(value))}
                  onFocus={createFocusHandler('enable_confirm_pin')}
                  placeholder="Powtórz PIN"
                  secureTextEntry
                  value={confirmPin}
                />
              </View>
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
                <View onLayout={registerField('change_current_pin')}>
                  <AppInput
                    ref={registerInputRef('change_current_pin')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setCurrentPin(normalizePin(value))}
                    onFocus={createFocusHandler('change_current_pin')}
                    placeholder="Aktualny PIN"
                    secureTextEntry
                    value={currentPin}
                  />
                </View>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.label}>Nowy PIN</Text>
                <View onLayout={registerField('change_next_pin')}>
                  <AppInput
                    ref={registerInputRef('change_next_pin')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setNextPin(normalizePin(value))}
                    onFocus={createFocusHandler('change_next_pin')}
                    placeholder="Nowy PIN"
                    secureTextEntry
                    value={nextPin}
                  />
                </View>
              </View>

              <View style={styles.formBlock}>
                <Text style={styles.label}>Powtórz nowy PIN</Text>
                <View onLayout={registerField('change_confirm_pin')}>
                  <AppInput
                    ref={registerInputRef('change_confirm_pin')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) =>
                      setConfirmNextPin(normalizePin(value))
                    }
                    onFocus={createFocusHandler('change_confirm_pin')}
                    placeholder="Powtórz nowy PIN"
                    secureTextEntry
                    value={confirmNextPin}
                  />
                </View>
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
                      : 'Włącz biometrię'
                  }
                  onPress={handleToggleBiometrics}
                />

                {settings.biometricEnabled && showDisableBiometricConfirm ? (
                  <View style={styles.confirmationBox}>
                    <Text style={styles.helperText}>
                      Potwierdź wyłączenie biometrii palcem albo PIN-em.
                    </Text>
                    <AppButton
                      disabled={isSaving}
                      label="Potwierdź biometrią"
                      onPress={handleDisableBiometricsWithBiometrics}
                    />
                    <View style={styles.formBlock}>
                      <Text style={styles.label}>PIN</Text>
                      <View onLayout={registerField('disable_biometric_pin')}>
                        <AppInput
                          ref={registerInputRef('disable_biometric_pin')}
                          inputMode="numeric"
                          keyboardType="number-pad"
                          maxLength={4}
                          onChangeText={(value) =>
                            setDisableBiometricPin(normalizePin(value))
                          }
                          onFocus={createFocusHandler('disable_biometric_pin')}
                          placeholder="Wpisz PIN"
                          secureTextEntry
                          value={disableBiometricPin}
                        />
                      </View>
                    </View>
                    <View style={styles.inlineActions}>
                      <View style={styles.inlineAction}>
                        <AppButton
                          disabled={
                            isSaving || disableBiometricPin.length !== 4
                          }
                          label="Potwierdź PIN-em"
                          onPress={handleDisableBiometricsWithPin}
                          variant="secondary"
                        />
                      </View>
                      <View style={styles.inlineAction}>
                        <AppButton
                          disabled={isSaving}
                          label="Anuluj"
                          onPress={() => {
                            setShowDisableBiometricConfirm(false);
                            setDisableBiometricPin('');
                            clearMessages();
                          }}
                          variant="secondary"
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
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
                <View onLayout={registerField('disable_security_pin')}>
                  <AppInput
                    ref={registerInputRef('disable_security_pin')}
                    inputMode="numeric"
                    keyboardType="number-pad"
                    maxLength={4}
                    onChangeText={(value) => setDisablePin(normalizePin(value))}
                    onFocus={createFocusHandler('disable_security_pin')}
                    placeholder="Aktualny PIN"
                    secureTextEntry
                    value={disablePin}
                  />
                </View>
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
    </KeyboardAvoidingView>
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
  confirmationBox: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: spacing.md,
    borderWidth: 1,
    gap: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  inlineActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineAction: {
    flex: 1,
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
