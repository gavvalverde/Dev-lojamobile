import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthForm } from "../components/AuthForm";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";

export default function RegisterView() {
  const { theme } = useAppTheme();
  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const updateValue = (field, value) => {
    setValues((current) => ({ ...current, [field]: value }));
  };

  const submit = async () => {
    try {
      setLoading(true);
      setError("");
      await AuthService.register(values);
      router.replace("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <AuthForm
        title="Criar conta"
        submitLabel="Cadastrar"
        values={values}
        error={error}
        loading={loading}
        showName
        showConfirmPassword
        footerText="Ja tem conta?"
        footerActionLabel="Entrar"
        onChange={updateValue}
        onSubmit={submit}
        onFooterPress={() => router.push("/views/LoginView")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#f5f6fa",
    flex: 1,
  },
});
