import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { SecurityProvider } from '@/src/features/security/providers/SecurityProvider';
import { AppNavigator } from '@/src/navigation/AppNavigator';
import { AppServicesProvider } from '@/src/providers/AppServicesProvider';
import { ThemeProvider, useTheme } from '@/src/shared/theme/ThemeProvider';

function ThemedStatusBar() {
  const { resolvedMode } = useTheme();

  return <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <ThemeProvider>
        <ThemedStatusBar />
        <AppServicesProvider>
          <SecurityProvider>
            <AppNavigator />
          </SecurityProvider>
        </AppServicesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
