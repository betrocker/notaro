import { Icon } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";

import type { WheelPickerOption } from "@/components/wheel-picker";
import { WheelPicker, WheelPickerWrapper } from "@/components/wheel-picker";

import { TransparentModalShell } from "@/components/TransparentModalShell";
import WhenCalendarModal from "@/components/WhenCalendarModal";

import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  OPACITY_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import {
  createReminder,
  fetchReminderById,
  updateReminder,
} from "@/lib/reminders";
import { type PaymentJobOption, fetchPaymentJobs } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatReminderDateTimeLabel(date: Date) {
  return (
    date.toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) + ` • ${formatTime(date)}`
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function withTime(date: Date, hour: number, minute: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    hour,
    minute,
    0,
    0,
  );
}

function getLaterTodayDate(now = new Date()) {
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);

  if (next.getHours() >= 22) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return withTime(tomorrow, 9, 0);
  }

  return next;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

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

function clampMinute(value: number) {
  return clamp(Math.round(value), 0, 59);
}

function clampMinuteToStep(value: number, step: number) {
  const safeStep = Math.max(1, Math.round(step));
  const boundedMinute = clampMinute(value);
  const steppedMinute = Math.round(boundedMinute / safeStep) * safeStep;
  const maxSteppedMinute = Math.floor(59 / safeStep) * safeStep;
  return clamp(steppedMinute, 0, maxSteppedMinute);
}

type TimeWheelItem = WheelPickerOption<number>;

const TIME_WHEEL_ROW_HEIGHT = 28;
const TIME_WHEEL_VISIBLE_ROWS = 7;
const TIME_WHEEL_HEIGHT = TIME_WHEEL_ROW_HEIGHT * TIME_WHEEL_VISIBLE_ROWS;
const TIME_WHEEL_SIDE_ROWS = Math.floor(TIME_WHEEL_VISIBLE_ROWS / 2);
const TIME_WHEEL_PILL_HEIGHT = TIME_WHEEL_ROW_HEIGHT + 4;
const TIME_WHEEL_PILL_CENTER_OFFSET = (TIME_WHEEL_PILL_HEIGHT - TIME_WHEEL_ROW_HEIGHT) / 2;
const TIME_MINUTE_STEP = 5;
const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 / TIME_MINUTE_STEP }, (_, index) => index * TIME_MINUTE_STEP);
const HOURS_WHEEL_ITEMS: TimeWheelItem[] = HOURS.map((value) => ({
  value,
  label: `${value}`.padStart(2, "0"),
}));
const MINUTES_WHEEL_ITEMS: TimeWheelItem[] = MINUTES.map((value) => ({
  value,
  label: `${value}`.padStart(2, "0"),
}));
const TIME_WHEEL_COLUMN_WIDTH = 74;
const TIME_WHEEL_COLUMN_GAP = 2;
const TIME_PICKER_ACTION_MIN_WIDTH = 92;
const TIME_PICKER_ACTION_GAP = 4;
const TIME_PICKER_ACTION_HORIZONTAL_PADDING = 14;
const TIME_PICKER_ACTION_VERTICAL_PADDING = 6;
const TIME_PICKER_FOOTER_SIDE_PADDING = 10;
const TIME_PICKER_WHEEL_SIDE_PADDING = SPACING_TOKENS.xs;

type FocusedField = "title" | "when" | "job" | "note" | null;

