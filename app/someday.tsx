import { Icon } from "@/components/Icon";
import InlineTodoAccordion from "@/components/InlineTodoAccordion";
import ProjectHeader from "@/components/ProjectHeader";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SIZE_TOKENS } from "@/lib/design-system/tokens";
import {
  completeInboxTodo,
  fetchSomedayTodos,
  updateInboxTodo,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

type SomedayTask = {
  id: string;
  title: string;
  description: string | null;
  scheduledDate?: string | null;
  status?: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
};

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

export default function SomedayScreen() {
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [tasks, setTasks] = useState<SomedayTask[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const scrollY = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const checkboxBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.7 : 0.4,
  );
  const checkedColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];

  const loadSomedayTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      return;
    }

    try {
      const data = await fetchSomedayTodos();
      setTasks(
        data.map((task) => ({
          id: task.id,
          title: task.title ?? "Bez naslova",
          description: task.description ?? null,
          scheduledDate: task.scheduled_date ?? null,
          status: task.status ?? null,
          deadlineDateIso: task.deadline_date ?? null,
          checklistItems: task.checklist_items ?? [],
        })),
      );
      setExpandedTaskId(null);
      setCheckingIds(new Set());
      setCheckedIds(new Set());
      setFadingIds(new Set());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam someday taskove.",
      );
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSomedayTasks();
    }, [loadSomedayTasks]),
  );

  useEffect(() => {
    if (!refresh) {
      return;
    }

    void loadSomedayTasks();
  }, [loadSomedayTasks, refresh]);

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

    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
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
  }, [expandedTaskId]);

  const handleFadeComplete = useCallback((taskId: string) => {
    setTasks((current) => current.filter((task) => task.id !== taskId));
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    }
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
  }, [expandedTaskId]);

  const handleSaveTask = useCallback(
    async (
      taskId: string,
      payload: {
        title: string;
        description: string;
        scheduledDateIso?: string | null;
        deadlineDateIso?: string | null;
        checklistItems?: string[];
        status?: "new" | "someday" | null;
      },
    ) => {
      await updateInboxTodo(taskId, {
        title: payload.title,
        description: payload.description,
        scheduledDateIso: payload.scheduledDateIso,
        deadlineDateIso: payload.deadlineDateIso,
        checklistItems: payload.checklistItems,
        status: payload.status,
      });

      let shouldLeaveSomeday = false;
      setTasks((current) => {
        const currentTask = current.find((task) => task.id === taskId);
        const nextStatus =
          payload.status === undefined ? currentTask?.status ?? "someday" : payload.status;
        const nextScheduledDate =
          payload.scheduledDateIso === undefined
            ? currentTask?.scheduledDate ?? null
            : payload.scheduledDateIso;

        shouldLeaveSomeday = nextStatus !== "someday" || Boolean(nextScheduledDate);

        if (shouldLeaveSomeday) {
          return current.filter((task) => task.id !== taskId);
        }

        return current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title: payload.title,
                description: payload.description || null,
                scheduledDate: nextScheduledDate,
                status: nextStatus,
                deadlineDateIso: payload.deadlineDateIso ?? null,
                checklistItems: payload.checklistItems ?? [],
              }
            : task,
        );
      });

      if (shouldLeaveSomeday) {
        setExpandedTaskId((current) => (current === taskId ? null : current));
      }
    },
    [],
  );

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Someday"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 32, flexGrow: 1 }}
      >
        <Pressable className="flex-1" onPress={() => setExpandedTaskId(null)}>
          <Animated.View
            className="mb-6 flex-row items-center"
            style={heroTitleAnimatedStyle}
          >
            <Icon name="someday" size={22} color="var(--color-someday)" />
            <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
              Someday
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
                <InlineTodoAccordion
                  key={task.id}
                  task={task}
                  checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                  checkboxBorderColor={checkboxBorderColor}
                  checkedColor={checkedColor}
                  checkedIconColor={checkedIconColor}
                  isChecked={checkedIds.has(task.id)}
                  isFading={fadingIds.has(task.id)}
                  isBusy={checkingIds.has(task.id)}
                  isExpanded={expandedTaskId === task.id}
                  onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                  onToggleExpanded={(taskId) =>
                    setExpandedTaskId((current) => (current === taskId ? null : taskId))
                  }
                  onFadeComplete={handleFadeComplete}
                  onSave={handleSaveTask}
                />
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center">
              <Icon name="someday" size={96} color={emptyIconColor} />
            </View>
          )}
        </Pressable>
      </Animated.ScrollView>
    </View>
  );
}
