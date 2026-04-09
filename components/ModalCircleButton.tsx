import React, { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { getThemeTokens } from "@/lib/theme";

const MODAL_CIRCLE_BUTTON_SIZE = 36;
const DEFAULT_MODAL_CIRCLE_ICON_SIZE = 24;
const MODAL_CIRCLE_ICON_SIZE_BY_NAME: Partial<Record<IconName, number>> = {
  chevronLeft: 30,
  chevronRight: 30,
  close: 24,
};

export function ModalCircleButton({
  icon,
  theme,
  onPress,
}: {
  icon: IconName;
  theme: ReturnType<typeof getThemeTokens>;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const iconSize =
    MODAL_CIRCLE_ICON_SIZE_BY_NAME[icon] ?? DEFAULT_MODAL_CIRCLE_ICON_SIZE;

  const animateTo = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      useNativeDriver: false,
      speed: 24,
      bounciness: 6,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.75}
        onPress={onPress}
        onPressIn={() => animateTo(1.18)}
        onPressOut={() => animateTo(1)}
        style={[
          styles.button,
          {
            width: MODAL_CIRCLE_BUTTON_SIZE,
            height: MODAL_CIRCLE_BUTTON_SIZE,
            borderRadius: MODAL_CIRCLE_BUTTON_SIZE / 2,
            backgroundColor: theme.modalCircleButtonBg,
            borderColor: theme.modalCircleButtonGlassBorder,
          },
        ]}
      >
        <Icon name={icon} size={iconSize} color={theme.modalCircleButtonIcon} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
});
