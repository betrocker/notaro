import { Icon, type IconName } from "@/components/Icon";
import { AppText as Text, AppTextInput } from "@/components/ui";
import React, { useEffect, useRef } from "react";
import { Animated, TextInput, View } from "react-native";

interface InlineComposerProps {
  icon: IconName;
  iconColor: string;
  iconSize?: number;
  value: string;
  isSaving: boolean;
  placeholder: string;
  placeholderTextColor: string;
  textColor: string;
  textOpacity?: number;
  backgroundColor: string;
  backgroundFade: Animated.Value;
  selectionColor?: string;
  autoFocus?: boolean;
  rowPaddingClassName?: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}

export function InlineComposer({
  icon,
  iconColor,
  iconSize = 22,
  value,
  isSaving,
  placeholder,
  placeholderTextColor,
  textColor,
  textOpacity = 1,
  backgroundColor,
  backgroundFade,
  selectionColor,
  autoFocus = false,
  rowPaddingClassName = "py-2",
  onChangeText,
  onSubmit,
}: InlineComposerProps) {
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!autoFocus || isSaving) {
      return;
    }

    const timeout = setTimeout(() => {
      inputRef.current?.focus();
    }, 100);

    return () => clearTimeout(timeout);
  }, [autoFocus, isSaving]);

  return (
    <View className={rowPaddingClassName}>
      <View className="relative flex-row items-center px-1">
        <Animated.View
          style={{
            position: "absolute",
            top: -4,
            right: -8,
            bottom: -4,
            left: -8,
            borderRadius: 12,
            backgroundColor,
            opacity: backgroundFade,
          }}
        />

        <View className="h-8 w-8 items-center justify-center">
          <Icon name={icon} size={iconSize} color={iconColor} />
        </View>

        <View className="ml-2 flex-1">
          {isSaving ? (
            <Text
              variant="bodyMd"
              className="font-regular"
              style={{
                color: textColor,
                opacity: textOpacity,
                paddingVertical: 2,
              }}
            >
              {value}
            </Text>
          ) : (
            <AppTextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={placeholderTextColor}
              variant="bodyMd"
              className="font-regular"
              editable
              caretHidden={false}
              style={{
                flex: 1,
                color: textColor,
                opacity: textOpacity,
                backgroundColor: "transparent",
                paddingVertical: 2,
                paddingHorizontal: 0,
              }}
              selectionColor={selectionColor ?? textColor}
              underlineColorAndroid="transparent"
              returnKeyType="done"
              onSubmitEditing={() => onSubmit()}
              onEndEditing={() => onSubmit()}
            />
          )}
        </View>
      </View>
    </View>
  );
}
