import { useEffect, useState, type PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';

import {
  radius,
  spacing,
  typography,
  type AppThemeColors,
} from '@/src/shared/theme';
import { useTheme, useThemeStyles } from '@/src/shared/theme/ThemeProvider';
import {
  readCollapsibleSectionState,
  writeCollapsibleSectionState,
} from '@/src/shared/ui/collapsibleSectionState';

type CollapsibleSectionProps = PropsWithChildren<{
  defaultExpanded?: boolean;
  screenId: string;
  sectionId: string;
  summary?: string;
  title: string;
}>;

export function CollapsibleSection({
  children,
  defaultExpanded = true,
  screenId,
  sectionId,
  summary,
  title,
}: CollapsibleSectionProps) {
  const { colors } = useTheme();
  const styles = useThemeStyles(createStyles);
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    let cancelled = false;

    readCollapsibleSectionState(screenId, sectionId).then((storedState) => {
      if (cancelled || storedState === null) {
        return;
      }

      setIsExpanded(storedState);
    });

    return () => {
      cancelled = true;
    };
  }, [screenId, sectionId]);

  const toggleExpanded = () => {
    setIsExpanded((current) => {
      const nextValue = !current;
      void writeCollapsibleSectionState(screenId, sectionId, nextValue);
      return nextValue;
    });
  };

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={toggleExpanded}
        style={styles.header}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {summary ? <Text style={styles.summary}>{summary}</Text> : null}
        </View>
        <View style={styles.iconBox}>
          <FontAwesome5
            color={colors.textMuted}
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={14}
          />
        </View>
      </Pressable>

      {isExpanded ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    body: {
      gap: spacing.sm,
    },
    container: {
      gap: spacing.md,
    },
    header: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.border,
      borderRadius: radius.md,
      borderWidth: 1,
      flexDirection: 'row',
      gap: spacing.md,
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    headerCopy: {
      flex: 1,
      gap: spacing.xs,
    },
    iconBox: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 32,
      width: 32,
    },
    summary: {
      color: colors.textMuted,
      fontSize: typography.caption,
      lineHeight: 18,
    },
    title: {
      color: colors.text,
      fontSize: typography.caption,
      fontWeight: '700',
    },
  });
}
