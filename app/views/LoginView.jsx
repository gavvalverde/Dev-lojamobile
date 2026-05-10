import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View, ImageBackground, useWindowDimensions } from "react-native";
import { AuthForm } from "../components/AuthForm";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";

export default function LoginView() {
  const { theme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const [values, setValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    try {
      setLoading(true);
      setError("");
      await AuthService.login(values);
      router.replace("/views/HomeView");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/backgrounds/bg_login.jpg')}
      style={[styles.bg, { width, height }]}
      resizeMode="cover"
      imageStyle={styles.bgImage}
    >
      <View style={styles.overlay}>
        <View style={[
          styles.card,
          { backgroundColor: theme.dark ? 'rgba(6,6,6,0.55)' : 'rgba(255,255,255,0.86)'}
        ]}>
          <AuthForm
            title="Entrar"
            submitLabel="Entrar"
            values={values}
            error={error}
            loading={loading}
            footerText="Ainda não tem conta?"
            footerActionLabel="Cadastrar"
            onChange={updateValue}
            onSubmit={submit}
            onFooterPress={() => router.push("/views/RegisterView")}
          />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: 'center',
  },
  bgImage: {
    opacity: 0.95,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
});
