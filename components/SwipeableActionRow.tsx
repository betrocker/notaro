import { Icon, type IconName } from "@/components/Icon";
import React, { useMemo } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { View } from "react-native";

const DEFAULT_REVEAL_WIDTH = 36;
const DEFAULT_TRIGGER_DISTANCE = 27;

type SwipeableActionRowProps = {
  onSwipeLeft: () => void;
  revealBackgroundColor: string;
  actionBackgroundColor: string;
  actionIconColor: string;
  actionIcon: IconName;
  children: React.ReactNode;
  disabled?: boolean;
  revealWidth?: number;
  triggerDistance?: number;
  borderRadius?: number;
};

export function SwipeableActionRow({
  onSwipeLeft,
  revealBackgroundColor,
  actionBackgroundColor,
  actionIconColor,
  actionIcon,
  children,
  disabled = false,
  revealWidth = DEFAULT_REVEAL_WIDTH,
  triggerDistance = DEFAULT_TRIGGER_DISTANCE,
  borderRadius = 11,
}: SwipeableActionRowProps) {
  const translateX = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          const next = Math.max(-revealWidth, Math.min(0, event.translationX));
          translateX.value = next;
        })
        .onEnd(() => {
          const shouldTrigger = translateX.value <= -triggerDistance;
          translateX.value = withTiming(0, { duration: 180 });
          if (shouldTrigger) {
            runOnJS(onSwipeLeft)();
          }
        })
        .onFinalize(() => {
          if (translateX.value !== 0) {
            translateX.value = withTiming(0, { duration: 160 });
          }
        }),
    [disabled, onSwipeLeft, revealWidth, translateX, triggerDistance],
  );

  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const revealLayerStyle = useAnimatedStyle(() => {
    const revealProgress = interpolate(
      translateX.value,
      [-revealWidth, -8, 0],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: revealProgress,
    };
  });

  const movingSurfaceStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        Math.abs(translateX.value),
        [0, 1, 2],
        [0, 0.98, 1],
        Extrapolation.CLAMP,
      ),
      borderRadius,
      backgroundColor: revealBackgroundColor,
    };
  });

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ position: "relative", overflow: "hidden", borderRadius }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingRight: 12,
              backgroundColor: actionBackgroundColor,
            },
            revealLayerStyle,
          ]}
        >
          <Icon name={actionIcon} size={18} color={actionIconColor} />
        </Animated.View>
        <Animated.View style={foregroundStyle}>
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
              },
              movingSurfaceStyle,
            ]}
          />
          {children}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default SwipeableActionRow;
