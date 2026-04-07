import { completeInboxTodo, fetchInboxTodos } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { Icon } from "@/components/Icon";
import MagicMenu from "@/components/MagicMenu";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import React, { useCallback, useState } from "react";
import { Dimensions, TouchableOpacity, View } from "react-native";
import { AppText as Text } from "@/components/ui";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface InboxTodo {
  id: string;
  title: string;
  notes: string | null;
  clientName: string | null;
}

export default function InboxScreen() {
  const [tasks, setTasks] = useState<InboxTodo[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollY = useSharedValue(0);

  const loadInbox = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setTasks([]);
      return;
    }

    try {
      const data = await fetchInboxTodos();
      setTasks(
        data.map((todo) => ({
          id: todo.id,
          title: todo.title ?? "Bez naslova",
          notes: todo.description,
          clientName:
            !Array.isArray(todo.clients) && todo.clients
              ? (todo.clients.name ?? null)
              : null,
        })),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam poslove bez termina.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInbox();
    }, [loadInbox]),
  );

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const headerTitleAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [30, 60],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [30, 60],
      [10, 0],
      Extrapolation.CLAMP,
    );

    return { opacity, transform: [{ translateY }] };
  });

  const HeaderTitle = () => (
    <Animated.View style={headerTitleAnimatedStyle}>
      <Text className="font-semibold text-body-lg text-things-text">
        Bez termina
      </Text>
    </Animated.View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: "var(--color-bg)" },
          headerTitle: () => <HeaderTitle />,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              className="mr-4 flex-row items-center"
            >
              <Icon name="chevronLeft" size={18} color="var(--color-inbox)" />
              <Text className="ml-1 font-regular text-body-lg text-things-inbox">
                Pregled
              </Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => console.log("Select/Edit Jobs")}>
              <Icon name="ellipsis" size={24} color="var(--color-inbox)" />
            </TouchableOpacity>
          ),
        }}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-4 pt-2"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <Text className="mb-6 font-bold text-things-title-large tracking-tight text-things-inbox">
          Poslovi bez termina
        </Text>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        {tasks.length === 0 ? (
          <View
            className="flex-1 items-center justify-center"
            style={{ height: SCREEN_HEIGHT * 0.5 }}
          >
            <Icon name="inbox" size={64} color="var(--color-border)" />
            <Text className="mt-4 text-center font-regular text-things-muted text-label-sm">
              {errorMessage
                ? "Povezi Supabase da vidis prave poslove."
                : "Nema poslova bez termina."}
            </Text>
          </View>
        ) : (
          <View className="mb-8 overflow-hidden rounded-2xl bg-things-card">
            {tasks.map((task, index) => (
              <View
                key={task.id}
                className={`flex-row items-start p-4 ${index !== tasks.length - 1 ? "border-b border-things-border/60" : ""}`}
              >
                <TouchableOpacity
                  className="mr-3 mt-0.5 h-6 w-6 rounded-full border-2 border-things-checkbox"
                  onPress={async () => {
                    try {
                      await completeInboxTodo(task.id);
                      setTasks((currentTasks) =>
                        currentTasks.filter(
                          (currentTask) => currentTask.id !== task.id,
                        ),
                      );
                    } catch (error) {
                      setErrorMessage(
                        error instanceof Error
                          ? error.message
                          : "Nisam uspeo da zavrsim posao.",
                      );
                    }
                  }}
                />

                <View className="flex-1">
                  <Text className="font-medium leading-5 text-things-body text-things-text">
                    {task.title}
                  </Text>

                  {task.clientName ? (
                    <Text className="mt-1 font-regular text-label-sm leading-5 text-things-muted">
                      {task.clientName}
                    </Text>
                  ) : null}

                  {task.notes ? (
                    <Text className="mt-1 font-regular text-label-sm leading-5 text-things-muted">
                      {task.notes}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        )}
      </Animated.ScrollView>

      <MagicMenu
        onNewTask={() => router.push("/new-todo")}
        onNewProject={() => router.push("/")}
        onNewClient={() => console.log("New Client is not implemented yet")}
      />
    </>
  );
}
