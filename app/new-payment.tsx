import { Icon } from "@/components/Icon";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import WhenCalendarModal from "@/components/WhenCalendarModal";
import { AppText as Text, AppTextInput } from "@/components/ui";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  OPACITY_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import {
  type PaymentJobOption,
  createPayment,
  fetchPaymentJobs,
} from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  Platform,
  ScrollView,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function formatDateLabel(date: Date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function NewPaymentScreen() {
  const { jobId: initialJobIdParam } = useLocalSearchParams<{ jobId?: string }>();
  const { colorScheme } = useColorScheme();
  const { height: windowHeight } = useWindowDimensions();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const formScrollRef = useRef<ScrollView | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [paymentJobs, setPaymentJobs] = useState<PaymentJobOption[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isJobsListOpen, setIsJobsListOpen] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(true);
  const [jobsErrorMessage, setJobsErrorMessage] = useState<string | null>(null);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [formContentHeight, setFormContentHeight] = useState(0);
  const [focusedField, setFocusedField] = useState<
    "job" | "amount" | "date" | "note" | null
  >(null);
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
  const confirmButtonBg = COLOR_TOKENS[colorMode]["primary.soft"];
  const confirmButtonBorder = COLOR_TOKENS[colorMode]["primary.soft"];
  const confirmButtonIcon = COLOR_TOKENS.light["bg.base"];
  const inputLabelColor = titleText;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const idleBorderColor = placeholderColor;
  const fieldHeight = SPACING_TOKENS["4xl"];
  const controlRadius = RADIUS_TOKENS.control;
  const focusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const subtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const initialJobId = useMemo(
    () =>
      typeof initialJobIdParam === "string" && initialJobIdParam.trim().length > 0
        ? initialJobIdParam
        : null,
    [initialJobIdParam],
  );
  const disabledOpacity = OPACITY_TOKENS.disabled;
  const amountValue = useMemo(() => {
    const normalized = amountInput.replace(",", ".").trim();
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [amountInput]);
  const selectedJob = useMemo(
    () => paymentJobs.find((job) => job.id === selectedJobId) ?? null,
    [paymentJobs, selectedJobId],
  );
  const selectedJobLabel = useMemo(() => {
    if (!selectedJob) {
      return "Choose job";
    }

    const title = selectedJob.title?.trim() || "Untitled job";
    if (!selectedJob.client_name) {
      return title;
    }

    return `${title} - ${selectedJob.client_name}`;
  }, [selectedJob]);
  const canSave =
    !isSaving &&
    Number.isFinite(amountValue) &&
    amountValue > 0 &&
    Boolean(selectedJobId);
  const keyboardLayoutInset = keyboardInset;
  const usableHeight = Math.max(windowHeight - keyboardLayoutInset, 320);
  const modalMaxHeight = Math.round(usableHeight * 0.82);
  const formMaxHeight = Math.round(usableHeight * 0.62);
  const formViewportHeight =
    formContentHeight > 0 ? Math.min(formContentHeight, formMaxHeight) : formMaxHeight;

  useEffect(() => {
    let isMounted = true;

    const loadJobs = async () => {
      setIsJobsLoading(true);
      try {
        const jobs = await fetchPaymentJobs();
        if (!isMounted) {
          return;
        }

        setPaymentJobs(jobs);
        if (initialJobId && jobs.some((job) => job.id === initialJobId)) {
          setSelectedJobId((current) => current ?? initialJobId);
        }
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
  }, [initialJobId]);

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

  useEffect(() => {
    if (keyboardInset <= 0 || focusedField !== "note") {
      return;
    }
    const id = setTimeout(() => {
      formScrollRef.current?.scrollToEnd({ animated: true });
    }, 60);
    return () => clearTimeout(id);
  }, [keyboardInset, focusedField]);

  const closeModal = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleSave = async () => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setErrorMessage("Enter a valid amount greater than 0.");
      return;
    }
    if (!selectedJobId) {
      setErrorMessage("Select job for this payment.");
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase is not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.",
      );
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);
    try {
      await createPayment({
        amount: amountValue,
        note: noteInput,
        paymentDate,
        jobId: selectedJobId,
      });
      setErrorMessage(null);
      closeModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Couldn't save payment.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const getFieldBorderStyle = (field: "job" | "amount" | "date" | "note") => ({
    borderWidth: focusedField === field ? focusBorderWidth : subtleBorderWidth,
    borderColor: focusedField === field ? focusBorderColor : idleBorderColor,
  });

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
          <View className="shrink">
            <View className="mb-1 mt-1.5 h-14 items-center justify-center">
              <Text variant="bodyLg" className="text-center" style={{ color: titleText }}>
                New Payment
              </Text>
              <View
                style={[
                  { position: "absolute", top: 8, right: 16 },
                  { opacity: canSave ? 1 : disabledOpacity },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.82}
                  className="h-9 w-9 items-center justify-center rounded-[18px] border"
                  style={[
                    {
                      backgroundColor: confirmButtonBg,
                      borderColor: confirmButtonBorder,
                    },
                  ]}
                  onPress={() => {
                    if (!canSave) {
                      return;
                    }
                    void handleSave();
                  }}
                  disabled={!canSave}
                >
                  <Icon name="check" size={18} color={confirmButtonIcon} />
                </TouchableOpacity>
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
              Job
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
                <Icon name="briefcase" size={16} color={secondaryText} />
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
                      focusedField === "job" ? focusBorderColor : idleBorderColor,
                    borderWidth:
                      focusedField === "job" ? focusBorderWidth : subtleBorderWidth,
                  },
                ]}
              >
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
              Amount
            </Text>
            <View
              className="px-3 py-0"
              style={[
                {
                  borderWidth: BORDER_WIDTH_TOKENS.subtle,
                  borderRadius: RADIUS_TOKENS.control,
                },
                {
                  height: fieldHeight,
                  borderRadius: controlRadius,
                  backgroundColor: fieldBg,
                },
                getFieldBorderStyle("amount"),
              ]}
            >
              <AppTextInput
                value={amountInput}
                onChangeText={setAmountInput}
                onFocus={() => {
                  setFocusedField("amount");
                  setIsJobsListOpen(false);
                }}
                onBlur={() =>
                  setFocusedField((current) =>
                    current === "amount" ? null : current,
                  )
                }
                variant="bodyMd"
                keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                placeholder="0.00"
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
              Payment Date
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                Keyboard.dismiss();
                setFocusedField("date");
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
                getFieldBorderStyle("date"),
              ]}
            >
              <View className="h-full flex-row items-center">
                <Icon name="upcoming" size={16} color={secondaryText} />
                <Text
                  className="ml-2 font-medium text-body"
                  style={{ color: inputText }}
                >
                  {formatDateLabel(paymentDate)}
                </Text>
              </View>
            </TouchableOpacity>

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
                  setTimeout(() => {
                    formScrollRef.current?.scrollToEnd({ animated: true });
                  }, Platform.OS === "ios" ? 220 : 140);
                }}
                  onBlur={() =>
                    setFocusedField((current) => (current === "note" ? null : current))
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
          </View>
        </View>
      </TransparentModalShell>

      <WhenCalendarModal
        visible={isDateModalOpen}
        mode="deadline"
        onClose={() => setIsDateModalOpen(false)}
        onSelectDate={(date) => setPaymentDate(date)}
        onClearSelection={() => setPaymentDate(new Date())}
        selectedDate={paymentDate}
      />
    </SafeAreaView>
  );
}
