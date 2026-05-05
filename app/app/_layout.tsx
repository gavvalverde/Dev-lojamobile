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
        <Tabs.Screen name="home" />
        <Tabs.Screen name="favorites" />
        <Tabs.Screen name="profile" />
      </Tabs>
    </AuthGuard>
  );
}
