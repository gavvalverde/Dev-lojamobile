import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../services/AppThemeContext";

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
  const { theme } = useAppTheme();
  const colors = theme.colors;

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

        {showName && (
          <TextInput
            autoCapitalize="words"
            placeholder="Nome"
            value={values.name}
            onChangeText={(value) => onChange("name", value)}
            placeholderTextColor={colors.mutedText}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
        )}

        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Email"
          value={values.email}
          onChangeText={(value) => onChange("email", value)}
          placeholderTextColor={colors.mutedText}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />

        <TextInput
          placeholder="Senha"
          secureTextEntry
          value={values.password}
          onChangeText={(value) => onChange("password", value)}
          placeholderTextColor={colors.mutedText}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
        />

        {showConfirmPassword && (
          <TextInput
            placeholder="Confirmar senha"
            secureTextEntry
            value={values.confirmPassword}
            onChangeText={(value) => onChange("confirmPassword", value)}
            placeholderTextColor={colors.mutedText}
            style={[
              styles.input,
              { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
            ]}
          />
        )}

        {!!error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={loading}
          onPress={onSubmit}
          style={[styles.submitButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Aguarde..." : submitLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} onPress={onFooterPress}>
          <Text style={[styles.footerText, { color: colors.mutedText }]}>
            {footerText} <Text style={[styles.footerAction, { color: colors.primary }]}>{footerActionLabel}</Text>
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
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 18,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  submitButton: {
    alignItems: "center",
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
    fontSize: 14,
    textAlign: "center",
  },
  footerAction: {
    fontWeight: "800",
  },
});
