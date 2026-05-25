import { useState } from 'react';
import { FontAwesome5 } from '@expo/vector-icons';
import {
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSecurity } from '@/src/features/security/providers/SecurityProvider';
import { AnalysisScreen } from '@/src/features/analysis/screens/AnalysisScreen';
import { BudgetsScreen } from '@/src/features/budgets/screens/BudgetsScreen';
import { DashboardScreen } from '@/src/features/dashboard/screens/DashboardScreen';
import { HistoryScreen } from '@/src/features/history/screens/HistoryScreen';
import { SettingsScreen } from '@/src/features/settings/screens/SettingsScreen';
import { AddTransactionScreen } from '@/src/features/transactions/screens/AddTransactionScreen';
import { colors, spacing, typography } from '@/src/shared/theme';
import { AppButton, AppCard } from '@/src/shared/ui';

export type RootTabParamList = {
  Dashboard: undefined;
  AddTransaction: undefined;
  History: undefined;
  Budgets: undefined;
  Analysis: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const navigationTheme: NavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    card: colors.surface,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
    notification: colors.primary,
  },
};

const tabIcons: Record<
  keyof RootTabParamList,
  keyof typeof FontAwesome5.glyphMap
> = {
  Dashboard: 'chart-pie',
  AddTransaction: 'plus-circle',
  History: 'list-alt',
  Budgets: 'wallet',
  Analysis: 'chart-line',
  Settings: 'shield-alt',
};

export function AppNavigator() {
  const insets = useSafeAreaInsets();
  const navigationRef = useNavigationContainerRef<RootTabParamList>();
  const { shouldPromptSecuritySetup, dismissSecuritySetupPrompt, settings } =
    useSecurity();
  const [hideSetupPromptForSession, setHideSetupPromptForSession] =
    useState(false);

  const showSecuritySetupPrompt =
    shouldPromptSecuritySetup && !settings.hasPin && !hideSetupPromptForSession;

  return (
    <>
      <NavigationContainer ref={navigationRef} theme={navigationTheme}>
        <Tab.Navigator
          initialRouteName="Dashboard"
          screenOptions={({ route }) => ({
            headerShown: false,
            headerStyle: {
              backgroundColor: colors.surface,
            },
            headerTitleStyle: {
              color: colors.text,
            },
            headerShadowVisible: false,
            tabBarActiveTintColor: colors.primary,
            tabBarInactiveTintColor: colors.textMuted,
            tabBarStyle: {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              height: 64 + insets.bottom,
              paddingBottom: Math.max(insets.bottom, 8),
              paddingTop: 8,
            },
            tabBarIcon: ({ color, size }) => (
              <FontAwesome5
                iconStyle="solid"
                name={tabIcons[route.name]}
                color={color}
                size={size - 2}
              />
            ),
          })}
        >
          <Tab.Screen
            name="Dashboard"
            component={DashboardScreen}
            options={{ title: 'Dashboard' }}
          />
          <Tab.Screen
            name="AddTransaction"
            component={AddTransactionScreen}
            options={{ title: 'Dodaj transakcję', tabBarLabel: 'Dodaj' }}
          />
          <Tab.Screen
            name="History"
            component={HistoryScreen}
            options={{ title: 'Historia' }}
          />
          <Tab.Screen
            name="Budgets"
            component={BudgetsScreen}
            options={{ title: 'Budżety' }}
          />
          <Tab.Screen
            name="Analysis"
            component={AnalysisScreen}
            options={{ title: 'Analizy' }}
          />
          <Tab.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Bezpieczeństwo' }}
          />
        </Tab.Navigator>
      </NavigationContainer>

      {showSecuritySetupPrompt ? (
        <View style={styles.promptOverlay}>
          <AppCard>
            <Text style={styles.promptTitle}>Ustawić PIN do aplikacji?</Text>
            <Text style={styles.promptText}>
              Możesz zabezpieczyć wejście PIN-em i opcjonalnie biometrią.
            </Text>
            <View style={styles.promptActions}>
              <AppButton
                label="Tak, ustaw"
                onPress={() => {
                  setHideSetupPromptForSession(true);
                  navigationRef.navigate('Settings');
                }}
              />
              <AppButton
                label="Nie teraz"
                onPress={() => {
                  setHideSetupPromptForSession(true);
                  void dismissSecuritySetupPrompt();
                }}
                variant="secondary"
              />
            </View>
          </AppCard>
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  promptOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(31, 41, 51, 0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  promptTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  promptText: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
  },
  promptActions: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
