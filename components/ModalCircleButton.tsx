import React, { useRef } from "react";
import { Animated, StyleSheet, TouchableOpacity } from "react-native";

import { Icon, IconName } from "@/components/Icon";
import { getThemeTokens } from "@/lib/theme";

export function ModalCircleButton({
  icon,
  iconSize,
  theme,
  onPress,
  size = 42,
}: {
  icon: IconName;
  iconSize: number;
  theme: ReturnType<typeof getThemeTokens>;
  onPress: () => void;
  size?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

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
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.modalCircleButtonBg,
            borderColor: theme.modalCircleButtonGlassBorder,
          },
        ]}
      >
        <Icon
          name={icon}
          size={iconSize}
          color={theme.modalCircleButtonIcon}
        />
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
