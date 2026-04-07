import { FadeIn, FadeOut, Keyframe } from "react-native-reanimated";
import { COLOR_TOKENS } from "@/lib/design-system/tokens";

export const SHARED_MODAL_ANIMATION_MS = 100;

export const sharedModalEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ scale: 0.8 }],
  },
  100: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
}).duration(SHARED_MODAL_ANIMATION_MS);

export const sharedModalExiting = new Keyframe({
  0: {
    opacity: 1,
    transform: [{ scale: 1 }],
  },
  100: {
    opacity: 0,
    transform: [{ scale: 0.8 }],
  },
}).duration(SHARED_MODAL_ANIMATION_MS);

export const sharedBackdropEntering = FadeIn.duration(SHARED_MODAL_ANIMATION_MS);
export const sharedBackdropExiting = FadeOut.duration(SHARED_MODAL_ANIMATION_MS);

export function getSharedModalTheme(isDark: boolean) {
  const colorMode = isDark ? "dark" : "light";
  const color = COLOR_TOKENS[colorMode];
  return {
    modalBg: color["bg.modal"],
    borderColor: color["border.default"],
    backdropColor: color["bg.popup"],
  };
}