export default function NewReminderScreen() {
  const {
    reminderId: reminderIdParam,
    jobId: initialJobIdParam,
    jobTitle: initialJobTitleParam,
    clientName: initialClientNameParam,
  } = useLocalSearchParams<{
    reminderId?: string;
    jobId?: string;
    jobTitle?: string;
    clientName?: string;
  }>();
  const { colorScheme } = useColorScheme();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const theme = getThemeTokens(isDark);
  const formScrollRef = useRef<ScrollView | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [remindAt, setRemindAt] = useState<Date>(getLaterTodayDate());
  const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);
  const [hasReminderTime, setHasReminderTime] = useState(false);
  const [pickerHour, setPickerHour] = useState(remindAt.getHours());
  const [pickerMinute, setPickerMinute] = useState(
    clampMinuteToStep(remindAt.getMinutes(), TIME_MINUTE_STEP),
  );
  const [paymentJobs, setPaymentJobs] = useState<PaymentJobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [fallbackJobTitle, setFallbackJobTitle] = useState<string | null>(null);
  const [fallbackClientName, setFallbackClientName] = useState<string | null>(
    null,
  );
  const [isJobsListOpen, setIsJobsListOpen] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [jobsErrorMessage, setJobsErrorMessage] = useState<string | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isReminderLoading, setIsReminderLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const [focusedField, setFocusedField] = useState<FocusedField>(null);
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const borderColor = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];
  const fieldBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const inputText = COLOR_TOKENS[colorMode]["text.primary"];
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const titleText = isDark
    ? COLOR_TOKENS.light["bg.modal"]
    : COLOR_TOKENS[colorMode]["text.primary"];
  const secondaryText = COLOR_TOKENS[colorMode]["text.secondary"];
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const reminderValueColor = COLOR_TOKENS.light["primary.default"];
  const confirmButtonBg = COLOR_TOKENS[colorMode]["primary.soft"];
  const confirmButtonBorder = COLOR_TOKENS[colorMode]["primary.soft"];
  const confirmButtonIcon = COLOR_TOKENS.light["bg.base"];
  const chipActiveBg = COLOR_TOKENS[colorMode]["primary.soft"];
  const chipActiveText = COLOR_TOKENS.light["bg.base"];
  const inputLabelColor = titleText;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const idleBorderColor = placeholderColor;
  const fieldHeight = SPACING_TOKENS["4xl"];
  const controlRadius = RADIUS_TOKENS.control;
  const focusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const subtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const reminderId =
    typeof reminderIdParam === "string" && reminderIdParam.trim().length > 0
      ? reminderIdParam
      : null;
  const initialJobId =
    typeof initialJobIdParam === "string" && initialJobIdParam.trim().length > 0
      ? initialJobIdParam
      : null;
  const initialJobTitle =
    typeof initialJobTitleParam === "string" &&
    initialJobTitleParam.trim().length > 0
      ? initialJobTitleParam.trim()
      : null;
  const initialClientName =
    typeof initialClientNameParam === "string" &&
    initialClientNameParam.trim().length > 0
      ? initialClientNameParam.trim()
      : null;
  const disabledOpacity = OPACITY_TOKENS.disabled;
  const canSave = !isSaving && !isReminderLoading;
  const keyboardLayoutInset = keyboardInset;
  const usableHeight = Math.max(windowHeight - keyboardLayoutInset, 320);
  const modalMaxHeight = Math.round(usableHeight * 0.84);
  const formMaxHeight = Math.round(usableHeight * 0.62);
  const formViewportHeight =
    formContentHeight > 0
      ? Math.min(formContentHeight, formMaxHeight)
      : formMaxHeight;
  const timePickerPanelBg = isDark ? "#343B47" : COLOR_TOKENS.light["bg.modal"];
  const timePickerPanelBorder = isDark
    ? withOpacity(COLOR_TOKENS.light["bg.modal"], 0.2)
    : borderColor;
  const timePickerActionBorder = isDark
    ? withOpacity(COLOR_TOKENS.light["bg.modal"], 0.26)
    : withOpacity(COLOR_TOKENS.dark["text.primary"], 0.16);
  const timePickerActionFill = isDark
    ? "#5C6574"
    : withOpacity(COLOR_TOKENS.light["bg.base"], 0.78);
  const timePickerWheelPill = isDark
    ? withOpacity("#8A94A3", 0.44)
    : withOpacity(COLOR_TOKENS.light["border.default"], 0.9);
  const wheelInactiveColor = isDark ? "#F5F7FB" : inputText;
  const timePickerMaskColor = isDark
    ? withOpacity(timePickerPanelBg, 0.7)
    : withOpacity(COLOR_TOKENS.light["bg.base"], 0.7);
  const timePickerMaskSoftColor = isDark
    ? withOpacity(timePickerPanelBg, 0.46)
    : withOpacity(COLOR_TOKENS.light["bg.base"], 0.46);
  const timePickerMaskFaintColor = isDark
    ? withOpacity(timePickerPanelBg, 0.24)
    : withOpacity(COLOR_TOKENS.light["bg.base"], 0.24);
  const timePickerDividerColor = isDark
    ? withOpacity(COLOR_TOKENS.light["bg.modal"], 0.16)
    : withOpacity(COLOR_TOKENS.dark["text.primary"], 0.12);
  const timePickerBottomOffset = Math.max(Math.round(windowHeight * 0.18), 126);
  const wheelGroupWidth = TIME_WHEEL_COLUMN_WIDTH * 2 + TIME_WHEEL_COLUMN_GAP;
  const timePickerButtonsWidth =
    TIME_PICKER_ACTION_MIN_WIDTH * 2 +
    TIME_PICKER_ACTION_GAP +
    TIME_PICKER_FOOTER_SIDE_PADDING * 2;
  const timePickerWheelContentWidth = wheelGroupWidth + TIME_PICKER_WHEEL_SIDE_PADDING * 2;
  const timePickerCardWidth = Math.min(
    Math.max(timePickerWheelContentWidth, timePickerButtonsWidth) + 2,
    windowWidth - SPACING_TOKENS.lg * 2,
  );
  const selectedJob = useMemo(
    () => paymentJobs.find((job) => job.id === selectedJobId) ?? null,
    [paymentJobs, selectedJobId],
  );
  const selectedJobLabel = useMemo(() => {
    if (!selectedJobId) {
      return "No linked job";
    }

    if (selectedJob) {
      const title = selectedJob.title?.trim() || "Untitled job";
      if (!selectedJob.client_name) {
        return title;
      }
      return `${title} - ${selectedJob.client_name}`;
    }

    const fallbackTitle = fallbackJobTitle ?? "Linked job";
    if (!fallbackClientName) {
      return fallbackTitle;
    }
    return `${fallbackTitle} - ${fallbackClientName}`;
  }, [fallbackClientName, fallbackJobTitle, selectedJob, selectedJobId]);

  useEffect(() => {
    if (!initialJobId) {
      return;
    }

    setSelectedJobId((current) => current ?? initialJobId);
    setFallbackJobTitle((current) => current ?? initialJobTitle);
    setFallbackClientName((current) => current ?? initialClientName);
  }, [initialClientName, initialJobId, initialJobTitle]);

  useEffect(() => {
    let isMounted = true;

    if (!reminderId) {
      return undefined;
    }

    const loadReminder = async () => {
      setIsReminderLoading(true);
      try {
        const reminder = await fetchReminderById(reminderId);
        if (!isMounted) {
          return;
        }

        if (!reminder) {
          setErrorMessage("Reminder nije pronadjen.");
          return;
        }

        const remindAtDate = new Date(reminder.remindAt);
        const selectedMinute = clampMinuteToStep(remindAtDate.getMinutes(), TIME_MINUTE_STEP);
        remindAtDate.setMinutes(selectedMinute, 0, 0);
        setTitleInput(reminder.title);
        setNoteInput(reminder.note ?? "");
        setRemindAt(remindAtDate);
        setPickerHour(remindAtDate.getHours());
        setPickerMinute(selectedMinute);
        setHasReminderTime(true);
        setSelectedJobId(reminder.jobId);
        setFallbackJobTitle(reminder.jobTitle);
        setFallbackClientName(reminder.clientName);
        setErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Nisam uspeo da ucitam reminder.",
        );
      } finally {
        if (isMounted) {
          setIsReminderLoading(false);
        }
      }
    };

    void loadReminder();

    return () => {
      isMounted = false;
    };
  }, [reminderId]);

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      if (!isSupabaseConfigured) {
        if (isMounted) {
          setPaymentJobs([]);
          setJobsErrorMessage(null);
          setIsJobsLoading(false);
        }
        return;
      }

      setIsJobsLoading(true);
      try {
        const jobs = await fetchPaymentJobs();
        if (!isMounted) {
          return;
        }

        setPaymentJobs(jobs);
        setJobsErrorMessage(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setJobsErrorMessage(
          error instanceof Error ? error.message : "Couldn't load jobs.",
        );
        setPaymentJobs([]);
      } finally {
        if (isMounted) {
          setIsJobsLoading(false);
        }
      }
    };

    void loadJobs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates?.height ?? 0);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const closeModal = () => {
    Keyboard.dismiss();
    router.back();
  };

  const getFieldBorderStyle = (field: FocusedField) => ({
    borderWidth: focusedField === field ? focusBorderWidth : subtleBorderWidth,
    borderColor: focusedField === field ? focusBorderColor : idleBorderColor,
  });

  const openTimePicker = () => {
    const hour = remindAt.getHours();
    const minute = clampMinuteToStep(remindAt.getMinutes(), TIME_MINUTE_STEP);
    setPickerHour(hour);
    setPickerMinute(minute);
    setIsTimePickerOpen(true);
  };

  const closeTimePicker = () => {
    setIsTimePickerOpen(false);
  };

  const applyTimePicker = () => {
    const nextDate = withTime(remindAt, pickerHour, pickerMinute);
    setRemindAt(nextDate);
    setHasReminderTime(true);
    setErrorMessage(null);
    closeTimePicker();
  };

  const handleSave = async () => {
    if (isSaving || isReminderLoading) {
      return;
    }

    const resolvedTitle = titleInput.trim() || "Reminder";
    const selectedJobTitle =
      selectedJob?.title?.trim() || fallbackJobTitle || null;
    const selectedClientName =
      selectedJob?.client_name ?? fallbackClientName ?? null;

    setIsSaving(true);
    try {
      if (reminderId) {
        await updateReminder(reminderId, {
          title: resolvedTitle,
          note: noteInput,
          remindAt,
          jobId: selectedJobId,
          jobTitle: selectedJobId ? selectedJobTitle : null,
          clientName: selectedJobId ? selectedClientName : null,
        });
      } else {
        await createReminder({
          title: resolvedTitle,
          note: noteInput,
          remindAt,
          jobId: selectedJobId,
          jobTitle: selectedJobId ? selectedJobTitle : null,
          clientName: selectedJobId ? selectedClientName : null,
        });
      }

      setErrorMessage(null);
      closeModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't save reminder.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-transparent" edges={["top"]}>
      <TransparentModalShell
        closeOnBackdropPress
        onBackdropPress={closeModal}
        overlayStyle={[
          {
            paddingHorizontal: SPACING_TOKENS.md,
            paddingVertical: SPACING_TOKENS["2xl"],
          },
          keyboardLayoutInset > 0
            ? { paddingBottom: SPACING_TOKENS["2xl"] + keyboardLayoutInset }
            : null,
        ]}
        contentStyle={[
          {
            width: "85%",
            borderRadius: 28,
            borderWidth: BORDER_WIDTH_TOKENS.subtle,
            overflow: "hidden",
          },
          Platform.select({
            ios: {
              ...SHADOW_TOKENS.card.ios,
            },
            android: {
              elevation: SHADOW_TOKENS.card.android.elevation,
            },
          }),
          { backgroundColor: modalBg, borderColor, maxHeight: modalMaxHeight },
        ]}
        backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
        backdropOpacity={isDark ? 0.64 : 0.4}
      >
        <View className="shrink">
          <View className="mb-1 mt-1.5 h-14 items-center justify-center">
            <View className="flex-row items-center">
              <Icon name="bell" size={17} color={titleText} />
              <Text
                variant="bodyLg"
                className="ml-2 text-center"
                style={{ color: titleText }}
              >
                {reminderId ? "Edit Reminder" : "New Reminder"}
              </Text>
            </View>
            <View
              style={[
                { position: "absolute", top: 8, right: 16 },
              ]}
            >
              <ModalCircleButton icon="close" theme={theme} onPress={closeModal} />
            </View>
          </View>

          <ScrollView
            ref={formScrollRef}
            contentContainerStyle={{
              paddingHorizontal: SPACING_TOKENS.lg,
              paddingBottom: SPACING_TOKENS.lg,
            }}
            contentInsetAdjustmentBehavior="always"
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={
              Platform.OS === "ios" ? "interactive" : "on-drag"
            }
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            bounces={false}
            overScrollMode="never"
            scrollIndicatorInsets={{ bottom: SPACING_TOKENS.xs }}
            onContentSizeChange={(_, height) => {
              setFormContentHeight((current) =>
                Math.abs(current - height) > 1 ? height : current,
              );
            }}
            style={{ flexGrow: 0, height: formViewportHeight }}
          >
            {errorMessage ? (
              <Text
                className="mb-3 font-regular text-label-sm leading-5"
                style={{ color: secondaryText }}
              >
                {errorMessage}
              </Text>
            ) : null}

            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              Title
            </Text>
            <View
              className="px-3 py-0"
              style={[
                {
                  height: fieldHeight,
                  borderRadius: controlRadius,
                  backgroundColor: fieldBg,
                },
                getFieldBorderStyle("title"),
              ]}
            >
              <AppTextInput
                value={titleInput}
                onChangeText={setTitleInput}
                onFocus={() => {
                  setFocusedField("title");
                  setIsJobsListOpen(false);
                }}
                onBlur={() =>
                  setFocusedField((current) =>
                    current === "title" ? null : current,
                  )
                }
                variant="bodyMd"
                placeholder="Reminder title"
                placeholderTextColor={placeholderColor}
                selectionColor={selectionColor}
                className="leading-5 text-things-text"
                style={{ color: inputText }}
              />
            </View>

            <View className="h-3" />
            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              When
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Keyboard.dismiss();
                setFocusedField("when");
                setIsJobsListOpen(false);
                setIsDateModalOpen(true);
              }}
              style={[
                {
                  borderWidth: BORDER_WIDTH_TOKENS.subtle,
                  borderRadius: RADIUS_TOKENS.control,
                  paddingHorizontal: SPACING_TOKENS.md,
                  justifyContent: "center",
                },
                {
                  height: fieldHeight,
                  borderRadius: controlRadius,
                  backgroundColor: fieldBg,
                },
                getFieldBorderStyle("when"),
              ]}
            >
              <View className="h-full flex-row items-center">
                <Icon name="upcoming" size={16} color={secondaryText} />
                <Text
                  className="ml-2 font-medium text-body"
                  style={{ color: inputText }}
                >
                  {formatReminderDateTimeLabel(remindAt)}
                </Text>
              </View>
            </TouchableOpacity>

            <View className="h-3" />
            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              Link To Job
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Keyboard.dismiss();
                setFocusedField("job");
                setIsJobsListOpen((current) => !current);
              }}
              style={[
                {
                  borderWidth: BORDER_WIDTH_TOKENS.subtle,
                  borderRadius: RADIUS_TOKENS.control,
                  paddingHorizontal: SPACING_TOKENS.md,
                  justifyContent: "center",
                },
                {
                  height: fieldHeight,
                  borderRadius: controlRadius,
                  backgroundColor: fieldBg,
                },
                getFieldBorderStyle("job"),
              ]}
            >
              <View className="h-full flex-row items-center">
                <Icon name="project" size={16} color={secondaryText} />
                <Text
                  className="ml-2 font-medium text-body"
                  style={{ color: inputText, flexShrink: 1 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {selectedJobLabel}
                </Text>
              </View>
            </TouchableOpacity>

            {isJobsListOpen ? (
              <View
                style={[
                  {
                    marginTop: SPACING_TOKENS.xs,
                    borderWidth: BORDER_WIDTH_TOKENS.subtle,
                    borderRadius: RADIUS_TOKENS.control,
                    overflow: "hidden",
                  },
                  {
                    backgroundColor: fieldBg,
                    borderColor:
                      focusedField === "job"
                        ? focusBorderColor
                        : idleBorderColor,
                    borderWidth:
                      focusedField === "job"
                        ? focusBorderWidth
                        : subtleBorderWidth,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedJobId(null);
                    setIsJobsListOpen(false);
                    setFocusedField(null);
                  }}
                  style={[
                    {
                      paddingHorizontal: SPACING_TOKENS.md,
                      paddingVertical: SPACING_TOKENS.sm,
                      borderBottomWidth: BORDER_WIDTH_TOKENS.subtle,
                      borderBottomColor: idleBorderColor,
                    },
                    {
                      backgroundColor: !selectedJobId
                        ? chipActiveBg
                        : "transparent",
                    },
                  ]}
                >
                  <Text
                    className="font-semibold text-label-sm"
                    style={{
                      color: !selectedJobId ? chipActiveText : inputText,
                    }}
                  >
                    No linked job
                  </Text>
                </TouchableOpacity>

                {isJobsLoading ? (
                  <Text
                    className="px-3 py-2 font-regular text-label-sm"
                    style={{ color: secondaryText }}
                  >
                    Loading jobs...
                  </Text>
                ) : jobsErrorMessage ? (
                  <Text
                    className="px-3 py-2 font-regular text-label-sm"
                    style={{ color: secondaryText }}
                  >
                    {jobsErrorMessage}
                  </Text>
                ) : paymentJobs.length === 0 ? (
                  <Text
                    className="px-3 py-2 font-regular text-label-sm"
                    style={{ color: secondaryText }}
                  >
                    No jobs available.
                  </Text>
                ) : (
                  <ScrollView
                    style={{ maxHeight: 180 }}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {paymentJobs.map((job) => {
                      const isSelected = selectedJobId === job.id;
                      const jobTitle = job.title?.trim() || "Untitled job";
                      const subtitleParts = [
                        job.client_name ? job.client_name : null,
                        job.completed_at ? "Completed" : null,
                      ].filter((part): part is string => Boolean(part));

                      return (
                        <TouchableOpacity
                          key={job.id}
                          activeOpacity={0.8}
                          onPress={() => {
                            setSelectedJobId(job.id);
                            setFallbackJobTitle(jobTitle);
                            setFallbackClientName(job.client_name ?? null);
                            setErrorMessage(null);
                            setIsJobsListOpen(false);
                            setFocusedField(null);
                          }}
                          style={[
                            {
                              paddingHorizontal: SPACING_TOKENS.md,
                              paddingVertical: SPACING_TOKENS.sm,
                              borderBottomWidth: BORDER_WIDTH_TOKENS.subtle,
                            },
                            {
                              borderBottomColor: idleBorderColor,
                              backgroundColor: isSelected
                                ? "rgba(80, 144, 250, 0.18)"
                                : "transparent",
                            },
                          ]}
                        >
                          <Text
                            className="font-semibold text-label-sm"
                            style={{ color: inputText }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {jobTitle}
                          </Text>
                          {subtitleParts.length > 0 ? (
                            <Text
                              className="mt-0.5 font-regular text-footer"
                              style={{ color: secondaryText }}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {subtitleParts.join(" - ")}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            ) : null}

            <View className="h-3" />
            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              Note
            </Text>
            <View
              className="px-3 py-2"
              style={[
                {
                  borderWidth: BORDER_WIDTH_TOKENS.subtle,
                  borderRadius: RADIUS_TOKENS.control,
                  minHeight: 98,
                },
                {
                  borderRadius: controlRadius,
                  backgroundColor: fieldBg,
                },
                getFieldBorderStyle("note"),
              ]}
            >
              <AppTextInput
                value={noteInput}
                onChangeText={setNoteInput}
                onFocus={() => {
                  setFocusedField("note");
                  setIsJobsListOpen(false);
                  setTimeout(
                    () => {
                      formScrollRef.current?.scrollToEnd({ animated: true });
                    },
                    Platform.OS === "ios" ? 220 : 140,
                  );
                }}
                onBlur={() =>
                  setFocusedField((current) =>
                    current === "note" ? null : current,
                  )
                }
                variant="bodyMd"
                placeholder="Optional note"
                placeholderTextColor={placeholderColor}
                selectionColor={selectionColor}
                multiline
                textAlignVertical="top"
                className="min-h-[74px] leading-5 text-things-text"
                style={{ color: inputText }}
              />
            </View>
          </ScrollView>

          <View className="px-4 pb-3 pt-2">
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                columnGap: SPACING_TOKENS.xs + 2,
              }}
            >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={closeModal}
              className="items-center justify-center rounded-full border"
              style={{
                flex: 1,
                minHeight: 40,
                borderColor: borderColor,
                borderWidth: BORDER_WIDTH_TOKENS.subtle,
                backgroundColor: fieldBg,
              }}
            >
              <Text
                className="font-medium text-label-sm"
                style={{ color: secondaryText }}
              >
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.82}
              onPress={() => {
                if (!canSave) {
                  return;
                }
                void handleSave();
              }}
              className="items-center justify-center rounded-full border"
              style={{
                flex: 1,
                minHeight: 40,
                backgroundColor: confirmButtonBg,
                borderColor: confirmButtonBorder,
                borderWidth: 0.5,
                opacity: canSave ? 1 : 0.45,
              }}
              disabled={!canSave}
            >
              <Text
                className="font-semibold text-label-sm"
                style={{ color: confirmButtonIcon }}
              >
                {isSaving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
            </View>
          </View>
        </View>
      </TransparentModalShell>

      <WhenCalendarModal
        visible={isDateModalOpen}
        onClose={() => setIsDateModalOpen(false)}
        onSelectDate={(date) => {
          const nextDate = withTime(
            date,
            remindAt.getHours(),
            remindAt.getMinutes(),
          );
          setRemindAt(nextDate);
          setIsDateModalOpen(false);
          setFocusedField((current) => (current === "when" ? null : current));
        }}
        onSelectToday={() => {
          const now = new Date();
          const nextDate = withTime(
            now,
            remindAt.getHours(),
            remindAt.getMinutes(),
          );
          setRemindAt(nextDate);
          setIsDateModalOpen(false);
          setFocusedField((current) => (current === "when" ? null : current));
        }}
        onClearSelection={() => {
          const nextDate = getLaterTodayDate();
          setRemindAt(nextDate);
          setIsDateModalOpen(false);
          setFocusedField((current) => (current === "when" ? null : current));
        }}
        selectedDate={remindAt}
        selectedWhen="date"
        footerActionLabel={hasReminderTime ? "Reminder" : "Add reminder"}
        footerActionIcon={hasReminderTime ? "bell" : "plusfab"}
        footerActionValue={hasReminderTime ? formatTime(remindAt) : null}
        footerActionValueColor={reminderValueColor}
        onFooterActionPress={openTimePicker}
        onFooterActionClear={
          hasReminderTime
            ? () => {
                setHasReminderTime(false);
              }
            : undefined
        }
      />

      <Modal
        visible={isTimePickerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={closeTimePicker}
      >
        <View style={StyleSheet.absoluteFill}>
          <TransparentModalShell
            closeOnBackdropPress
            onBackdropPress={closeTimePicker}
            overlayStyle={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: "flex-end",
              alignItems: "flex-end",
              paddingRight: SPACING_TOKENS.lg,
              paddingBottom: timePickerBottomOffset,
            }}
            contentStyle={[
              {
                width: timePickerCardWidth,
                borderRadius: 30,
                borderWidth: 1,
                overflow: "hidden",
              },
              Platform.select({
                ios: {
                  ...SHADOW_TOKENS.card.ios,
                },
                android: {
                  elevation: SHADOW_TOKENS.card.android.elevation,
                },
              }),
              { backgroundColor: timePickerPanelBg, borderColor: timePickerPanelBorder },
            ]}
            backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
            backdropOpacity={isDark ? 0.64 : 0.4}
          >
            <View
              className="items-center"
              style={{
                paddingTop: 2,
                paddingHorizontal: TIME_PICKER_WHEEL_SIDE_PADDING,
              }}
            >
              <View
                style={{
                  width: wheelGroupWidth,
                  height: TIME_WHEEL_HEIGHT,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                }}
              >
                <WheelPickerWrapper
                  style={{ width: TIME_WHEEL_COLUMN_WIDTH, height: TIME_WHEEL_HEIGHT }}
                >
                  <WheelPicker
                    options={HOURS_WHEEL_ITEMS}
                    value={pickerHour}
                    onValueChange={setPickerHour}
                    infinite
                    optionItemHeight={TIME_WHEEL_ROW_HEIGHT}
                    visibleCount={TIME_WHEEL_VISIBLE_ROWS}
                    itemTextStyle={{
                      color: wheelInactiveColor,
                      fontSize: 24,
                      fontVariant: ["tabular-nums"],
                      includeFontPadding: false,
                    }}
                  />
                </WheelPickerWrapper>
                <View style={{ width: TIME_WHEEL_COLUMN_GAP }} />

                <WheelPickerWrapper
                  style={{ width: TIME_WHEEL_COLUMN_WIDTH, height: TIME_WHEEL_HEIGHT }}
                >
                  <WheelPicker
                    options={MINUTES_WHEEL_ITEMS}
                    value={pickerMinute}
                    onValueChange={setPickerMinute}
                    infinite
                    optionItemHeight={TIME_WHEEL_ROW_HEIGHT}
                    visibleCount={TIME_WHEEL_VISIBLE_ROWS}
                    itemTextStyle={{
                      color: wheelInactiveColor,
                      fontSize: 24,
                      fontVariant: ["tabular-nums"],
                      includeFontPadding: false,
                    }}
                  />
                </WheelPickerWrapper>
              </View>

              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: wheelGroupWidth,
                  alignSelf: "center",
                  top: TIME_WHEEL_ROW_HEIGHT * TIME_WHEEL_SIDE_ROWS - TIME_WHEEL_PILL_CENTER_OFFSET,
                  height: TIME_WHEEL_PILL_HEIGHT,
                  borderRadius: TIME_WHEEL_PILL_HEIGHT / 2,
                  borderWidth: 1,
                  borderColor: timePickerDividerColor,
                  backgroundColor: timePickerWheelPill,
                  zIndex: 1,
                }}
              />

              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: 0,
                  width: wheelGroupWidth,
                  height: TIME_WHEEL_ROW_HEIGHT * TIME_WHEEL_SIDE_ROWS,
                  zIndex: 3,
                }}
              >
                <View
                  style={{
                    flex: 0.36,
                    backgroundColor: timePickerMaskColor,
                  }}
                />
                <View
                  style={{
                    flex: 0.36,
                    backgroundColor: timePickerMaskSoftColor,
                  }}
                />
                <View
                  style={{
                    flex: 0.28,
                    backgroundColor: timePickerMaskFaintColor,
                  }}
                />
              </View>

              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  bottom: 0,
                  width: wheelGroupWidth,
                  height: TIME_WHEEL_ROW_HEIGHT * TIME_WHEEL_SIDE_ROWS,
                  zIndex: 3,
                }}
              >
                <View
                  style={{
                    flex: 0.28,
                    backgroundColor: timePickerMaskFaintColor,
                  }}
                />
                <View
                  style={{
                    flex: 0.36,
                    backgroundColor: timePickerMaskSoftColor,
                  }}
                />
                <View
                  style={{
                    flex: 0.36,
                    backgroundColor: timePickerMaskColor,
                  }}
                />
              </View>
            </View>

            <View
              className="mt-1 flex-row items-center justify-center px-2.5 pb-2 pt-1.5"
              style={{
                columnGap: TIME_PICKER_ACTION_GAP,
              }}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={closeTimePicker}
                className="rounded-full border"
                style={{
                  borderColor: timePickerActionBorder,
                  borderWidth: 1,
                  minWidth: TIME_PICKER_ACTION_MIN_WIDTH,
                  backgroundColor: timePickerActionFill,
                  paddingVertical: TIME_PICKER_ACTION_VERTICAL_PADDING,
                  paddingHorizontal: TIME_PICKER_ACTION_HORIZONTAL_PADDING,
                }}
              >
                <Text
                  className="text-center font-medium text-label-sm"
                  style={{ color: inputText }}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.82}
                onPress={applyTimePicker}
                className="rounded-full border"
                style={{
                  borderColor: timePickerActionBorder,
                  borderWidth: 1,
                  minWidth: TIME_PICKER_ACTION_MIN_WIDTH,
                  backgroundColor: timePickerActionFill,
                  paddingVertical: TIME_PICKER_ACTION_VERTICAL_PADDING,
                  paddingHorizontal: TIME_PICKER_ACTION_HORIZONTAL_PADDING,
                }}
              >
                <Text
                  className="text-center font-semibold text-label-sm"
                  style={{ color: inputText }}
                >
                  Set
                </Text>
              </TouchableOpacity>
            </View>
          </TransparentModalShell>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
