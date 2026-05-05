import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export function AuthForm({
  title,
  submitLabel,
  values,
  error,
  loading,
  showName = false,
  showConfirmPassword = false,
  footerText,
  footerActionLabel,
  onChange,
  onSubmit,
  onFooterPress,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>{title}</Text>

        {showName && (
          <TextInput
            autoCapitalize="words"
            placeholder="Nome"
            value={values.name}
            onChangeText={(value) => onChange("name", value)}
            style={styles.input}
          />
        )}

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={values.email}
          onChangeText={(value) => onChange("email", value)}
          style={styles.input}
        />

        <TextInput
          placeholder="Senha"
          secureTextEntry
          value={values.password}
          onChangeText={(value) => onChange("password", value)}
          style={styles.input}
        />

        {showConfirmPassword && (
          <TextInput
            placeholder="Confirmar senha"
            secureTextEntry
            value={values.confirmPassword}
            onChangeText={(value) => onChange("confirmPassword", value)}
            style={styles.input}
          />
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading}
          onPress={onSubmit}
          style={[styles.submitButton, loading && styles.disabledButton]}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Aguarde..." : submitLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} onPress={onFooterPress}>
          <Text style={styles.footerText}>
            {footerText} <Text style={styles.footerAction}>{footerActionLabel}</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  form: {
    alignSelf: "center",
    maxWidth: 420,
    width: "100%",
  },
  title: {
    color: "#222",
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#222",
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: {
    color: "#d32f2f",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  submitButton: {
    alignItems: "center",
    backgroundColor: "#ef5350",
    borderRadius: 8,
    marginBottom: 14,
    paddingVertical: 13,
  },
  disabledButton: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  footerText: {
    color: "#555",
    fontSize: 14,
    textAlign: "center",
  },
  footerAction: {
    color: "#ef5350",
    fontWeight: "800",
  },
});
