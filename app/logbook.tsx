import { Icon } from "@/components/Icon";
import ProjectHeader from "@/components/ProjectHeader";
import { AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import { fetchLogbookTodos } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useState } from "react";
import { View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

type LogbookTask = {
  id: string;
  title: string;
  completedAt: string | null;
  completedDate: Date | null;
};

type MonthSection = {
  key: string;
  label: string;
  tasks: LogbookTask[];
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

function formatCompletedDate(dateString: string | null) {
  if (!dateString) {
    return "";
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}.${month}.`;
}

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function LogbookScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [tasks, setTasks] = useState<LogbookTask[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollY = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const completedColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];
  const sectionDividerColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.26);

  const loadLogbook = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      return;
    }

    try {
      const data = await fetchLogbookTodos();
      setTasks(
        data.map((task) => ({
          completedDate: task.completed_at ? new Date(task.completed_at) : null,
          id: task.id,
          title: task.title ?? "Bez naslova",
          completedAt: task.completed_at,
        })),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam logbook.",
      );
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadLogbook();
    }, [loadLogbook]),
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

  const todayDate = startOfDay(new Date());
  const yesterdayDate = addDays(todayDate, -1);

  const todayTasks = tasks.filter(
    (task) => !!task.completedDate && isSameDay(task.completedDate, todayDate),
  );
  const yesterdayTasks = tasks.filter(
    (task) => !!task.completedDate && isSameDay(task.completedDate, yesterdayDate),
  );

  const monthSectionsMap = new Map<string, MonthSection>();
  for (const task of tasks) {
    if (!task.completedDate) {
      continue;
    }

    if (
      isSameDay(task.completedDate, todayDate) ||
      isSameDay(task.completedDate, yesterdayDate)
    ) {
      continue;
    }

    const key = monthKey(task.completedDate);
    const label = task.completedDate.toLocaleDateString("en-US", { month: "long" });
    if (!monthSectionsMap.has(key)) {
      monthSectionsMap.set(key, { key, label, tasks: [] });
    }

    monthSectionsMap.get(key)?.tasks.push(task);
  }
  const monthSections = Array.from(monthSectionsMap.values());

  const renderSectionHeader = (title: string, spacingClassName = "mb-3 mt-2") => (
    <View className={spacingClassName}>
      <Text className="font-bold text-body-md text-things-text">{title}</Text>
      <View
        className="mt-2 h-px w-full"
        style={{ backgroundColor: sectionDividerColor }}
      />
    </View>
  );

  const renderTaskRow = (
    task: LogbookTask,
    dateLabel: string,
    dateLabelClassName = "mr-3 font-medium text-footer",
  ) => (
    <View
      key={task.id}
      className="flex-row items-center py-3"
    >
      <View
        className="mr-3 items-center justify-center"
        style={{
          width: SIZE_TOKENS.quickTaskCheckbox,
          height: SIZE_TOKENS.quickTaskCheckbox,
          borderRadius: RADIUS_TOKENS.xs,
          borderWidth: BORDER_WIDTH_TOKENS.subtle,
          borderColor: completedColor,
          backgroundColor: completedColor,
        }}
      >
        <Icon name="check" size={10} color={checkedIconColor} />
      </View>
      <Text
        className={dateLabelClassName}
        style={{ color: completedColor }}
      >
        {dateLabel}
      </Text>
      <Text className="flex-1 font-regular text-label-sm text-things-text">
        {task.title}
      </Text>
    </View>
  );

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Logbook"
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
          <Icon name="logbook" size={22} color="var(--color-logbook)" />
          <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
            Logbook
          </Text>
        </Animated.View>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {tasks.length > 0 ? (
          <View className="mb-20">
            {todayTasks.length > 0 ? (
              renderSectionHeader("Today")
            ) : null}

            {todayTasks.map((task) => renderTaskRow(task, "today", "mr-3 font-medium text-tiny"))}

            {yesterdayTasks.length > 0 ? (
              renderSectionHeader("Yesterday", todayTasks.length > 0 ? "mb-3 mt-4" : "mb-3 mt-2")
            ) : null}

            {yesterdayTasks.map((task) =>
              renderTaskRow(task, formatCompletedDate(task.completedAt)),
            )}

            {monthSections.map((section) => (
              <React.Fragment key={section.key}>
                {renderSectionHeader(
                  section.label,
                  todayTasks.length > 0 || yesterdayTasks.length > 0 ? "mb-3 mt-4" : "mb-3 mt-2",
                )}
                {section.tasks.map((task) =>
                  renderTaskRow(task, formatCompletedDate(task.completedAt)),
                )}
              </React.Fragment>
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="logbook" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>

    </View>
  );
}
