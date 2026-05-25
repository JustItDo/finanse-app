import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing } from '@/src/shared/theme';

export function useScreenContentInsets(minBottomPadding = spacing.xxl) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  return {
    contentBottomPadding: Math.max(minBottomPadding, tabBarHeight + spacing.lg),
    contentTopPadding: Math.max(insets.top + spacing.sm, spacing.xl),
    insets,
    tabBarHeight,
  };
}
