import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthForm } from "../components/AuthForm";
import { AuthService } from "../services/AuthService";

export default function LoginView() {
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
      router.replace("/");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AuthForm
        title="Entrar"
        submitLabel="Entrar"
        values={values}
        error={error}
        loading={loading}
        footerText="Ainda nao tem conta?"
        footerActionLabel="Cadastrar"
        onChange={updateValue}
        onSubmit={submit}
        onFooterPress={() => router.push("/views/RegisterView")}
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
