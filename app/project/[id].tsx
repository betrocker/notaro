import { fetchProjectById } from "@/lib/repository";
import { Icon } from "@/components/Icon";
import { isSupabaseConfigured } from "@/lib/supabase";
import ProjectHeader from "@/components/ProjectHeader";
import ProjectMenu from "@/components/ProjectMenu";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { useFocusEffect } from "@react-navigation/native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { ChartPie } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import React, { useCallback, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { AppText as Text } from "@/components/ui";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

interface ProjectTodo {
  id: string;
  title: string;
  subtitle: string | null;
}

export default function ProjectScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const projectTitleIconColor = COLOR_TOKENS.light["primary.soft"];
  const titleMenuIconColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const titleMenuActiveBg = COLOR_TOKENS[colorMode]["bg.input"];
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [projectTitle, setProjectTitle] = useState("Projekat");
  const [projectNotes, setProjectNotes] = useState("Projekat nije pronadjen.");
  const [projectTasks, setProjectTasks] = useState<ProjectTodo[]>([]);
  const [projectExists, setProjectExists] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollY = useSharedValue(0);

  const loadProject = useCallback(async () => {
    if (!id) {
      setProjectExists(false);
      setProjectTitle("Projekat");
      setProjectNotes("Nedostaje ID projekta.");
      setProjectTasks([]);
      return;
    }

    if (!isSupabaseConfigured) {
      setProjectExists(false);
      setProjectTitle("Projekat");
      setProjectNotes(
        "Povezi Supabase da bi ekran projekta radio sa pravim podacima.",
      );
      setProjectTasks([]);
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    try {
      const data = await fetchProjectById(id);
      setProjectExists(true);
      setProjectTitle(data.project.name || "Bez imena");
      setProjectNotes(
        data.project.note?.trim() || "Jos nema detalja za ovaj projekat.",
      );
      setProjectTasks(
        data.todos.map((todo) => ({
          id: todo.id,
          title: todo.title || "Bez naslova",
          subtitle: [
            todo.status,
            todo.scheduled_date ? `Termin: ${todo.scheduled_date}` : null,
            todo.price ? `${todo.price} RSD` : null,
          ]
            .filter(Boolean)
            .join(" | "),
        })),
      );
      setErrorMessage(null);
    } catch (error) {
      setProjectExists(false);
      setProjectTitle("Projekat");
      setProjectNotes("Projekat nije pronadjen.");
      setProjectTasks([]);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam projekat.",
      );
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadProject();
    }, [loadProject]),
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

  const heroNotesAnimatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 36],
      [1, 0],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, 36],
      [0, -10],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const closeProjectMenu = () => {
    setIsMenuOpen(false);
    setMenuAnchor(null);
  };

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title={projectTitle}
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.back()}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 32 }}
      >
        <Animated.View
          className="mb-2 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <ChartPie
            size={22}
            color={projectTitleIconColor}
            strokeWidth={1.9}
          />
          <View className="ml-2 flex-1 flex-row items-center">
            <Text
              numberOfLines={1}
              className="font-bold text-things-text text-things-title-large"
            >
              {projectTitle}
            </Text>

            <TouchableOpacity
              onPress={(event) => {
                setMenuAnchor({
                  x: event.nativeEvent.pageX,
                  y: event.nativeEvent.pageY,
                });
                setIsMenuOpen(true);
              }}
              disabled={!projectExists}
              className="ml-2 h-9 w-9 items-center justify-center rounded-full"
              style={isMenuOpen ? { backgroundColor: titleMenuActiveBg } : undefined}
              activeOpacity={0.75}
            >
              <Icon name="ellipsisPlain" size={28} color={titleMenuIconColor} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Animated.Text
          className="mb-4 font-regular leading-6 text-things-muted text-label-sm"
          style={heroNotesAnimatedStyle}
        >
          {projectNotes}
        </Animated.Text>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        <View className="mb-20 overflow-hidden rounded-2xl bg-things-card">
          {projectTasks.length > 0 ? (
            projectTasks.map((task, index) => (
              <View
                key={task.id}
                className={`flex-row items-center p-4 ${index !== projectTasks.length - 1 ? "border-b border-things-border" : ""}`}
              >
                <TouchableOpacity className="mr-3 h-6 w-6 rounded-full border-2 border-things-checkbox" />
                <View className="flex-1">
                  <Text className="font-medium text-things-body text-things-text">
                    {task.title}
                  </Text>
                  {task.subtitle ? (
                    <Text className="mt-1 font-regular text-label-sm text-things-muted">
                      {task.subtitle}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))
          ) : (
            <Text className="p-4 font-regular text-label-sm leading-6 text-things-muted">
              {projectExists
                ? "Ovaj projekat jos nema poslova."
                : "Vrati se na pocetni ekran i otvori validan projekat."}
            </Text>
          )}
        </View>
      </Animated.ScrollView>

      {isMenuOpen && projectExists ? (
        <ProjectMenu anchor={menuAnchor} onClose={closeProjectMenu} />
      ) : null}
    </View>
  );
}
