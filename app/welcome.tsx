import { Redirect, router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useRef, useState } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { AppText as Text } from "@/components/ui";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/components/AuthProvider";
import { Icon, type IconName } from "@/components/Icon";
import { SHADOW_TOKENS } from "@/lib/design-system/tokens";
import { getThemeTokens } from "@/lib/theme";

const ONBOARDING_SCREENS: Array<{
  icon: IconName;
  title: string;
  description: string;
}> = [
  {
    icon: "clipboard",
    title: "Tvoja digitalna sveska.",
    description:
      "Zaboravi na izgubljene papirice i propustene pozive. Svi tvoji klijenti, adrese i dogovori konacno na jednom preglednom mestu.",
  },
  {
    icon: "zap",
    title: "Unos u hodu, jednim potezom.",
    description:
      "Dok si jos na terenu, dodaj novog klijenta ili zakazi termin u sekundi. Swipe desno za kalendar, swipe levo za naplatu.",
  },
  {
    icon: "checkCircle",
    title: "Nista ne ostaje nenaplaceno.",
    description:
      "Prati tacno sta si radio kod koga, koliko materijala je otislo i ko ti duguje novac. Sve je sigurno i uvek pri ruci.",
  },
];

const DOT_SIZE = 2;
const ACTIVE_WIDTH = 18;
const STEP_WIDTH = 18;
const STEP_GAP = 8;

export default function WelcomeScreen() {
  const { isAuthReady, session } = useAuth();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = getThemeTokens(isDark);
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(width - 48, 1);
  const scrollRef = useRef<ScrollView | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const isLastScreen = activeIndex === ONBOARDING_SCREENS.length - 1;

  if (!isAuthReady) {
    return null;
  }

  if (session) {
    return <Redirect href={"/" as never} />;
  }

  const onNext = () => {
    if (activeIndex >= ONBOARDING_SCREENS.length - 1) {
      router.push("/auth/email" as never);
      return;
    }

    scrollRef.current?.scrollTo({
      x: (activeIndex + 1) * pageWidth,
      animated: true,
    });
  };

  const onMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    setActiveIndex(nextIndex);
  };

  return (
    <SafeAreaView className="flex-1 bg-things-bg">
      <View className="flex-1 px-6 pt-2">
        <View className="min-h-9 flex-row items-center justify-end">
          <Pressable
            onPress={() => router.push("/auth/email" as never)}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Text
              className="font-medium text-label-sm"
              style={{ color: theme.onboardingSkipText }}
            >
              Skip
            </Text>
          </Pressable>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          bounces={false}
          showsHorizontalScrollIndicator={false}
          className="flex-1"
          contentContainerStyle={{ alignItems: "stretch" }}
          onMomentumScrollEnd={onMomentumEnd}
        >
          {ONBOARDING_SCREENS.map((screen) => (
            <View
              key={screen.title}
              className="items-center justify-center px-7"
              style={{ width: pageWidth }}
            >
              <Icon
                name={screen.icon}
                size={52}
                color={theme.onboardingIcon}
                weight="light"
              />

              <Text
                variant="onboardingTitle"
                className="mt-8 max-w-[320px] text-center font-bold"
                style={{ color: theme.onboardingTitle }}
              >
                {screen.title}
              </Text>

              <Text
                className="mt-4 max-w-[320px] text-center font-regular text-body-base leading-[26px]"
                style={{ color: theme.onboardingBody }}
              >
                {screen.description}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View className="flex-row items-center justify-between pb-6 pt-3">
          <View
            className="h-[18px] flex-row items-center"
            style={{ gap: STEP_GAP }}
          >
            {ONBOARDING_SCREENS.map((screen, index) => {
              const isActive = index === activeIndex;

              return (
                <View
                  key={screen.title}
                  className="h-[18px] justify-center"
                  style={{ width: STEP_WIDTH }}
                >
                  <View
                    className="rounded-full"
                    style={{
                      width: isActive ? ACTIVE_WIDTH : DOT_SIZE,
                      height: DOT_SIZE,
                      backgroundColor: isActive
                        ? theme.authActionBg
                        : theme.onboardingIndicatorInactive,
                    }}
                  />
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={onNext}
            activeOpacity={0.82}
            style={{
              width: isLastScreen ? 122 : 52,
              height: 52,
              borderRadius: 26,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: theme.authActionBg,
              shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              elevation: 5,
            }}
          >
            {isLastScreen ? (
              <Text
                className="font-semibold text-body-md"
                style={{ color: theme.authActionText }}
              >
                Get Started
              </Text>
            ) : (
              <Icon
                name="chevronRight"
                size={20}
                color={theme.authActionText}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
