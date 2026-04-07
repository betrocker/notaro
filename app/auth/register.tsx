import { Redirect } from "expo-router";

export default function RegisterScreen() {
  return <Redirect href="/auth/email?screen=register" />;
}
