import { Icon } from "@/components/Icon";
import { AppText as Text, AppTextInput } from "@/components/ui";
import { COLOR_TOKENS, SHADOW_TOKENS } from "@/lib/design-system/tokens";
import { createTodo } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function NewTodoScreen() {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const placeholderColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const titleInputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      titleInputRef.current?.focus();
    }, 150);

    return () => clearTimeout(timeout);
  }, []);

  const closeModal = () => {
    Keyboard.dismiss();
    router.back();
  };

  const handleSave = async () => {
    if (!title.trim() || isSaving) {
      return;
    }

    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    setIsSaving(true);

    try {
      await createTodo({ title: title.trim(), notes: notes.trim() });
      closeModal();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da sacuvam posao.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={closeModal}>
        <View style={styles.backdrop} />
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 px-3 pt-2"
      >
        <View
          className="overflow-hidden rounded-[28px] bg-things-bg"
          style={styles.modalCard}
        >
          <View className="flex-row items-center justify-between px-5 pt-4 pb-3">
            <TouchableOpacity onPress={closeModal}>
              <Text className="font-regular text-label-sm text-things-muted">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={title.trim().length === 0 || isSaving}
              onPress={() => void handleSave()}
            >
              <Text
                className={`font-semibold text-body-lg ${title.trim().length > 0 && !isSaving ? "text-things-inbox" : "text-things-muted/50"}`}
              >
                {isSaving ? "Saving" : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="flex-1 px-5 pt-2">
            {errorMessage ? (
              <Text className="mb-3 font-regular text-label-sm leading-5 text-things-muted">
                {errorMessage}
              </Text>
            ) : null}

            <AppTextInput
              ref={titleInputRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Novi posao"
              placeholderTextColor={placeholderColor}
              variant="titleSm"
              className="mb-2 text-things-text"
              selectionColor="var(--color-inbox)"
              returnKeyType="next"
            />

            <AppTextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Opis posla"
              placeholderTextColor={placeholderColor}
              variant="bodyLg"
              className="min-h-[120px] text-things-text"
              multiline
              selectionColor="var(--color-inbox)"
              textAlignVertical="top"
            />
          </View>

          <View className="flex-row items-center justify-between border-t border-things-border bg-things-card px-4 py-3">
            <View className="flex-row gap-4">
              <TouchableOpacity className="h-8 w-8 items-center justify-center rounded-full border border-things-border bg-things-bg">
                <Icon name="upcoming" size={16} color="var(--color-muted)" />
              </TouchableOpacity>

              <TouchableOpacity className="h-8 w-8 items-center justify-center rounded-full border border-things-border bg-things-bg">
                <Icon name="project" size={16} color="var(--color-muted)" />
              </TouchableOpacity>

              <TouchableOpacity className="h-8 w-8 items-center justify-center rounded-full border border-things-border bg-things-bg">
                <Icon name="tag" size={16} color="var(--color-muted)" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => void handleSave()}
              disabled={title.trim().length === 0 || isSaving}
            >
              <Icon
                name="check"
                size={24}
                color={
                  title.trim().length > 0 && !isSaving
                    ? "var(--color-inbox)"
                    : "var(--color-muted)"
                }
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "var(--color-bg-popup)",
    opacity: 0.52,
  },
  modalCard: {
    marginTop: 6,
    minHeight: 260,
    maxHeight: "82%",
    shadowColor: SHADOW_TOKENS.card.ios.shadowColor,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 18,
  },
});
