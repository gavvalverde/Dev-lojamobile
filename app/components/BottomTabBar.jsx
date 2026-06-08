import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../services/AppThemeContext";

const ICON_MAP = {
  "views/ProfileView": "account",
  "views/HomeView": "home",
  "views/FavoritesView": "cards-heart",
  "views/ChatView": "message-text",
  "views/AuctionView": "gavel",
};

const hiddenTabBarRoutes = new Set(["views/ProfileSetupView"]);

const LABEL_MAP = {
  "views/ProfileView": "Perfil",
  "views/HomeView": "Inicio",
  "views/FavoritesView": "Listas",
  "views/ChatView": "Chats",
  "views/AuctionView": "Leiloes",
};

export default function BottomTabBar({ state, descriptors, navigation }) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const currentRouteName = state.routes[state.index]?.name;
  const isDesktop = width >= 900;
  const bottomInset = Math.max(insets.bottom, 10);

  if (hiddenTabBarRoutes.has(currentRouteName)) return null;

  const visibleTabs = [
    "views/ProfileView",
    "views/FavoritesView",
    "views/HomeView",
    "views/ChatView",
    "views/AuctionView",
  ];
  const filteredRoutes = visibleTabs
    .map((name) => state.routes.find((route) => route.name === name))
    .filter(Boolean);

  return (
    <View
      style={[
        styles.container,
        isDesktop && styles.desktopContainer,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          bottom: isDesktop ? bottomInset + 8 : undefined,
          paddingBottom: isDesktop ? 8 : bottomInset,
          shadowColor: colors.shadow,
        },
      ]}
    >
      {filteredRoutes.map((route) => {
        const { options } = descriptors[route.key];
        const isFocused = state.routes[state.index]?.key === route.key;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (route.name === "views/ProfileView" && !event.defaultPrevented) {
            router.replace("/views/ProfileView");
            return;
          }

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate({ name: route.name, merge: true });
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        const iconName = ICON_MAP[route.name] ?? "circle";
        const isHome = route.name === "views/HomeView";

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[
              styles.tabButton,
              isDesktop && styles.desktopTabButton,
              isFocused && isDesktop && { backgroundColor: colors.surfaceVariant },
              isHome && styles.homeButton,
            ]}
          >
            <View
              style={[
                styles.iconWrapper,
                isHome && !isDesktop && styles.homeIconWrapper,
                isHome && !isDesktop && { backgroundColor: colors.accent },
              ]}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={isHome && !isDesktop ? 28 : 22}
                color={isFocused ? colors.primary : colors.mutedText}
              />
            </View>
            {isDesktop && (
              <Text
                numberOfLines={1}
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary : colors.mutedText },
                ]}
              >
                {LABEL_MAP[route.name] ?? ""}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  desktopContainer: {
    alignSelf: "center",
    borderRadius: 8,
    borderWidth: 1,
    elevation: 8,
    maxWidth: 620,
    paddingHorizontal: 8,
    position: "absolute",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    width: "92%",
  },
  tabButton: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  desktopTabButton: {
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  homeButton: {
    flex: 1,
  },
  homeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
});
