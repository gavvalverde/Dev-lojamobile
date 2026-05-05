import { router, useSegments } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthService } from "../services/AuthService";

export function AuthGuard({ children }) {
  const segments = useSegments();
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);
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

    if (!user && !isAuthRoute) {
      router.replace("/views/LoginView");
      return;
    }

    if (user && isAuthRoute) {
      router.replace("/views/HomeView");
    }
  }, [isAuthRoute, loading, user]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text style={styles.loadingText}>Carregando sessao...</Text>
      </View>
    );
  }

  if (!user && !isAuthRoute) return null;

  return children;
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    backgroundColor: "#f5f6fa",
    flex: 1,
    justifyContent: "center",
  },
  loadingText: {
    color: "#666",
    marginTop: 10,
  },
});
