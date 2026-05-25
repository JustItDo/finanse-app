import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/src/shared/theme';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
};

export function AppButton({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
}: AppButtonProps) {
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        isSecondary ? styles.buttonSecondary : styles.buttonPrimary,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.label,
          isSecondary ? styles.labelSecondary : styles.labelPrimary,
          disabled ? styles.labelDisabled : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderWidth: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 16,
    fontWeight: '700',
  },
  labelPrimary: {
    color: colors.surface,
  },
  labelSecondary: {
    color: colors.text,
  },
  labelDisabled: {
    color: colors.textMuted,
  },
});
