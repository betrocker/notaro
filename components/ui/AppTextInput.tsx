import React, { forwardRef } from "react";
import { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native";

import { TEXT_COLOR_TONES, TextTone } from "@/lib/design-system/tokens";
import {
  DEFAULT_TEXT_MAX_MULTIPLIER,
  DEFAULT_TEXT_VARIANT,
  getTypographyStyle,
  TYPOGRAPHY_VARIANTS,
  TypographyVariant,
} from "@/lib/design-system/typography";

export type AppTextInputProps = Omit<TextInputProps, "style"> & {
  variant?: TypographyVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  className?: string;
};

export const AppTextInput = forwardRef<TextInput, AppTextInputProps>(function AppTextInput(
  {
    variant = DEFAULT_TEXT_VARIANT,
    tone,
    style,
    allowFontScaling = false,
    maxFontSizeMultiplier,
    className,
    ...rest
  },
  ref,
) {
  const variantConfig = TYPOGRAPHY_VARIANTS[variant];

  return (
    <TextInput
      ref={ref}
      className={className}
      allowFontScaling={allowFontScaling}
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? variantConfig.maxFontSizeMultiplier ?? DEFAULT_TEXT_MAX_MULTIPLIER}
      style={[
        getTypographyStyle(variant),
        tone ? { color: TEXT_COLOR_TONES[tone] } : null,
        style,
      ]}
      {...rest}
    />
  );
});
