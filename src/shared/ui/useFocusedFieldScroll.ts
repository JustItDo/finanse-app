import { useRef } from 'react';
import {
  findNodeHandle,
  type LayoutChangeEvent,
  type TextInput,
} from 'react-native';

import { spacing } from '@/src/shared/theme';

type UseFocusedFieldScrollOptions = {
  delayMs?: number;
  scrollToTarget?: (target: number, topOffset: number) => void;
  topOffset?: number;
};

export function useFocusedFieldScroll(
  scrollToY: (y: number) => void,
  options: UseFocusedFieldScrollOptions = {},
) {
  const fieldOffsetsRef = useRef<Record<string, number>>({});
  const fieldRefsRef = useRef<Record<string, TextInput | null>>({});
  const topOffset = options.topOffset ?? spacing.xxl + spacing.xl + 60 + spacing.md;
  const delayMs = options.delayMs ?? 120;

  const registerField = (fieldId: string) => (event: LayoutChangeEvent) => {
    fieldOffsetsRef.current[fieldId] = event.nativeEvent.layout.y;
  };

  const setFieldOffset = (fieldId: string, y: number) => {
    fieldOffsetsRef.current[fieldId] = y;
  };

  const registerInputRef = (fieldId: string) => (input: TextInput | null) => {
    fieldRefsRef.current[fieldId] = input;
  };

  const scrollToField = (fieldId: string) => {
    setTimeout(() => {
      const input = fieldRefsRef.current[fieldId];
      const target = input ? findNodeHandle(input) : null;

      if (target && options.scrollToTarget) {
        options.scrollToTarget(target, topOffset);
        return;
      }

      const y = fieldOffsetsRef.current[fieldId];

      if (typeof y !== 'number') {
        return;
      }

      scrollToY(Math.max(y - topOffset, 0));
    }, delayMs);
  };

  const createFocusHandler = (fieldId: string) => () => {
    scrollToField(fieldId);
  };

  return {
    createFocusHandler,
    registerField,
    registerInputRef,
    setFieldOffset,
    scrollToField,
  };
}
