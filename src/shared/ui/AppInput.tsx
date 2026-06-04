import { forwardRef } from 'react';
import type { TextInputProps } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import { radius, spacing, type AppThemeColors } from '@/src/shared/theme';
import { useTheme, useThemeStyles } from '@/src/shared/theme/ThemeProvider';

export const AppInput = forwardRef<TextInput, TextInputProps>(
  function AppInput(props, ref) {
    const { style, ...rest } = props;
    const { colors } = useTheme();
    const styles = useThemeStyles(createStyles);

    return (
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    );
  },
);

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      color: colors.text,
      fontSize: 16,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
  });
}
