import { Icon, LIST_ICON_COLORS } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";
import ProjectHeader from "@/components/ProjectHeader";
import ProjectMenu, { type ProjectMenuAction } from "@/components/ProjectMenu";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text, AppTextInput } from "@/components/ui";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SIZE_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import {
  completeInboxTodo,
  deleteInboxTodo,
  fetchJobById,
  JobDetail,
  type ChecklistStateItem,
  updateInboxTodo,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useQuickFindPullToOpen } from "@/lib/useQuickFindPullToOpen";
import { getThemeTokens } from "@/lib/theme";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  type GestureResponderEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  LinearTransition,
  interpolate,
  runOnJS,
  type SharedValue,
  useDerivedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

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

function getDaysUntilDate(targetDate: Date) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTarget = new Date(
    targetDate.getFullYear(),
    targetDate.getMonth(),
    targetDate.getDate(),
  );
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfTarget.getTime() - startOfToday.getTime()) / millisecondsPerDay,
  );
}

function formatSelectedDateLabel(date: Date) {
  const daysUntil = getDaysUntilDate(date);

  if (daysUntil === 0) {
    return "Today";
  }

  if (daysUntil === 1) {
    return "Tomorrow";
  }

  if (daysUntil > 1 && daysUntil <= 4) {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}, ${day} ${month}`;
}

function formatDaysUntilLabel(targetDate: Date) {
  const daysUntil = getDaysUntilDate(targetDate);

  if (daysUntil <= 0) {
    return "today";
  }

  if (daysUntil === 1) {
    return "1 day left";
  }

  return `${daysUntil} days left`;
}

function formatPriceLabel(price: number | null | undefined) {
  if (price === null || price === undefined || !Number.isFinite(price)) {
    return null;
  }

  const rounded = Math.round(price * 100) / 100;
  const hasDecimals = Math.abs(rounded % 1) > 0.000001;
  const formatted = new Intl.NumberFormat("sr-RS", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  }).format(rounded);

  return `${formatted} RSD`;
}

function parsePriceInputValue(rawValue: string): number | null {
  const normalized = rawValue
    .trim()
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  if (!normalized.length) {
    return null;
  }

  const decimalSeparatorCount = (normalized.match(/\./g) ?? []).length;
  if (decimalSeparatorCount > 1) {
    throw new Error("Unesi ispravnu cenu.");
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) {
    throw new Error("Unesi ispravnu cenu.");
  }

  if (parsed < 0) {
    throw new Error("Cena ne moze biti negativna.");
  }

  return Math.round(parsed * 100) / 100;
}

function parseDateOnly(dateIso: string | null | undefined) {
  if (!dateIso) {
    return null;
  }

  const date = new Date(`${dateIso}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatPaymentDateLabel(dateIso: string | null | undefined) {
  const date = parseDateOnly(dateIso);
  if (!date) {
    return "today";
  }

  if (getDaysUntilDate(date) === 0) {
    return "today";
  }

  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${day}. ${month}.`;
}

function toDateOnlyIso(date: Date) {
  const year = `${date.getFullYear()}`;
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const NOTES_MIN_HEIGHT = 44;
const CHECKLIST_FOCUS_RETRY_MS = 24;
const PAYMENTS_PREVIEW_LIMIT = 3;
const CHECKLIST_SWIPE_REVEAL_WIDTH = 64;
const CHECKLIST_SWIPE_DELETE_TRIGGER = 42;
const CHECKLIST_DRAG_SLOT_HEIGHT = 44;
const CHECKLIST_REORDER_ROW_LAYOUT = LinearTransition.duration(120);

type ChecklistItem = {
  id: string;
  text: string;
};

type JobStatus = "new" | "in_progress" | "waiting" | "blocked" | "someday";

function normalizeJobStatus(status: string | null | undefined): JobStatus {
  if (status === "in_progress" || status === "waiting" || status === "blocked") {
    return status;
  }

  if (status === "someday") {
    return "someday";
  }

  return "new";
}

function createChecklistItemId() {
  return `check-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function areChecklistStateItemsEqual(
  left: ChecklistStateItem[],
  right: ChecklistStateItem[],
) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftItem = left[index];
    const rightItem = right[index];

    if (!leftItem || !rightItem) {
      return false;
    }

    if (
      leftItem.text !== rightItem.text ||
      leftItem.completed !== rightItem.completed
    ) {
      return false;
    }
  }

  return true;
}

function normalizeCompletedIdsForItems(items: ChecklistItem[], completedIds: string[]) {
  const existingIds = new Set(items.map((item) => item.id));
  return completedIds.filter((itemId) => existingIds.has(itemId));
}

function buildChecklistStateItems(
  items: ChecklistItem[],
  completedIds: string[],
) {
  const completedIdSet = new Set(completedIds);

  return items
    .map((item) => {
      const text = item.text.trim();
      if (!text.length) {
        return null;
      }
      return {
        text,
        completed: completedIdSet.has(item.id),
      } satisfies ChecklistStateItem;
    })
    .filter((item): item is ChecklistStateItem => Boolean(item));
}

