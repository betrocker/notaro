import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { SPACING_TOKENS } from "@/lib/design-system/tokens";
import { QuickFindPullDown } from "@/components/QuickFindPullDown";
import { ChevronDown, ChevronLeft } from "lucide-react-native";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useRef } from "react";
import { View, TouchableOpacity } from "react-native";
import type { GestureResponderEvent, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

interface ProjectHeaderProps {
  title: string;
  titleAnimatedStyle: StyleProp<ViewStyle>;
  onBack: () => void;
  onTitleActionPress?: (event: GestureResponderEvent) => void;
  titleActionDisabled?: boolean;
  pullDownScrollY?: SharedValue<number>;
}

function darkenHex(hexColor: string, factor: number) {
  const sanitized = hexColor.replace("#", "");
  const full =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : sanitized;
  const r = Math.max(0, Math.min(255, Math.round(Number.parseInt(full.slice(0, 2), 16) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(Number.parseInt(full.slice(2, 4), 16) * factor)));
  const b = Math.max(0, Math.min(255, Math.round(Number.parseInt(full.slice(4, 6), 16) * factor)));

  return `rgb(${r}, ${g}, ${b})`;
}

export default function ProjectHeader({
  title,
  titleAnimatedStyle,
  onBack,
  onTitleActionPress,
  titleActionDisabled = false,
  pullDownScrollY,
}: ProjectHeaderProps) {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const baseIconColor =
    colorMode === "dark"
      ? COLOR_TOKENS.dark["text.secondary"]
      : COLOR_TOKENS.light["text.secondary"];
  const actionIconColor = darkenHex(baseIconColor, 0.78);
  const quickFindTriggerLockRef = useRef(false);
  const handleQuickFindSwipeTrigger = useCallback(() => {
    if (quickFindTriggerLockRef.current) {
      return;
    }

    quickFindTriggerLockRef.current = true;
    router.push("/quick-find" as never);
    setTimeout(() => {
      quickFindTriggerLockRef.current = false;
    }, 500);
  }, []);

  const quickFindPullStyle = useAnimatedStyle(() => {
    const scrollValue = pullDownScrollY?.value ?? 0;
    const pullDistance = Math.max(0, -scrollValue);
    const progress = Math.max(0, Math.min(1, pullDistance / 54));

    return {
      opacity: progress,
      transform: [
        { translateY: -16 + progress * 16 },
        { scale: 0.92 + progress * 0.08 },
      ],
    };
  }, [pullDownScrollY]);

  useAnimatedReaction(
    () => {
      const scrollValue = pullDownScrollY?.value ?? 0;
      return scrollValue <= -76;
    },
    (shouldOpen, previousShouldOpen) => {
      if (shouldOpen && !previousShouldOpen) {
        runOnJS(handleQuickFindSwipeTrigger)();
      }
    },
    [pullDownScrollY, handleQuickFindSwipeTrigger],
  );

  return (
    <SafeAreaView
      edges={["top"]}
      className="absolute left-0 right-0 top-0 z-30 bg-things-bg"
    >
      <View className="h-12 flex-row items-center px-4 pt-2">
        <TouchableOpacity
          onPress={onBack}
          className="h-12 w-12 items-center justify-center overflow-visible"
          activeOpacity={0.75}
        >
          <ChevronLeft
            size={30}
            color={actionIconColor}
            strokeWidth={1.3}
          />
        </TouchableOpacity>

        <View className="flex-1 items-center justify-center">
          <Animated.View style={titleAnimatedStyle}>
            {onTitleActionPress ? (
              <TouchableOpacity
                onPress={onTitleActionPress}
                disabled={titleActionDisabled}
                activeOpacity={0.75}
                className="flex-row items-center rounded-full px-1.5 py-0.5"
              >
                <Animated.Text
                  className="font-semibold text-body-lg text-things-text"
                  numberOfLines={1}
                  style={{ maxWidth: "90%" }}
                >
                  {title}
                </Animated.Text>
                <ChevronDown
                  size={16}
                  color={actionIconColor}
                  strokeWidth={1.8}
                  style={{ marginLeft: 2 }}
                />
              </TouchableOpacity>
            ) : (
              <Animated.Text
                className="font-semibold text-body-lg text-things-text"
                numberOfLines={1}
              >
                {title}
              </Animated.Text>
            )}
          </Animated.View>
        </View>

        <View className="h-11 w-11" />
      </View>

      {pullDownScrollY ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: SPACING_TOKENS.lg,
              right: SPACING_TOKENS.lg,
              top: SPACING_TOKENS.sm,
              zIndex: 35,
            },
            quickFindPullStyle,
          ]}
        >
          <QuickFindPullDown />
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}
