import { router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import LoadingDuck from "./LoadingDuck";

export function AuthGuard({ children }) {
  const segments = useSegments();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const currentView = segments[1];
  const isAuthRoute =
    segments[0] === "views" &&
    (currentView === "LoginView" || currentView === "RegisterView");

  useEffect(() => {
    let mounted = true;

    const unsubscribe = AuthService.subscribe((currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
    });

    AuthService.loadSession()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!user && !isAuthRoute) {
      router.replace("/views/LoginView");
      return;
    }

    if (user && isAuthRoute) {
      router.replace(currentView === "RegisterView" ? "/views/ProfileSetupView" : "/views/HomeView");
    }
  }, [currentView, isAuthRoute, loading, user]);

  if (loading) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <LoadingDuck label="Carregando..." />
      </View>
    );
  }

  if (!user && !isAuthRoute) return null;

  return children;
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
});
