import { Icon } from "@/components/Icon";
import ProjectHeader from "@/components/ProjectHeader";
import { AppText as Text } from "@/components/ui";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";
import { fetchHomeData } from "@/lib/repository";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

type ClientListItem = {
  id: string;
  title: string;
  notes: string;
  jobCount: number;
};

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

export default function ClientsHomeScreen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollY = useSharedValue(0);
  const dividerColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.22);
  const emptyIconColor = withOpacity(COLOR_TOKENS[colorMode]["text.secondary"], 0.5);

  const loadClients = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      setClients([]);
      return;
    }

    try {
      const data = await fetchHomeData();
      setClients(
        data.clients.map((client) => ({
          id: client.id,
          title: client.name ?? "Novi klijent",
          notes: client.note ?? "",
          jobCount: client.jobCount ?? 0,
        })),
      );
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam klijente.",
      );
      setClients([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients]),
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

  return (
    <View className="flex-1 bg-things-bg">
      <Stack.Screen options={{ headerShown: false }} />

      <ProjectHeader
        title="Clients"
        titleAnimatedStyle={headerTitleAnimatedStyle}
        onBack={() => router.replace("/")}
      />

      <Animated.ScrollView
        className="flex-1 bg-things-bg px-5"
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 94, paddingBottom: 132, flexGrow: 1 }}
      >
        <Animated.View
          className="mb-6 flex-row items-center"
          style={heroTitleAnimatedStyle}
        >
          <Icon name="client" size={22} color="var(--color-inbox)" />
          <Text className="ml-2.5 font-bold text-things-text text-things-title-large">
            Clients
          </Text>
        </Animated.View>

        {errorMessage ? (
          <Text className="mb-4 font-regular text-label-sm leading-5 text-things-muted">
            {errorMessage}
          </Text>
        ) : null}

        <Pressable
          onPress={() => router.push("/clients" as never)}
          className="mb-4 self-start rounded-full px-3 py-1.5"
          style={{
            backgroundColor: withOpacity(COLOR_TOKENS[colorMode]["bg.input"], 0.86),
            borderWidth: 0.5,
            borderColor: dividerColor,
          }}
        >
          <Text className="font-medium text-label-sm text-things-text">
            Manage Clients
          </Text>
        </Pressable>

        {clients.length > 0 ? (
          <View
            className="mb-20 overflow-hidden rounded-2xl"
            style={{
              borderWidth: 0.5,
              borderColor: dividerColor,
              backgroundColor: withOpacity(COLOR_TOKENS[colorMode]["bg.modal"], 0.48),
            }}
          >
            {clients.map((client, index) => (
              <Pressable
                key={client.id}
                onPress={() =>
                  router.push({
                    pathname: "/project/[id]",
                    params: { id: client.id },
                  })
                }
                className="flex-row items-center px-4 py-3.5"
                style={
                  index < clients.length - 1
                    ? {
                        borderBottomWidth: 0.5,
                        borderBottomColor: dividerColor,
                      }
                    : undefined
                }
              >
                <View className="mr-3 h-7 w-7 items-center justify-center">
                  <Icon name="project" size={19} color="var(--color-muted)" />
                </View>
                <Text variant="bodyMd" className="flex-1 font-medium text-things-text">
                  {client.title}
                </Text>
                {client.jobCount > 0 ? (
                  <Text className="font-medium text-label-sm text-things-muted">
                    {client.jobCount}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Icon name="client" size={96} color={emptyIconColor} />
          </View>
        )}
      </Animated.ScrollView>
    </View>
  );
}
