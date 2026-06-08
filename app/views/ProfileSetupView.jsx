import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingDuck from "../components/LoadingDuck";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { UserService } from "../services/UserService";

function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, ".")
    .toLowerCase();
}

export default function ProfileSetupView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    handle: "",
    profileTitle: "",
    favoritePokemon: "",
    bio: "",
    themeColor: colors.accent,
  });

  useEffect(() => AuthService.subscribe(setUser), []);

  useEffect(() => {
    if (!user) return;

    setForm({
      name: user.name ?? "",
      handle: user.handle ?? "",
      profileTitle: user.profileTitle ?? "",
      favoritePokemon: user.favoritePokemon ?? "",
      bio: user.bio ?? "",
      themeColor: user.profileColors?.primary || user.themeColor || colors.accent,
    });
  }, [colors.accent, user]);

  const profileColorOptions = useMemo(
    () => theme.profileColorOptions.slice(0, 10),
    [theme.profileColorOptions]
  );

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const saveProfile = async () => {
    const name = form.name.trim();

    if (!name) {
      Alert.alert("Perfil incompleto", "Informe o nome que vai aparecer no perfil.");
      return;
    }

    try {
      setLoading(true);
      const profileColors = {
        ...(user?.profileColors ?? {}),
        primary: form.themeColor,
      };
      const updatedUser = await UserService.updateProfile(user.id, {
        name,
        handle: normalizeHandle(form.handle),
        profileTitle: form.profileTitle.trim(),
        favoritePokemon: form.favoritePokemon.trim(),
        bio: form.bio.trim(),
        themeColor: form.themeColor,
        profileColors,
      });

      await AuthService.setCurrentUser(updatedUser);
      router.replace("/views/HomeView");
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const skipSetup = () => {
    router.replace("/views/HomeView");
  };

  if (!user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LoadingDuck label="Carregando perfil..." />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <View style={styles.form}>
        <View style={styles.header}>
          <View
            style={[
              styles.avatarPreview,
              { backgroundColor: form.themeColor || colors.accent },
            ]}
          >
            <Text style={[styles.avatarText, { color: colors.onAccent }]}>
              {form.name.trim().slice(0, 1).toUpperCase() || "Y"}
            </Text>
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Criar perfil</Text>
            <Text style={[styles.subtitle, { color: colors.mutedText }]}>
              Complete o basico para as pessoas reconhecerem voce no app.
            </Text>
          </View>
        </View>

        <TextInput
          autoCapitalize="words"
          onChangeText={(value) => updateField("name", value)}
          placeholder="Nome publico"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={form.name}
        />

        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => updateField("handle", value)}
          placeholder="@usuario"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={form.handle}
        />

        <TextInput
          onChangeText={(value) => updateField("profileTitle", value)}
          placeholder="Titulo do perfil"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={form.profileTitle}
        />

        <TextInput
          onChangeText={(value) => updateField("favoritePokemon", value)}
          placeholder="Pokemon favorito"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={form.favoritePokemon}
        />

        <TextInput
          multiline
          onChangeText={(value) => updateField("bio", value)}
          placeholder="Bio curta"
          placeholderTextColor={colors.mutedText}
          style={[
            styles.input,
            styles.bioInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
          textAlignVertical="top"
          value={form.bio}
        />

        <Text style={[styles.sectionLabel, { color: colors.text }]}>Cor principal</Text>
        <View style={styles.swatches}>
          {profileColorOptions.map((color) => {
            const selected = form.themeColor === color;

            return (
              <TouchableOpacity
                accessibilityLabel={`Escolher cor ${color}`}
                accessibilityRole="button"
                activeOpacity={0.8}
                key={color}
                onPress={() => updateField("themeColor", color)}
                style={[
                  styles.swatch,
                  {
                    backgroundColor: color,
                    borderColor: selected ? colors.text : colors.border,
                  },
                  selected && styles.selectedSwatch,
                ]}
              />
            );
          })}
        </View>

        <TextInput
          autoCapitalize="none"
          onChangeText={(value) => updateField("themeColor", value)}
          placeholder="#ffc94a"
          placeholderTextColor={colors.mutedText}
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          value={form.themeColor}
        />

        <TouchableOpacity
          activeOpacity={0.86}
          disabled={loading}
          onPress={saveProfile}
          style={[styles.primaryButton, { backgroundColor: colors.primary }, loading && styles.disabledButton]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
            {loading ? "Salvando..." : "Salvar perfil"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.75} disabled={loading} onPress={skipSetup} style={styles.secondaryButton}>
          <Text style={[styles.secondaryButtonText, { color: colors.mutedText }]}>Pular por enquanto</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 18,
  },
  form: {
    alignSelf: "center",
    maxWidth: 520,
    width: "100%",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  avatarPreview: {
    alignItems: "center",
    borderRadius: 30,
    height: 60,
    justifyContent: "center",
    width: 60,
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "900",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  bioInput: {
    minHeight: 88,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 10,
  },
  swatches: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12,
  },
  swatch: {
    borderRadius: 18,
    borderWidth: 1,
    height: 36,
    width: 36,
  },
  selectedSwatch: {
    borderWidth: 3,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 13,
  },
  disabledButton: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    paddingVertical: 14,
  },
  secondaryButtonText: {
    fontWeight: "800",
  },
});
