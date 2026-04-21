import { ModalCircleButton } from "@/components/ModalCircleButton";
import { TransparentModalShell } from "@/components/TransparentModalShell";
import { Icon, IconName } from "@/components/Icon";
import { AppText as Text, AppTextInput } from "@/components/ui";
import {
  assignClientToInboxTodo,
  createClient,
  deleteClient,
  fetchClients,
  updateClient,
} from "@/lib/repository";
import { emitClientPickerSelection } from "@/lib/clientPicker";
import {
  BORDER_WIDTH_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
} from "@/lib/design-system/tokens";
import { isSupabaseConfigured } from "@/lib/supabase";
import { getThemeTokens } from "@/lib/theme";
import { useFocusEffect } from "@react-navigation/native";
import { BlurView } from "expo-blur";
import { router, useLocalSearchParams } from "expo-router";
import { useColorScheme } from "nativewind";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Platform,
  ScrollView,
  View,
} from "react-native";

const HARD_CODED_CLIENTS = [
  "Acme Studio",
  "Blue Harbor LLC",
  "Mila Design",
  "Northline Partners",
  "Petar Jovanovic",
  "Studio Aurora",
  "Delta Build Co.",
  "Greenline Interiors",
  "Tara Kovacevic",
  "Westend Legal",
  "Novak Dentistry",
  "Pixel Forge",
  "Lumina Events",
  "Marko Nikolic",
  "Astra Consulting",
  "Riverfront Holdings",
  "Elena Ilic",
  "Fjord Analytics",
  "Urban Nest",
  "Mosaic Digital",
  "Helix Systems",
  "Cobalt Logistics",
  "Sanja Petrovic",
  "Vertex Health",
  "Harbor Media",
];
const CLIENT_ROW_ICONS: IconName[] = [
  "client",
  "project",
  "area",
  "upcoming",
  "today",
  "anytime",
];
const HEADER_GLASS_HEIGHT = 62;
const FOOTER_ACTIONS_HEIGHT = 86;
const SHEET_ENTRY_DURATION_MS = 300;

type ClientListItem = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
};

type ClientFormField = "name" | "address" | "phone";

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

