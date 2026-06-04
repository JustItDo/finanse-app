import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { useAppServices } from '@/src/providers/AppServicesProvider';
import {
  spacing,
  themePaletteOptions,
  typography,
  type AppThemeColors,
  type PaletteId,
  type ThemeMode,
} from '@/src/shared/theme';
import { useTheme, useThemeStyles } from '@/src/shared/theme/ThemeProvider';
import {
  AppButton,
  AppCard,
  AppInput,
  useFocusedFieldScroll,
  useScreenContentInsets,
} from '@/src/shared/ui';
import type {
  BackupExportResult,
  BackupImportResult,
} from '@/src/storage/backup/types';

type SettingsSection =
  | 'home'
  | 'security'
  | 'backup'
  | 'sync'
  | 'themes'
  | 'app';

const themeModeOptions: {
  description: string;
  label: string;
  value: ThemeMode;
}[] = [
  {
    description: 'Podąża za ustawieniem telefonu.',
    label: 'Systemowy',
    value: 'system',
  },
  {
    description: 'Zawsze używa jasnego motywu.',
    label: 'Jasny',
    value: 'light',
  },
  {
    description: 'Zawsze używa ciemnego motywu.',
    label: 'Ciemny',
    value: 'dark',
  },
];

function getProtectionSummary(hasPin: boolean, biometricEnabled: boolean) {
  if (!hasPin) {
    return 'Wyłączona';
  }

  if (biometricEnabled) {
    return 'PIN + biometria';
  }

  return 'PIN';
}

function isPickerCancelledError(error: unknown) {
  return (
    error instanceof Error &&
    error.message.toLowerCase().includes('picker was cancelled')
  );
}

