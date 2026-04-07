import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { ChevronLeft } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import React from "react";
import { View, TouchableOpacity } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

interface ProjectHeaderProps {
  title: string;
  titleAnimatedStyle: StyleProp<ViewStyle>;
  onBack: () => void;
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
}: ProjectHeaderProps) {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const baseIconColor =
    colorMode === "dark"
      ? COLOR_TOKENS.dark["text.secondary"]
      : COLOR_TOKENS.light["text.secondary"];
  const actionIconColor = darkenHex(baseIconColor, 0.78);

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
            <Animated.Text
              className="font-semibold text-body-lg text-things-text"
              numberOfLines={1}
            >
              {title}
            </Animated.Text>
          </Animated.View>
        </View>

        <View className="h-11 w-11" />
      </View>
    </SafeAreaView>
  );
}
