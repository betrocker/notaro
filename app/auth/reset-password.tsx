import { Redirect, useLocalSearchParams } from "expo-router";

export default function ResetPasswordScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <Redirect
      href={{
        pathname: "/auth/email",
        params: {
          screen: "reset",
          ...(email ? { email } : {}),
        },
      }}
    />
  );
}
