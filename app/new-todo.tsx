import { Icon } from "@/components/Icon";
import { ModalCircleButton } from "@/components/ModalCircleButton";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppTextInput, AppText as Text } from "@/components/ui";
import {
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SIZE_TOKENS,
} from "@/lib/design-system/tokens";
import { createTodo } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type WhenSelection =
  | { type: "none" }
  | { type: "date"; date: Date }
  | { type: "today" }
  | { type: "someday" };

function formatSelectedDateLabel(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const day = date.getDate();
  const month = date.toLocaleDateString("en-US", { month: "short" });
  return `${weekday}, ${day} ${month}`;
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

function formatDaysUntilLabel(targetDate: Date) {
  const daysUntil = getDaysUntilDate(targetDate);

  if (daysUntil <= 0) {
    return "today";
  }

  if (daysUntil === 1) {
    return "in 1 day";
  }

  return `in ${daysUntil} days`;
}

function isSameDate(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

const MODAL_ENTRY_DURATION_MS = 320;
const MODAL_ENTRY_TRANSLATE_Y = Dimensions.get("window").height * 0.32;
const TITLE_AUTOFOCUS_DELAY_MS = 16;
const MODAL_CARD_SHADOW_STYLE = Platform.select({
  ios: {
    shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
  },
  android: {
    elevation: 18,
  },
});

export default function NewTodoScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [whenSelection, setWhenSelection] = useState<WhenSelection>({
    type: "none",
  });
  const [isWhenModalOpen, setIsWhenModalOpen] = useState(false);
  const [deadlineDate, setDeadlineDate] = useState<Date | null>(null);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isNotesFocused, setIsNotesFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const modalTheme = getThemeTokens(true);
  const modalTopBg = COLOR_TOKENS.dark["bg.modal"];
  const modalBottomBg = COLOR_TOKENS.dark["bg.popup"];
  const primaryTextColor = COLOR_TOKENS.dark["text.primary"];
  const secondaryTextColor = COLOR_TOKENS.dark["text.secondary"];
  const checkboxBorderColor = COLOR_TOKENS.dark["text.secondary"];
  const inboxColor = COLOR_TOKENS.dark["icon.inbox"];
  const inputBorderColor = COLOR_TOKENS.dark["btn.secondary"];
  const saveButtonBg = COLOR_TOKENS.light["primary.default"];
  const saveButtonTextColor = COLOR_TOKENS.light["bg.base"];
  const saveButtonBorderColor = COLOR_TOKENS.light["bg.base"];
  const backdropColor = COLOR_TOKENS.dark["bg.overlay"];
  const selectionColor = COLOR_TOKENS.light["primary.default"];
  const canSave = title.trim().length > 0 && !isSaving;
  const titleInputRef = useRef<RNTextInput>(null);
  const titleAutofocusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isCalendarModalOpenRef = useRef(false);
  const modalEntryY = useRef(
    new Animated.Value(MODAL_ENTRY_TRANSLATE_Y),
  ).current;
  const modalEntryOpacity = useRef(new Animated.Value(0)).current;
  const isCalendarModalOpen = isWhenModalOpen || isDeadlineModalOpen;

  useEffect(() => {
    modalEntryY.setValue(MODAL_ENTRY_TRANSLATE_Y);
    modalEntryOpacity.setValue(0);

    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
    }

    titleAutofocusTimeoutRef.current = setTimeout(() => {
      if (isCalendarModalOpenRef.current) {
        return;
      }

      titleInputRef.current?.focus();
    }, TITLE_AUTOFOCUS_DELAY_MS);

    Animated.parallel([
      Animated.spring(modalEntryY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: false,
      }),
      Animated.timing(modalEntryOpacity, {
        toValue: 1,
        duration: Math.round(MODAL_ENTRY_DURATION_MS * 0.62),
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
    ]).start();

    return () => {
      if (titleAutofocusTimeoutRef.current) {
        clearTimeout(titleAutofocusTimeoutRef.current);
        titleAutofocusTimeoutRef.current = null;
      }
    };
  }, [modalEntryOpacity, modalEntryY]);

  useEffect(() => {
    isCalendarModalOpenRef.current = isCalendarModalOpen;
  }, [isCalendarModalOpen]);

  const openWhenModal = () => {
    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
      titleAutofocusTimeoutRef.current = null;
    }

    isCalendarModalOpenRef.current = true;
    Keyboard.dismiss();
    setIsWhenModalOpen(true);
  };

  const closeWhenModal = () => {
    setIsWhenModalOpen(false);
  };

  const openDeadlineModal = () => {
    if (titleAutofocusTimeoutRef.current) {
      clearTimeout(titleAutofocusTimeoutRef.current);
      titleAutofocusTimeoutRef.current = null;
    }

    isCalendarModalOpenRef.current = true;
    Keyboard.dismiss();
    setIsDeadlineModalOpen(true);
  };

  const closeDeadlineModal = () => {
    setIsDeadlineModalOpen(false);
  };

  const closeModal = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleToolbarIconPress = (action?: () => void) => {
    Keyboard.dismiss();
    action?.();
  };

  const createTodoWithOptions = async ({
    scheduledDate,
    status,
  }: {
    scheduledDate?: Date | null;
    status?: "new" | "someday";
  }) => {
    if (!title.trim()) {
      setErrorMessage("Enter a task title.");
      return false;
    }

    if (isSaving) {
      return false;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase is not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      );
      return false;
    }

    setIsSaving(true);

    try {
      await createTodo({
        title: title.trim(),
        notes: notes.trim(),
        scheduledDate: scheduledDate ?? null,
        status,
      });
      return true;
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't save the task.",
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    const saveOptions: {
      scheduledDate?: Date | null;
      status?: "new" | "someday";
    } = (() => {
      if (whenSelection.type === "date") {
        return { scheduledDate: whenSelection.date, status: "new" };
      }

      if (whenSelection.type === "today") {
        return { scheduledDate: new Date(), status: "new" };
      }

      if (whenSelection.type === "someday") {
        return { scheduledDate: null, status: "someday" };
      }

      return { scheduledDate: null, status: "new" };
    })();

    const saved = await createTodoWithOptions({
      scheduledDate: saveOptions.scheduledDate ?? null,
      status: saveOptions.status,
    });
    if (saved) {
      if (whenSelection.type === "someday") {
        router.replace("/someday");
        return;
      }

      if (
        whenSelection.type === "today" ||
        (whenSelection.type === "date" &&
          isSameDate(whenSelection.date, new Date()))
      ) {
        router.replace("/today");
        return;
      }

      router.replace("/inbox");
    }
  };

  const handleSelectWhenDate = (date: Date) => {
    setWhenSelection({ type: "date", date });
  };

  const handleSelectToday = () => {
    setWhenSelection({ type: "today" });
  };

  const handleSelectSomeday = () => {
    setWhenSelection({ type: "someday" });
  };

  const handleClearWhenSelection = () => {
    setWhenSelection({ type: "none" });
  };

  const handleSelectDeadlineDate = (date: Date) => {
    setDeadlineDate(date);
  };

  const handleClearDeadlineSelection = () => {
    setDeadlineDate(null);
  };

  const selectedWhenDisplay =
    whenSelection.type === "date"
      ? {
          label: formatSelectedDateLabel(whenSelection.date),
          icon: "upcoming" as const,
          iconColor: "var(--color-upcoming)",
          showIcon: true,
        }
      : whenSelection.type === "today"
        ? {
            label: "Today",
            icon: "today" as const,
            iconColor: "var(--color-today)",
            showIcon: true,
          }
        : whenSelection.type === "someday"
          ? {
              label: "Someday",
              icon: "someday" as const,
              iconColor: "var(--color-someday)",
              showIcon: true,
            }
          : null;

  const selectedDeadlineDisplay = deadlineDate
    ? {
        label: formatSelectedDateLabel(deadlineDate),
        daysLeft: formatDaysUntilLabel(deadlineDate),
      }
    : null;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-transparent">
      <Pressable
        className="absolute inset-0"
        pointerEvents={isCalendarModalOpen ? "none" : "auto"}
        onPress={isCalendarModalOpen ? undefined : () => {}}
      >
        <View style={{ flex: 1, backgroundColor: backdropColor, opacity: 0.52 }} />
      </Pressable>

      <View
        pointerEvents={isCalendarModalOpen ? "none" : "auto"}
        className="flex-1 justify-start px-3"
      >
        
        <Animated.View
          className="self-stretch"
          style={[
            {
              opacity: modalEntryOpacity,
              transform: [{ translateY: modalEntryY as never }],
            },
          ]}
        >
          <View
            className="min-h-[260px] max-h-[82%] overflow-hidden rounded-[28px]"
            style={MODAL_CARD_SHADOW_STYLE}
          >
            <View className="shrink" style={{ backgroundColor: modalTopBg }}>
              <View className="flex-row items-center px-5 pt-4 pb-1">
                <View className="mr-2 h-6 w-6 items-center justify-center">
                  <View
                    className="bg-transparent"
                    style={{
                      width: SIZE_TOKENS.quickTaskCheckbox,
                      height: SIZE_TOKENS.quickTaskCheckbox,
                      borderRadius: RADIUS_TOKENS.xs,
                      borderWidth: 1,
                      borderColor: checkboxBorderColor,
                    }}
                  />
                </View>
                <AppTextInput
                  ref={titleInputRef}
                  value={title}
                  onChangeText={setTitle}
                  editable={!isCalendarModalOpen}
                  placeholder="New Quick Task"
                  placeholderTextColor={secondaryTextColor}
                  variant="bodyMd"
                  style={[
                    {
                      flex: 1,
                      minHeight: 36,
                      backgroundColor: "transparent",
                      paddingHorizontal: 0,
                      paddingVertical: 0,
                    },
                    {
                      color: primaryTextColor,
                    },
                  ]}
                  selectionColor={selectionColor}
                  returnKeyType="next"
                />
                <View className="ml-3">
                  <ModalCircleButton
                    icon="close"
                    theme={modalTheme}
                    onPress={closeModal}
                  />
                </View>
              </View>

              <View className="px-5 pb-2">
                {errorMessage ? (
                  <Text
                    className="mb-2 font-regular text-label-sm leading-5"
                    style={{ color: secondaryTextColor }}
                  >
                    {errorMessage}
                  </Text>
                ) : null}

                <View className="relative ml-8 h-[108px]">
                  {!notes.trim() && !isNotesFocused ? (
                    <Text
                      variant="labelSm"
                      pointerEvents="none"
                      className="absolute left-0 top-2 z-10"
                      style={{ color: secondaryTextColor }}
                    >
                      Notes
                    </Text>
                  ) : null}
                  <AppTextInput
                    value={notes}
                    onChangeText={setNotes}
                    editable={!isCalendarModalOpen}
                    onFocus={() => setIsNotesFocused(true)}
                    onBlur={() => setIsNotesFocused(false)}
                    placeholder=""
                    variant="bodyMd"
                    style={[
                      {
                        height: 108,
                        maxHeight: 108,
                        backgroundColor: "transparent",
                        paddingHorizontal: 0,
                        paddingTop: 8,
                        paddingBottom: 8,
                      },
                      {
                        color: primaryTextColor,
                      },
                    ]}
                    selectionColor={selectionColor}
                    multiline
                    scrollEnabled
                    textAlignVertical="top"
                  />
                </View>

                <View className="-mt-[25px] mb-[18px] flex-row items-center justify-between">
                  <View className="mb-2 min-h-[44px] min-w-0 flex-1 justify-center">
                    {selectedWhenDisplay ? (
                      <TouchableOpacity
                        activeOpacity={0.72}
                        className="min-w-0 flex-row items-center pr-[10px]"
                        onPress={openWhenModal}
                      >
                        {selectedWhenDisplay.showIcon ? (
                          <Icon
                            name={selectedWhenDisplay.icon}
                            size={16}
                            color={selectedWhenDisplay.iconColor}
                            weight="light"
                          />
                        ) : null}
                        <Text
                          variant="label"
                          className={
                            selectedWhenDisplay.showIcon
                              ? "ml-2 font-semibold"
                              : "font-semibold"
                          }
                          style={{ color: primaryTextColor, flexShrink: 1 }}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {selectedWhenDisplay.label}
                        </Text>
                      </TouchableOpacity>
                    ) : null}

                    {selectedDeadlineDisplay ? (
                      <TouchableOpacity
                        activeOpacity={0.72}
                        className={`min-w-0 flex-row items-center pr-[10px] ${selectedWhenDisplay ? "mt-4" : ""}`}
                        onPress={openDeadlineModal}
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
                            {selectedDeadlineDisplay.label}
                          </Text>
                          <Text
                            variant="labelSm"
                            className="ml-1 font-regular"
                            style={{ color: secondaryTextColor }}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {selectedDeadlineDisplay.daysLeft}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View className="mt-[26px] flex-row items-center justify-end">
                    {whenSelection.type === "none" ? (
                      <TouchableOpacity
                        className="h-8 w-8 items-center justify-center"
                        activeOpacity={0.72}
                        onPress={openWhenModal}
                      >
                        <Icon
                          name="upcoming"
                          size={18}
                          color={secondaryTextColor}
                          weight="light"
                        />
                      </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                      className="ml-2 h-8 w-8 items-center justify-center"
                      activeOpacity={0.72}
                      onPress={() => handleToolbarIconPress()}
                    >
                      <Icon
                        name="tag"
                        size={18}
                        color={secondaryTextColor}
                        weight="light"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="ml-2 h-8 w-8 items-center justify-center"
                      activeOpacity={0.72}
                      onPress={() => handleToolbarIconPress()}
                    >
                      <Icon
                        name="checkCircle"
                        size={18}
                        color={secondaryTextColor}
                        weight="light"
                      />
                    </TouchableOpacity>
                    {!deadlineDate ? (
                      <TouchableOpacity
                        className="ml-2 h-8 w-8 items-center justify-center"
                        activeOpacity={0.72}
                        onPress={openDeadlineModal}
                      >
                        <Icon
                          name="flag"
                          size={18}
                          color={secondaryTextColor}
                          weight="light"
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>

            <View
              className="flex-row items-center justify-between border-t px-[14px] py-[10px]"
              style={{
                backgroundColor: modalBottomBg,
                borderTopColor: inputBorderColor,
                borderTopWidth: 0.5,
              }}
            >
              <View className="flex-row items-center">
                <Icon name="inbox" size={18} color={inboxColor} />
                <Text
                  className="ml-2 font-semibold text-label-sm"
                  style={{ color: primaryTextColor }}
                >
                  Quick Tasks
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => void handleSave()}
                disabled={!canSave}
                activeOpacity={0.82}
                className="h-9 min-w-24 items-center justify-center rounded-full border px-4"
                style={{
                  backgroundColor: saveButtonBg,
                  borderColor: saveButtonBorderColor,
                  borderWidth: 0.5,
                  opacity: canSave ? 1 : 0.45,
                }}
              >
                <Text
                  className="font-semibold text-label-sm"
                  style={{ color: saveButtonTextColor }}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>

      <WhenCalendarModal
        visible={isWhenModalOpen}
        onClose={closeWhenModal}
        onSelectDate={handleSelectWhenDate}
        onSelectToday={handleSelectToday}
        onSelectSomeday={handleSelectSomeday}
        onClearSelection={handleClearWhenSelection}
        selectedDate={whenSelection.type === "date" ? whenSelection.date : null}
        selectedWhen={whenSelection.type}
      />

      <WhenCalendarModal
        visible={isDeadlineModalOpen}
        mode="deadline"
        onClose={closeDeadlineModal}
        onSelectDate={handleSelectDeadlineDate}
        onClearSelection={handleClearDeadlineSelection}
        selectedDate={deadlineDate}
      />
    </SafeAreaView>
  );
}
