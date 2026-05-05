import { Tabs } from "expo-router";
import { AuthGuard } from "./components/AuthGuard";
import BottomTabBar from "./components/BottomTabBar";

export default function RootLayout() {
  return (
    <AuthGuard>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
        }}
        tabBar={(props) => <BottomTabBar {...props} />}
      >
        <Tabs.Screen name="views/ProfileView" />
        <Tabs.Screen name="views/HomeView" />
        <Tabs.Screen name="views/FavoritesView" />
      </Tabs>
    </AuthGuard>
  );
}
