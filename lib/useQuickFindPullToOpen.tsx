import { router } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useMemo, useRef } from "react";
import { RefreshControl } from "react-native";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";

const OPEN_LOCK_MS = 550;

export function useQuickFindPullToOpen() {
  const { colorScheme } = useColorScheme();
  const colorMode = colorScheme === "dark" ? "dark" : "light";
  const openLockRef = useRef(false);

  const handleRefresh = useCallback(() => {
    if (openLockRef.current) {
      return;
    }

    openLockRef.current = true;
    router.push("/quick-find" as never);
    setTimeout(() => {
      openLockRef.current = false;
    }, OPEN_LOCK_MS);
  }, []);

  const refreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={false}
        onRefresh={handleRefresh}
        tintColor={COLOR_TOKENS[colorMode]["text.secondary"]}
        colors={[COLOR_TOKENS[colorMode]["primary.default"]]}
        progressBackgroundColor={COLOR_TOKENS[colorMode]["bg.modal"]}
      />
    ),
    [colorMode, handleRefresh],
  );

  return refreshControl;
}
