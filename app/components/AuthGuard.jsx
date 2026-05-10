import { router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";

export function AuthGuard({ children }) {
  const segments = useSegments();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const isPublicRoute = segments.length === 0 || segments[0] === "index";
  const isAuthRoute =
    segments[0] === "views" &&
    (segments[1] === "LoginView" || segments[1] === "RegisterView");

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

    if (!user && !isAuthRoute && !isPublicRoute) {
      router.replace("/views/LoginView");
      return;
    }

    if (user && isAuthRoute) {
      router.replace("/views/HomeView");
    }
  }, [isAuthRoute, isPublicRoute, loading, user]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.mutedText }]}>Carregando sessao...</Text>
      </View>
    );
  }

  if (!user && !isAuthRoute && !isPublicRoute) return null;

  return children;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
  },
});
