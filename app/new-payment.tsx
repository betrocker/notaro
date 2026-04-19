import { ModalCircleButton } from "@/components/ModalCircleButton";
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
import { getThemeTokens } from "@/lib/theme";
import { router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
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
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const theme = getThemeTokens(isDark);
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
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <TransparentModalShell
        closeOnBackdropPress
        onBackdropPress={closeModal}
        overlayStyle={styles.overlay}
        contentStyle={[
          styles.modalWindow,
          styles.modalWindowShadow,
          { backgroundColor: modalBg, borderColor },
        ]}
        backdropColor={COLOR_TOKENS.dark["bg.overlay"]}
        backdropOpacity={isDark ? 0.64 : 0.4}
      >
        <Pressable
          style={styles.content}
          onPress={() => {
            Keyboard.dismiss();
            setIsJobsListOpen(false);
            setFocusedField(null);
          }}
        >
          <View style={styles.header}>
            <Text variant="bodyLg" style={[styles.headerTitle, { color: titleText }]}>
              New Payment
            </Text>
            <View
              style={[
                styles.headerRightButton,
                { opacity: canSave ? 1 : disabledOpacity },
              ]}
            >
              <ModalCircleButton
                icon="check"
                theme={theme}
                onPress={() => {
                  if (!canSave) {
                    return;
                  }
                  void handleSave();
                }}
              />
            </View>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
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
                styles.authField,
                styles.rowField,
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
                  styles.jobsList,
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
                    style={styles.jobsListScroll}
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
                            styles.jobRow,
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

            <View style={styles.fieldSpacing} />
            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              Amount
            </Text>
            <View
              className="px-3 py-0"
              style={[
                styles.authField,
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

            <View style={styles.fieldSpacing} />
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
                styles.authField,
                styles.rowField,
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

            <View style={styles.fieldSpacing} />
            <Text
              className="mb-2 ml-1 font-semibold text-label-md"
              style={{ color: inputLabelColor }}
            >
              Note
            </Text>
            <View
              className="px-3 py-2"
              style={[
                styles.authField,
                styles.noteField,
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

        </Pressable>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  overlay: {
    paddingHorizontal: SPACING_TOKENS.md,
    paddingVertical: SPACING_TOKENS["2xl"],
  },
  modalWindow: {
    width: "85%",
    height: "60%",
    borderRadius: 28,
    borderWidth: BORDER_WIDTH_TOKENS.subtle,
    overflow: "hidden",
    paddingBottom: SPACING_TOKENS.sm,
  },
  modalWindowShadow: {
    ...Platform.select({
      ios: {
        ...SHADOW_TOKENS.card.ios,
      },
      android: {
        elevation: SHADOW_TOKENS.card.android.elevation,
      },
    }),
  },
  content: {
    flex: 1,
  },
  header: {
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    marginBottom: SPACING_TOKENS.xs,
  },
  headerTitle: {
    textAlign: "center",
  },
  headerRightButton: {
    position: "absolute",
    top: 8,
    right: 16,
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: SPACING_TOKENS.lg,
    paddingBottom: SPACING_TOKENS.lg,
  },
  authField: {
    borderWidth: BORDER_WIDTH_TOKENS.subtle,
    borderRadius: RADIUS_TOKENS.control,
  },
  rowField: {
    paddingHorizontal: SPACING_TOKENS.md,
    justifyContent: "center",
  },
  noteField: {
    minHeight: 98,
  },
  fieldSpacing: {
    height: SPACING_TOKENS.md,
  },
  jobsList: {
    marginTop: SPACING_TOKENS.xs,
    borderWidth: BORDER_WIDTH_TOKENS.subtle,
    borderRadius: RADIUS_TOKENS.control,
    overflow: "hidden",
  },
  jobsListScroll: {
    maxHeight: 180,
  },
  jobRow: {
    paddingHorizontal: SPACING_TOKENS.md,
    paddingVertical: SPACING_TOKENS.sm,
    borderBottomWidth: BORDER_WIDTH_TOKENS.subtle,
  },
});
