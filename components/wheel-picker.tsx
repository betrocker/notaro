import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";

export type WheelPickerValue = string | number;

export type WheelPickerOption<T extends WheelPickerValue = string> = {
  value: T;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
};

export type WheelPickerClassNames = {
  optionItem?: string;
  highlightWrapper?: string;
  highlightItem?: string;
};

export type WheelPickerProps<T extends WheelPickerValue = string> = {
  defaultValue?: T;
  value?: T;
  onValueChange?: (value: T) => void;
  options: WheelPickerOption<T>[];
  infinite?: boolean;
  visibleCount?: number;
  dragSensitivity?: number;
  scrollSensitivity?: number;
  optionItemHeight?: number;
  classNames?: WheelPickerClassNames;
  style?: StyleProp<ViewStyle>;
  itemTextStyle?: StyleProp<TextStyle>;
};

export type WheelPickerWrapperProps = {
  className?: string;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

type InternalPickerItem<T extends WheelPickerValue> = {
  key: string;
  value: T;
  label: ReactNode;
  textValue?: string;
  disabled?: boolean;
  baseIndex: number;
  loopIndex: number;
};

function normalizeVisibleCount(value?: number) {
  if (!value || Number.isNaN(value)) {
    return 7;
  }

  const rounded = Math.max(5, Math.round(value));
  if (rounded % 2 === 1) {
    return rounded;
  }
  return rounded + 1;
}

function getDisplayLabel<T extends WheelPickerValue>(option: WheelPickerOption<T>) {
  if (typeof option.label === "string" || typeof option.label === "number") {
    return option.label;
  }
  if (typeof option.textValue === "string" && option.textValue.trim().length > 0) {
    return option.textValue;
  }
  return String(option.value);
}

function findEnabledIndex<T extends WheelPickerValue>(
  items: InternalPickerItem<T>[],
  startIndex: number,
) {
  const current = items[startIndex];
  if (!current) {
    return startIndex;
  }
  if (!current.disabled) {
    return startIndex;
  }

  for (let step = 1; step < items.length; step += 1) {
    const up = startIndex + step;
    if (up < items.length && !items[up]?.disabled) {
      return up;
    }

    const down = startIndex - step;
    if (down >= 0 && !items[down]?.disabled) {
      return down;
    }
  }

  return startIndex;
}

export const WheelPickerWrapper: React.FC<WheelPickerWrapperProps> = ({
  className,
  style,
  children,
}) => {
  return (
    <View className={className} style={[styles.wrapper, style]}>
      {children}
    </View>
  );
};

type WheelTextRowProps = {
  label: string | number;
  optionItemHeight: number;
  itemTextStyle?: StyleProp<TextStyle>;
  focused: boolean;
  disabled?: boolean;
  distanceFromCenter: number;
};

const WheelTextRow = React.memo(
  ({
    label,
    optionItemHeight,
    itemTextStyle,
    focused,
    disabled,
    distanceFromCenter,
  }: WheelTextRowProps) => {
    const absoluteDistance = Math.abs(distanceFromCenter);
    const clampedDistance = Math.max(-3, Math.min(3, distanceFromCenter));
    const opacity = focused ? 1 : absoluteDistance <= 1 ? 0.62 : 0.46;
    const rotateXDeg = Platform.OS === "android" ? 0 : clampedDistance * -10;
    const scale =
      Platform.OS === "android"
        ? 1
        : focused
          ? 1
          : absoluteDistance <= 1
            ? 0.95
            : 0.9;

    return (
      <View
        style={[
          styles.row,
          { height: optionItemHeight },
          disabled ? styles.rowDisabled : null,
        ]}
      >
        <Text
          style={[
            styles.itemText,
            {
              height: optionItemHeight,
              lineHeight: optionItemHeight,
              textAlignVertical: "center",
              opacity,
              backfaceVisibility: "hidden",
              transform: [
                ...(Platform.OS === "android"
                  ? []
                  : [
                      { perspective: 900 },
                      { rotateX: `${rotateXDeg}deg` },
                    ]),
                { scale },
                { translateY: Platform.OS === "android" ? -1 : -0.5 },
              ],
            },
            itemTextStyle,
            focused ? styles.itemTextFocused : styles.itemTextUnfocused,
          ]}
        >
          {label}
        </Text>
      </View>
    );
  },
  (prev, next) =>
    prev.label === next.label &&
    prev.optionItemHeight === next.optionItemHeight &&
    prev.itemTextStyle === next.itemTextStyle &&
    prev.focused === next.focused &&
    prev.disabled === next.disabled &&
    prev.distanceFromCenter === next.distanceFromCenter,
);

export function WheelPicker<T extends WheelPickerValue>({
  defaultValue,
  value: valueProp,
  onValueChange,
  options,
  infinite = false,
  visibleCount = 7,
  optionItemHeight = 40,
  style,
  itemTextStyle,
}: WheelPickerProps<T>) {
  const normalizedVisibleCount = normalizeVisibleCount(visibleCount);
  const sideRows = Math.floor(normalizedVisibleCount / 2);
  const pickerHeight = normalizedVisibleCount * optionItemHeight;

  const baseOptions = useMemo(() => options.slice(), [options]);
  const fallbackValue = baseOptions.find((option) => !option.disabled)?.value;
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState<T | undefined>(
    defaultValue ?? fallbackValue,
  );
  const currentValue = (isControlled ? valueProp : uncontrolledValue) ?? fallbackValue;

  useEffect(() => {
    if (isControlled || uncontrolledValue !== undefined) {
      return;
    }

    if (fallbackValue !== undefined) {
      setUncontrolledValue(fallbackValue);
    }
  }, [fallbackValue, isControlled, uncontrolledValue]);

  const repeatCount = useMemo(() => {
    if (!infinite || baseOptions.length <= 1) {
      return 1;
    }

    return 48;
  }, [baseOptions.length, infinite]);

  const centerLoopIndex = Math.floor(repeatCount / 2);

  const pickerItems = useMemo<InternalPickerItem<T>[]>(() => {
    if (baseOptions.length === 0) {
      return [];
    }

    const total = baseOptions.length * repeatCount;
    return Array.from({ length: total }, (_, index) => {
      const baseIndex = index % baseOptions.length;
      const loopIndex = Math.floor(index / baseOptions.length);
      const option = baseOptions[baseIndex] ?? baseOptions[0];
      const token = `${String(option.value)}-${loopIndex}-${baseIndex}`;

      return {
        key: token,
        value: option.value,
        label: option.label,
        textValue: option.textValue,
        disabled: option.disabled,
        baseIndex,
        loopIndex,
      };
    });
  }, [baseOptions, repeatCount]);

  const getBaseIndexForValue = useCallback(
    (nextValue: T | undefined) => {
      const found = baseOptions.findIndex((option) => option.value === nextValue);
      return found >= 0 ? found : 0;
    },
    [baseOptions],
  );

  const initialIndex = useMemo(() => {
    if (pickerItems.length === 0 || baseOptions.length === 0) {
      return 0;
    }
    const baseIndex = getBaseIndexForValue(currentValue);
    return centerLoopIndex * baseOptions.length + baseIndex;
  }, [baseOptions.length, centerLoopIndex, currentValue, getBaseIndexForValue, pickerItems.length]);

  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [visualCenterIndex, setVisualCenterIndex] = useState(initialIndex);
  const listRef = useRef<FlatList<InternalPickerItem<T>> | null>(null);
  const currentOffsetRef = useRef(initialIndex * optionItemHeight);
  const visualCenterIndexRef = useRef(initialIndex);
  const momentumActiveRef = useRef(false);

  const emitValue = useCallback(
    (item: InternalPickerItem<T>) => {
      if (item.disabled) {
        return;
      }

      if (!isControlled) {
        setUncontrolledValue(item.value);
      }
      onValueChange?.(item.value);
    },
    [isControlled, onValueChange],
  );

  const snapToIndex = useCallback(
    (rawIndex: number, animated: boolean) => {
      if (pickerItems.length === 0 || baseOptions.length === 0) {
        return;
      }

      const bounded = Math.max(0, Math.min(rawIndex, pickerItems.length - 1));
      const enabledIndex = findEnabledIndex(pickerItems, bounded);
      const picked = pickerItems[enabledIndex];
      if (!picked) {
        return;
      }

      let targetIndex = enabledIndex;
      if (infinite) {
        const centerIndex = centerLoopIndex * baseOptions.length + picked.baseIndex;
        const nearStart = enabledIndex < baseOptions.length * 2;
        const nearEnd = enabledIndex > pickerItems.length - baseOptions.length * 3;
        if (nearStart || nearEnd) {
          targetIndex = centerIndex;
        }
      }

      const targetItem = pickerItems[targetIndex] ?? picked;
      setSelectedIndex(targetIndex);
      visualCenterIndexRef.current = targetIndex;
      setVisualCenterIndex(targetIndex);
      emitValue(targetItem);

      const nextOffset = targetIndex * optionItemHeight;
      const prevOffset = currentOffsetRef.current;
      currentOffsetRef.current = nextOffset;

      if (Math.abs(nextOffset - prevOffset) < 0.5) {
        return;
      }

      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({
          offset: nextOffset,
          animated,
        });
      });
    },
    [
      baseOptions.length,
      centerLoopIndex,
      emitValue,
      infinite,
      optionItemHeight,
      pickerItems,
    ],
  );

  useEffect(() => {
    if (pickerItems.length === 0 || baseOptions.length === 0) {
      setSelectedIndex(0);
      setVisualCenterIndex(0);
      currentOffsetRef.current = 0;
      visualCenterIndexRef.current = 0;
      return;
    }

    const baseIndex = getBaseIndexForValue(currentValue);
    const nextIndex = centerLoopIndex * baseOptions.length + baseIndex;
    setSelectedIndex(nextIndex);
    setVisualCenterIndex(nextIndex);
    const nextOffset = nextIndex * optionItemHeight;
    currentOffsetRef.current = nextOffset;
    visualCenterIndexRef.current = nextIndex;

    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: nextOffset,
        animated: false,
      });
    });
  }, [
    baseOptions.length,
    centerLoopIndex,
    currentValue,
    getBaseIndexForValue,
    optionItemHeight,
    pickerItems.length,
  ]);

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextOffset = event.nativeEvent.contentOffset.y;
    currentOffsetRef.current = nextOffset;

    const rawIndex = Math.round(nextOffset / optionItemHeight);
    const boundedIndex = Math.max(0, Math.min(rawIndex, pickerItems.length - 1));
    if (boundedIndex !== visualCenterIndexRef.current) {
      visualCenterIndexRef.current = boundedIndex;
      setVisualCenterIndex(boundedIndex);
    }
  }, [optionItemHeight, pickerItems.length]);

  const flushSnapFromOffset = useCallback(
    (offsetY: number) => {
      const rawIndex = Math.round(offsetY / optionItemHeight);
      snapToIndex(rawIndex, Platform.OS === "ios");
    },
    [optionItemHeight, snapToIndex],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: InternalPickerItem<T>; index: number }) => {
      const focused = index === visualCenterIndex;
      const distanceFromCenter = index - visualCenterIndex;
      return (
        <WheelTextRow
          label={getDisplayLabel(item)}
          optionItemHeight={optionItemHeight}
          itemTextStyle={itemTextStyle}
          focused={focused}
          disabled={item.disabled}
          distanceFromCenter={distanceFromCenter}
        />
      );
    },
    [itemTextStyle, optionItemHeight, visualCenterIndex],
  );

  if (pickerItems.length === 0) {
    return <View style={[styles.picker, { height: pickerHeight }, style]} />;
  }

  return (
    <View style={[styles.picker, { height: pickerHeight }, style]}>
      <FlatList
        ref={listRef}
        data={pickerItems}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        bounces={false}
        snapToInterval={optionItemHeight}
        decelerationRate={Platform.OS === "ios" ? "fast" : 0.985}
        contentContainerStyle={{
          paddingVertical: optionItemHeight * sideRows,
        }}
        initialNumToRender={normalizedVisibleCount + 2}
        maxToRenderPerBatch={normalizedVisibleCount + 4}
        windowSize={5}
        updateCellsBatchingPeriod={16}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({
          length: optionItemHeight,
          offset: optionItemHeight * index,
          index,
        })}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {}}
        onScrollEndDrag={(event) => {
          const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
          if (velocityY < 0.1 && !momentumActiveRef.current) {
            flushSnapFromOffset(event.nativeEvent.contentOffset.y);
            return;
          }

          setTimeout(() => {
            if (!momentumActiveRef.current) {
              flushSnapFromOffset(currentOffsetRef.current);
            }
          }, 80);
        }}
        onMomentumScrollBegin={() => {
          momentumActiveRef.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          momentumActiveRef.current = false;
          flushSnapFromOffset(event.nativeEvent.contentOffset.y);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
  },
  picker: {
    flex: 1,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    justifyContent: "center",
  },
  rowDisabled: {
    opacity: 0.28,
  },
  itemText: {
    textAlign: "center",
    fontSize: 20,
    fontWeight: "500",
    letterSpacing: 0.2,
    includeFontPadding: false,
  },
  itemTextFocused: {
    fontWeight: "700",
  },
  itemTextUnfocused: {
    fontWeight: "500",
  },
});
