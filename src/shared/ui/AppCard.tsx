import type { PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, spacing, type AppThemeColors } from '@/src/shared/theme';
import { useThemeStyles } from '@/src/shared/theme/ThemeProvider';

export function AppCard({ children }: PropsWithChildren) {
  const styles = useThemeStyles(createStyles);

  return <View style={styles.card}>{children}</View>;
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.lg,
      borderWidth: 1,
      gap: spacing.sm,
      padding: spacing.lg,
    },
  });
}
