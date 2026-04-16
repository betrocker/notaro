import { Icon } from "@/components/Icon";
import InlineTodoAccordion from "@/components/InlineTodoAccordion";
import ProjectHeader from "@/components/ProjectHeader";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS, SIZE_TOKENS } from "@/lib/design-system/tokens";
import {
  completeInboxTodo,
  fetchUpcomingTodos,
  updateInboxTodo,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type UpcomingTask = {
  id: string;
  title: string;
  description: string | null;
  scheduledDate: string | null;
  deadlineDateIso?: string | null;
  checklistItems?: string[];
};

type DaySection = {
  key: string;
  date: Date;
  label: string;
  tasks: UpcomingTask[];
};

type MonthSection = {
  key: string;
  label: string;
  start: Date;
  end: Date;
  tasks: UpcomingTask[];
};

type YearSection = {
  key: string;
  label: string;
  tasks: UpcomingTask[];
};

const DAY_SECTION_COUNT = 7;
const UPCOMING_MONTH_COUNT = 4;
const EMPTY_SECTION_HEIGHT = 30;
const EXPANDED_SHIFT_UP = 40;
const EXPANDED_SHIFT_DOWN = 34;

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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function fromScheduledDate(dateIso: string | null) {
  if (!dateIso) {
    return null;
  }

  const date = new Date(`${dateIso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinRange(date: Date, start: Date, end: Date) {
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
}

function formatDayRangeLabel(start: Date, end: Date) {
  const monthLabel = start.toLocaleDateString("en-US", { month: "long" });
  return `${monthLabel} ${start.getDate()}-${end.getDate()}`;
}

function formatTaskPrefix(dateIso: string | null) {
  const parsed = fromScheduledDate(dateIso);
  if (!parsed) {
    return "";
  }

  return `${parsed.getDate()}.${parsed.getMonth() + 1}.`;
}

function getNeighborShift(taskIndex: number, expandedIndex: number) {
  if (expandedIndex < 0) {
    return 0;
  }

  if (taskIndex < expandedIndex) {
    return -EXPANDED_SHIFT_UP;
  }

  if (taskIndex > expandedIndex) {
    return EXPANDED_SHIFT_DOWN;
  }

  return 0;
}

function getSectionHeaderShift(expandedIndex: number) {
  return expandedIndex >= 0 ? -EXPANDED_SHIFT_UP : 0;
}

function getTopBlockShift(blockOrder: number, expandedBlockOrder: number) {
  if (expandedBlockOrder < 0 || blockOrder < 0) {
    return 0;
  }

  return blockOrder < expandedBlockOrder ? -EXPANDED_SHIFT_UP : 0;
}

function TaskShiftContainer({
  shift,
  children,
}: {
  shift: number;
  children: React.ReactNode;
}) {
  const animatedShift = useSharedValue(shift);

  useEffect(() => {
    animatedShift.value = withTiming(shift, {
      duration: 210,
      easing: Easing.bezier(0.22, 0, 0.18, 1),
    });
  }, [animatedShift, shift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: animatedShift.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function UpcomingScreen() {
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [tasks, setTasks] = useState<UpcomingTask[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set());
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [fadingIds, setFadingIds] = useState<Set<string>>(new Set());
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const scrollY = useSharedValue(0);
  const emptyIconColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.5,
  );
  const dividerColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.26,
  );
  const checkboxBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.7 : 0.4,
  );
  const checkedColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];

  const loadUpcomingTasks = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      return;
    }

    try {
      const data = await fetchUpcomingTodos();
      setTasks(
        data.map((task) => ({
          id: task.id,
          title: task.title ?? "Bez naslova",
          description: task.description ?? null,
          scheduledDate: task.scheduled_date ?? null,
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
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam upcoming taskove.",
      );
      setTasks([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadUpcomingTasks();
    }, [loadUpcomingTasks]),
  );

  useEffect(() => {
    if (!refresh) {
      return;
    }

    void loadUpcomingTasks();
  }, [loadUpcomingTasks, refresh]);

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

  const handleCompleteTask = useCallback(
    async (taskId: string) => {
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
          error instanceof Error
            ? error.message
            : "Nisam uspeo da zavrsim task.",
        );
      } finally {
        setCheckingIds((current) => {
          const next = new Set(current);
          next.delete(taskId);
          return next;
        });
      }
    },
    [expandedTaskId],
  );

  const handleFadeComplete = useCallback(
    (taskId: string) => {
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
    },
    [expandedTaskId],
  );

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

      const todayIso = toDateKey(startOfDay(new Date()));
      let shouldLeaveUpcoming = false;

      setTasks((current) => {
        const currentTask = current.find((task) => task.id === taskId);
        const nextScheduledDate =
          payload.scheduledDateIso === undefined
            ? currentTask?.scheduledDate ?? null
            : payload.scheduledDateIso;

        shouldLeaveUpcoming =
          payload.status === "someday" ||
          !nextScheduledDate ||
          nextScheduledDate <= todayIso;

        if (shouldLeaveUpcoming) {
          return current.filter((task) => task.id !== taskId);
        }

        return current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                title: payload.title,
                description: payload.description || null,
                scheduledDate: nextScheduledDate,
                deadlineDateIso: payload.deadlineDateIso ?? null,
                checklistItems: payload.checklistItems ?? [],
              }
            : task,
        );
      });

      if (shouldLeaveUpcoming) {
        setExpandedTaskId((current) => (current === taskId ? null : current));
      }
    },
    [],
  );

  const {
    daySections,
    firstMonthRangeSection,
    upcomingMonthSections,
    yearSections,
  } = useMemo(() => {
    const tomorrow = addDays(startOfDay(new Date()), 1);
    const days: DaySection[] = Array.from(
      { length: DAY_SECTION_COUNT },
      (_, index) => {
        const date = addDays(tomorrow, index);
        return {
          key: toDateKey(date),
          date,
          label:
            index === 0
              ? "Tomorrow"
              : date.toLocaleDateString("en-US", { weekday: "long" }),
          tasks: [],
        };
      },
    );

    const dayEnd = addDays(tomorrow, DAY_SECTION_COUNT - 1);
    const firstRangeStart = addDays(dayEnd, 1);
    const firstRangeEnd = endOfMonth(firstRangeStart);
    const firstRange: MonthSection = {
      key: `range-${toDateKey(firstRangeStart)}`,
      label: formatDayRangeLabel(firstRangeStart, firstRangeEnd),
      start: firstRangeStart,
      end: firstRangeEnd,
      tasks: [],
    };

    const firstUpcomingMonthStart = addMonths(startOfMonth(firstRangeStart), 1);
    const months: MonthSection[] = Array.from(
      { length: UPCOMING_MONTH_COUNT },
      (_, index) => {
        const monthStart = addMonths(firstUpcomingMonthStart, index);
        const monthEnd = endOfMonth(monthStart);
        return {
          key: `month-${toDateKey(monthStart)}`,
          label: monthStart.toLocaleDateString("en-US", { month: "long" }),
          start: monthStart,
          end: monthEnd,
          tasks: [],
        };
      },
    );

    const dayMap = new Map(days.map((section) => [section.key, section]));
    const yearMap = new Map<string, UpcomingTask[]>();

    for (const task of tasks) {
      const scheduled = fromScheduledDate(task.scheduledDate);
      if (!scheduled) {
        continue;
      }

      const dayKey = toDateKey(scheduled);
      const daySection = dayMap.get(dayKey);
      if (daySection) {
        daySection.tasks.push(task);
        continue;
      }

      if (isWithinRange(scheduled, firstRange.start, firstRange.end)) {
        firstRange.tasks.push(task);
        continue;
      }

      const targetMonth = months.find((section) =>
        isWithinRange(scheduled, section.start, section.end),
      );
      if (targetMonth) {
        targetMonth.tasks.push(task);
        continue;
      }

      const yearKey = String(scheduled.getFullYear());
      yearMap.set(yearKey, [...(yearMap.get(yearKey) ?? []), task]);
    }

    const groupedYears: YearSection[] = Array.from(yearMap.entries())
      .sort(([left], [right]) => Number(left) - Number(right))
      .map(([year, yearTasks]) => ({
        key: `year-${year}`,
        label: year,
        tasks: yearTasks,
      }));

    return {
      daySections: days,
      firstMonthRangeSection: firstRange,
      upcomingMonthSections: months,
      yearSections: groupedYears,
    };
  }, [tasks]);
  const firstRangeExpandedTaskIndex = firstMonthRangeSection.tasks.findIndex(
    (task) => task.id === expandedTaskId,
  );
  const { blockOrderByKey, expandedTopBlockOrder } = useMemo(() => {
    const dayBlockKeys = daySections.map((section) => `day:${section.key}`);
    const firstRangeBlockKey = `range:${firstMonthRangeSection.key}`;
    const monthBlockKeys = upcomingMonthSections.map(
      (section) => `month:${section.key}`,
    );
    const yearBlockKeys = yearSections.map((section) => `year:${section.key}`);
    const allBlockKeys = [
      ...dayBlockKeys,
      firstRangeBlockKey,
      ...monthBlockKeys,
      ...yearBlockKeys,
    ];
    const orderMap = new Map(allBlockKeys.map((key, index) => [key, index]));

    if (!expandedTaskId) {
      return {
        blockOrderByKey: orderMap,
        expandedTopBlockOrder: -1,
      };
    }

    let expandedBlockKey: string | null = null;

    for (const section of daySections) {
      if (section.tasks.some((task) => task.id === expandedTaskId)) {
        expandedBlockKey = `day:${section.key}`;
        break;
      }
    }

    if (
      !expandedBlockKey &&
      firstMonthRangeSection.tasks.some((task) => task.id === expandedTaskId)
    ) {
      expandedBlockKey = firstRangeBlockKey;
    }

    if (!expandedBlockKey) {
      for (const section of upcomingMonthSections) {
        if (section.tasks.some((task) => task.id === expandedTaskId)) {
          expandedBlockKey = `month:${section.key}`;
          break;
        }
      }
    }

    if (!expandedBlockKey) {
      for (const section of yearSections) {
        if (section.tasks.some((task) => task.id === expandedTaskId)) {
          expandedBlockKey = `year:${section.key}`;
          break;
        }
      }
    }

    return {
      blockOrderByKey: orderMap,
      expandedTopBlockOrder:
        expandedBlockKey === null ? -1 : (orderMap.get(expandedBlockKey) ?? -1),
    };
  }, [
    daySections,
    expandedTaskId,
    firstMonthRangeSection.key,
    firstMonthRangeSection.tasks,
    upcomingMonthSections,
    yearSections,
  ]);
  const firstRangeBlockShift = getTopBlockShift(
    blockOrderByKey.get(`range:${firstMonthRangeSection.key}`) ?? -1,
    expandedTopBlockOrder,
  );

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Upcoming"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: 94,
          paddingBottom: 36,
          flexGrow: 1,
        }}
      >
        <Animated.View
          className="mb-10 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <Icon name="upcoming" size={22} color="var(--color-upcoming)" />
          <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
            Upcoming
          </Text>
        </Animated.View>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {tasks.length > 0 ? (
          <Pressable className="mb-20" onPress={() => setExpandedTaskId(null)}>
            {daySections.map((section, index) => {
              const expandedTaskIndex = section.tasks.findIndex(
                (task) => task.id === expandedTaskId,
              );
              const isSectionExpanded = expandedTaskIndex >= 0;
              const sectionHeaderShift = getSectionHeaderShift(expandedTaskIndex);
              const dayBlockShift = getTopBlockShift(
                blockOrderByKey.get(`day:${section.key}`) ?? -1,
                expandedTopBlockOrder,
              );
              return (
                <TaskShiftContainer key={section.key} shift={dayBlockShift}>
                  <View
                    className={index === daySections.length - 1 ? "mb-0" : "mb-8"}
                  >
                    <TaskShiftContainer shift={sectionHeaderShift}>
                      <View className="flex-row items-end">
                        <Text
                          className="w-[46px] font-bold text-things-text"
                          style={{ fontSize: 27, lineHeight: 31 }}
                        >
                          {section.date.getDate()}
                        </Text>
                        <View className="flex-1">
                          <View
                            className="h-px w-full"
                            style={{ backgroundColor: dividerColor }}
                          />
                          <Text className="mt-2 font-semibold text-label-sm text-things-muted">
                            {section.label}
                          </Text>
                        </View>
                      </View>
                    </TaskShiftContainer>

                    <View
                      style={
                        index === daySections.length - 1 && section.tasks.length === 0
                          ? {
                              height: EMPTY_SECTION_HEIGHT,
                              marginTop: isSectionExpanded ? 10 : 6,
                            }
                          : {
                              minHeight: EMPTY_SECTION_HEIGHT,
                              marginTop: isSectionExpanded ? 10 : 6,
                            }
                      }
                    >
                      {section.tasks.map((task, taskIndex) => {
                        const verticalShift = getNeighborShift(
                          taskIndex,
                          expandedTaskIndex,
                        );
                        return (
                          <TaskShiftContainer key={task.id} shift={verticalShift}>
                            <InlineTodoAccordion
                              task={task}
                              isExpanded={expandedTaskId === task.id}
                              checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                              checkboxBorderColor={checkboxBorderColor}
                              checkedColor={checkedColor}
                              checkedIconColor={checkedIconColor}
                              isChecked={checkedIds.has(task.id)}
                              isFading={fadingIds.has(task.id)}
                              isBusy={checkingIds.has(task.id)}
                              onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                              onToggleExpanded={(taskId) =>
                                setExpandedTaskId((current) =>
                                  current === taskId ? null : taskId,
                                )
                              }
                              onFadeComplete={handleFadeComplete}
                              onSave={handleSaveTask}
                            />
                          </TaskShiftContainer>
                        );
                      })}
                    </View>
                  </View>
                </TaskShiftContainer>
              );
            })}

            <TaskShiftContainer shift={firstRangeBlockShift}>
              <View className="mb-8">
                <TaskShiftContainer
                  shift={getSectionHeaderShift(firstRangeExpandedTaskIndex)}
                >
                  <View style={{ height: EMPTY_SECTION_HEIGHT }} />
                  <View
                    className="mt-3 h-px w-full"
                    style={{ backgroundColor: dividerColor }}
                  />
                  <Text className="mt-2 font-semibold text-label-sm">
                    <Text className="text-things-text">
                      {firstMonthRangeSection.start.toLocaleDateString("en-US", {
                        month: "long",
                      })}{" "}
                    </Text>
                    <Text className="text-things-muted">
                      {`${firstMonthRangeSection.start.getDate()}-${firstMonthRangeSection.end.getDate()}`}
                    </Text>
                  </Text>
                </TaskShiftContainer>
                {firstMonthRangeSection.tasks.map((task, taskIndex) => {
                  const verticalShift = getNeighborShift(
                    taskIndex,
                    firstRangeExpandedTaskIndex,
                  );
                  return (
                    <TaskShiftContainer key={task.id} shift={verticalShift}>
                      <InlineTodoAccordion
                        task={task}
                        titlePrefix={formatTaskPrefix(task.scheduledDate)}
                        isExpanded={expandedTaskId === task.id}
                        checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                        checkboxBorderColor={checkboxBorderColor}
                        checkedColor={checkedColor}
                        checkedIconColor={checkedIconColor}
                        isChecked={checkedIds.has(task.id)}
                        isFading={fadingIds.has(task.id)}
                        isBusy={checkingIds.has(task.id)}
                        onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                        onToggleExpanded={(taskId) =>
                          setExpandedTaskId((current) =>
                            current === taskId ? null : taskId,
                          )
                        }
                        onFadeComplete={handleFadeComplete}
                        onSave={handleSaveTask}
                      />
                    </TaskShiftContainer>
                  );
                })}
              </View>
            </TaskShiftContainer>

            {upcomingMonthSections.map((section) => {
              const expandedTaskIndex = section.tasks.findIndex(
                (task) => task.id === expandedTaskId,
              );
              const sectionBlockShift = getTopBlockShift(
                blockOrderByKey.get(`month:${section.key}`) ?? -1,
                expandedTopBlockOrder,
              );
              return (
                <TaskShiftContainer key={section.key} shift={sectionBlockShift}>
                  <View className="mb-8">
                    <TaskShiftContainer
                      shift={getSectionHeaderShift(expandedTaskIndex)}
                    >
                      <View style={{ height: EMPTY_SECTION_HEIGHT }} />
                      <View
                        className="mt-3 h-px w-full"
                        style={{ backgroundColor: dividerColor }}
                      />
                      <Text className="mt-2 font-semibold text-label-sm text-things-text">
                        {section.label}
                      </Text>
                    </TaskShiftContainer>

                    {section.tasks.map((task, taskIndex) => {
                      const verticalShift = getNeighborShift(
                        taskIndex,
                        expandedTaskIndex,
                      );
                      return (
                        <TaskShiftContainer key={task.id} shift={verticalShift}>
                          <InlineTodoAccordion
                            task={task}
                            titlePrefix={formatTaskPrefix(task.scheduledDate)}
                            isExpanded={expandedTaskId === task.id}
                            checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                            checkboxBorderColor={checkboxBorderColor}
                            checkedColor={checkedColor}
                            checkedIconColor={checkedIconColor}
                            isChecked={checkedIds.has(task.id)}
                            isFading={fadingIds.has(task.id)}
                            isBusy={checkingIds.has(task.id)}
                            onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                            onToggleExpanded={(taskId) =>
                              setExpandedTaskId((current) =>
                                current === taskId ? null : taskId,
                              )
                            }
                            onFadeComplete={handleFadeComplete}
                            onSave={handleSaveTask}
                          />
                        </TaskShiftContainer>
                      );
                    })}
                  </View>
                </TaskShiftContainer>
              );
            })}

            {yearSections.map((yearSection) => {
              const expandedTaskIndex = yearSection.tasks.findIndex(
                (task) => task.id === expandedTaskId,
              );
              const sectionBlockShift = getTopBlockShift(
                blockOrderByKey.get(`year:${yearSection.key}`) ?? -1,
                expandedTopBlockOrder,
              );
              return (
                <TaskShiftContainer key={yearSection.key} shift={sectionBlockShift}>
                  <View className="mb-8">
                    <TaskShiftContainer
                      shift={getSectionHeaderShift(expandedTaskIndex)}
                    >
                      <View
                        className="mb-2 h-px w-full"
                        style={{ backgroundColor: dividerColor }}
                      />
                      <Text className="font-bold text-body-md text-things-text">
                        {yearSection.label}
                      </Text>
                    </TaskShiftContainer>

                    {yearSection.tasks.map((task, taskIndex) => {
                      const verticalShift = getNeighborShift(
                        taskIndex,
                        expandedTaskIndex,
                      );
                      return (
                        <TaskShiftContainer key={task.id} shift={verticalShift}>
                          <InlineTodoAccordion
                            task={task}
                            titlePrefix={formatTaskPrefix(task.scheduledDate)}
                            isExpanded={expandedTaskId === task.id}
                            checkboxSize={SIZE_TOKENS.quickTaskCheckbox}
                            checkboxBorderColor={checkboxBorderColor}
                            checkedColor={checkedColor}
                            checkedIconColor={checkedIconColor}
                            isChecked={checkedIds.has(task.id)}
                            isFading={fadingIds.has(task.id)}
                            isBusy={checkingIds.has(task.id)}
                            onCheckPress={(taskId) => void handleCompleteTask(taskId)}
                            onToggleExpanded={(taskId) =>
                              setExpandedTaskId((current) =>
                                current === taskId ? null : taskId,
                              )
                            }
                            onFadeComplete={handleFadeComplete}
                            onSave={handleSaveTask}
                          />
                        </TaskShiftContainer>
                      );
                    })}
                  </View>
                </TaskShiftContainer>
              );
            })}
          </Pressable>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="upcoming" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
