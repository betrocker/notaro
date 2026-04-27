import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as SystemUI from "expo-system-ui";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider, useAuth } from "@/components/AuthProvider";
import { resolveActionTabFromSegment } from "@/components/ActionTabBar";
import MagicMenu, { MagicMenuAction } from "@/components/MagicMenu";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { triggerJobsInlineComposer } from "@/lib/jobsInlineComposer";
import { recordQuickFindRecentBySegment } from "@/lib/quickFind";
import {
  DEFAULT_TEXT_MAX_MULTIPLIER,
  DEFAULT_TEXT_STYLE,
} from "@/lib/design-system/typography";
import "../global.css";

const SHOULD_MANAGE_SPLASH = !__DEV__;

function safelyPreventAutoHideSplash() {
  if (!SHOULD_MANAGE_SPLASH) {
    return;
  }

  try {
    const pending = SplashScreen.preventAutoHideAsync();
    void pending.catch(() => {
      // Ignore when native splash is unavailable.
    });
  } catch {
    // Ignore when native splash is unavailable.
  }
}

function safelyHideSplash() {
  if (!SHOULD_MANAGE_SPLASH) {
    return;
  }

  try {
    const pending = SplashScreen.hideAsync();
    void pending.catch(() => {
      // Ignore when splash was already hidden or not registered.
    });
  } catch {
    // Ignore when splash was already hidden or not registered.
  }
}

safelyPreventAutoHideSplash();

const defaultTextStyle = DEFAULT_TEXT_STYLE;
const defaultTextInputStyle = DEFAULT_TEXT_STYLE;
const TextWithDefaults = Text as typeof Text & {
  defaultProps?: { style?: unknown; maxFontSizeMultiplier?: number; allowFontScaling?: boolean };
};
const TextInputWithDefaults = TextInput as typeof TextInput & {
  defaultProps?: { style?: unknown; maxFontSizeMultiplier?: number; allowFontScaling?: boolean };
};

TextWithDefaults.defaultProps = TextWithDefaults.defaultProps ?? {};
TextWithDefaults.defaultProps.style = [
  defaultTextStyle,
  TextWithDefaults.defaultProps.style,
];
TextWithDefaults.defaultProps.maxFontSizeMultiplier = DEFAULT_TEXT_MAX_MULTIPLIER;
TextWithDefaults.defaultProps.allowFontScaling = false;