export function SettingsScreen() {
  const isFocusedRef = useRef(false);
  const { paletteId, resolvedMode, setPaletteId, setThemeMode, themeMode } =
    useTheme();
  const styles = useThemeStyles(createStyles);
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
  const { repositories } = useAppServices();

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
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [backupSummary, setBackupSummary] = useState<{
    exportResult?: BackupExportResult;
    importResult?: BackupImportResult;
    kind: 'export' | 'import';
  } | null>(null);
  const [disableBiometricPin, setDisableBiometricPin] = useState('');
  const [showDisableBiometricConfirm, setShowDisableBiometricConfirm] =
    useState(false);
  const [activeSection, setActiveSection] = useState<SettingsSection>('home');

  useFocusEffect(
    useCallback(() => {
      isFocusedRef.current = true;

      return () => {
        isFocusedRef.current = false;
        setActiveSection('home');
        setFeedback(null);
        setErrorMessage(null);
        setBackupSummary(null);
        setShowDisableBiometricConfirm(false);
        setDisableBiometricPin('');
      };
    }, []),
  );

  const protectionSummary = useMemo(
    () => getProtectionSummary(settings.hasPin, settings.biometricEnabled),
    [settings.biometricEnabled, settings.hasPin],
  );
  const themeModeLabel = useMemo(
    () =>
      themeModeOptions.find((option) => option.value === themeMode)?.label ??
      'Systemowy',
    [themeMode],
  );
  const paletteLabel = useMemo(
    () =>
      themePaletteOptions.find((option) => option.id === paletteId)?.name ??
      'Neon Mint',
    [paletteId],
  );
  const themeStatusLabel = useMemo(
    () => `${themeModeLabel} · ${paletteLabel}`,
    [paletteLabel, themeModeLabel],
  );

  const clearMessages = () => {
    setFeedback(null);
    setErrorMessage(null);
    setBackupSummary(null);
  };

  const openSection = (section: SettingsSection) => {
    clearMessages();
    setActiveSection(section);
  };

  const handleThemeModeChange = async (nextThemeMode: ThemeMode) => {
    if (nextThemeMode === themeMode) {
      return;
    }

    clearMessages();

    try {
      await setThemeMode(nextThemeMode);
      setFeedback('Tryb motywu zapisany.');
    } catch {
      setErrorMessage('Nie udało się zapisać trybu motywu.');
    }
  };

  const handlePaletteChange = async (nextPaletteId: PaletteId) => {
    if (nextPaletteId === paletteId) {
      return;
    }

    clearMessages();

    try {
      await setPaletteId(nextPaletteId);
      setFeedback('Kolorystyka aplikacji zapisana.');
    } catch {
      setErrorMessage('Nie udało się zapisać kolorystyki aplikacji.');
    }
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

  const preparedBackup =
    backupSummary?.kind === 'export' ? backupSummary.exportResult : null;

  const handleCreateBackup = async () => {
    clearMessages();
    setIsBackupBusy(true);

    try {
      const result = await repositories.backup.exportBackup();

      if (!isFocusedRef.current) {
        return;
      }

      setBackupSummary({ exportResult: result, kind: 'export' });
      setFeedback(
        `Backup ${result.fileName} jest gotowy. Wybierz zapis do plików albo udostępnienie.`,
      );
    } catch (error: unknown) {
      if (!isFocusedRef.current) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się utworzyć kopii danych.',
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleSaveBackupToFiles = async () => {
    if (!preparedBackup) {
      setErrorMessage('Najpierw utwórz backup.');
      return;
    }

    clearMessages();
    setIsBackupBusy(true);

    try {
      const result =
        await repositories.backup.saveBackupToFiles(preparedBackup);

      if (!isFocusedRef.current) {
        return;
      }

      setFeedback(`Backup zapisany do plików: ${result.fileName}`);
    } catch (error: unknown) {
      if (!isFocusedRef.current) {
        return;
      }

      if (isPickerCancelledError(error)) {
        setFeedback('Zapis backupu został anulowany.');
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zapisać backupu do plików.',
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleShareBackup = async () => {
    if (!preparedBackup) {
      setErrorMessage('Najpierw utwórz backup.');
      return;
    }

    clearMessages();
    setIsBackupBusy(true);

    try {
      await repositories.backup.shareBackup(preparedBackup);

      if (!isFocusedRef.current) {
        return;
      }

      setFeedback('Backup został przekazany do udostępnienia.');
    } catch (error: unknown) {
      if (!isFocusedRef.current) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się udostępnić backupu.',
      );
    } finally {
      setIsBackupBusy(false);
    }
  };

  const handleImportBackup = async () => {
    clearMessages();
    setIsBackupBusy(true);

    try {
      const result = await repositories.backup.importBackup();

      if (!isFocusedRef.current) {
        return;
      }

      if (!result) {
        setFeedback('Import kopii danych został anulowany.');
        return;
      }

      setBackupSummary({ importResult: result, kind: 'import' });
      setFeedback('Import kopii danych zakończony.');
    } catch (error: unknown) {
      if (!isFocusedRef.current) {
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Nie udało się zaimportować kopii danych.',
      );
    } finally {
      setIsBackupBusy(false);
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
          {
            paddingBottom: contentBottomPadding,
            paddingTop: contentTopPadding,
          },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.screen}
      >
        <View style={styles.hero}>
          <Text style={styles.title}>Ustawienia</Text>
          <Text style={styles.description}>
            Centrum konfiguracji aplikacji, danych i lokalnej ochrony finansów.
          </Text>
        </View>

        {activeSection !== 'home' ? (
          <View style={styles.backAction}>
            <AppButton
              label="Wróć do ustawień"
              onPress={() => openSection('home')}
              variant="secondary"
            />
          </View>
        ) : null}

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

        {activeSection === 'home' ? (
          <View style={styles.tileGrid}>
            <SettingsTile
              icon="shield-alt"
              title="Bezpieczeństwo"
              description="PIN, biometria i blokada po wznowieniu."
              status={protectionSummary}
              onPress={() => openSection('security')}
            />
            <SettingsTile
              icon="database"
              title="Backup i dane"
              description="Eksport i import lokalnej kopii ZIP."
              status="Backup lokalny"
              onPress={() => openSection('backup')}
            />
            <SettingsTile
              icon="sync-alt"
              title="Synchronizacja"
              description="Miejsce na przyszłą chmurę i sync."
              status="Niedostępna w MVP"
              onPress={() => openSection('sync')}
            />
            <SettingsTile
              icon="palette"
              title="Motywy"
              description="Tryb ekranu i gotowe palety kolorów."
              status={themeStatusLabel}
              onPress={() => openSection('themes')}
            />
            <SettingsTile
              icon="info-circle"
              title="Aplikacja"
              description="Informacje o wersji, danych i trybie działania."
              status="Zenifi"
              onPress={() => openSection('app')}
            />
          </View>
        ) : null}

        {activeSection === 'security' ? (
          <>
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
                      onChangeText={(value) =>
                        setConfirmPin(normalizePin(value))
                      }
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
                    label={
                      wantsBiometrics ? 'Biometria: tak' : 'Biometria: nie'
                    }
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
                        onChangeText={(value) =>
                          setCurrentPin(normalizePin(value))
                        }
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
                        onChangeText={(value) =>
                          setNextPin(normalizePin(value))
                        }
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

                    {settings.biometricEnabled &&
                    showDisableBiometricConfirm ? (
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
                          <View
                            onLayout={registerField('disable_biometric_pin')}
                          >
                            <AppInput
                              ref={registerInputRef('disable_biometric_pin')}
                              inputMode="numeric"
                              keyboardType="number-pad"
                              maxLength={4}
                              onChangeText={(value) =>
                                setDisableBiometricPin(normalizePin(value))
                              }
                              onFocus={createFocusHandler(
                                'disable_biometric_pin',
                              )}
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
                        onChangeText={(value) =>
                          setDisablePin(normalizePin(value))
                        }
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
          </>
        ) : null}

        {activeSection === 'backup' ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Backup i dane</Text>
            <Text style={styles.helperText}>
              ZIP zawiera finanse i pliki załączników. PIN, biometria i sekrety
              urządzenia nie są eksportowane.
            </Text>
            <View style={styles.metricList}>
              <SecurityRow label="Tryb danych" value="Lokalnie na urządzeniu" />
              <SecurityRow
                label="Format kopii"
                value="ZIP z manifestem, danymi i załącznikami"
              />
              <SecurityRow
                label="Sekrety urządzenia"
                value="Nie są przenoszone w backupie"
              />
            </View>
            <View style={styles.backupActions}>
              <AppButton
                disabled={isBackupBusy || isSaving}
                label={isBackupBusy ? 'Przetwarzam kopię...' : 'Utwórz backup'}
                onPress={handleCreateBackup}
              />
              {preparedBackup ? (
                <View style={styles.inlineActions}>
                  <View style={styles.inlineAction}>
                    <AppButton
                      disabled={isBackupBusy || isSaving}
                      label="Zapisz do plików"
                      onPress={handleSaveBackupToFiles}
                      variant="secondary"
                    />
                  </View>
                  <View style={styles.inlineAction}>
                    <AppButton
                      disabled={isBackupBusy || isSaving}
                      label="Udostępnij"
                      onPress={handleShareBackup}
                      variant="secondary"
                    />
                  </View>
                </View>
              ) : null}
              <AppButton
                disabled={isBackupBusy || isSaving}
                label="Importuj kopię danych"
                onPress={handleImportBackup}
                variant="secondary"
              />
            </View>

            {backupSummary ? (
              <View style={styles.backupSummary}>
                <Text style={styles.label}>
                  {backupSummary.kind === 'export'
                    ? 'Przygotowany backup'
                    : 'Ostatni import'}
                </Text>
                <SecurityRow
                  label="Transakcje"
                  value={String(
                    backupSummary.exportResult?.counts.transactions ??
                      backupSummary.importResult?.counts.transactions ??
                      0,
                  )}
                />
                <SecurityRow
                  label="Kategorie"
                  value={String(
                    backupSummary.exportResult?.counts.categories ??
                      backupSummary.importResult?.counts.categories ??
                      0,
                  )}
                />
                <SecurityRow
                  label="Budżety"
                  value={String(
                    (backupSummary.exportResult?.counts.monthlyBudgets ??
                      backupSummary.importResult?.counts.monthlyBudgets ??
                      0) +
                      (backupSummary.exportResult?.counts.categoryBudgets ??
                        backupSummary.importResult?.counts.categoryBudgets ??
                        0),
                  )}
                />
                <SecurityRow
                  label="Załączniki"
                  value={String(
                    backupSummary.exportResult?.counts.attachments ??
                      backupSummary.importResult?.counts.attachments ??
                      0,
                  )}
                />
                {backupSummary.importResult?.warnings.map((warning) => (
                  <Text key={warning} style={styles.warningText}>
                    {warning}
                  </Text>
                ))}
              </View>
            ) : null}
          </AppCard>
        ) : null}

        {activeSection === 'sync' ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Synchronizacja</Text>
            <Text style={styles.helperText}>
              Synchronizacja nie jest częścią MVP. Dane pozostają lokalnie, a
              przenoszenie między urządzeniami odbywa się ręcznym backupem ZIP.
            </Text>
            <View style={styles.metricList}>
              <SecurityRow label="Status" value="Niedostępna w MVP" />
              <SecurityRow label="Konta użytkownika" value="Nie wdrożone" />
              <SecurityRow
                label="Obecna alternatywa"
                value="Eksport i import w Backup i dane"
              />
            </View>
          </AppCard>
        ) : null}

        {activeSection === 'themes' ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Motywy</Text>
            <Text style={styles.helperText}>
              Wybierz tryb ekranu i gotową kolorystykę. Te ustawienia są
              niezależne.
            </Text>
            <View style={styles.themeBlock}>
              <Text style={styles.label}>Tryb aplikacji</Text>
              <View style={styles.themeOptions}>
                {themeModeOptions.map((option) => (
                  <ThemeModeOption
                    active={themeMode === option.value}
                    description={option.description}
                    key={option.value}
                    label={option.label}
                    onPress={() => {
                      void handleThemeModeChange(option.value);
                    }}
                  />
                ))}
              </View>
              <SecurityRow
                label="Aktywny tryb"
                value={resolvedMode === 'dark' ? 'Ciemny' : 'Jasny'}
              />
              <SecurityRow label="Zapisany wybór" value={themeModeLabel} />
            </View>
            <View style={styles.themeBlock}>
              <Text style={styles.label}>Kolorystyka</Text>
              <View style={styles.paletteOptions}>
                {themePaletteOptions.map((option) => (
                  <PaletteOption
                    active={paletteId === option.id}
                    description={option.description}
                    key={option.id}
                    name={option.name}
                    onPress={() => {
                      void handlePaletteChange(option.id);
                    }}
                    swatches={option.swatches}
                  />
                ))}
              </View>
              <SecurityRow label="Aktywna paleta" value={paletteLabel} />
            </View>
          </AppCard>
        ) : null}

        {activeSection === 'app' ? (
          <AppCard>
            <Text style={styles.sectionTitle}>Aplikacja</Text>
            <Text style={styles.helperText}>
              Zenifi działa jako lokalna aplikacja offline-first do codziennej
              kontroli finansów.
            </Text>
            <View style={styles.metricList}>
              <SecurityRow label="Nazwa" value="Zenifi" />
              <SecurityRow label="Wersja" value="1.0.0" />
              <SecurityRow label="Tryb danych" value="Offline-first" />
              <SecurityRow label="Platforma" value="Expo SDK 56" />
            </View>
          </AppCard>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ThemeModeOption({
  active,
  description,
  label,
  onPress,
}: {
  active: boolean;
  description: string;
  label: string;
  onPress: () => void;
}) {
  const styles = useThemeStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.themeOption, active ? styles.themeOptionActive : null]}
    >
      <Text
        style={[
          styles.themeOptionLabel,
          active ? styles.themeOptionLabelActive : null,
        ]}
      >
        {label}
      </Text>
      <Text style={styles.themeOptionDescription}>{description}</Text>
    </Pressable>
  );
}

function PaletteOption({
  active,
  description,
  name,
  onPress,
  swatches,
}: {
  active: boolean;
  description: string;
  name: string;
  onPress: () => void;
  swatches: string[];
}) {
  const styles = useThemeStyles(createStyles);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.paletteOption, active ? styles.paletteOptionActive : null]}
    >
      <View style={styles.paletteOptionHeader}>
        <Text
          style={[
            styles.paletteOptionName,
            active ? styles.paletteOptionNameActive : null,
          ]}
        >
          {name}
        </Text>
        {active ? (
          <Text style={styles.paletteOptionStatus}>Wybrana</Text>
        ) : null}
      </View>
      <Text style={styles.paletteOptionDescription}>{description}</Text>
      <View style={styles.paletteSwatches}>
        {swatches.map((swatch) => (
          <View
            key={swatch}
            style={[styles.paletteSwatch, { backgroundColor: swatch }]}
          />
        ))}
      </View>
    </Pressable>
  );
}

function SettingsTile({
  description,
  icon,
  onPress,
  status,
  title,
}: {
  description: string;
  icon: keyof typeof FontAwesome5.glyphMap;
  onPress: () => void;
  status: string;
  title: string;
}) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <View style={styles.tileIcon}>
        <FontAwesome5
          color={colors.primary}
          iconStyle="solid"
          name={icon}
          size={16}
        />
      </View>
      <View style={styles.tileCopy}>
        <Text style={styles.tileTitle}>{title}</Text>
        <Text style={styles.tileDescription}>{description}</Text>
        <Text style={styles.tileStatus}>{status}</Text>
      </View>
      <FontAwesome5 color={colors.textMuted} name="chevron-right" size={13} />
    </Pressable>
  );
}

