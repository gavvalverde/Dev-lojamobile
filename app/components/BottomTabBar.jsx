import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../services/AppThemeContext";

const ICON_MAP = {
  "views/ProfileView": "account",
  "views/HomeView": "home",
  "views/FavoritesView": "heart",
  "views/MyCardsView": "cards",
  "views/AuctionView": "gavel",
  "views/ChatsView": "chat",
};

export default function BottomTabBar({ state, descriptors, navigation }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const activeRouteName = state.routes[state.index]?.name;
  const hiddenRoutes = ["index", "views/IndexView", "views/LoginView", "views/RegisterView"];

  // Esconde o tab bar apenas nas telas públicas de entrada e autenticação
  if (hiddenRoutes.includes(activeRouteName)) return null;
  const visibleTabs = [
    "views/ProfileView",
    "views/FavoritesView",
    "views/HomeView",
    "views/ChatsView",
    "views/MyCardsView",
    "views/AuctionView",
  ];
  const filteredRoutes = visibleTabs
    .map((name) => state.routes.find((route) => route.name === name))
    .filter(Boolean);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
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
        const isActive = isFocused;

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabButton}
          >
            <View
              style={[
                styles.iconWrapper,
                isActive && styles.activeIconWrapper,
                isActive && { backgroundColor: colors.accent },
              ]}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={isActive ? 28 : 24}
                color={isFocused ? colors.primary : colors.mutedText}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 24,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  activeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
});
