import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { AuthGuard } from "./components/AuthGuard";
import BottomTabBar from "./components/BottomTabBar";
import { AppThemeProvider, useAppTheme } from "./services/AppThemeContext";
import { StoreProductService } from "./services/StoreProductService";

const TAB_ROUTES = [
  "/views/ProfileView",
  "/views/FavoritesView",
  "/views/HomeView",
  "/views/ChatView",
  "/views/AuctionView",
] as const;

type TabRoute = (typeof TAB_ROUTES)[number];

const TAB_META = {
  "/views/ProfileView": { icon: "account", label: "Perfil" },
  "/views/FavoritesView": { icon: "cards-heart", label: "Listas" },
  "/views/HomeView": { icon: "home", label: "Home" },
  "/views/ChatView": { icon: "message-text", label: "Chats" },
  "/views/AuctionView": { icon: "gavel", label: "Leiloes" },
} as const;

function SwipeableTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const translateX = useRef(new Animated.Value(0)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;
  const [previewRoute, setPreviewRoute] = useState<TabRoute | null>(null);
  const [previewSide, setPreviewSide] = useState("right");

  useEffect(() => {
    StoreProductService.loadProducts().catch((error) => {
      console.error("Erro ao pre-carregar produtos selados:", error);
    });
  }, []);

  // Reseta a animacao e o preview quando o gesto de swipe termina ou e cancelado.
  const resetSwipe = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping: 26,
        stiffness: 135,
        mass: 0.85,
      }),
      Animated.timing(previewOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
    ]).start(() => setPreviewRoute(null));
  }, [previewOpacity, translateX]);

  // Cria o PanResponder de swipe apenas quando as dependencias mudam.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const horizontalMove = Math.abs(gestureState.dx);
          const verticalMove = Math.abs(gestureState.dy);

          return horizontalMove > 40 && horizontalMove > verticalMove * 2;
        },
        onPanResponderMove: (_, gestureState) => {
          const currentRoute = TAB_ROUTES.includes(pathname as TabRoute)
            ? (pathname as TabRoute)
            : null;

          if (!currentRoute) {
            return;
          }

          const currentIndex = TAB_ROUTES.indexOf(currentRoute);
          const nextIndex = gestureState.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = TAB_ROUTES[nextIndex];

          setPreviewRoute(nextRoute ?? null);
          setPreviewSide(gestureState.dx < 0 ? "right" : "left");
          translateX.setValue(Math.max(-112, Math.min(112, gestureState.dx * 0.46)));
          previewOpacity.setValue(Math.min(1, Math.abs(gestureState.dx) / 130));
        },
        onPanResponderTerminate: resetSwipe,
        onPanResponderRelease: (_, gestureState) => {
          const currentRoute = TAB_ROUTES.includes(pathname as TabRoute)
            ? (pathname as TabRoute)
            : null;

          if (!currentRoute) {
            resetSwipe();
            return;
          }

          const currentIndex = TAB_ROUTES.indexOf(currentRoute);
          const enoughDistance = Math.abs(gestureState.dx) > 90;
          const enoughVelocity = Math.abs(gestureState.vx) > 0.45;

          if (!enoughDistance && !enoughVelocity) {
            resetSwipe();
            return;
          }

          const nextIndex = gestureState.dx < 0 ? currentIndex + 1 : currentIndex - 1;
          const nextRoute = TAB_ROUTES[nextIndex];

          if (nextRoute) {
            router.push(nextRoute);
          }

          resetSwipe();
        },
      }),
    [pathname, previewOpacity, resetSwipe, router, translateX]
  );
  const previewMeta = previewRoute ? TAB_META[previewRoute] : null;

  return (
    <View style={styles.swipeRoot}>
      {previewMeta && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.previewPane,
            previewSide === "right" ? styles.previewRight : styles.previewLeft,
            { backgroundColor: colors.surfaceVariant, opacity: previewOpacity },
          ]}
        >
          <MaterialCommunityIcons name={previewMeta.icon} size={28} color={colors.primary} />
          <Text style={[styles.previewLabel, { color: colors.primary }]}>{previewMeta.label}</Text>
        </Animated.View>
      )}

      <Animated.View
        style={{
          flex: 1,
          transform: [
            { translateX },
            {
              scale: translateX.interpolate({
                inputRange: [-112, 0, 112],
                outputRange: [0.985, 1, 0.985],
              }),
            },
          ],
        }}
        {...panResponder.panHandlers}
      >
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
          }}
          tabBar={(props) => <BottomTabBar {...props} />}
        >
          <Tabs.Screen name="views/ProfileView" />
          <Tabs.Screen name="views/FavoritesView" />
          <Tabs.Screen name="views/DeckBuilderView" options={{ href: null }} />
          <Tabs.Screen name="views/HomeView" />
          <Tabs.Screen name="views/MyCardsView" options={{ href: null }} />
          <Tabs.Screen name="views/ChatView" />
          <Tabs.Screen name="views/AuctionView" />
          <Tabs.Screen name="views/AuctionRoomView" options={{ href: null }} />
          <Tabs.Screen name="views/CartView" options={{ href: null }} />
          <Tabs.Screen name="views/PokemonDetailsView" options={{ href: null }} />
          <Tabs.Screen name="views/ProfileSetupView" options={{ href: null }} />
          <Tabs.Screen name="views/AdminView" options={{ href: null }} />
          <Tabs.Screen name="views/InsertProductView" options={{ href: null }} />
          <Tabs.Screen name="views/CarouselManagementView" options={{ href: null }} />
          <Tabs.Screen name="views/OrdersView" options={{ href: null }} />
          <Tabs.Screen name="views/SellerDashboardView" options={{ href: null }} />
          <Tabs.Screen name="views/UsersManagementView" />
        </Tabs>
      </Animated.View>
    </View>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <AuthGuard>
        <SwipeableTabs />
      </AuthGuard>
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  swipeRoot: {
    flex: 1,
    overflow: "hidden",
  },
  previewPane: {
    alignItems: "center",
    bottom: 0,
    gap: 6,
    justifyContent: "center",
    position: "absolute",
    top: 0,
    width: 96,
  },
  previewLeft: {
    left: 0,
  },
  previewRight: {
    right: 0,
  },
  previewLabel: {
    fontSize: 12,
    fontWeight: "900",
  },
});
