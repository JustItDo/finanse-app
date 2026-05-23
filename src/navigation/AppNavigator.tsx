import { FontAwesome5 } from '@expo/vector-icons';
import {
  DefaultTheme,
  NavigationContainer,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { BudgetsScreen } from '@/src/features/budgets/screens/BudgetsScreen';
import { DashboardScreen } from '@/src/features/dashboard/screens/DashboardScreen';
import { HistoryScreen } from '@/src/features/history/screens/HistoryScreen';
import { SettingsScreen } from '@/src/features/settings/screens/SettingsScreen';
import { AddTransactionScreen } from '@/src/features/transactions/screens/AddTransactionScreen';
import { colors } from '@/src/shared/theme';

export type RootTabParamList = {
  Dashboard: undefined;
  AddTransaction: undefined;
  History: undefined;
  Budgets: undefined;
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

const tabIcons: Record<keyof RootTabParamList, keyof typeof FontAwesome5.glyphMap> = {
  Dashboard: 'chart-pie',
  AddTransaction: 'plus-circle',
  History: 'list-alt',
  Budgets: 'wallet',
  Settings: 'cog',
};

export function AppNavigator() {
  return (
    <NavigationContainer theme={navigationTheme}>
      <Tab.Navigator
        initialRouteName="Dashboard"
        screenOptions={({ route }) => ({
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
            height: 64,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5 iconStyle="solid" name={tabIcons[route.name]} color={color} size={size - 2} />
          ),
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
        <Tab.Screen
          name="AddTransaction"
          component={AddTransactionScreen}
          options={{ title: 'Dodaj transakcję', tabBarLabel: 'Dodaj' }}
        />
        <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Historia' }} />
        <Tab.Screen name="Budgets" component={BudgetsScreen} options={{ title: 'Budżety' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: 'Ustawienia' }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
