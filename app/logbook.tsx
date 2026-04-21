import { Icon } from "@/components/Icon";
import ProjectHeader from "@/components/ProjectHeader";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import { deleteLogbookTodo, fetchLogbookTodos } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useQuickFindPullToOpen } from "@/lib/useQuickFindPullToOpen";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleProp, TextStyle, TouchableOpacity, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  FadeInUp,
  FadeOutDown,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const SWIPE_DELETE_REVEAL_WIDTH = 52;
const SWIPE_DELETE_TRIGGER = 34;
const UNDO_DELETE_TIMEOUT_MS = 4500;

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
  return `${day}. ${month}.`;
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

function sortLogbookTasksByCompletedAtDesc(tasks: LogbookTask[]) {
  return [...tasks].sort((left, right) => {
    const leftTime = left.completedDate?.getTime() ?? -1;
    const rightTime = right.completedDate?.getTime() ?? -1;
    return rightTime - leftTime;
  });
}

function SwipeableLogbookRow({
  onDelete,
  revealBackgroundColor,
  deleteBackgroundColor,
  deleteIconColor,
  surfaceBackgroundColor,
  disabled = false,
  children,
}: {
  onDelete: () => void;
  revealBackgroundColor: string;
  deleteBackgroundColor: string;
  deleteIconColor: string;
  surfaceBackgroundColor: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-10, 10])
        .onUpdate((event) => {
          const next = Math.max(
            -SWIPE_DELETE_REVEAL_WIDTH,
            Math.min(event.translationX, 0),
          );
          translateX.value = next;
        })
        .onEnd(() => {
          const shouldDelete = translateX.value <= -SWIPE_DELETE_TRIGGER;
          translateX.value = withTiming(0, { duration: 180 });
          if (shouldDelete) {
            runOnJS(onDelete)();
          }
        })
        .onFinalize(() => {
          if (translateX.value !== 0) {
            translateX.value = withTiming(0, { duration: 180 });
          }
        }),
    [disabled, onDelete, translateX],
  );

  const foregroundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteRevealStyle = useAnimatedStyle(() => {
    const revealProgress = interpolate(
      translateX.value,
      [-SWIPE_DELETE_REVEAL_WIDTH, -8, 0],
      [1, 1, 0],
      Extrapolation.CLAMP,
    );
    return {
      opacity: revealProgress,
    };
  });

  const movingSurfaceStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      Math.abs(translateX.value),
      [0, 1, 2],
      [0, 0.98, 1],
      Extrapolation.CLAMP,
    ),
    borderRadius: 11,
    backgroundColor: revealBackgroundColor,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <View
        style={{
          position: "relative",
          overflow: "hidden",
          borderRadius: 11,
          backgroundColor: surfaceBackgroundColor,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              borderRadius: 11,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingRight: 12,
              backgroundColor: deleteBackgroundColor,
            },
            deleteRevealStyle,
          ]}
        >
          <Icon name="trash" size={18} color={deleteIconColor} />
        </Animated.View>
        <Animated.View
          style={[
            {
              borderRadius: 11,
              backgroundColor: surfaceBackgroundColor,
            },
            foregroundStyle,
          ]}
        >
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