function SecurityRow({ label, value }: { label: string; value: string }) {
  const styles = useThemeStyles(createStyles);

  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
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
    backAction: {
      alignSelf: 'flex-start',
    },
    tileGrid: {
      gap: spacing.md,
    },
    tile: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: spacing.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
    },
    tileIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: spacing.md,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
    tileCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    tileTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    tileDescription: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    tileStatus: {
      color: colors.primary,
      fontSize: typography.caption,
      fontWeight: '700',
    },
    metricList: {
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    backupActions: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    backupSummary: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    themeBlock: {
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    themeOptions: {
      gap: spacing.sm,
    },
    paletteOptions: {
      gap: spacing.sm,
    },
    themeOption: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: spacing.md,
      borderWidth: 1,
      gap: spacing.xs,
      padding: spacing.md,
    },
    themeOptionActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    themeOptionLabel: {
      color: colors.text,
      fontWeight: '700',
    },
    themeOptionLabelActive: {
      color: colors.primary,
    },
    themeOptionDescription: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    paletteOption: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: spacing.md,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.md,
    },
    paletteOptionActive: {
      backgroundColor: colors.primarySoft,
      borderColor: colors.primary,
    },
    paletteOptionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'space-between',
    },
    paletteOptionName: {
      color: colors.text,
      flex: 1,
      fontWeight: '700',
    },
    paletteOptionNameActive: {
      color: colors.primary,
    },
    paletteOptionStatus: {
      color: colors.primary,
      fontSize: typography.caption,
      fontWeight: '700',
    },
    paletteOptionDescription: {
      color: colors.textMuted,
      lineHeight: 20,
    },
    paletteSwatches: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    paletteSwatch: {
      borderColor: colors.border,
      borderRadius: spacing.xs,
      borderWidth: 1,
      flex: 1,
      height: 28,
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
    warningText: {
      color: colors.textMuted,
      lineHeight: 20,
    },
  });
}
