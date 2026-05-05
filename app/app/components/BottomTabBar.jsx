import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";

const ICON_MAP = {
  profile: "account",
  home: "home",
  favorites: "heart",
};

export default function BottomTabBar({ state, descriptors, navigation }) {
  const visibleTabs = ["profile", "home", "favorites"];
  const filteredRoutes = state.routes.filter((route) =>
    visibleTabs.includes(route.name)
  );

  return (
    <View style={styles.container}>
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
        const isHome = route.name === "home";

        return (
          <TouchableOpacity
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={[styles.tabButton, isHome && styles.homeButton]}
          >
            <View style={[styles.iconWrapper, isHome && styles.homeIconWrapper]}>
              <MaterialCommunityIcons
                name={iconName}
                size={isHome ? 28 : 24}
                color={isFocused ? "#007AFF" : "#999"}
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
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
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
  homeButton: {
    flex: 1,
  },
  homeIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0, 122, 255, 0.08)",
  },
});
