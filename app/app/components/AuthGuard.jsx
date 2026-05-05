import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AuthService } from "../services/AuthService";

export function AuthGuard({ children }) {
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let sessionLoaded = false;

    const unsubscribe = AuthService.subscribe((currentUser) => {
      if (!mounted) return;
      setUser(currentUser);
      if (sessionLoaded && !currentUser) router.replace("/views/LoginView");
    });

    AuthService.loadSession()
      .then((currentUser) => {
        if (!mounted) return;
        sessionLoaded = true;
        setUser(currentUser);
        if (!currentUser) router.replace("/views/LoginView");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text style={styles.loadingText}>Carregando sessao...</Text>
      </View>
    );
  }

  if (!user) return null;

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
