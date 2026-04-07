import React, { forwardRef } from "react";
import { StyleProp, Text, TextProps, TextStyle } from "react-native";

import { TEXT_COLOR_TONES, TextTone } from "@/lib/design-system/tokens";
import {
  DEFAULT_TEXT_MAX_MULTIPLIER,
  getTypographyStyle,
  TYPOGRAPHY_VARIANTS,
  TypographyVariant,
} from "@/lib/design-system/typography";

export type AppTextProps = Omit<TextProps, "style"> & {
  variant?: TypographyVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  className?: string;
};

export const AppText = forwardRef<Text, AppTextProps>(function AppText(
  {
    variant,
    tone,
    style,
    allowFontScaling = false,
    maxFontSizeMultiplier,
    className,
    ...rest
  },
  ref,
) {
  const variantConfig = variant ? TYPOGRAPHY_VARIANTS[variant] : undefined;

  return (
    <Text
      ref={ref}
      className={className}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={
        maxFontSizeMultiplier ??
        variantConfig?.maxFontSizeMultiplier ??
        DEFAULT_TEXT_MAX_MULTIPLIER
      }
      style={[
        variant ? getTypographyStyle(variant) : null,
        tone ? { color: TEXT_COLOR_TONES[tone] } : null,
        style,
      ]}
      {...rest}
    />
  );
});
