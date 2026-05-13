import { Tabs } from "expo-router";
import { AuthGuard } from "./components/AuthGuard";
import BottomTabBar from "./components/BottomTabBar";
import { AppThemeProvider } from "./services/AppThemeContext";

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthGuard>
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            animation: "shift",
          }}
          tabBar={(props) => <BottomTabBar {...props} />}
        >
          <Tabs.Screen name="views/ProfileView" />
          <Tabs.Screen name="views/FavoritesView" />
          <Tabs.Screen name="views/HomeView" />
          <Tabs.Screen name="views/CatalogView" />
          <Tabs.Screen name="views/MyCardsView" />
          <Tabs.Screen name="views/AuctionView" />
          <Tabs.Screen name="views/UsersManagementView" />
        </Tabs>
      </AuthGuard>
    </AppThemeProvider>
  );
}
