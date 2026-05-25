import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';

import { SecurityProvider } from '@/src/features/security/providers/SecurityProvider';
import { AppNavigator } from '@/src/navigation/AppNavigator';
import { AppServicesProvider } from '@/src/providers/AppServicesProvider';

export default function App() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar style="dark" />
      <AppServicesProvider>
        <SecurityProvider>
          <AppNavigator />
        </SecurityProvider>
      </AppServicesProvider>
    </SafeAreaProvider>
  );
}
