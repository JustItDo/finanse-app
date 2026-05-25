import { forwardRef } from 'react';
import type { TextInputProps } from 'react-native';
import { StyleSheet, TextInput } from 'react-native';

import { colors, radius, spacing } from '@/src/shared/theme';

export const AppInput = forwardRef<TextInput, TextInputProps>(
  function AppInput(props, ref) {
    const { style, ...rest } = props;

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

const styles = StyleSheet.create({
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