export default function LogbookScreen() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [tasks, setTasks] = useState<LogbookTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<LogbookTask | null>(null);
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestUndoTaskRef = useRef<LogbookTask | null>(null);
  const scrollY = useSharedValue(0);
  const quickFindRefreshControl = useQuickFindPullToOpen();
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const completedColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const checkedIconColor = COLOR_TOKENS.light["text.primary"];
  const sectionDividerColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.26);
  const swipeRevealBackgroundColor = withOpacity(
    COLOR_TOKENS[colorMode]["primary.soft"],
    colorMode === "dark" ? 0.28 : 0.2,
  );
  const swipeDeleteBackgroundColor = "#D14A42";
  const swipeDeleteIconColor = "#FFFFFF";
  const swipeSurfaceBackgroundColor = COLOR_TOKENS[colorMode]["bg.base"];
  const confirmModalBg = colorMode === "dark"
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const confirmModalBorder = colorMode === "dark"
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];
  const confirmModalBackdropOpacity = colorMode === "dark" ? 0.52 : 0.36;
  const confirmCancelBg = colorMode === "dark"
    ? withOpacity(COLOR_TOKENS.dark["btn.secondary"], 0.28)
    : withOpacity(COLOR_TOKENS.light["bg.input"], 0.96);
  const confirmCancelBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.42 : 0.28,
  );
  const confirmDeleteBorder = withOpacity(
    swipeDeleteBackgroundColor,
    colorMode === "dark" ? 0.96 : 0.78,
  );
  const dateLabelUnifiedStyle: StyleProp<TextStyle> = {
    fontSize: 11,
    lineHeight: 13,
  };
  const undoBannerBg = colorMode === "dark"
    ? withOpacity(COLOR_TOKENS.dark["bg.popup"], 0.84)
    : withOpacity(COLOR_TOKENS.light["bg.modal"], 0.84);
  const undoBannerBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.4 : 0.26,
  );
  const undoBannerBottom = Math.max(insets.bottom + 84, 92);

  const clearUndoTimer = useCallback(() => {
    if (!undoTimerRef.current) {
      return;
    }

    clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
  }, []);

  const commitLogbookDelete = useCallback(
    async (task: LogbookTask) => {
      clearUndoTimer();
      if (latestUndoTaskRef.current?.id === task.id) {
        latestUndoTaskRef.current = null;
      }
      setUndoTask((current) => (current?.id === task.id ? null : current));

      try {
        await deleteLogbookTodo(task.id);
      } catch (error) {
        setTasks((current) =>
          sortLogbookTasksByCompletedAtDesc([...current, task]),
        );
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da obrisem logbook stavku.",
        );
      }
    },
    [clearUndoTimer],
  );

  const loadLogbook = useCallback(async () => {
    setIsLoading(true);

    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await fetchLogbookTodos();
      setTasks(sortLogbookTasksByCompletedAtDesc(
        data.map((task) => ({
          completedDate: task.completed_at ? new Date(task.completed_at) : null,
          id: task.id,
          title: task.title ?? "Bez naslova",
          completedAt: task.completed_at,
        })),
      ));
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam logbook.",
      );
      setTasks([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    latestUndoTaskRef.current = undoTask;
  }, [undoTask]);

  useEffect(() => () => {
    clearUndoTimer();
    const pendingTask = latestUndoTaskRef.current;
    if (pendingTask) {
      void deleteLogbookTodo(pendingTask.id);
    }
  }, [clearUndoTimer]);

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
    dateLabelStyle?: StyleProp<TextStyle>,
  ) => {
    return (
      <SwipeableLogbookRow
        key={task.id}
        onDelete={() => setPendingDeleteTaskId(task.id)}
        revealBackgroundColor={swipeRevealBackgroundColor}
        deleteBackgroundColor={swipeDeleteBackgroundColor}
        deleteIconColor={swipeDeleteIconColor}
        surfaceBackgroundColor={swipeSurfaceBackgroundColor}
      >
        <View className="flex-row items-center py-3">
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
            style={[{ color: completedColor }, dateLabelStyle]}
          >
            {dateLabel}
          </Text>
          <Text className="flex-1 font-regular text-label-sm text-things-text">
            {task.title}
          </Text>
        </View>
      </SwipeableLogbookRow>
    );
  };

  const handleDeleteTask = useCallback(async () => {
    if (!pendingDeleteTaskId) {
      return;
    }

    const taskId = pendingDeleteTaskId;
    setPendingDeleteTaskId(null);

    const removedTask = tasks.find((task) => task.id === taskId);
    if (!removedTask) {
      return;
    }
    setTasks((current) => current.filter((task) => task.id !== taskId));

    if (undoTask) {
      await commitLogbookDelete(undoTask);
    }

    const nextUndoTask = removedTask;
    setUndoTask(nextUndoTask);
    latestUndoTaskRef.current = nextUndoTask;
    setErrorMessage(null);
    clearUndoTimer();
    undoTimerRef.current = setTimeout(() => {
      void commitLogbookDelete(nextUndoTask);
    }, UNDO_DELETE_TIMEOUT_MS);
  }, [clearUndoTimer, commitLogbookDelete, pendingDeleteTaskId, tasks, undoTask]);

  const handleUndoDelete = useCallback(() => {
    if (!undoTask) {
      return;
    }

    const restoredTask = undoTask;
    clearUndoTimer();
    setUndoTask(null);
    latestUndoTaskRef.current = null;
    setTasks((current) =>
      sortLogbookTasksByCompletedAtDesc([...current, restoredTask]),
    );
  }, [clearUndoTimer, undoTask]);

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Logbook"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        pullDownScrollY={scrollY}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={quickFindRefreshControl}
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

        {isLoading ? (
          <View className="flex-1 items-center justify-center pt-14">
            <ActivityIndicator
              size="small"
              color={COLOR_TOKENS[colorMode]["text.secondary"]}
            />
          </View>
        ) : tasks.length > 0 ? (
          <View>
            {todayTasks.length > 0 ? (
              renderSectionHeader("Today")
            ) : null}

            {todayTasks.map((task) =>
              renderTaskRow(task, "today", "mr-3 font-medium text-tiny", dateLabelUnifiedStyle),
            )}

            {yesterdayTasks.length > 0 ? (
              renderSectionHeader("Yesterday", todayTasks.length > 0 ? "mb-3 mt-4" : "mb-3 mt-2")
            ) : null}

            {yesterdayTasks.map((task) =>
              renderTaskRow(
                task,
                formatCompletedDate(task.completedAt),
                "mr-3 font-medium text-footer",
                dateLabelUnifiedStyle,
              ),
            )}

            {monthSections.map((section) => (
              <React.Fragment key={section.key}>
                {renderSectionHeader(
                  section.label,
                  todayTasks.length > 0 || yesterdayTasks.length > 0 ? "mb-3 mt-4" : "mb-3 mt-2",
                )}
                {section.tasks.map((task) =>
                  renderTaskRow(
                    task,
                    formatCompletedDate(task.completedAt),
                    "mr-3 font-medium text-footer",
                    dateLabelUnifiedStyle,
                  ),
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

      {undoTask ? (
        <Animated.View
          entering={FadeInUp.duration(220).withInitialValues({
            opacity: 0,
            transform: [{ translateY: 34 }, { scale: 0.94 }],
          })}
          exiting={FadeOutDown.duration(140)}
          pointerEvents="box-none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: undoBannerBottom,
            zIndex: 24,
            alignItems: "center",
          }}
        >
          <View
            style={{
              borderRadius: 999,
              borderWidth: 0.5,
              borderColor: undoBannerBorder,
              backgroundColor: undoBannerBg,
              paddingHorizontal: 14,
              paddingVertical: 8,
              maxWidth: "88%",
            }}
          >
            <View className="flex-row items-center">
              <Text className="font-medium text-label-sm text-things-text" numberOfLines={1}>
                Logbook item deleted
              </Text>
              <View
                style={{
                  width: 1,
                  height: 14,
                  marginHorizontal: 10,
                  backgroundColor: undoBannerBorder,
                }}
              />
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleUndoDelete}
                className="rounded-full px-2.5 py-1"
              >
                <Text
                  className="font-semibold text-label-sm"
                  style={{ color: COLOR_TOKENS[colorMode]["primary.default"] }}
                >
                  Undo
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      ) : null}

      {pendingDeleteTaskId !== null ? (
        <TransparentModalShell
          closeOnBackdropPress
          onBackdropPress={() => setPendingDeleteTaskId(null)}
          enteringBackdrop={FadeIn.duration(110)}
          exitingBackdrop={FadeOut.duration(90)}
          enteringContent={ZoomIn.duration(90)
            .springify()
            .damping(56)
            .stiffness(620)
            .mass(0.7)}
          exitingContent={ZoomOut.duration(75)}
          backdropColor={COLOR_TOKENS[colorMode]["bg.overlay"]}
          backdropOpacity={confirmModalBackdropOpacity}
          contentStyle={{
            width: "84%",
            borderRadius: 28,
            borderWidth: 0.5,
            borderColor: confirmModalBorder,
            backgroundColor: confirmModalBg,
            paddingHorizontal: 18,
            paddingTop: 18,
            paddingBottom: 16,
          }}
          overlayStyle={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            paddingHorizontal: 16,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <View
            className="self-center items-center justify-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: withOpacity(swipeDeleteBackgroundColor, 0.15),
            }}
          >
            <Icon name="trash" size={16} color={swipeDeleteBackgroundColor} />
          </View>

          <Text className="mt-3 text-center font-semibold text-body-md text-things-text">
            Delete Logbook Item
          </Text>
          <Text className="mt-1.5 text-center font-regular text-label-sm text-things-muted">
            This action cannot be undone.
          </Text>

          <View className="mt-5 flex-row items-center">
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setPendingDeleteTaskId(null)}
              className="items-center justify-center rounded-full"
              style={{
                flex: 1,
                minHeight: 40,
                borderWidth: 1,
                borderColor: confirmCancelBorder,
                backgroundColor: confirmCancelBg,
              }}
            >
              <Text className="font-semibold text-label-sm text-things-text">
                Cancel
              </Text>
            </TouchableOpacity>

            <View style={{ width: 10 }} />

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => void handleDeleteTask()}
              className="items-center justify-center rounded-full"
              style={{
                flex: 1,
                minHeight: 40,
                borderWidth: 1,
                borderColor: confirmDeleteBorder,
                backgroundColor: swipeDeleteBackgroundColor,
              }}
            >
              <Text className="font-semibold text-label-sm" style={{ color: swipeDeleteIconColor }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        </TransparentModalShell>
      ) : null}

    </View>
  );
}