TextInputWithDefaults.defaultProps = TextInputWithDefaults.defaultProps ?? {};
TextInputWithDefaults.defaultProps.style = [
  defaultTextInputStyle,
  TextInputWithDefaults.defaultProps.style,
];
TextInputWithDefaults.defaultProps.maxFontSizeMultiplier = DEFAULT_TEXT_MAX_MULTIPLIER;
TextInputWithDefaults.defaultProps.allowFontScaling = false;

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Inter-Regular": Inter_400Regular,
    "Inter-Medium": Inter_500Medium,
    "Inter-SemiBold": Inter_600SemiBold,
    "Inter-Bold": Inter_700Bold,
  });
  const { colorScheme, setColorScheme } = useColorScheme();
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const stackBackgroundColor = COLOR_TOKENS[colorMode]["bg.base"];
  const stackAnimation =
    Platform.OS === "android" ? "slide_from_right" : "default";

  useEffect(() => {
    async function loadTheme() {
      try {
        const savedTheme = await AsyncStorage.getItem("@app_theme");
        setColorScheme((savedTheme as "light" | "dark" | "system") ?? "system");
      } catch (error) {
        console.warn("Failed to load app theme", error);
        setColorScheme("system");
      } finally {
        setIsThemeLoaded(true);
      }
    }

    void loadTheme();
  }, [setColorScheme]);

  useEffect(() => {
    if (fontsLoaded && isThemeLoaded) {
      safelyHideSplash();
    }
  }, [fontsLoaded, isThemeLoaded]);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(stackBackgroundColor);
  }, [stackBackgroundColor]);

  if (!fontsLoaded || !isThemeLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootNavigator
            stackAnimation={stackAnimation}
            stackBackgroundColor={stackBackgroundColor}
          />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator({
  stackAnimation,
  stackBackgroundColor,
}: {
  stackAnimation: "slide_from_right" | "default";
  stackBackgroundColor: string;
}) {
  const segments = useSegments();
  const { isAuthReady, session } = useAuth();

  const rootSegment = segments[0] as string | undefined;
  const authScreen = segments[1] as string | undefined;

  useEffect(() => {
    if (!isAuthReady || !session) {
      return;
    }

    void recordQuickFindRecentBySegment(rootSegment);
  }, [isAuthReady, rootSegment, session]);

  if (!isAuthReady) {
    return null;
  }

  const inAuth = rootSegment === "auth";
  const onWelcome = rootSegment === "welcome";
  const inSettings = rootSegment === "settings";
  const inClients = rootSegment === "clients";
  const inNewTodo = rootSegment === "new-todo";
  const inNewPayment = rootSegment === "new-payment";
  const inNewReminder = rootSegment === "new-reminder";
  const inQuickFind = rootSegment === "quick-find";
  const inModalSurface =
    inSettings || inClients || inNewTodo || inNewPayment || inNewReminder || inQuickFind;
  const activeTab = resolveActionTabFromSegment(rootSegment);
  const showGlobalMagicMenu =
    !!session && !inAuth && !onWelcome && !inModalSurface;

  if (!session) {
    if (
      (!inAuth && !onWelcome) ||
      (inAuth &&
        authScreen !== "email" &&
        authScreen !== "login" &&
        authScreen !== "register" &&
        authScreen !== "reset-password" &&
        authScreen !== "update-password")
    ) {
      return <Redirect href={"/welcome" as never} />;
    }
  } else {
    if (onWelcome) {
      return <Redirect href={"/" as never} />;
    }

    if (inAuth) {
      return <Redirect href="/" />;
    }
  }

  const defaultMagicActions: MagicMenuAction[] = [
    {
      key: "project",
      label: "New Project",
      description: "Open the full composer modal for a new project.",
      icon: "project",
      iconColor: COLOR_TOKENS.dark["primary.default"],
      onPress: () => router.push("/new-todo"),
    },
    {
      key: "client",
      label: "New Client",
      description: "Create a client profile for future work and follow-ups.",
      icon: "client",
      iconColor: "var(--color-logbook)",
      onPress: () => router.push("/clients"),
    },
    {
      key: "reminder",
      label: "New Reminder",
      description: "Set a reminder with date, optional note, and linked job.",
      icon: "bell",
      iconColor: "var(--color-upcoming)",
      onPress: () => router.push("/new-reminder"),
    },
  ];
  const homeMagicActions: MagicMenuAction[] = [
    {
      key: "project",
      label: "New Project",
      description: "Open the full composer modal for a new project.",
      icon: "project",
      iconColor: COLOR_TOKENS.dark["primary.default"],
      onPress: () => router.push("/new-todo"),
    },
    {
      key: "client",
      label: "New Client",
      description: "Open the existing client modal and add a new client.",
      icon: "client",
      iconColor: "var(--color-logbook)",
      onPress: () => router.push("/clients"),
    },
    {
      key: "payment",
      label: "New Payment",
      description: "Register a new payment with amount, date, and note.",
      icon: "dollar",
      iconColor: "var(--color-today)",
      onPress: () => router.push("/new-payment"),
    },
    {
      key: "reminder",
      label: "New Reminder",
      description: "Set a reminder with date, optional note, and linked job.",
      icon: "bell",
      iconColor: "var(--color-upcoming)",
      onPress: () => router.push("/new-reminder"),
    },
  ];
  const magicMenuActions = activeTab === "home" ? homeMagicActions : defaultMagicActions;

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: stackAnimation,
          animationDuration: Platform.OS === "android" ? 180 : undefined,
          gestureEnabled: true,
          fullScreenGestureEnabled: Platform.OS === "ios",
          contentStyle: { backgroundColor: stackBackgroundColor },
        }}
      >
        <Stack.Screen
          name="welcome"
          options={{ headerShown: false, animation: "fade" }}
        />
        <Stack.Screen
          name="auth"
          options={{
            headerShown: false,
            presentation: "transparentModal",
            animation: "none",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="jobs" options={{ headerShown: false }} />
        <Stack.Screen name="clients-home" options={{ headerShown: false }} />
        <Stack.Screen name="today" options={{ headerShown: false }} />
        <Stack.Screen name="inbox" options={{ headerShown: false }} />
        <Stack.Screen name="upcoming" options={{ headerShown: false }} />
        <Stack.Screen name="anytime" options={{ headerShown: false }} />
        <Stack.Screen name="someday" options={{ headerShown: false }} />
        <Stack.Screen name="logbook" options={{ headerShown: false }} />
        <Stack.Screen
          name="project/[id]"
          options={{
            headerShown: false,
            animation: stackAnimation,
          }}
        />
        <Stack.Screen
          name="job/[id]"
          options={{
            headerShown: false,
            animation: stackAnimation,
          }}
        />
        <Stack.Screen
          name="settings"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="quick-find"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="clients"
          options={{
            presentation: "transparentModal",
            animation: "fade",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="new-todo"
          options={{
            presentation: "transparentModal",
            animation: "none",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="new-payment"
          options={{
            presentation: "transparentModal",
            animation: "none",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="new-reminder"
          options={{
            presentation: "transparentModal",
            animation: "none",
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>

      {showGlobalMagicMenu ? (
        <MagicMenu
          actions={magicMenuActions}
          onPrimaryActionPress={
            rootSegment === "jobs"
              ? triggerJobsInlineComposer
              : undefined
          }
          bottomOffset={0}
        />
      ) : null}
    </View>
  );
}
