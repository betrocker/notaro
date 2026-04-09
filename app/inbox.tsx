import { Icon } from "@/components/Icon";
import ProjectHeader from "@/components/ProjectHeader";
import { AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import { completeInboxTodo, fetchInboxTodos } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";

type QuickTask = {
  id: string;
  title: string;
};

const CHECKED_HOLD_DURATION_MS = 2300;
const CHECKED_FADE_OUT_DURATION_MS = 320;

function withOpacity(hexColor: string, opacity: number) {
  const sanitized = hexColor.replace("#", "");
  const full =
    sanitized.length === 3
      ? sanitized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : sanitized;

  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function QuickTaskRow({
  task,
  checkboxSize,
  checkboxBorderColor,
  checkedColor,
  checkedIconColor,
  isChecked,
  isFading,
  isBusy,
  onCheckPress,
  onFadeComplete,
}: {
  task: QuickTask;
  checkboxSize: number;
  checkboxBorderColor: string;
  checkedColor: string;
  checkedIconColor: string;
  isChecked: boolean;
  isFading: boolean;
  isBusy: boolean;
  onCheckPress: (taskId: string) => void;
  onFadeComplete: (taskId: string) => void;
}) {
  const rowOpacity = useSharedValue(1);
  const hasFadeStartedRef = useRef(false);

  useEffect(() => {
    if (!isFading || hasFadeStartedRef.current) {
      return;
    }

    hasFadeStartedRef.current = true;
    rowOpacity.value = withDelay(
      CHECKED_HOLD_DURATION_MS,
      withTiming(0, { duration: CHECKED_FADE_OUT_DURATION_MS }, (finished) => {
        if (finished) {
          runOnJS(onFadeComplete)(task.id);
        }
      }),
    );
  }, [isFading, onFadeComplete, rowOpacity, task.id]);

  const rowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: rowOpacity.value,
  }));

  return (
    <Animated.View
      className="flex-row items-center py-3"
      style={rowAnimatedStyle}
    >
      <TouchableOpacity
        className="mr-3 items-center justify-center"
        activeOpacity={0.72}
        onPress={() => onCheckPress(task.id)}
        disabled={isBusy}
        style={{
          width: checkboxSize,
          height: checkboxSize,
          borderRadius: RADIUS_TOKENS.xs,
          borderWidth: BORDER_WIDTH_TOKENS.subtle,
          borderColor: isChecked ? checkedColor : checkboxBorderColor,
          backgroundColor: isChecked ? checkedColor : "transparent",
        }}
      >
        {isChecked ? (
          <Icon name="check" size={10} color={checkedIconColor} />
        ) : null}
      </TouchableOpacity>
      <Text className="flex-1 font-regular text-label-sm text-things-text">
        {task.title}
      </Text>
    </Animated.View>
  );
}

export default function QuickTasksScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [tasks, setTasks] = useState<QuickTask[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const scrollY = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const checkboxBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.7 : 0.4,
  );
  const checkedColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];

  const loadQuickTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      return;
    }

    try {
      const data = await fetchInboxTodos();
      setTasks(
        data.map((task) => ({
          id: task.id,
          title: task.title ?? "Bez naslova",
        })),
      );
      setCheckingIds(new Set());
      setCheckedIds(new Set());
      setFadingIds(new Set());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam quick tasks.",
      );
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQuickTasks();
    }, [loadQuickTasks]),
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [44, 86],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [44, 86],
      [8, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const heroTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 48],
      [0, -14],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [0, 48],
      [1, 0.96],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }, { scale }],
    };
  });

  const handleCompleteTask = useCallback(async (taskId: string) => {
    let shouldProceed = false;
    setCheckingIds((current) => {
      if (current.has(taskId)) {
        return current;
      }

      shouldProceed = true;
      const next = new Set(current);
      next.add(taskId);
      return next;
    });

    if (!shouldProceed) {
      return;
    }

    setCheckedIds((current) => {
      const next = new Set(current);
      next.add(taskId);
      return next;
    });

    try {
      await completeInboxTodo(taskId);
      setFadingIds((current) => {
        const next = new Set(current);
        next.add(taskId);
        return next;
      });
      setErrorMessage(null);
    } catch (error) {
      setCheckedIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da zavrsim task.",
      );
    } finally {
      setCheckingIds((current) => {
        const next = new Set(current);
        next.delete(taskId);
        return next;
      });
    }
  }, []);

  const handleFadeComplete = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    setCheckedIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
    setFadingIds((current) => {
      const next = new Set(current);
      next.delete(taskId);
      return next;
    });
  }, []);

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Quick Tasks"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 32, flexGrow: 1 }}
      >
        <Animated.View
          className="mb-6 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <Icon name="inbox" size={22} color="var(--color-inbox)" />
          <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
            Quick Tasks
          </Text>
        </Animated.View>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {tasks.length > 0 ? (
          <View className="mb-20">
            {tasks.map((task) => (
              <QuickTaskRow
                key={task.id}
                task={task}
                checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                checkboxBorderColor={checkboxBorderColor}
                checkedColor={checkedColor}
                checkedIconColor={checkedIconColor}
                isChecked={checkedIds.has(task.id)}
                isFading={fadingIds.has(task.id)}
                isBusy={checkingIds.has(task.id)}
                onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                onFadeComplete={handleFadeComplete}
              />
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="inbox" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>

    </View>
  );
}
