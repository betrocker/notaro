import { Icon, type IconName } from "@/components/Icon";
import { AppText as Text } from "@/components/ui";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type SectionAccordionProps = {
  title: string;
  collapsedIcon: IconName;
  expandedIcon: IconName;
  isExpanded: boolean;
  onToggle: () => void;
  borderColor: string;
  iconColor?: string;
  caretColor?: string;
  children?: React.ReactNode;
};

export default function SectionAccordion({
  title,
  collapsedIcon,
  expandedIcon,
  isExpanded,
  onToggle,
  borderColor,
  iconColor = "var(--color-muted)",
  caretColor = "var(--color-muted)",
  children,
}: SectionAccordionProps) {
  const [measuredContentHeight, setMeasuredContentHeight] = useState(0);
  const expandProgress = useSharedValue(isExpanded ? 1 : 0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    contentHeight.value = measuredContentHeight;
  }, [contentHeight, measuredContentHeight]);

  useEffect(() => {
    expandProgress.value = withTiming(isExpanded ? 1 : 0, {
      duration: 260,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [expandProgress, isExpanded]);

  const caretAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${expandProgress.value * 90}deg` }],
  }));

  const bodyAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(expandProgress.value, [0, 1], [0, contentHeight.value]),
    opacity: expandProgress.value,
    transform: [{ translateY: interpolate(expandProgress.value, [0, 1], [-4, 0]) }],
  }));

  return (
    <View>
      <View
        className="h-px"
        style={{
          backgroundColor: borderColor,
          width: "96%",
          alignSelf: "center",
        }}
      />
      <TouchableOpacity
        activeOpacity={1}
        onPress={onToggle}
        className="flex-row items-center px-1 py-5"
        style={{
          minHeight: 60,
        }}
      >
        <View className="h-9 w-9 items-center justify-center">
          <Icon
            name={isExpanded ? expandedIcon : collapsedIcon}
            size={24}
            color={iconColor}
          />
        </View>
        <Text className="ml-2 flex-1 font-normal text-body-md text-things-text">
          {title}
        </Text>
        <Animated.View
          className="h-8 w-8 items-center justify-center"
          style={caretAnimatedStyle}
        >
          <Icon name="chevronRight" size={22} color={caretColor} />
        </Animated.View>
      </TouchableOpacity>

      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          opacity: 0,
          zIndex: -1,
        }}
      >
        <View
          className="pb-2"
          onLayout={(event) => {
            const nextHeight = Math.max(0, Math.ceil(event.nativeEvent.layout.height));
            if (nextHeight !== measuredContentHeight) {
              setMeasuredContentHeight(nextHeight);
            }
          }}
        >
          {children}
        </View>
      </View>

      <Animated.View
        style={[{ overflow: "hidden" }, bodyAnimatedStyle]}
        pointerEvents={isExpanded ? "auto" : "none"}
      >
        <View className="pb-2">{children}</View>
      </Animated.View>
    </View>
  );
}