function SwipeableChecklistRow({
  onDelete,
  iconBgColor,
  iconColor,
  disabled = false,
  dragIconColor,
  dragDisabled = false,
  isDragActive = false,
  rowIndex,
  dragStartIndexValue,
  dragStepValue,
  dragSlotHeight = CHECKLIST_DRAG_SLOT_HEIGHT,
  dragPlaceholderColor,
  dragPlaceholderBorderColor,
  onDragStart,
  onDragStep,
  onDragEnd,
  children,
}: {
  onDelete: () => void;
  iconBgColor: string;
  iconColor: string;
  disabled?: boolean;
  dragIconColor?: string;
  dragDisabled?: boolean;
  isDragActive?: boolean;
  rowIndex: number;
  dragStartIndexValue: SharedValue<number>;
  dragStepValue: SharedValue<number>;
  dragSlotHeight?: number;
  dragPlaceholderColor?: string;
  dragPlaceholderBorderColor?: string;
  onDragStart?: () => void;
  onDragStep?: (step: number) => void;
  onDragEnd?: () => void;
  children: React.ReactNode;
}) {
  const translateX = useSharedValue(0);
  const gestureStartX = useSharedValue(0);
  const actionProgress = useSharedValue(0);
  const iconSpringProgress = useSharedValue(0);
  const iconTravelX = useSharedValue(0);
  const dragOffsetY = useSharedValue(0);
  const dragLiftProgress = useSharedValue(0);
  const dragStep = useSharedValue(0);
  const dragSlotHeightValue = useSharedValue(dragSlotHeight);
  const rowShiftYValue = useDerivedValue(() => {
    const startIndex = dragStartIndexValue.value;
    const step = dragStepValue.value;
    if (startIndex < 0 || step === 0) {
      return 0;
    }

    const targetIndex = startIndex + step;
    const slotHeight = Math.max(1, dragSlotHeightValue.value);

    if (isDragActive) {
      return (targetIndex - startIndex) * slotHeight;
    }

    if (targetIndex > startIndex && rowIndex > startIndex && rowIndex <= targetIndex) {
      return -slotHeight;
    }

    if (targetIndex < startIndex && rowIndex >= targetIndex && rowIndex < startIndex) {
      return slotHeight;
    }

    return 0;
  }, [dragSlotHeightValue, dragStartIndexValue, dragStepValue, isDragActive, rowIndex]);
  const rowContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: isDragActive ? 0 : rowShiftYValue.value }],
  }));
  const activePlaceholderStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: isDragActive ? rowShiftYValue.value : 0 }],
  }));
  const [isActionOpen, setIsActionOpen] = useState(false);
  const [measuredRowHeight, setMeasuredRowHeight] = useState(dragSlotHeight);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activeOffsetX([-8, 8])
        .failOffsetY([-10, 10])
        .onBegin(() => {
          gestureStartX.value = translateX.value;
        })
        .onUpdate((event) => {
          const next = Math.max(
            -CHECKLIST_SWIPE_REVEAL_WIDTH,
            Math.min(0, gestureStartX.value + event.translationX),
          );
          translateX.value = next;
          const nextProgress = Math.min(
            1,
            Math.max(0, Math.abs(next) / CHECKLIST_SWIPE_REVEAL_WIDTH),
          );
          const swipeDistance = Math.max(0, -event.translationX);
          actionProgress.value = nextProgress;
          iconSpringProgress.value = withSpring(nextProgress, {
            damping: 11,
            stiffness: 145,
            mass: 0.52,
          });
          iconTravelX.value = -Math.min(54, swipeDistance * 1.18);
        })
        .onEnd(() => {
          const shouldOpen = translateX.value <= -CHECKLIST_SWIPE_DELETE_TRIGGER;
          const targetProgress = shouldOpen ? 1 : 0;
          translateX.value = withTiming(shouldOpen ? -CHECKLIST_SWIPE_REVEAL_WIDTH : 0, {
            duration: 180,
          });
          actionProgress.value = targetProgress;
          iconSpringProgress.value = withSpring(targetProgress, {
            damping: 9,
            stiffness: 130,
            mass: 0.58,
          });
          iconTravelX.value = withSpring(0, {
            damping: 8,
            stiffness: 125,
            mass: 0.62,
          });
          runOnJS(setIsActionOpen)(shouldOpen);
        }),
    [actionProgress, disabled, gestureStartX, iconSpringProgress, iconTravelX, translateX],
  );

  const actionStyle = useAnimatedStyle(() => {
    const progress = iconSpringProgress.value;
    const translate = interpolate(progress, [0, 1], [34, 0], Extrapolation.CLAMP);
    const rotate = interpolate(progress, [0, 1], [115, 0], Extrapolation.CLAMP);
    const scale = interpolate(progress, [0, 1], [0.68, 1.08], Extrapolation.CLAMP);

    return {
      opacity: progress,
      transform: [
        { translateX: translate + iconTravelX.value },
        { rotate: `${rotate}deg` },
        { scale },
      ],
    };
  });

  const dragRowStyle = useAnimatedStyle(() => {
    const liftProg = dragLiftProgress.value;
    const scale = interpolate(liftProg, [0, 1], [1, 1.02], Extrapolation.CLAMP);
    const translateY = isDragActive ? dragOffsetY.value : 0;

    return {
      transform: [{ translateY }, { scale }],
      opacity: 1,
    };
  });

  const dragHandleStyle = useAnimatedStyle(() => {
    const progress = actionProgress.value;
    return {
      opacity: interpolate(progress, [0, 0.58, 1], [1, 0.38, 0], Extrapolation.CLAMP),
      transform: [
        {
          translateX: interpolate(progress, [0, 1], [0, -24], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const dragGesture = useMemo(() => {
    const canDrag =
      !dragDisabled &&
      typeof onDragStart === "function" &&
      typeof onDragStep === "function" &&
      typeof onDragEnd === "function";

    return Gesture.Pan()
      .enabled(canDrag)
      .activeOffsetY([-4, 4])
      .failOffsetX([-12, 12])
      .onBegin(() => {
        dragStep.value = 0;
        dragOffsetY.value = 0;
        dragLiftProgress.value = withTiming(1, { duration: 110 });
        if (onDragStart) {
          runOnJS(onDragStart)();
        }
      })
      .onUpdate((event) => {
        dragOffsetY.value = event.translationY;
        const slotHeight = Math.max(1, dragSlotHeightValue.value);
        const relativeSteps = event.translationY / slotHeight;
        const nextStep =
          relativeSteps >= 0
            ? Math.floor(relativeSteps)
            : Math.ceil(relativeSteps);
        if (nextStep !== dragStep.value) {
          dragStep.value = nextStep;
          if (onDragStep) {
            runOnJS(onDragStep)(nextStep);
          }
        }
      })
      .onFinalize(() => {
        dragLiftProgress.value = withTiming(0, { duration: 140 });
        dragOffsetY.value = withTiming(rowShiftYValue.value, { duration: 120 });
        if (onDragEnd) {
          runOnJS(onDragEnd)();
        }
      });
  }, [
    dragStep,
    dragDisabled,
    dragLiftProgress,
    dragOffsetY,
    onDragEnd,
    onDragStart,
    onDragStep,
    rowShiftYValue,
    dragSlotHeightValue,
  ]);

  useEffect(() => {
    if (!disabled) {
      return;
    }

    setIsActionOpen(false);
    translateX.value = withTiming(0, { duration: 120 });
    actionProgress.value = 0;
    iconSpringProgress.value = withSpring(0, {
      damping: 10,
      stiffness: 140,
      mass: 0.52,
    });
    iconTravelX.value = withSpring(0, {
      damping: 9,
      stiffness: 130,
      mass: 0.6,
    });
  }, [actionProgress, disabled, iconSpringProgress, iconTravelX, translateX]);

  useEffect(() => {
    dragSlotHeightValue.value = dragSlotHeight;
  }, [dragSlotHeight, dragSlotHeightValue]);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        layout={isDragActive ? undefined : CHECKLIST_REORDER_ROW_LAYOUT}
        style={[
          isDragActive
            ? {
                position: "relative",
                zIndex: 24,
                elevation: 12,
              }
            : {
                position: "relative",
                zIndex: 1,
                elevation: 1,
              },
          rowContainerStyle,
        ]}
      >
        <View
          style={{
            position: "relative",
            overflow: isDragActive ? "visible" : "hidden",
            borderRadius: 12,
          }}
          onLayout={(event) => {
            const nextHeight = Math.max(1, Math.round(event.nativeEvent.layout.height));
            if (Math.abs(nextHeight - measuredRowHeight) > 1) {
              setMeasuredRowHeight(nextHeight);
            }
          }}
        >
          {isDragActive ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  height: Math.max(1, measuredRowHeight || dragSlotHeight),
                  borderRadius: 12,
                  backgroundColor: dragPlaceholderColor ?? "rgba(128,128,128,0.16)",
                  borderWidth: 0,
                  borderColor: dragPlaceholderBorderColor ?? "transparent",
                },
                activePlaceholderStyle,
              ]}
            />
          ) : null}
          <Animated.View
            pointerEvents={isDragActive ? "none" : "auto"}
            style={
              isDragActive
                ? {
                    opacity: 0,
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 0,
                  }
                : undefined
            }
          >
            {children}
          </Animated.View>
          {isDragActive ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  zIndex: 40,
                  elevation: 18,
                },
                dragRowStyle,
              ]}
            >
              {children}
            </Animated.View>
          ) : null}
          {dragIconColor ? (
            <Animated.View
              pointerEvents={isActionOpen ? "none" : "auto"}
              style={[
                {
                  position: "absolute",
                  right: 6,
                  top: 0,
                  bottom: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 3,
                },
                dragHandleStyle,
              ]}
            >
              <GestureDetector gesture={dragGesture}>
                <View className="h-7 w-7 items-center justify-center">
                  <Icon name="dragHandle" size={17} color={dragIconColor} />
                </View>
              </GestureDetector>
            </Animated.View>
          ) : null}
          <Animated.View
            pointerEvents={isActionOpen ? "auto" : "none"}
            style={[
              {
                position: "absolute",
                right: 14,
                top: 0,
                bottom: 0,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 4,
                elevation: 4,
              },
              actionStyle,
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.82}
              className="items-center justify-center rounded-full"
              style={{ width: 19, height: 19, backgroundColor: iconBgColor }}
              disabled={!isActionOpen}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              onPress={() => {
                setIsActionOpen(false);
                translateX.value = withTiming(0, { duration: 160 });
                actionProgress.value = 0;
                iconSpringProgress.value = withSpring(0, {
                  damping: 10,
                  stiffness: 140,
                  mass: 0.52,
                });
                iconTravelX.value = withSpring(0, {
                  damping: 9,
                  stiffness: 130,
                  mass: 0.6,
                });
                onDelete();
              }}
            >
              <Icon name="close" size={11} color={iconColor} />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const isDark = colorMode === "dark";
  const theme = useMemo(() => getThemeTokens(isDark), [isDark]);
  const [job, setJob] = useState<JobDetail | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [notesInputHeight, setNotesInputHeight] = useState(NOTES_MIN_HEIGHT);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [savedChecklistStateItems, setSavedChecklistStateItems] = useState<
    ChecklistStateItem[]
  >([]);
  const [completedChecklistItemIds, setCompletedChecklistItemIds] = useState<
    string[]
  >([]);
  const [checklistDraft, setChecklistDraft] = useState("");
  const [isChecklistVisible, setIsChecklistVisible] = useState(false);
  const [isChecklistComposerOpen, setIsChecklistComposerOpen] = useState(false);
  const [draggingChecklistItemId, setDraggingChecklistItemId] = useState<string | null>(
    null,
  );
  const [checklistDragRowHeight, setChecklistDragRowHeight] = useState(
    CHECKLIST_DRAG_SLOT_HEIGHT,
  );
  const [editingChecklistItemId, setEditingChecklistItemId] = useState<string | null>(
    null,
  );
  const [editingChecklistText, setEditingChecklistText] = useState("");
  const [, setEditingChecklistOriginalText] = useState("");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [isRemindersModalOpen, setIsRemindersModalOpen] = useState(false);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [priceDraft, setPriceDraft] = useState("");
  const [isPriceInputFocused, setIsPriceInputFocused] = useState(false);
  const [isPaymentsExpanded, setIsPaymentsExpanded] = useState(false);
  const [isPaymentsTogglePressed, setIsPaymentsTogglePressed] = useState(false);
  const scrollY = useSharedValue(0);
  const quickFindRefreshControl = useQuickFindPullToOpen();
  const checklistDragStartIndexValue = useSharedValue(-1);
  const checklistDragStepValue = useSharedValue(0);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);
  const primaryTextColor = COLOR_TOKENS[colorMode]["text.primary"];
  const secondaryTextColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const subheaderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const titleMenuIconColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const titleMenuActiveBg = COLOR_TOKENS[colorMode]["bg.input"];
  const statusModalBg = COLOR_TOKENS[colorMode]["bg.popup"];
  const statusModalBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.42 : 0.24,
  );
  const statusModalDividerColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.34 : 0.18,
  );
  const statusModalWindowShadow = Platform.select({
    ios: {
      ...SHADOW_TOKENS.card.ios,
    },
    android: {
      elevation: SHADOW_TOKENS.card.android.elevation,
    },
    default: {},
  });
  const actionButtonBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    isDark ? 0.34 : 0.28,
  );
  const actionButtonHighlight = isDark
    ? "rgba(0, 0, 0, 0.24)"
    : "rgba(0, 0, 0, 0.08)";
  const actionButtonText = COLOR_TOKENS[colorMode]["text.primary"];
  const blurMethod =
    Platform.OS === "android"
      ? ("dimezisBlurView" as const)
      : undefined;
  const authFieldBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const authInputLabelColor = theme.onboardingTitle;
  const authFocusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const authPlaceholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const authIdleBorderColor = authPlaceholderColor;
  const authFieldHeight = SPACING_TOKENS["4xl"];
  const authControlRadius = RADIUS_TOKENS.control;
  const authFocusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const authSubtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const metadataSeparatorColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    0.24,
  );
  const metadataGroupLayout = LinearTransition.duration(260);
  const metadataRowLayout = LinearTransition.duration(260);
  const checklistActiveBg = withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.78);
  const checklistDotColor = subheaderColor;
  const checklistCheckColor = secondaryTextColor;
  const checklistCompletedTextColor = withOpacity(primaryTextColor, 0.58);
  const checklistDragHandleColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.9 : 0.74,
  );
  const checklistDragActiveBg =
    colorMode === "dark" ? "#36537A" : "#D9E9FF";
  const checklistDragPlaceholderBg = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.18 : 0.12,
  );
  const checklistDragPlaceholderBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    colorMode === "dark" ? 0.38 : 0.24,
  );
  const checklistDragActiveBorderColor = withOpacity(
    COLOR_TOKENS[colorMode]["primary.soft"],
    colorMode === "dark" ? 0.6 : 0.44,
  );
  const checklistDragActiveShadow = Platform.select({
    ios: {
      shadowColor: COLOR_TOKENS[colorMode]["primary.soft"],
      shadowOpacity: colorMode === "dark" ? 0.24 : 0.16,
      shadowOffset: { width: 0, height: 2 },
      shadowRadius: 8,
    },
    android: {
      elevation: 2,
    },
    default: {},
  });
  const checklistDeleteIconBg = "#D15B52";
  const checklistDeleteIconColor = COLOR_TOKENS.light["bg.base"];
  const paymentAccentColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const paymentCheckIconColor = COLOR_TOKENS.light["text.primary"];
  const paymentsToggleBgPressed = withOpacity(
    COLOR_TOKENS[colorMode]["bg.input"],
    colorMode === "dark" ? 0.88 : 0.86,
  );
  const emptySectionEmbossTextStyle = {
    color: withOpacity(primaryTextColor, colorMode === "dark" ? 0.26 : 0.22),
    textShadowColor:
      colorMode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.72)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  } as const;

  const statusColorByKey = useMemo<Record<JobStatus, string>>(
    () => ({
      new: COLOR_TOKENS[colorMode]["primary.default"],
      in_progress: LIST_ICON_COLORS["--color-upcoming"],
      waiting: "#F2B24A",
      blocked: "#D15B52",
      someday: LIST_ICON_COLORS["--color-someday"],
    }),
    [colorMode],
  );

  const statusOptions = useMemo(
    () =>
      [
        { key: "new", label: "To do" },
        { key: "in_progress", label: "In progress" },
        { key: "waiting", label: "Waiting" },
        { key: "blocked", label: "Blocked" },
        { key: "someday", label: "Someday" },
      ] as const,
    [],
  );
  const checklistDraftInputRef = useRef<RNTextInput>(null);
  const checklistItemInputRefs = useRef<Record<string, RNTextInput | null>>({});
  const priceInputRef = useRef<RNTextInput>(null);
  const priceInputFocusTimeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const checklistItemsRef = useRef<ChecklistItem[]>([]);
  const savedChecklistStateItemsRef = useRef<ChecklistStateItem[]>([]);
  const skipChecklistBlurForItemIdRef = useRef<string | null>(null);
  const checklistDragStartIndexRef = useRef<number | null>(null);
  const checklistDragPendingStepRef = useRef(0);
  const draggingChecklistItemIdRef = useRef<string | null>(null);
  const draggingChecklistResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const payments = job?.payments ?? [];
  const hiddenPaymentsCount = Math.max(payments.length - PAYMENTS_PREVIEW_LIMIT, 0);
  const visiblePayments =
    isPaymentsExpanded || payments.length <= PAYMENTS_PREVIEW_LIMIT
      ? payments
      : payments.slice(0, PAYMENTS_PREVIEW_LIMIT);

  const loadJob = useCallback(async () => {
    if (!id) {
      setJob(null);
      setErrorMessage("Nedostaje ID posla.");
      return;
    }

    if (!isSupabaseConfigured) {
      setJob(null);
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    try {
      const data = await fetchJobById(id);
      setJob(data);
      setErrorMessage(null);
    } catch (error) {
      setJob(null);
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da ucitam posao.",
      );
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadJob();
    }, [loadJob]),
  );

  useEffect(() => {
    const nextNotes = job?.description ?? "";
    setNotesDraft(nextNotes);
    setSavedNotes(nextNotes);
  }, [job?.description, job?.id]);

  useEffect(() => {
    setIsPaymentsExpanded(false);
    setIsPaymentsTogglePressed(false);
  }, [job?.id]);

  useEffect(() => {
    if (draggingChecklistResetTimeoutRef.current) {
      clearTimeout(draggingChecklistResetTimeoutRef.current);
      draggingChecklistResetTimeoutRef.current = null;
    }
    draggingChecklistItemIdRef.current = null;
    checklistDragStartIndexRef.current = null;
    checklistDragPendingStepRef.current = 0;
    checklistDragStartIndexValue.value = -1;
    checklistDragStepValue.value = 0;
    setDraggingChecklistItemId(null);
  }, [checklistDragStartIndexValue, checklistDragStepValue, job?.id]);

  useEffect(() => {
    checklistItemsRef.current = checklistItems;
  }, [checklistItems]);

  useEffect(() => {
    savedChecklistStateItemsRef.current = savedChecklistStateItems;
  }, [savedChecklistStateItems]);

  useEffect(() => {
    const jobChecklistState = job?.checklist_state_items ?? [];
    const nextChecklistItems = jobChecklistState.map((item) => ({
      id: createChecklistItemId(),
      text: item.text,
    }));
    const nextCompletedChecklistItemIds = nextChecklistItems
      .filter((_, index) => jobChecklistState[index]?.completed)
      .map((item) => item.id);
    setChecklistItems(nextChecklistItems);
    setSavedChecklistStateItems(jobChecklistState);
    setCompletedChecklistItemIds(nextCompletedChecklistItemIds);
    setChecklistDraft("");
    setIsChecklistVisible(jobChecklistState.length > 0);
    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    skipChecklistBlurForItemIdRef.current = null;
  }, [job?.id, job?.checklist_state_items]);

  useEffect(() => {
    if (!isChecklistComposerOpen) {
      return;
    }

    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
  }, [isChecklistComposerOpen]);

  useEffect(() => {
    setCompletedChecklistItemIds((current) => {
      if (current.length === 0) {
        return current;
      }

      const existingIds = new Set(checklistItems.map((item) => item.id));
      const next = current.filter((itemId) => existingIds.has(itemId));

      return next.length === current.length ? current : next;
    });
  }, [checklistItems]);

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

  const scheduledDateObj = parseDateOnly(job?.scheduled_date);
  const deadlineDateObj = parseDateOnly(job?.deadline_date);
  const currentJobStatus = normalizeJobStatus(job?.status);
  const statusIndicatorFillColor = statusColorByKey[currentJobStatus];
  const scheduledDateLabel = scheduledDateObj
    ? formatSelectedDateLabel(scheduledDateObj)
    : null;
  const deadlineDateLabel = deadlineDateObj
    ? formatSelectedDateLabel(deadlineDateObj)
    : null;
  const deadlineDaysLeftLabel = deadlineDateObj
    ? formatDaysUntilLabel(deadlineDateObj)
    : null;
  const priceLabel = formatPriceLabel(job?.price);
  const hasPriceValue = job?.price !== null && job?.price !== undefined;
  const paidAmount = (job?.payments ?? []).reduce((sum, payment) => {
    const amount = payment.amount;
    if (!Number.isFinite(amount)) {
      return sum;
    }
    return sum + (amount ?? 0);
  }, 0);
  const debtAmount = hasPriceValue
    ? Math.max((job?.price ?? 0) - paidAmount, 0)
    : null;
  const debtPriceMetaLabel =
    debtAmount === null ? "—" : (formatPriceLabel(debtAmount) ?? "0 RSD");
  const metaIconColor = secondaryTextColor;
  const selectedWhenState: "none" | "date" | "today" | "someday" =
    scheduledDateObj ? "date" : job?.status === "someday" ? "someday" : "none";

  const openClientsModal = useCallback(() => {
    if (!job?.id) {
      router.push("/clients");
      return;
    }

    router.push({
      pathname: "/clients",
      params: {
        jobId: job.id,
        ...(job.client_id ? { selectedClientId: job.client_id } : {}),
      },
    });
  }, [job?.client_id, job?.id]);

  const openWhenModal = useCallback(() => {
    setIsWhenModalOpen(true);
  }, []);

  const closeWhenModal = useCallback(() => {
    setIsWhenModalOpen(false);
  }, []);

  const openRemindersModal = useCallback(() => {
    setIsRemindersModalOpen(true);
  }, []);

  const closeRemindersModal = useCallback(() => {
    setIsRemindersModalOpen(false);
  }, []);

  const openDeadlineModal = useCallback(() => {
    setIsDeadlineModalOpen(true);
  }, []);

  const closeDeadlineModal = useCallback(() => {
    setIsDeadlineModalOpen(false);
  }, []);

  const openStatusModal = useCallback(() => {
    requestAnimationFrame(() => {
      setIsStatusModalOpen(true);
    });
  }, []);

  const closeStatusModal = useCallback(() => {
    setIsStatusModalOpen(false);
  }, []);

  const openPriceModal = useCallback(() => {
    setPriceDraft(job?.price !== null && job?.price !== undefined ? `${job.price}` : "");
    setIsPriceInputFocused(false);
    requestAnimationFrame(() => {
      setIsPriceModalOpen(true);
    });
  }, [job?.price]);

  const closePriceModal = useCallback(() => {
    setIsPriceModalOpen(false);
  }, []);

  const openNewPaymentModal = useCallback(() => {
    if (!job?.id) {
      router.push("/new-payment");
      return;
    }

    router.push({
      pathname: "/new-payment",
      params: {
        jobId: job.id,
      },
    });
  }, [job?.id]);

  const clearPriceInputFocusTimers = useCallback(() => {
    if (priceInputFocusTimeoutsRef.current.length === 0) {
      return;
    }

    for (const timeoutId of priceInputFocusTimeoutsRef.current) {
      clearTimeout(timeoutId);
    }
    priceInputFocusTimeoutsRef.current = [];
  }, []);

  const focusPriceInputNow = useCallback(() => {
    if (!isPriceModalOpen) {
      return;
    }

    priceInputRef.current?.focus();
  }, [isPriceModalOpen]);

  const schedulePriceInputFocus = useCallback(
    (delays: number[] = [80, 200, 360, 560]) => {
      clearPriceInputFocusTimers();

      priceInputFocusTimeoutsRef.current = delays.map((delayMs) =>
        setTimeout(() => {
          focusPriceInputNow();
        }, delayMs),
      );
    },
    [clearPriceInputFocusTimers, focusPriceInputNow],
  );

  const setPriceInputNode = useCallback(
    (input: RNTextInput | null) => {
      priceInputRef.current = input;

      if (input && isPriceModalOpen) {
        schedulePriceInputFocus([0, 90, 220]);
      }
    },
    [isPriceModalOpen, schedulePriceInputFocus],
  );

  useEffect(() => {
    if (!isPriceModalOpen) {
      clearPriceInputFocusTimers();
      return;
    }

    schedulePriceInputFocus([100, 240, 420, 700]);

    return () => {
      clearPriceInputFocusTimers();
    };
  }, [clearPriceInputFocusTimers, isPriceModalOpen, schedulePriceInputFocus]);

  useEffect(
    () => () => {
      clearPriceInputFocusTimers();
    },
    [clearPriceInputFocusTimers],
  );

  const persistJobMetadata = useCallback(
    async (input: {
      scheduledDateIso?: string | null;
      deadlineDateIso?: string | null;
      status?: JobStatus | null;
      price?: number | null;
    }) => {
      if (!job) {
        return;
      }

      const previousJob = job;
      const nextJob: JobDetail = {
        ...job,
        scheduled_date:
          input.scheduledDateIso !== undefined
            ? input.scheduledDateIso
            : job.scheduled_date,
        deadline_date:
          input.deadlineDateIso !== undefined
            ? input.deadlineDateIso
            : job.deadline_date,
        status:
          input.status !== undefined
            ? input.status === "new"
              ? null
              : input.status
            : job.status,
        price: input.price !== undefined ? input.price : job.price,
      };

      setJob(nextJob);
      setErrorMessage(null);

      try {
        await updateInboxTodo(job.id, {
          title: job.title?.trim() || "Bez naslova",
          scheduledDateIso: input.scheduledDateIso,
          deadlineDateIso: input.deadlineDateIso,
          status: input.status,
          price: input.price,
        });
      } catch (error) {
        setJob(previousJob);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da sacuvam izmene.",
        );
      }
    },
    [job],
  );

  const handleSelectWhenDate = useCallback(
    (date: Date) => {
      const shouldLeaveSomeday = job?.status === "someday";
      void persistJobMetadata({
        scheduledDateIso: toDateOnlyIso(date),
        ...(shouldLeaveSomeday ? { status: "new" as const } : {}),
      });
    },
    [job?.status, persistJobMetadata],
  );

  const handleSelectToday = useCallback(() => {
    const shouldLeaveSomeday = job?.status === "someday";
    void persistJobMetadata({
      scheduledDateIso: toDateOnlyIso(new Date()),
      ...(shouldLeaveSomeday ? { status: "new" as const } : {}),
    });
  }, [job?.status, persistJobMetadata]);

  const handleSelectSomeday = useCallback(() => {
    void persistJobMetadata({
      scheduledDateIso: null,
      status: "someday",
    });
  }, [persistJobMetadata]);

  const handleClearWhenSelection = useCallback(() => {
    const shouldLeaveSomeday = job?.status === "someday";
    void persistJobMetadata({
      scheduledDateIso: null,
      ...(shouldLeaveSomeday ? { status: "new" as const } : {}),
    });
  }, [job?.status, persistJobMetadata]);

  const handleSelectStatus = useCallback(
    (status: JobStatus) => {
      closeStatusModal();
      if (status === "someday") {
        void persistJobMetadata({
          status: "someday",
          scheduledDateIso: null,
        });
        return;
      }
      void persistJobMetadata({ status });
    },
    [closeStatusModal, persistJobMetadata],
  );

  const handleSelectDeadlineDate = useCallback(
    (date: Date) => {
      void persistJobMetadata({
        deadlineDateIso: toDateOnlyIso(date),
      });
    },
    [persistJobMetadata],
  );

  const handleClearDeadlineSelection = useCallback(() => {
    void persistJobMetadata({
      deadlineDateIso: null,
    });
  }, [persistJobMetadata]);

  const handleSavePrice = useCallback(() => {
    if (!job) {
      return;
    }

    try {
      const nextPrice = parsePriceInputValue(priceDraft);
      closePriceModal();
      void persistJobMetadata({
        price: nextPrice,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da sacuvam cenu.",
      );
    }
  }, [closePriceModal, job, persistJobMetadata, priceDraft]);

  const handleClearPrice = useCallback(() => {
    closePriceModal();
    setPriceDraft("");
    void persistJobMetadata({
      price: null,
    });
  }, [closePriceModal, persistJobMetadata]);

  const persistNotes = useCallback(async () => {
    if (!job) {
      return;
    }

    const nextNotes = notesDraft.trim();
    const previousNotes = savedNotes.trim();

    if (nextNotes === previousNotes) {
      return;
    }

    const previousDescription = savedNotes;

    setSavedNotes(nextNotes);
    setErrorMessage(null);
    setJob((current) =>
      current
        ? {
            ...current,
            description: nextNotes || null,
          }
        : current,
    );

    try {
      await updateInboxTodo(job.id, {
        title: job.title?.trim() || "Bez naslova",
        description: nextNotes,
      });
    } catch (error) {
      setSavedNotes(previousDescription);
      setNotesDraft(previousDescription);
      setJob((current) =>
        current
          ? {
              ...current,
              description: previousDescription || null,
            }
          : current,
      );
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da sacuvam notes.",
      );
    }
  }, [job, notesDraft, savedNotes]);

  const focusChecklistDraftWithRetry = useCallback((attempt = 0) => {
    const targetInput = checklistDraftInputRef.current;

    if (targetInput) {
      targetInput.focus();
      return;
    }

    if (attempt >= 20) {
      return;
    }

    setTimeout(() => {
      focusChecklistDraftWithRetry(attempt + 1);
    }, CHECKLIST_FOCUS_RETRY_MS);
  }, []);

  const focusChecklistItemWithRetry = useCallback((itemId: string, attempt = 0) => {
    const targetInput = checklistItemInputRefs.current[itemId] ?? null;

    if (targetInput) {
      targetInput.focus();
      return;
    }

    if (attempt >= 20) {
      return;
    }

    setTimeout(() => {
      focusChecklistItemWithRetry(itemId, attempt + 1);
    }, CHECKLIST_FOCUS_RETRY_MS);
  }, []);

  const persistChecklistItems = useCallback(
    async (nextItems: ChecklistItem[], nextCompletedIds?: string[]) => {
      if (!job) {
        return;
      }

      const previousItems = checklistItemsRef.current;
      const previousCompletedIds = completedChecklistItemIds;
      const previousSavedItems = savedChecklistStateItemsRef.current;
      const resolvedCompletedIds = normalizeCompletedIdsForItems(
        nextItems,
        nextCompletedIds ?? completedChecklistItemIds,
      );
      const nextChecklistStateItems = buildChecklistStateItems(
        nextItems,
        resolvedCompletedIds,
      );

      if (areChecklistStateItemsEqual(nextChecklistStateItems, previousSavedItems)) {
        setChecklistItems(nextItems);
        checklistItemsRef.current = nextItems;
        setCompletedChecklistItemIds(resolvedCompletedIds);
        return;
      }

      setChecklistItems(nextItems);
      checklistItemsRef.current = nextItems;
      setCompletedChecklistItemIds(resolvedCompletedIds);
      setSavedChecklistStateItems(nextChecklistStateItems);
      savedChecklistStateItemsRef.current = nextChecklistStateItems;
      setErrorMessage(null);

      try {
        await updateInboxTodo(job.id, {
          title: job.title?.trim() || "Bez naslova",
          checklistStateItems: nextChecklistStateItems,
        });
      } catch (error) {
        setChecklistItems(previousItems);
        checklistItemsRef.current = previousItems;
        setCompletedChecklistItemIds(previousCompletedIds);
        setSavedChecklistStateItems(previousSavedItems);
        savedChecklistStateItemsRef.current = previousSavedItems;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da sacuvam checklistu.",
        );
      }
    },
    [completedChecklistItemIds, job],
  );

  const openChecklistComposer = useCallback(() => {
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  }, [focusChecklistDraftWithRetry]);

  const handleSubmitChecklistDraft = useCallback(() => {
    const trimmedDraft = checklistDraft.trim();

    if (!trimmedDraft.length) {
      return;
    }

    const nextItems = [
      ...checklistItemsRef.current,
      { id: createChecklistItemId(), text: trimmedDraft },
    ];

    setChecklistDraft("");
    setIsChecklistVisible(true);
    setIsChecklistComposerOpen(true);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    void persistChecklistItems(nextItems);
    requestAnimationFrame(() => {
      focusChecklistDraftWithRetry();
    });
  }, [checklistDraft, focusChecklistDraftWithRetry, persistChecklistItems]);

  const closeChecklistComposer = useCallback(() => {
    const trimmedDraft = checklistDraft.trim();

    if (trimmedDraft.length > 0) {
      const nextItems = [
        ...checklistItemsRef.current,
        { id: createChecklistItemId(), text: trimmedDraft },
      ];
      setChecklistDraft("");
      setIsChecklistVisible(true);
      setIsChecklistComposerOpen(false);
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
      return;
    }

    setIsChecklistComposerOpen(false);
    setEditingChecklistItemId(null);
    setEditingChecklistText("");
    setEditingChecklistOriginalText("");
    setIsChecklistVisible(checklistItemsRef.current.length > 0);
  }, [checklistDraft, persistChecklistItems]);

  const handleChecklistRowPress = useCallback(
    (item: ChecklistItem) => {
      setIsChecklistVisible(true);
      setIsChecklistComposerOpen(false);
      setEditingChecklistItemId(item.id);
      setEditingChecklistText(item.text);
      setEditingChecklistOriginalText(item.text);
      requestAnimationFrame(() => {
        focusChecklistItemWithRetry(item.id);
      });
    },
    [focusChecklistItemWithRetry],
  );

  const handleChecklistCompleteToggle = useCallback((itemId: string) => {
    const currentItems = checklistItemsRef.current;
    const nextCompletedIds = completedChecklistItemIds.includes(itemId)
      ? completedChecklistItemIds.filter((entry) => entry !== itemId)
      : [...completedChecklistItemIds, itemId];

    setCompletedChecklistItemIds(nextCompletedIds);
    void persistChecklistItems(currentItems, nextCompletedIds);
  }, [completedChecklistItemIds, persistChecklistItems]);

  const handleChecklistItemTextChange = useCallback((itemId: string, text: string) => {
    setEditingChecklistText(text);
    setChecklistItems((current) => {
      const next = current.map((entry) =>
        entry.id === itemId ? { ...entry, text } : entry,
      );
      checklistItemsRef.current = next;
      return next;
    });
  }, []);

  const removeChecklistItem = useCallback(
    (itemId: string, options?: { focusNeighbor?: boolean }) => {
      const focusNeighbor = options?.focusNeighbor ?? true;
      if (draggingChecklistItemIdRef.current === itemId) {
        if (draggingChecklistResetTimeoutRef.current) {
          clearTimeout(draggingChecklistResetTimeoutRef.current);
          draggingChecklistResetTimeoutRef.current = null;
        }
        draggingChecklistItemIdRef.current = null;
        checklistDragStartIndexRef.current = null;
        checklistDragPendingStepRef.current = 0;
        checklistDragStartIndexValue.value = -1;
        checklistDragStepValue.value = 0;
        setDraggingChecklistItemId(null);
      }
      skipChecklistBlurForItemIdRef.current = itemId;
      const currentItems = checklistItemsRef.current;
      const removedIndex = currentItems.findIndex((entry) => entry.id === itemId);

      if (removedIndex === -1) {
        skipChecklistBlurForItemIdRef.current = null;
        return;
      }

      const nextItems = currentItems.filter((entry) => entry.id !== itemId);
      const nextCompletedIds = completedChecklistItemIds.filter(
        (entry) => entry !== itemId,
      );

      if (nextItems.length > 0 && focusNeighbor) {
        const previousIndex = Math.max(0, removedIndex - 1);
        const previousItem = nextItems[previousIndex];
        if (previousItem) {
          setEditingChecklistItemId(previousItem.id);
          setEditingChecklistText(previousItem.text);
          setEditingChecklistOriginalText(previousItem.text);
          setIsChecklistVisible(true);
          setIsChecklistComposerOpen(false);
          requestAnimationFrame(() => {
            focusChecklistItemWithRetry(previousItem.id);
          });
        }
      } else {
        setEditingChecklistItemId(null);
        setEditingChecklistText("");
        setEditingChecklistOriginalText("");
        setIsChecklistVisible(nextItems.length > 0 ? true : isChecklistComposerOpen);
        if (!focusNeighbor) {
          setIsChecklistComposerOpen(false);
        }
      }

      setCompletedChecklistItemIds(nextCompletedIds);
      void persistChecklistItems(nextItems, nextCompletedIds);
    },
    [
      completedChecklistItemIds,
      focusChecklistItemWithRetry,
      isChecklistComposerOpen,
      persistChecklistItems,
    ],
  );

  const handleChecklistDragStart = useCallback(
    (itemId: string) => {
      if (editingChecklistItemId !== null || isChecklistComposerOpen) {
        return;
      }

      const currentItems = checklistItemsRef.current;
      const startIndex = currentItems.findIndex((entry) => entry.id === itemId);
      if (startIndex === -1) {
        return;
      }

      if (draggingChecklistResetTimeoutRef.current) {
        clearTimeout(draggingChecklistResetTimeoutRef.current);
        draggingChecklistResetTimeoutRef.current = null;
      }
      checklistDragStartIndexRef.current = startIndex;
      checklistDragPendingStepRef.current = 0;
      checklistDragStartIndexValue.value = startIndex;
      checklistDragStepValue.value = 0;
      draggingChecklistItemIdRef.current = itemId;
      setDraggingChecklistItemId(itemId);
      setIsChecklistComposerOpen(false);
    },
    [
      checklistDragStartIndexValue,
      checklistDragStepValue,
      editingChecklistItemId,
      isChecklistComposerOpen,
    ],
  );

  const handleChecklistDragStep = useCallback((itemId: string, step: number) => {
    if (draggingChecklistItemIdRef.current !== itemId) {
      return;
    }

    const startIndex = checklistDragStartIndexRef.current;
    if (startIndex === null) {
      return;
    }

    const currentItems = checklistItemsRef.current;
    const currentIndex = currentItems.findIndex((entry) => entry.id === itemId);
    if (currentIndex === -1) {
      return;
    }

    const clampedTargetIndex = Math.max(0, Math.min(currentItems.length - 1, startIndex + step));
    const nextStep = clampedTargetIndex - startIndex;
    checklistDragPendingStepRef.current = nextStep;
    checklistDragStepValue.value = nextStep;
    void Haptics.selectionAsync();
  }, [checklistDragStepValue]);

  const handleChecklistDragEnd = useCallback(
    (itemId: string) => {
      if (draggingChecklistItemIdRef.current !== itemId) {
        return;
      }

      let nextItemsAfterDrop: ChecklistItem[] | null = null;
      const pendingStep = checklistDragPendingStepRef.current;
      const startIndex = checklistDragStartIndexRef.current;
      if (pendingStep !== 0 && startIndex !== null) {
        const currentItems = checklistItemsRef.current;
        const sourceIndex = currentItems.findIndex((entry) => entry.id === itemId);
        if (sourceIndex !== -1) {
          const targetIndex = Math.max(
            0,
            Math.min(currentItems.length - 1, startIndex + pendingStep),
          );
          if (sourceIndex !== targetIndex) {
            const reorderedItems = [...currentItems];
            const [movedItem] = reorderedItems.splice(sourceIndex, 1);
            if (movedItem) {
              reorderedItems.splice(targetIndex, 0, movedItem);
              nextItemsAfterDrop = reorderedItems;
            }
          }
        }
      }

      if (draggingChecklistResetTimeoutRef.current) {
        clearTimeout(draggingChecklistResetTimeoutRef.current);
      }
      draggingChecklistResetTimeoutRef.current = setTimeout(() => {
        draggingChecklistResetTimeoutRef.current = null;
        if (draggingChecklistItemIdRef.current !== itemId) {
          return;
        }

        if (nextItemsAfterDrop) {
          checklistItemsRef.current = nextItemsAfterDrop;
          setChecklistItems(nextItemsAfterDrop);
          void persistChecklistItems(nextItemsAfterDrop);
        }

        draggingChecklistItemIdRef.current = null;
        checklistDragStartIndexRef.current = null;
        checklistDragPendingStepRef.current = 0;
        checklistDragStartIndexValue.value = -1;
        checklistDragStepValue.value = 0;
        setDraggingChecklistItemId(null);
      }, 140);
    },
    [checklistDragStartIndexValue, checklistDragStepValue, persistChecklistItems],
  );

  const commitChecklistEditing = useCallback(
    (itemId: string) => {
      const currentText =
        checklistItemsRef.current.find((entry) => entry.id === itemId)?.text ?? "";
      const trimmedText = currentText.trim();

      if (!trimmedText.length) {
        removeChecklistItem(itemId);
        return;
      }

      const nextItems = checklistItemsRef.current.map((entry) =>
        entry.id === itemId ? { ...entry, text: trimmedText } : entry,
      );
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
    },
    [persistChecklistItems, removeChecklistItem],
  );

  const finalizeChecklistEditingOnBlur = useCallback(
    (itemId: string) => {
      const currentText =
        checklistItemsRef.current.find((entry) => entry.id === itemId)?.text ?? "";
      const trimmedText = currentText.trim();

      if (!trimmedText.length) {
        removeChecklistItem(itemId);
        return;
      }

      const nextItems = checklistItemsRef.current.map((entry) =>
        entry.id === itemId ? { ...entry, text: trimmedText } : entry,
      );
      setEditingChecklistItemId(null);
      setEditingChecklistText("");
      setEditingChecklistOriginalText("");
      void persistChecklistItems(nextItems);
    },
    [persistChecklistItems, removeChecklistItem],
  );

  const closeJobMenu = useCallback(() => {
    setIsMenuOpen(false);
    setMenuAnchor(null);
  }, []);

  const openJobMenu = useCallback((event: GestureResponderEvent) => {
    setMenuAnchor({
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    });
    setIsMenuOpen(true);
  }, []);

  const handleCompleteFromMenu = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      await completeInboxTodo(job.id);
      closeJobMenu();
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da oznacim posao kao zavrsen.",
      );
    }
  }, [closeJobMenu, job]);

  const handleDeleteFromMenu = useCallback(async () => {
    if (!job) {
      return;
    }

    try {
      await deleteInboxTodo(job.id);
      closeJobMenu();
      router.back();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Nisam uspeo da obrisem posao.",
      );
    }
  }, [closeJobMenu, job]);

  const jobMenuActions = useMemo<ProjectMenuAction[]>(
    () => [
      {
        key: "complete-project",
        label: "Complete Project",
        icon: "checkCircle",
        onPress: () => {
          void handleCompleteFromMenu();
        },
      },
      {
        key: "when",
        label: "When",
        icon: "upcoming",
        onPress: openWhenModal,
      },
      {
        key: "change-status",
        label: "Change status",
        icon: "todo",
        onPress: openStatusModal,
      },
      {
        key: "add-client",
        label: "Add Client",
        icon: "client",
        onPress: openClientsModal,
      },
      {
        key: "change-price",
        label: hasPriceValue ? "Edit Price" : "Set Price",
        icon: "tag",
        onPress: openPriceModal,
      },
      {
        key: "deadline",
        label: "Deadline",
        icon: "flag",
        onPress: openDeadlineModal,
      },
      {
        key: "delete",
        label: "Delete",
        icon: "trash",
        onPress: () => {
          void handleDeleteFromMenu();
        },
        destructive: true,
        showSeparatorAbove: true,
      },
    ],
    [
      handleCompleteFromMenu,
      handleDeleteFromMenu,
      hasPriceValue,
      openClientsModal,
      openDeadlineModal,
      openPriceModal,
      openStatusModal,
      openWhenModal,
    ],
  );

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title={job?.title?.trim() || "Job"}
        titleAnimatedStyle={headerTitleAnimatedStyle}
        pullDownScrollY={scrollY}
        onBack={() => router.back()}
        onTitleActionPress={openJobMenu}
        titleActionDisabled={!job}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={quickFindRefreshControl}
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 132, flexGrow: 1 }}
      >
        <Animated.View
          className="mb-1 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <View
            className="h-[22px] w-[22px] items-center justify-center rounded-full"
            style={{
              borderWidth: 1.4,
              borderColor: withOpacity(secondaryTextColor, 0.6),
            }}
          >
            <View
              className="h-[12px] w-[12px] rounded-full"
              style={{ backgroundColor: statusIndicatorFillColor }}
            />
          </View>
          <View className="ml-2.5 flex-1 flex-row items-center">
            <Text
              numberOfLines={1}
              className="font-bold text-things-text text-things-title-large"
              style={{ maxWidth: "88%" }}
            >
              {job?.title?.trim() || "Bez naslova"}
            </Text>
            <TouchableOpacity
              onPress={openJobMenu}
              disabled={!job}
              className="ml-1 h-9 w-9 items-center justify-center rounded-full"
              style={isMenuOpen ? { backgroundColor: titleMenuActiveBg } : undefined}
              activeOpacity={0.75}
            >
              <Icon name="ellipsisPlain" size={28} color={titleMenuIconColor} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {job ? (
          <Animated.View
            className="mb-2 ml-8 min-w-0 flex-row items-center"
            style={heroTitleAnimatedStyle}
          >
            <TouchableOpacity
              activeOpacity={0.72}
              className="min-w-0 shrink flex-row items-center"
              onPress={openClientsModal}
            >
              <Icon
                name="client"
                size={14}
                color={metaIconColor}
                weight="light"
              />
              <Text
                variant="labelSm"
                className="ml-1 font-regular"
                style={{ color: secondaryTextColor, flexShrink: 1 }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {job.client_name ?? "Add client"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.72}
              className="ml-3 flex-row items-center"
              onPress={openPriceModal}
            >
              <Icon
                name="tag"
                size={14}
                color={metaIconColor}
                weight="light"
              />
              <Text
                variant="labelSm"
                className="ml-1 font-regular"
                style={{ color: secondaryTextColor }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {priceLabel ?? "Set price"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.72}
              className="ml-3 flex-row items-center"
              onPress={openPriceModal}
            >
              <Icon
                name="dollar"
                size={14}
                color={metaIconColor}
                weight="light"
              />
              <Text
                variant="labelSm"
                className="ml-1 font-regular"
                style={{ color: secondaryTextColor }}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {debtPriceMetaLabel}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {job ? (
          <View className="mb-20">
            <Animated.View
              className="mb-5"
              layout={draggingChecklistItemId !== null ? undefined : metadataGroupLayout}
            >
                {scheduledDateLabel ? (
                  <Animated.View
                    key="meta-when"
                    layout={metadataRowLayout}
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(260)}
                    className="overflow-hidden"
                  >
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="min-w-0 flex-row items-center pr-[10px] py-2.5"
                      onPress={openWhenModal}
                      style={{
                        borderTopWidth: 0.5,
                        borderBottomWidth: 0.5,
                        borderColor: metadataSeparatorColor,
                      }}
                    >
                      <Icon
                        name="upcoming"
                        size={16}
                        color="var(--color-upcoming)"
                        weight="light"
                      />
                      <Text
                        variant="label"
                        className="ml-2 font-semibold"
                        style={{ color: primaryTextColor, flexShrink: 1 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {scheduledDateLabel}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}

                {deadlineDateLabel ? (
                  <Animated.View
                    key="meta-deadline"
                    layout={metadataRowLayout}
                    entering={FadeIn.duration(260)}
                    exiting={FadeOut.duration(260)}
                    className="overflow-hidden"
                  >
                    <TouchableOpacity
                      activeOpacity={0.72}
                      className="min-w-0 flex-row items-center pr-[10px] py-2.5"
                      onPress={openDeadlineModal}
                      style={{
                        borderTopWidth: 0.5,
                        borderBottomWidth: 0.5,
                        borderColor: metadataSeparatorColor,
                      }}
                    >
                      <Icon
                        name="flag"
                        size={16}
                        color={primaryTextColor}
                        weight="light"
                      />
                      <View className="ml-2 min-w-0 shrink flex-row items-center">
                        <Text
                          variant="label"
                          className="font-semibold"
                          style={{ color: primaryTextColor, flexShrink: 1 }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {deadlineDateLabel}
                        </Text>
                        {deadlineDaysLeftLabel ? (
                          <Text
                            variant="labelSm"
                            className="ml-2 font-regular"
                            style={{ color: secondaryTextColor }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {deadlineDaysLeftLabel}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                ) : null}
            </Animated.View>

            <View className="relative min-h-[44px] py-1">
              {!notesDraft.trim() && !isNotesFocused ? (
                <Text
                  variant="labelSm"
                  pointerEvents="none"
                  className="absolute left-0 top-3 z-10"
                  style={{ color: secondaryTextColor }}
                >
                  Notes
                </Text>
              ) : null}
              <AppTextInput
                value={notesDraft}
                onChangeText={setNotesDraft}
                onFocus={() => setIsNotesFocused(true)}
                onBlur={() => {
                  setIsNotesFocused(false);
                  void persistNotes();
                }}
                onContentSizeChange={(event) => {
                  const nextHeight = Math.max(
                    NOTES_MIN_HEIGHT,
                    Math.ceil(event.nativeEvent.contentSize.height),
                  );
                  if (Math.abs(nextHeight - notesInputHeight) > 1) {
                    setNotesInputHeight(nextHeight);
                  }
                }}
                placeholder=""
                variant="bodyMd"
                style={{
                  minHeight: NOTES_MIN_HEIGHT,
                  height: notesInputHeight,
                  backgroundColor: "transparent",
                  paddingHorizontal: 0,
                  paddingTop: 8,
                  paddingBottom: 8,
                  color: primaryTextColor,
                }}
                selectionColor={selectionColor}
                multiline
                scrollEnabled={false}
                textAlignVertical="top"
              />
            </View>

            <View className="mt-3">
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold"
                  style={{ color: subheaderColor, fontSize: 15 }}
                >
                  {"Things to do"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.76}
                  className="h-7 w-7 items-center justify-center rounded-full"
                  onPress={openChecklistComposer}
                >
                  <Icon name="plusfab" size={18} color={subheaderColor} />
                </TouchableOpacity>
              </View>
              <View
                className="mt-2 h-px"
                style={{ backgroundColor: metadataSeparatorColor }}
              />
            </View>

            {isChecklistVisible || checklistItems.length > 0 ? (
              <View className="mt-2">
                {checklistItems.map((item, index) => {
                  const isChecklistItemCompleted = completedChecklistItemIds.includes(
                    item.id,
                  );
                  const isDraggingChecklistItem = draggingChecklistItemId === item.id;
                  const separatorStyle = {
                    borderColor: metadataSeparatorColor,
                    borderBottomWidth: 0.5,
                    borderTopWidth: 0,
                  };

                  if (editingChecklistItemId === item.id && !isChecklistComposerOpen) {
                    return (
                      <View
                        key={item.id}
                        className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                        style={{
                          ...separatorStyle,
                          backgroundColor: checklistActiveBg,
                        }}
                      >
                        <View className="h-5 w-5 items-center justify-center">
                          <View
                            className="h-[12px] w-[12px] rounded-full"
                            style={{
                              borderWidth: 1,
                              borderColor: checklistDotColor,
                              backgroundColor: "transparent",
                            }}
                          />
                        </View>
                        <View className="ml-2 flex-1 py-1">
                          <AppTextInput
                            ref={(input) => {
                              checklistItemInputRefs.current[item.id] = input;
                            }}
                            autoFocus
                            value={editingChecklistText}
                            onChangeText={(nextText) =>
                              handleChecklistItemTextChange(item.id, nextText)
                            }
                            onKeyPress={(event) => {
                              if (event.nativeEvent.key !== "Backspace") {
                                return;
                              }

                              const currentItemText =
                                checklistItemsRef.current.find(
                                  (entry) => entry.id === item.id,
                                )?.text ?? "";

                              if (currentItemText.length > 0) {
                                return;
                              }

                              removeChecklistItem(item.id);
                            }}
                            onBlur={() => {
                              if (skipChecklistBlurForItemIdRef.current === item.id) {
                                skipChecklistBlurForItemIdRef.current = null;
                                return;
                              }

                              if (editingChecklistItemId === item.id) {
                                finalizeChecklistEditingOnBlur(item.id);
                              }
                            }}
                            onSubmitEditing={() => {
                              if (!editingChecklistText.trim().length) {
                                commitChecklistEditing(item.id);
                                return;
                              }

                              commitChecklistEditing(item.id);
                              setIsChecklistComposerOpen(true);
                              requestAnimationFrame(() => {
                                focusChecklistDraftWithRetry();
                              });
                            }}
                            placeholder="Checklist"
                            placeholderTextColor={secondaryTextColor}
                            variant="labelSm"
                            className="flex-1"
                            style={{
                              color: primaryTextColor,
                              paddingVertical: 0,
                              paddingHorizontal: 0,
                              margin: 0,
                            }}
                            returnKeyType="done"
                            blurOnSubmit={false}
                          />
                        </View>
                      </View>
                    );
                  }

                  return (
                    <SwipeableChecklistRow
                      key={item.id}
                      onDelete={() => removeChecklistItem(item.id, { focusNeighbor: false })}
                      disabled={
                        editingChecklistItemId !== null ||
                        isChecklistComposerOpen ||
                        draggingChecklistItemId !== null
                      }
                      iconBgColor={checklistDeleteIconBg}
                      iconColor={checklistDeleteIconColor}
                      dragIconColor={checklistDragHandleColor}
                      dragDisabled={
                        editingChecklistItemId !== null ||
                        isChecklistComposerOpen ||
                        (draggingChecklistItemId !== null &&
                          draggingChecklistItemId !== item.id)
                      }
                      rowIndex={index}
                      dragStartIndexValue={checklistDragStartIndexValue}
                      dragStepValue={checklistDragStepValue}
                      isDragActive={draggingChecklistItemId === item.id}
                      dragSlotHeight={checklistDragRowHeight}
                      dragPlaceholderColor={checklistDragPlaceholderBg}
                      dragPlaceholderBorderColor={checklistDragPlaceholderBorderColor}
                      onDragStart={() => handleChecklistDragStart(item.id)}
                      onDragStep={(step) => handleChecklistDragStep(item.id, step)}
                      onDragEnd={() => handleChecklistDragEnd(item.id)}
                    >
                      <View
                        className="mx-1 flex-row items-center rounded-xl pl-4 pr-11 py-2"
                        onLayout={(event) => {
                          if (draggingChecklistItemId !== null) {
                            return;
                          }
                          const measuredHeight = Math.max(
                            1,
                            Math.round(event.nativeEvent.layout.height),
                          );
                          if (Math.abs(measuredHeight - checklistDragRowHeight) > 1) {
                            setChecklistDragRowHeight(measuredHeight);
                          }
                        }}
                        style={[
                          !isDraggingChecklistItem ? separatorStyle : null,
                          isDraggingChecklistItem
                            ? {
                                opacity: 1,
                                backgroundColor: checklistDragActiveBg,
                                borderWidth: 1,
                                borderColor: checklistDragActiveBorderColor,
                                ...checklistDragActiveShadow,
                              }
                            : null,
                        ]}
                      >
                        <TouchableOpacity
                          activeOpacity={0.75}
                          className="h-5 w-5 items-center justify-center"
                          onPress={() => handleChecklistCompleteToggle(item.id)}
                        >
                          {isChecklistItemCompleted ? (
                            <Icon
                              name="check"
                              size={11}
                              color={checklistCheckColor}
                              weight="bold"
                            />
                          ) : (
                            <View
                              className="h-[12px] w-[12px] rounded-full"
                              style={{
                                borderWidth: 1,
                                borderColor: checklistDotColor,
                                backgroundColor: "transparent",
                              }}
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          className="ml-2 flex-1 py-1"
                          onPress={() => handleChecklistRowPress(item)}
                        >
                          <Text
                            variant="labelSm"
                            className="flex-1"
                            style={{
                              color: isChecklistItemCompleted
                                ? checklistCompletedTextColor
                                : primaryTextColor,
                            }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {item.text}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </SwipeableChecklistRow>
                  );
                })}

                {isChecklistComposerOpen ? (
                  <View
                    className="mx-1 flex-row items-center rounded-xl px-4 py-2"
                    style={{
                      borderColor: metadataSeparatorColor,
                      borderBottomWidth: 0.5,
                      borderTopWidth: 0,
                      backgroundColor: checklistActiveBg,
                    }}
                  >
                    <View className="h-5 w-5 items-center justify-center">
                      <View
                        className="h-[12px] w-[12px] rounded-full"
                        style={{
                          borderWidth: 1,
                          borderColor: checklistDotColor,
                          backgroundColor: "transparent",
                        }}
                      />
                    </View>
                    <View className="ml-2 flex-1 py-1">
                      <AppTextInput
                        ref={checklistDraftInputRef}
                        autoFocus={isChecklistComposerOpen}
                        value={checklistDraft}
                        onChangeText={setChecklistDraft}
                        onFocus={() => {
                          setEditingChecklistItemId(null);
                          setEditingChecklistText("");
                          setEditingChecklistOriginalText("");
                        }}
                        onKeyPress={(event) => {
                          if (event.nativeEvent.key !== "Backspace") {
                            return;
                          }
                          if (checklistDraft.length === 0) {
                            setIsChecklistComposerOpen(false);
                            setEditingChecklistItemId(null);
                            setEditingChecklistText("");
                            setEditingChecklistOriginalText("");
                            setIsChecklistVisible(checklistItemsRef.current.length > 0);
                          }
                        }}
                        onBlur={() => {
                          closeChecklistComposer();
                        }}
                        onSubmitEditing={handleSubmitChecklistDraft}
                        placeholder="Checklist"
                        placeholderTextColor={secondaryTextColor}
                        variant="labelSm"
                        className="flex-1"
                        style={{
                          color: primaryTextColor,
                          paddingVertical: 0,
                          paddingHorizontal: 0,
                          margin: 0,
                        }}
                        returnKeyType="done"
                        blurOnSubmit={false}
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            ) : (
              <View className="mt-2 mx-1 min-h-[88px] items-center justify-center rounded-xl px-5 py-6">
                <Text
                  variant="labelSm"
                  className="text-center italic"
                  style={emptySectionEmbossTextStyle}
                >
                  No items yet
                </Text>
              </View>
            )}

            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold"
                  style={{ color: subheaderColor, fontSize: 15 }}
                >
                  {"Payments"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.76}
                  className="h-7 w-7 items-center justify-center rounded-full"
                  onPress={openNewPaymentModal}
                >
                  <Icon name="plusfab" size={18} color={subheaderColor} />
                </TouchableOpacity>
              </View>
              <View
                className="mt-2 h-px"
                style={{ backgroundColor: metadataSeparatorColor }}
              />
            </View>

            {payments.length > 0 ? (
              <View className="mt-2 rounded-xl">
                {visiblePayments.map((payment) => {
                  const paymentAmountLabel = formatPriceLabel(payment.amount) ?? "0 RSD";
                  const paymentDateLabel = formatPaymentDateLabel(payment.payment_date);
                  const paymentTitleLabel = payment.note?.trim() || "Payment";

                  return (
                    <View
                      key={payment.id}
                      className="mx-1 py-3"
                    >
                      <View className="flex-row items-center">
                        <View
                          className="w-8 items-center justify-center"
                          style={{
                            width: SIZE_TOKENS.quickTaskCheckbox,
                            height: SIZE_TOKENS.quickTaskCheckbox,
                            borderRadius: RADIUS_TOKENS.xs,
                            borderWidth: BORDER_WIDTH_TOKENS.subtle,
                            borderColor: paymentAccentColor,
                            backgroundColor: paymentAccentColor,
                          }}
                        >
                          <Icon name="check" size={10} color={paymentCheckIconColor} />
                        </View>
                        <Text
                          variant="labelSm"
                          className="w-[52px] font-medium text-center"
                          style={{ color: paymentAccentColor, fontSize: 11, lineHeight: 14 }}
                          numberOfLines={1}
                        >
                          {paymentDateLabel}
                        </Text>
                        <View className="min-w-0 flex-1 justify-center">
                          <Text
                            variant="labelSm"
                            className="font-regular"
                            style={{ color: primaryTextColor }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {paymentTitleLabel}
                          </Text>
                        </View>
                        <View className="w-[92px] items-end justify-center">
                          <Text
                            variant="label"
                            className="font-semibold"
                            style={{ color: primaryTextColor }}
                            numberOfLines={1}
                          >
                            {paymentAmountLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {hiddenPaymentsCount > 0 ? (
                  <TouchableOpacity
                    onPress={() => setIsPaymentsExpanded((current) => !current)}
                    onPressIn={() => setIsPaymentsTogglePressed(true)}
                    onPressOut={() => setIsPaymentsTogglePressed(false)}
                    activeOpacity={0.88}
                    className="mt-2 self-start rounded-full py-1.5"
                    style={{
                      backgroundColor: isPaymentsTogglePressed
                        ? paymentsToggleBgPressed
                        : "transparent",
                      marginLeft: -6,
                      paddingHorizontal: 10,
                    }}
                  >
                    <Text
                      className="font-medium"
                      style={{ color: secondaryTextColor, fontSize: 11, lineHeight: 14 }}
                    >
                      {isPaymentsExpanded
                        ? "Show less"
                        : `Show ${hiddenPaymentsCount} more`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View
                className="mt-2 mx-1 min-h-[88px] items-center justify-center rounded-xl px-5 py-6"
              >
                <Text
                  variant="labelSm"
                  className="text-center italic"
                  style={emptySectionEmbossTextStyle}
                >
                  No payments yet
                </Text>
              </View>
            )}

            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold"
                  style={{ color: subheaderColor, fontSize: 15 }}
                >
                  {"Photos"}
                </Text>
              </View>
              <View
                className="mt-2 h-px"
                style={{ backgroundColor: metadataSeparatorColor }}
              />
            </View>

            <View
              className="mt-2 mx-1 min-h-[88px] items-center justify-center rounded-xl px-5 py-6"
            >
              <Text
                variant="labelSm"
                className="text-center italic"
                style={emptySectionEmbossTextStyle}
              >
                No photos yet
              </Text>
            </View>

            <View className="mt-6">
              <View className="flex-row items-center justify-between">
                <Text
                  className="font-bold"
                  style={{ color: subheaderColor, fontSize: 15 }}
                >
                  {"Reminders"}
                </Text>
                <TouchableOpacity
                  activeOpacity={0.76}
                  className="h-7 w-7 items-center justify-center rounded-full"
                  onPress={openRemindersModal}
                >
                  <Icon name="plusfab" size={18} color={subheaderColor} />
                </TouchableOpacity>
              </View>
              <View
                className="mt-2 h-px"
                style={{ backgroundColor: metadataSeparatorColor }}
              />
            </View>

            <View
              className="mt-2 mx-1 min-h-[88px] items-center justify-center rounded-xl px-5 py-6"
            >
              <Text
                variant="labelSm"
                className="text-center italic"
                style={emptySectionEmbossTextStyle}
              >
                No reminders yet
              </Text>
            </View>

          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="todo" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>

      <Modal
        visible={isRemindersModalOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeRemindersModal}
      >
        <View style={StyleSheet.absoluteFill}>
          <TransparentModalShell
            closeOnBackdropPress
            onBackdropPress={closeRemindersModal}
            enteringBackdrop={FadeIn.duration(120)}
            exitingBackdrop={FadeOut.duration(120)}
            enteringContent={FadeIn.duration(170)}
            exitingContent={FadeOut.duration(120)}
            contentStyle={[
              {
                width: "85%",
                height: "70%",
                borderWidth: 0.5,
                borderRadius: 28,
                overflow: "hidden",
                borderColor: statusModalBorderColor,
                backgroundColor: statusModalBg,
              },
              statusModalWindowShadow,
            ]}
            overlayStyle={{
              paddingHorizontal: 16,
              paddingVertical: 24,
            }}
            backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
            backdropOpacity={isDark ? 0.64 : 0.4}
          >
            <View
              style={{
                height: 56,
                alignItems: "center",
                justifyContent: "space-between",
                flexDirection: "row",
                marginTop: 6,
                marginBottom: 4,
                paddingHorizontal: 16,
              }}
            >
              <View style={{ width: 36, height: 36 }} />
              <Text
                className="font-bold text-things-modal-title"
                style={{ color: primaryTextColor, textAlign: "center", flex: 1 }}
              >
                Reminders
              </Text>
              <ModalCircleButton
                icon="close"
                theme={theme}
                onPress={closeRemindersModal}
              />
            </View>

            <View
              style={{
                height: 0.5,
                backgroundColor: statusModalDividerColor,
                marginHorizontal: 16,
              }}
            />

            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16 }}>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <View
                  style={{
                    borderRadius: 9999,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 40,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: actionButtonBorder,
                  }}
                >
                  <BlurView
                    intensity={48}
                    tint="default"
                    experimentalBlurMethod={blurMethod}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: actionButtonHighlight },
                    ]}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 9999,
                      flex: 1,
                      justifyContent: "center",
                      minHeight: 40,
                      paddingHorizontal: 14,
                    }}
                    android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
                    onPress={() => {
                      closeRemindersModal();
                      handleSelectToday();
                    }}
                  >
                    <Text
                      className="font-semibold text-label-sm"
                      style={{ color: actionButtonText }}
                      numberOfLines={1}
                    >
                      Today
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    borderRadius: 9999,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 40,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: actionButtonBorder,
                  }}
                >
                  <BlurView
                    intensity={48}
                    tint="default"
                    experimentalBlurMethod={blurMethod}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: actionButtonHighlight },
                    ]}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 9999,
                      flex: 1,
                      justifyContent: "center",
                      minHeight: 40,
                      paddingHorizontal: 14,
                    }}
                    android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
                    onPress={() => {
                      closeRemindersModal();
                      requestAnimationFrame(() => {
                        openWhenModal();
                      });
                    }}
                  >
                    <Text
                      className="font-semibold text-label-sm"
                      style={{ color: actionButtonText }}
                      numberOfLines={1}
                    >
                      Pick date
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View style={{ marginTop: 10 }}>
                <View
                  style={{
                    borderRadius: 9999,
                    borderWidth: 1,
                    minHeight: 40,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: actionButtonBorder,
                  }}
                >
                  <BlurView
                    intensity={48}
                    tint="default"
                    experimentalBlurMethod={blurMethod}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      { backgroundColor: actionButtonHighlight },
                    ]}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 9999,
                      justifyContent: "center",
                      minHeight: 40,
                      paddingHorizontal: 14,
                    }}
                    android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
                    onPress={() => {
                      closeRemindersModal();
                      handleSelectSomeday();
                    }}
                  >
                    <Text
                      className="font-semibold text-label-sm"
                      style={{ color: actionButtonText }}
                      numberOfLines={1}
                    >
                      Someday
                    </Text>
                  </Pressable>
                </View>
              </View>

              <View className="mt-4 mx-1 min-h-[88px] items-center justify-center rounded-xl px-5 py-6">
                <Text
                  variant="labelSm"
                  className="text-center italic"
                  style={emptySectionEmbossTextStyle}
                >
                  No reminders yet
                </Text>
              </View>
            </View>
          </TransparentModalShell>
        </View>
      </Modal>

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={closeWhenModal}
        onSelectDate={handleSelectWhenDate}
        onSelectToday={handleSelectToday}
        onSelectSomeday={handleSelectSomeday}
        onClearSelection={handleClearWhenSelection}
        selectedDate={scheduledDateObj}
        selectedWhen={selectedWhenState}
      />

      <WhenCalendarModal
        visible={isDeadlineModalOpen}
        mode="deadline"
        onClose={closeDeadlineModal}
        onSelectDate={handleSelectDeadlineDate}
        onClearSelection={handleClearDeadlineSelection}
        selectedDate={deadlineDateObj}
      />

      <Modal
        visible={isPriceModalOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closePriceModal}
        onShow={() => {
          schedulePriceInputFocus([140, 300, 520, 820]);
        }}
      >
        <View style={StyleSheet.absoluteFill}>
          <TransparentModalShell
            closeOnBackdropPress
            onBackdropPress={closePriceModal}
            enteringBackdrop={FadeIn.duration(120)}
            exitingBackdrop={FadeOut.duration(120)}
            contentStyle={[
              {
                width: "85%",
                borderWidth: 0.5,
                borderRadius: 28,
                overflow: "hidden",
                borderColor: statusModalBorderColor,
                backgroundColor: statusModalBg,
              },
              statusModalWindowShadow,
            ]}
            overlayStyle={{
              paddingHorizontal: 16,
              paddingVertical: 24,
            }}
            backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
            backdropOpacity={isDark ? 0.64 : 0.4}
          >
            <View
              style={{
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <Text
                variant="bodyLg"
                className="font-bold"
                style={{ color: primaryTextColor, textAlign: "center" }}
              >
                Set Price
              </Text>
              <View style={{ position: "absolute", top: 8, right: 16 }}>
                <ModalCircleButton icon="close" theme={theme} onPress={closePriceModal} />
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
              <Text
                className="mb-2 ml-1 font-semibold text-label-md"
                style={{ color: authInputLabelColor }}
              >
                Price
              </Text>
              <View
                className="px-3 py-0"
                style={{
                  height: authFieldHeight,
                  borderRadius: authControlRadius,
                  backgroundColor: authFieldBg,
                  borderWidth: isPriceInputFocused ? authFocusBorderWidth : authSubtleBorderWidth,
                  borderColor: isPriceInputFocused ? authFocusBorderColor : authIdleBorderColor,
                }}
                onLayout={() => {
                  if (isPriceModalOpen) {
                    schedulePriceInputFocus([20, 120, 260]);
                  }
                }}
              >
                <View className="h-full flex-row items-center">
                  <AppTextInput
                    ref={setPriceInputNode}
                    value={priceDraft}
                    onChangeText={setPriceDraft}
                    onFocus={() => setIsPriceInputFocused(true)}
                    onBlur={() => setIsPriceInputFocused(false)}
                    autoFocus
                    showSoftInputOnFocus
                    keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                    placeholder="0"
                    placeholderTextColor={authPlaceholderColor}
                    returnKeyType="done"
                    onSubmitEditing={handleSavePrice}
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    className="flex-1 leading-5"
                    style={{
                      color: primaryTextColor,
                    }}
                  />
                  <Text
                    variant="labelSm"
                    className="ml-2 font-semibold"
                    style={{ color: secondaryTextColor }}
                  >
                    RSD
                  </Text>
                </View>
              </View>

              <View className="flex-row" style={{ gap: 10, marginTop: 50 }}>
                <View
                  style={{
                    borderRadius: 9999,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 40,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: actionButtonBorder,
                  }}
                >
                  <BlurView
                    intensity={48}
                    tint="default"
                    experimentalBlurMethod={blurMethod}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View
                    style={[StyleSheet.absoluteFill, { backgroundColor: actionButtonHighlight }]}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 9999,
                      flex: 1,
                      justifyContent: "center",
                      minHeight: 40,
                      paddingHorizontal: 14,
                    }}
                    android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
                    onPress={handleClearPrice}
                  >
                    <Text
                      className="font-semibold text-label-sm"
                      style={{ color: actionButtonText }}
                      numberOfLines={1}
                    >
                      Clear
                    </Text>
                  </Pressable>
                </View>

                <View
                  style={{
                    borderRadius: 9999,
                    borderWidth: 1,
                    flex: 1,
                    minHeight: 40,
                    overflow: "hidden",
                    position: "relative",
                    borderColor: actionButtonBorder,
                  }}
                >
                  <BlurView
                    intensity={48}
                    tint="default"
                    experimentalBlurMethod={blurMethod}
                    style={StyleSheet.absoluteFill}
                    pointerEvents="none"
                  />
                  <View
                    style={[StyleSheet.absoluteFill, { backgroundColor: actionButtonHighlight }]}
                    pointerEvents="none"
                  />
                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 9999,
                      flex: 1,
                      justifyContent: "center",
                      minHeight: 40,
                      paddingHorizontal: 14,
                    }}
                    android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
                    onPress={handleSavePrice}
                  >
                    <Text
                      className="font-semibold text-label-sm"
                      style={{ color: actionButtonText }}
                      numberOfLines={1}
                    >
                      Save
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </TransparentModalShell>
        </View>
      </Modal>

      <Modal
        visible={isStatusModalOpen}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeStatusModal}
      >
        <View style={StyleSheet.absoluteFill}>
          <TransparentModalShell
            closeOnBackdropPress
            onBackdropPress={closeStatusModal}
            enteringBackdrop={FadeIn.duration(120)}
            exitingBackdrop={FadeOut.duration(120)}
            enteringContent={FadeIn.duration(170)}
            exitingContent={FadeOut.duration(120)}
            contentStyle={[
              {
                width: "85%",
                borderWidth: 0.5,
                borderRadius: 28,
                overflow: "hidden",
                borderColor: statusModalBorderColor,
                backgroundColor: statusModalBg,
              },
              statusModalWindowShadow,
            ]}
            overlayStyle={{
              paddingHorizontal: 16,
              paddingVertical: 24,
            }}
            backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
            backdropOpacity={isDark ? 0.64 : 0.4}
          >
            <View
              style={{
                height: 56,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              <Text
                variant="bodyLg"
                className="font-bold"
                style={{ color: primaryTextColor, textAlign: "center" }}
              >
                Change Status
              </Text>
              <View style={{ position: "absolute", top: 8, right: 16 }}>
                <ModalCircleButton icon="close" theme={theme} onPress={closeStatusModal} />
              </View>
            </View>

            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {statusOptions.map((option, index) => {
                const isSelected = currentJobStatus === option.key;
                const optionColor = statusColorByKey[option.key];

                return (
                  <TouchableOpacity
                    key={option.key}
                    activeOpacity={0.78}
                    className="flex-row items-center justify-between py-3"
                    style={{
                      borderTopWidth: index === 0 ? 0.5 : 0,
                      borderBottomWidth: 0.5,
                      borderColor: statusModalDividerColor,
                      paddingHorizontal: 6,
                    }}
                    onPress={() => handleSelectStatus(option.key)}
                  >
                    <View className="flex-row items-center">
                      <View
                        className="h-[20px] w-[20px] items-center justify-center rounded-full"
                        style={{
                          borderWidth: 1.25,
                          borderColor: withOpacity(secondaryTextColor, 0.58),
                        }}
                      >
                        <View
                          className="h-[10px] w-[10px] rounded-full"
                          style={{ backgroundColor: optionColor }}
                        />
                      </View>
                      <Text
                        variant="label"
                        className="ml-3 font-semibold"
                        style={{ color: primaryTextColor }}
                      >
                        {option.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <Icon name="check" size={18} color={primaryTextColor} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </TransparentModalShell>
        </View>
      </Modal>

      {isMenuOpen && job ? (
        <ProjectMenu
          anchor={menuAnchor}
          onClose={closeJobMenu}
          actions={jobMenuActions}
        />
      ) : null}
    </View>
  );
}