export default function ClientsScreen() {
  const {
    jobId: rawJobId,
    selectedClientId: rawSelectedClientId,
    pickerToken: rawPickerToken,
  } =
    useLocalSearchParams<{
      jobId?: string | string[];
      selectedClientId?: string | string[];
      pickerToken?: string | string[];
    }>();
  const jobId =
    typeof rawJobId === "string"
      ? rawJobId
      : Array.isArray(rawJobId)
        ? rawJobId[0]
        : undefined;
  const initialSelectedClientIdRaw =
    typeof rawSelectedClientId === "string"
      ? rawSelectedClientId
      : Array.isArray(rawSelectedClientId)
        ? rawSelectedClientId[0]
        : undefined;
  const initialSelectedClientId =
    initialSelectedClientIdRaw && initialSelectedClientIdRaw.trim().length > 0
      ? initialSelectedClientIdRaw
      : null;
  const pickerToken =
    typeof rawPickerToken === "string"
      ? rawPickerToken
      : Array.isArray(rawPickerToken)
        ? rawPickerToken[0]
        : undefined;
  const isJobAssignmentMode = Boolean(jobId);
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const colorMode = isDark ? "dark" : "light";
  const [clients, setClients] = useState<ClientListItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(
    initialSelectedClientId,
  );
  const [isAddClientScreenOpen, setIsAddClientScreenOpen] = useState(false);
  const [isManageClientsScreenOpen, setIsManageClientsScreenOpen] = useState(false);
  const [isEditClientScreenOpen, setIsEditClientScreenOpen] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientAddress, setNewClientAddress] = useState("");
  const [newClientPhone, setNewClientPhone] = useState("");
  const [editClientName, setEditClientName] = useState("");
  const [editClientAddress, setEditClientAddress] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [addFocusedField, setAddFocusedField] = useState<ClientFormField | null>(null);
  const [editFocusedField, setEditFocusedField] = useState<ClientFormField | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [manageErrorMessage, setManageErrorMessage] = useState<string | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState<string | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isUpdatingClient, setIsUpdatingClient] = useState(false);
  const [isDeletingClientId, setIsDeletingClientId] = useState<string | null>(null);
  const [isAssigningClient, setIsAssigningClient] = useState(false);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [addClientScreenHeight, setAddClientScreenHeight] = useState(0);
  const [manageClientsScreenHeight, setManageClientsScreenHeight] = useState(0);
  const [editClientScreenHeight, setEditClientScreenHeight] = useState(0);
  const addClientScreenProgress = useRef(new Animated.Value(0)).current;
  const manageClientsScreenProgress = useRef(new Animated.Value(0)).current;
  const editClientScreenProgress = useRef(new Animated.Value(0)).current;
  const theme = getThemeTokens(isDark);
  const modalBg = isDark
    ? COLOR_TOKENS.dark["bg.input"]
    : COLOR_TOKENS.light["bg.modal"];
  const borderColor = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["border.default"];
  const actionButtonBorder = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    isDark ? 0.34 : 0.28,
  );
  const actionButtonHighlight = isDark
    ? "rgba(0, 0, 0, 0.24)"
    : "rgba(0, 0, 0, 0.08)";
  const actionButtonText = COLOR_TOKENS[colorMode]["text.primary"];
  const confirmButtonBg = COLOR_TOKENS[colorMode]["primary.soft"];
  const confirmButtonBorder = withOpacity(confirmButtonBg, isDark ? 0.9 : 0.75);
  const confirmButtonIcon = COLOR_TOKENS.light["bg.base"];
  const rowIconBg = withOpacity(
    COLOR_TOKENS[colorMode]["text.secondary"],
    isDark ? 0.14 : 0.1,
  );
  const rowIconColor = COLOR_TOKENS[colorMode]["text.secondary"];
  const selectedRowCheckColor = COLOR_TOKENS[colorMode]["primary.default"];
  const selectionColor = COLOR_TOKENS[colorMode]["primary.default"];
  const inputBg = isDark
    ? COLOR_TOKENS.dark["btn.secondary"]
    : COLOR_TOKENS.light["bg.input"];
  const inputText = COLOR_TOKENS[colorMode]["text.primary"];
  const inputPlaceholder = COLOR_TOKENS[colorMode]["text.secondary"];
  const inputLabelColor = theme.onboardingTitle;
  const focusBorderColor = COLOR_TOKENS[colorMode]["primary.soft"];
  const idleBorderColor = inputPlaceholder;
  const fieldHeight = SPACING_TOKENS["4xl"];
  const controlRadius = RADIUS_TOKENS.control;
  const focusBorderWidth = BORDER_WIDTH_TOKENS.focus;
  const subtleBorderWidth = BORDER_WIDTH_TOKENS.subtle;
  const blurMethod =
    Platform.OS === "android"
      ? ("dimezisBlurView" as const)
      : undefined;
  const addClientScreenTranslateY = addClientScreenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(addClientScreenHeight, 340), 0],
  });
  const manageClientsScreenTranslateY = manageClientsScreenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(manageClientsScreenHeight, 340), 0],
  });
  const editClientScreenTranslateY = editClientScreenProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [Math.max(editClientScreenHeight, 340), 0],
  });

  const loadClients = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setClients(
        HARD_CODED_CLIENTS.map((name, index) => ({
          id: `mock-${index}`,
          name,
          address: null,
          phone: null,
        })),
      );
      setLoadErrorMessage(
        "Supabase nije povezan, prikazujem lokalne klijente.",
      );
      return;
    }

    try {
      const data = await fetchClients();
      setClients(
        data.map((client) => ({
          id: client.id,
          name: client.name?.trim() || "Bez imena",
          address: client.address ?? null,
          phone: client.phone ?? null,
        })),
      );
      setLoadErrorMessage(null);
    } catch (error) {
      setLoadErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da ucitam klijente.",
      );
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadClients();
    }, [loadClients]),
  );

  useEffect(() => {
    setSelectedClientId(initialSelectedClientId);
  }, [initialSelectedClientId]);

  const animateSheet = (
    progress: Animated.Value,
    toValue: number,
    onFinish?: () => void,
  ) => {
    Animated.timing(progress, {
      toValue,
      duration: SHEET_ENTRY_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) {
        onFinish?.();
      }
    });
  };

  const openAddClientScreen = () => {
    if (isAddClientScreenOpen) {
      return;
    }

    setSaveErrorMessage(null);
    addClientScreenProgress.stopAnimation();
    addClientScreenProgress.setValue(0);
    setIsAddClientScreenOpen(true);

    requestAnimationFrame(() => {
      animateSheet(addClientScreenProgress, 1);
    });
  };

  const closeAddClientScreen = (clearDrafts = false) => {
    if (!isAddClientScreenOpen) {
      if (clearDrafts) {
        setNewClientName("");
        setNewClientAddress("");
        setNewClientPhone("");
        setAddFocusedField(null);
        setSaveErrorMessage(null);
      }
      return;
    }

    animateSheet(addClientScreenProgress, 0, () => {
      setIsAddClientScreenOpen(false);

      if (clearDrafts) {
        setNewClientName("");
        setNewClientAddress("");
        setNewClientPhone("");
        setAddFocusedField(null);
        setSaveErrorMessage(null);
      }
    });
  };

  const openManageClientsScreen = () => {
    if (isManageClientsScreenOpen) {
      return;
    }

    setManageErrorMessage(null);
    manageClientsScreenProgress.stopAnimation();
    manageClientsScreenProgress.setValue(0);
    setIsManageClientsScreenOpen(true);

    requestAnimationFrame(() => {
      animateSheet(manageClientsScreenProgress, 1);
    });
  };

  const closeManageClientsScreen = () => {
    if (!isManageClientsScreenOpen) {
      return;
    }

    animateSheet(manageClientsScreenProgress, 0, () => {
      setIsManageClientsScreenOpen(false);
      setManageErrorMessage(null);
    });
  };

  const openEditClientScreen = (client: ClientListItem) => {
    setEditingClientId(client.id);
    setEditClientName(client.name);
    setEditClientAddress(client.address ?? "");
    setEditClientPhone(client.phone ?? "");
    setEditFocusedField(null);
    setEditErrorMessage(null);
    editClientScreenProgress.stopAnimation();
    editClientScreenProgress.setValue(0);
    setIsEditClientScreenOpen(true);

    requestAnimationFrame(() => {
      animateSheet(editClientScreenProgress, 1);
    });
  };

  const closeEditClientScreen = (clearDrafts = false) => {
    if (!isEditClientScreenOpen) {
      if (clearDrafts) {
        setEditingClientId(null);
        setEditClientName("");
        setEditClientAddress("");
        setEditClientPhone("");
        setEditFocusedField(null);
        setEditErrorMessage(null);
      }
      return;
    }

    animateSheet(editClientScreenProgress, 0, () => {
      setIsEditClientScreenOpen(false);

      if (clearDrafts) {
        setEditingClientId(null);
        setEditClientName("");
        setEditClientAddress("");
        setEditClientPhone("");
        setEditFocusedField(null);
        setEditErrorMessage(null);
      }
    });
  };

  const submitAddClient = async () => {
    const trimmedName = newClientName.trim();

    if (!trimmedName.length) {
      setSaveErrorMessage("Unesi ime klijenta.");
      return;
    }

    if (!isSupabaseConfigured) {
      setSaveErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    setIsSavingClient(true);

    try {
      const savedClient = await createClient({
        name: trimmedName,
        address: newClientAddress,
        phone: newClientPhone,
      });
      const nextItem: ClientListItem = {
        id: savedClient.id,
        name: savedClient.name?.trim() || "Bez imena",
        address: savedClient.address ?? null,
        phone: savedClient.phone ?? null,
      };

      setClients((current) => [nextItem, ...current.filter((item) => item.id !== nextItem.id)]);
      setSelectedClientId(nextItem.id);
      setSaveErrorMessage(null);
      closeAddClientScreen(true);
      await loadClients();
    } catch (error) {
      setSaveErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da sacuvam klijenta.",
      );
    } finally {
      setIsSavingClient(false);
    }
  };

  const submitEditClient = async () => {
    if (!editingClientId) {
      return;
    }

    const trimmedName = editClientName.trim();

    if (!trimmedName.length) {
      setEditErrorMessage("Unesi ime klijenta.");
      return;
    }

    if (!isSupabaseConfigured) {
      setEditErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    setIsUpdatingClient(true);

    try {
      const saved = await updateClient({
        id: editingClientId,
        name: trimmedName,
        address: editClientAddress,
        phone: editClientPhone,
      });

      const updatedItem: ClientListItem = {
        id: saved.id,
        name: saved.name?.trim() || "Bez imena",
        address: saved.address ?? null,
        phone: saved.phone ?? null,
      };

      setClients((current) =>
        current.map((item) => (item.id === updatedItem.id ? updatedItem : item)),
      );
      setSelectedClientId(updatedItem.id);
      setEditErrorMessage(null);
      closeEditClientScreen(true);
      await loadClients();
    } catch (error) {
      setEditErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da izmenim klijenta.",
      );
    } finally {
      setIsUpdatingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (isDeletingClientId) {
      return;
    }

    if (!isSupabaseConfigured) {
      setManageErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    setIsDeletingClientId(clientId);

    try {
      await deleteClient(clientId);
      setClients((current) => current.filter((item) => item.id !== clientId));
      setSelectedClientId((current) => (current === clientId ? null : current));
      setManageErrorMessage(null);

      if (editingClientId === clientId) {
        closeEditClientScreen(true);
      }

      await loadClients();
    } catch (error) {
      setManageErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da obrisem klijenta.",
      );
    } finally {
      setIsDeletingClientId(null);
    }
  };

  const hasClients = clients.length > 0;

  const handleMainConfirm = async () => {
    if (!jobId) {
      if (pickerToken) {
        const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
        emitClientPickerSelection({
          token: pickerToken,
          clientId: selectedClientId ?? selectedClient?.id ?? null,
          clientName: selectedClient?.name ?? null,
        });
      }
      router.back();
      return;
    }

    if (!isSupabaseConfigured) {
      setLoadErrorMessage(
        "Supabase nije povezan. Dodaj EXPO_PUBLIC_SUPABASE_URL i EXPO_PUBLIC_SUPABASE_ANON_KEY u .env.",
      );
      return;
    }

    setIsAssigningClient(true);

    try {
      await assignClientToInboxTodo(jobId, selectedClientId ?? null);
      if (pickerToken) {
        const selectedClient = clients.find((client) => client.id === selectedClientId) ?? null;
        emitClientPickerSelection({
          token: pickerToken,
          clientId: selectedClientId ?? selectedClient?.id ?? null,
          clientName: selectedClient?.name ?? null,
        });
      }
      router.back();
    } catch (error) {
      setLoadErrorMessage(
        error instanceof Error
          ? error.message
          : "Nisam uspeo da povezem klijenta sa poslom.",
      );
    } finally {
      setIsAssigningClient(false);
    }
  };

  return (
    <View className="flex-1 bg-transparent">
      <TransparentModalShell
        contentStyle={[
          {
            borderRadius: 28,
            borderWidth: 0.5,
            height: "70%",
            overflow: "hidden",
            width: "85%",
          },
          Platform.select({
            ios: {
              ...SHADOW_TOKENS.card.ios,
            },
            android: {
              elevation: SHADOW_TOKENS.card.android.elevation,
            },
          }),
          { backgroundColor: modalBg, borderColor },
        ]}
        overlayStyle={{ paddingHorizontal: 16, paddingVertical: 24 }}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingBottom: FOOTER_ACTIONS_HEIGHT + 12,
            paddingTop: HEADER_GLASS_HEIGHT + 6,
          }}
          scrollIndicatorInsets={{ top: HEADER_GLASS_HEIGHT, bottom: FOOTER_ACTIONS_HEIGHT }}
          showsVerticalScrollIndicator={false}
        >
          {loadErrorMessage ? (
            <Text
              className="px-5 pb-1 pt-0 font-regular text-label-sm"
              style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
            >
              {loadErrorMessage}
            </Text>
          ) : null}

          {clients.map((client, index) => (
            <Pressable
              key={client.id}
              className="min-h-[44px] flex-row items-center px-[18px] py-2"
              onPress={() =>
                setSelectedClientId((current) =>
                  current === client.id ? null : client.id,
                )
              }
            >
              <View
                style={[
                  {
                    alignItems: "center",
                    borderRadius: 11,
                    height: 22,
                    justifyContent: "center",
                    width: 22,
                  },
                  { backgroundColor: rowIconBg },
                ]}
              >
                <Icon
                  name={CLIENT_ROW_ICONS[index % CLIENT_ROW_ICONS.length] ?? "client"}
                  size={14}
                  color={rowIconColor}
                  weight="light"
                />
              </View>
              <Text
                variant="labelSm"
                className="ml-[10px] flex-1 font-medium"
                style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
              >
                {client.name}
              </Text>
              {selectedClientId === client.id ? (
                <Icon
                  name="check"
                  size={16}
                  color={selectedRowCheckColor}
                  weight="light"
                />
              ) : null}
            </Pressable>
          ))}

          {!hasClients ? (
            <Text
              className="px-5 pt-2 font-regular text-label-sm"
              style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
            >
              Jos nema klijenata.
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={{
            alignItems: "center",
            flexDirection: "row",
            height: HEADER_GLASS_HEIGHT,
            left: 0,
            position: "absolute",
            right: 0,
            top: 0,
            zIndex: 6,
            paddingBottom: 8,
            paddingLeft: 16,
            paddingRight: 12,
            paddingTop: 10,
            backgroundColor: modalBg,
          }}
        >
          <View className="w-9" />
          <Text
            className="flex-1 text-center font-bold text-things-modal-title"
            style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
          >
            Clients
          </Text>
          {selectedClientId || isJobAssignmentMode || Boolean(pickerToken) ? (
            <Pressable
              className="h-9 w-9 items-center justify-center rounded-[18px] border"
              style={[
                {
                  backgroundColor: confirmButtonBg,
                  borderColor: confirmButtonBorder,
                },
              ]}
              onPress={() => void handleMainConfirm()}
              disabled={isAssigningClient}
            >
              <Icon name="check" size={18} color={confirmButtonIcon} />
            </Pressable>
          ) : (
            <ModalCircleButton
              icon="close"
              theme={theme}
              onPress={() => router.back()}
            />
          )}
        </View>

        <View
          style={{
            bottom: 0,
            flexDirection: "row",
            gap: 10,
            left: 0,
            position: "absolute",
            paddingBottom: 8,
            paddingHorizontal: 16,
            paddingTop: 10,
            right: 0,
            zIndex: 5,
          }}
        >
          <View
            className="relative min-h-10 flex-1 overflow-hidden rounded-full border"
            style={{ borderColor: actionButtonBorder }}
          >
            <BlurView
              intensity={48}
              tint="default"
              experimentalBlurMethod={blurMethod}
              className="absolute inset-0"
              pointerEvents="none"
            />
            <View
              className="absolute inset-0"
              style={{ backgroundColor: actionButtonHighlight }}
              pointerEvents="none"
            />
            <Pressable
              className="min-h-10 flex-1 items-center justify-center rounded-full px-[14px]"
              android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
              onPress={openManageClientsScreen}
            >
              <Text
                className="font-semibold text-label-sm"
                style={{ color: actionButtonText }}
                numberOfLines={1}
              >
                Manage Clients
              </Text>
            </Pressable>
          </View>

          <View
            className="relative min-h-10 flex-1 overflow-hidden rounded-full border"
            style={{ borderColor: actionButtonBorder }}
          >
            <BlurView
              intensity={48}
              tint="default"
              experimentalBlurMethod={blurMethod}
              className="absolute inset-0"
              pointerEvents="none"
            />
            <View
              className="absolute inset-0"
              style={{ backgroundColor: actionButtonHighlight }}
              pointerEvents="none"
            />
            <Pressable
              className="min-h-10 flex-1 items-center justify-center rounded-full px-[14px]"
              android_ripple={{ color: withOpacity(actionButtonText, 0.08) }}
              onPress={openAddClientScreen}
            >
              <Text
                className="font-semibold text-label-sm"
                style={{ color: actionButtonText }}
                numberOfLines={1}
              >
                Add Client
              </Text>
            </Pressable>
          </View>
        </View>

        {isManageClientsScreenOpen ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 28,
                borderWidth: 0.5,
                zIndex: 21,
              },
              {
                backgroundColor: modalBg,
                borderColor,
                opacity: manageClientsScreenProgress,
                transform: [{ translateY: manageClientsScreenTranslateY }],
              },
            ]}
            onLayout={(event) =>
              setManageClientsScreenHeight(event.nativeEvent.layout.height)
            }
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                height: HEADER_GLASS_HEIGHT,
                left: 0,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 12,
                paddingTop: 10,
                position: "absolute",
                right: 0,
                top: 0,
                zIndex: 2,
                backgroundColor: modalBg,
              }}
            >
              <View className="w-9" />
              <Text
                className="flex-1 text-center font-bold text-things-modal-title"
                style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
              >
                Manage Clients
              </Text>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-[18px] border"
                style={[
                  {
                    backgroundColor: confirmButtonBg,
                    borderColor: confirmButtonBorder,
                  },
                ]}
                onPress={closeManageClientsScreen}
              >
                <Icon name="check" size={18} color={confirmButtonIcon} />
              </Pressable>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                gap: 4,
                paddingHorizontal: 16,
                paddingTop: HEADER_GLASS_HEIGHT + 10,
                paddingBottom: 20,
              }}
              showsVerticalScrollIndicator={false}
            >
              {clients.map((client) => (
                <View
                  key={`manage-${client.id}`}
                  className="min-h-[44px] flex-row items-center px-0.5 py-1"
                >
                  <Pressable
                    style={[
                      {
                        alignItems: "center",
                        borderRadius: 12,
                        height: 28,
                        justifyContent: "center",
                        width: 28,
                      },
                      isDeletingClientId === client.id ? { opacity: 0.4 } : null,
                    ]}
                    onPress={() => void handleDeleteClient(client.id)}
                    disabled={isDeletingClientId === client.id}
                  >
                    <Icon
                      name="trash"
                      size={16}
                      color={COLOR_TOKENS[colorMode]["text.secondary"]}
                      weight="light"
                    />
                  </Pressable>

                  <Text
                    variant="labelSm"
                    className="mx-[10px] flex-1 font-medium"
                    style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
                  >
                    {client.name}
                  </Text>

                  <Pressable
                    style={{
                      alignItems: "center",
                      borderRadius: 12,
                      height: 28,
                      justifyContent: "center",
                      width: 28,
                    }}
                    onPress={() => openEditClientScreen(client)}
                  >
                    <Icon
                      name="edit"
                      size={16}
                      color={COLOR_TOKENS[colorMode]["text.secondary"]}
                      weight="light"
                    />
                  </Pressable>
                </View>
              ))}

              {manageErrorMessage ? (
                <Text
                  className="mt-1 px-1 font-regular text-label-sm"
                  style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
                >
                  {manageErrorMessage}
                </Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : null}

        {isEditClientScreenOpen ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 28,
                borderWidth: 0.5,
                zIndex: 22,
              },
              {
                backgroundColor: modalBg,
                borderColor,
                opacity: editClientScreenProgress,
                transform: [{ translateY: editClientScreenTranslateY }],
              },
            ]}
            onLayout={(event) =>
              setEditClientScreenHeight(event.nativeEvent.layout.height)
            }
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                height: HEADER_GLASS_HEIGHT,
                left: 0,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 12,
                paddingTop: 10,
                position: "absolute",
                right: 0,
                top: 0,
                zIndex: 2,
                backgroundColor: modalBg,
              }}
            >
              <ModalCircleButton
                icon="close"
                theme={theme}
                onPress={() => closeEditClientScreen(true)}
              />
              <Text
                className="flex-1 text-center font-bold text-things-modal-title"
                style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
              >
                Edit Client
              </Text>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-[18px] border"
                style={[
                  {
                    backgroundColor: confirmButtonBg,
                    borderColor: confirmButtonBorder,
                  },
                ]}
                onPress={() => void submitEditClient()}
                disabled={isUpdatingClient}
              >
                <Icon name="check" size={18} color={confirmButtonIcon} />
              </Pressable>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                gap: 10,
                backgroundColor: "transparent",
                paddingHorizontal: 16,
                paddingTop: HEADER_GLASS_HEIGHT + 10,
                paddingBottom: 20,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Client name
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        editFocusedField === "name" ? focusBorderWidth : subtleBorderWidth,
                      borderColor:
                        editFocusedField === "name" ? focusBorderColor : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={editClientName}
                    onChangeText={setEditClientName}
                    onFocus={() => setEditFocusedField("name")}
                    onBlur={() =>
                      setEditFocusedField((current) =>
                        current === "name" ? null : current,
                      )
                    }
                    placeholder="Enter client name"
                    placeholderTextColor={inputPlaceholder}
                    returnKeyType="next"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Address
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        editFocusedField === "address"
                          ? focusBorderWidth
                          : subtleBorderWidth,
                      borderColor:
                        editFocusedField === "address"
                          ? focusBorderColor
                          : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={editClientAddress}
                    onChangeText={setEditClientAddress}
                    onFocus={() => setEditFocusedField("address")}
                    onBlur={() =>
                      setEditFocusedField((current) =>
                        current === "address" ? null : current,
                      )
                    }
                    placeholder="Enter address"
                    placeholderTextColor={inputPlaceholder}
                    returnKeyType="next"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Phone number
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        editFocusedField === "phone" ? focusBorderWidth : subtleBorderWidth,
                      borderColor:
                        editFocusedField === "phone" ? focusBorderColor : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={editClientPhone}
                    onChangeText={setEditClientPhone}
                    onFocus={() => setEditFocusedField("phone")}
                    onBlur={() =>
                      setEditFocusedField((current) =>
                        current === "phone" ? null : current,
                      )
                    }
                    placeholder="Enter phone number"
                    placeholderTextColor={inputPlaceholder}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              {editErrorMessage ? (
                <Text
                  className="mt-1 px-1 font-regular text-label-sm"
                  style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
                >
                  {editErrorMessage}
                </Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : null}

        {isAddClientScreenOpen ? (
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
                borderRadius: 28,
                borderWidth: 0.5,
                zIndex: 20,
              },
              {
                backgroundColor: modalBg,
                borderColor,
                opacity: addClientScreenProgress,
                transform: [{ translateY: addClientScreenTranslateY }],
              },
            ]}
            onLayout={(event) =>
              setAddClientScreenHeight(event.nativeEvent.layout.height)
            }
          >
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
                height: HEADER_GLASS_HEIGHT,
                left: 0,
                paddingBottom: 8,
                paddingLeft: 16,
                paddingRight: 12,
                paddingTop: 10,
                position: "absolute",
                right: 0,
                top: 0,
                zIndex: 2,
                backgroundColor: modalBg,
              }}
            >
              <ModalCircleButton
                icon="close"
                theme={theme}
                onPress={() => closeAddClientScreen()}
              />
              <Text
                className="flex-1 text-center font-bold text-things-modal-title"
                style={{ color: COLOR_TOKENS[colorMode]["text.primary"] }}
              >
                Add Client
              </Text>
              <Pressable
                className="h-9 w-9 items-center justify-center rounded-[18px] border"
                style={[
                  {
                    backgroundColor: confirmButtonBg,
                    borderColor: confirmButtonBorder,
                  },
                ]}
                onPress={() => void submitAddClient()}
                disabled={isSavingClient}
              >
                <Icon name="check" size={18} color={confirmButtonIcon} />
              </Pressable>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerStyle={{
                gap: 10,
                backgroundColor: "transparent",
                paddingHorizontal: 16,
                paddingTop: HEADER_GLASS_HEIGHT + 10,
                paddingBottom: 20,
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Client name
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        addFocusedField === "name" ? focusBorderWidth : subtleBorderWidth,
                      borderColor:
                        addFocusedField === "name" ? focusBorderColor : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={newClientName}
                    onChangeText={setNewClientName}
                    onFocus={() => setAddFocusedField("name")}
                    onBlur={() =>
                      setAddFocusedField((current) =>
                        current === "name" ? null : current,
                      )
                    }
                    placeholder="Enter client name"
                    placeholderTextColor={inputPlaceholder}
                    returnKeyType="next"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Address
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        addFocusedField === "address"
                          ? focusBorderWidth
                          : subtleBorderWidth,
                      borderColor:
                        addFocusedField === "address"
                          ? focusBorderColor
                          : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={newClientAddress}
                    onChangeText={setNewClientAddress}
                    onFocus={() => setAddFocusedField("address")}
                    onBlur={() =>
                      setAddFocusedField((current) =>
                        current === "address" ? null : current,
                      )
                    }
                    placeholder="Enter address"
                    placeholderTextColor={inputPlaceholder}
                    returnKeyType="next"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              <View>
                <Text
                  className="mb-2 ml-1 font-semibold text-label-md"
                  style={{ color: inputLabelColor }}
                >
                  Phone number
                </Text>
                <View
                  style={[
                    {
                      justifyContent: "center",
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                    {
                      height: fieldHeight,
                      borderRadius: controlRadius,
                      backgroundColor: inputBg,
                      borderWidth:
                        addFocusedField === "phone" ? focusBorderWidth : subtleBorderWidth,
                      borderColor:
                        addFocusedField === "phone" ? focusBorderColor : idleBorderColor,
                    },
                  ]}
                >
                  <AppTextInput
                    value={newClientPhone}
                    onChangeText={setNewClientPhone}
                    onFocus={() => setAddFocusedField("phone")}
                    onBlur={() =>
                      setAddFocusedField((current) =>
                        current === "phone" ? null : current,
                      )
                    }
                    placeholder="Enter phone number"
                    placeholderTextColor={inputPlaceholder}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                    variant="bodyMd"
                    selectionColor={selectionColor}
                    style={{ lineHeight: 20, paddingHorizontal: 0, paddingVertical: 0, color: inputText }}
                  />
                </View>
              </View>

              {saveErrorMessage ? (
                <Text
                  className="mt-1 px-1 font-regular text-label-sm"
                  style={{ color: COLOR_TOKENS[colorMode]["text.secondary"] }}
                >
                  {saveErrorMessage}
                </Text>
              ) : null}
            </ScrollView>
          </Animated.View>
        ) : null}
      </TransparentModalShell>
    </View>
  );
}
