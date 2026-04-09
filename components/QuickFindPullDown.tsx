import { Icon } from "@/components/Icon";
import { AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import { useColorScheme } from "nativewind";
import React from "react";
import { TouchableOpacity } from "react-native";

function lightenHex(hexColor: string, factor: number) {
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

export function QuickFindPullDown({
  placeholder = "Quick Find",
  onPress,
  className = "",
}: {
  placeholder?: string;
  onPress?: () => void;
  className?: string;
}) {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const quickFindBackgroundColor = lightenHex(
    COLOR_TOKENS[colorMode]["bg.modal"],
    colorMode === "dark" ? 1.22 : 1.04,
  );
  const quickFindBorderColor = COLOR_TOKENS[colorMode]["border.default"];
  const quickFindPlaceholderColor = COLOR_TOKENS[colorMode]["text.secondary"];

  return (
    <TouchableOpacity
      className={`flex-row items-center justify-center ${className}`.trim()}
      style={{
        height: SPACING_TOKENS["4xl"],
        borderRadius: RADIUS_TOKENS.full,
        borderWidth: BORDER_WIDTH_TOKENS.subtle,
        borderColor: quickFindBorderColor,
        backgroundColor: quickFindBackgroundColor,
        paddingHorizontal: SPACING_TOKENS.lg,
      }}
      onPress={onPress}
      activeOpacity={0.78}
      disabled={!onPress}
    >
      <Icon
        name="search"
        size={SPACING_TOKENS.lg}
        color={quickFindPlaceholderColor}
      />
      <Text
        className="ml-2 font-regular text-label-sm"
        style={{ color: quickFindPlaceholderColor }}
      >
        {placeholder}
      </Text>
    </TouchableOpacity>
  );
}
