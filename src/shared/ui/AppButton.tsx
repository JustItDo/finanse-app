import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/src/shared/theme';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
};

export function AppButton({ label, onPress, disabled = false }: AppButtonProps) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.button, disabled ? styles.buttonDisabled : null]}>
      <Text style={[styles.label, disabled ? styles.labelDisabled : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceMuted,
  },
  label: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
