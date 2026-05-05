import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { UserService } from "../services/UserService";

const colorOptions = ["#ef5350", "#007AFF", "#34C759", "#8e44ad", "#f59f00"];
const badgeOptions = [
  "Colecionador",
  "Vendedor",
  "Deck builder",
  "Trocas",
  "Arte favorita",
  "Competitivo",
];

function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
}

export default function ProfileEditModal({ user, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: user?.name || "",
    handle: user?.handle || "",
    pronouns: user?.pronouns || "",
    status: user?.status || "",
    location: user?.location || "",
    favoritePokemon: user?.favoritePokemon || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
    photo: user?.photo || null,
    coverPhoto: user?.coverPhoto || null,
    themeColor: user?.themeColor || "#ef5350",
    badges: user?.badges || [],
  });
  const [loading, setLoading] = useState(false);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickImage = async (field, aspect) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect,
        quality: 0.82,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        const base64 = await UserService.convertImageToBase64(result.assets[0].uri);
        updateField(field, base64);
      }
    } catch (error) {
      Alert.alert("Erro", "Falha ao selecionar imagem: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleBadge = (badge) => {
    setForm((current) => {
      const hasBadge = current.badges.includes(badge);
      return {
        ...current,
        badges: hasBadge
          ? current.badges.filter((item) => item !== badge)
          : [...current.badges, badge],
      };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Erro", "Informe seu nome.");
      return;
    }

    setLoading(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim(),
        handle: normalizeHandle(form.handle),
        pronouns: form.pronouns.trim(),
        status: form.status.trim(),
        location: form.location.trim(),
        favoritePokemon: form.favoritePokemon.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
      });
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLabel = form.handle ? `@${normalizeHandle(form.handle)}` : "@seu_usuario";

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onCancel} style={styles.iconButton}>
          <MaterialCommunityIcons name="close" size={24} color="#222" />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Editar perfil</Text>
        <TouchableOpacity
          disabled={loading}
          onPress={handleSave}
          style={[styles.saveButton, loading && styles.disabledButton]}
        >
          <Text style={styles.saveButtonText}>Salvar</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={form.themeColor} />
          <Text style={styles.loadingText}>Atualizando perfil...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.preview}>
          <View style={[styles.cover, { backgroundColor: form.themeColor }]}>
            {form.coverPhoto && (
              <Image source={{ uri: form.coverPhoto }} style={styles.coverImage} />
            )}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => pickImage("coverPhoto", [3, 1])}
              style={styles.coverAction}
            >
              <MaterialCommunityIcons name="image-edit" size={18} color="#fff" />
              <Text style={styles.coverActionText}>Capa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewBody}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => pickImage("photo", [1, 1])}
              style={[styles.avatar, { borderColor: form.themeColor }]}
            >
              {form.photo ? (
                <Image source={{ uri: form.photo }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={46} color="#777" />
              )}
            </TouchableOpacity>

            <Text style={styles.namePreview}>{form.name || "Seu nome"}</Text>
            <Text style={styles.handlePreview}>{handleLabel}</Text>
            {!!form.status.trim() && (
              <View style={[styles.statusPill, { borderColor: form.themeColor }]}>
                <View style={[styles.statusDot, { backgroundColor: form.themeColor }]} />
                <Text style={styles.statusText}>{form.status.trim()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Identidade</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => updateField("name", value)}
            placeholder="Nome visivel"
            style={styles.input}
          />
          <TextInput
            autoCapitalize="none"
            value={form.handle}
            onChangeText={(value) => updateField("handle", normalizeHandle(value))}
            placeholder="@usuario"
            style={styles.input}
          />
          <View style={styles.inlineInputs}>
            <TextInput
              value={form.pronouns}
              onChangeText={(value) => updateField("pronouns", value)}
              placeholder="Pronomes"
              style={[styles.input, styles.inlineInput]}
            />
            <TextInput
              value={form.location}
              onChangeText={(value) => updateField("location", value)}
              placeholder="Cidade"
              style={[styles.input, styles.inlineInput]}
            />
          </View>
          <TextInput
            value={form.status}
            onChangeText={(value) => updateField("status", value)}
            placeholder="Status do perfil"
            style={styles.input}
          />
          <TextInput
            value={form.favoritePokemon}
            onChangeText={(value) => updateField("favoritePokemon", value)}
            placeholder="Carta ou Pokemon favorito"
            style={styles.input}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bio</Text>
          <TextInput
            value={form.bio}
            onChangeText={(value) => updateField("bio", value)}
            maxLength={240}
            multiline
            placeholder="Escreva uma bio com cara de perfil publico."
            style={[styles.input, styles.bioInput]}
          />
          <Text style={styles.counter}>{form.bio.length}/240</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Cor do perfil</Text>
          <View style={styles.swatches}>
            {colorOptions.map((color) => (
              <TouchableOpacity
                accessibilityLabel={`Selecionar cor ${color}`}
                key={color}
                onPress={() => updateField("themeColor", color)}
                style={[
                  styles.swatch,
                  { backgroundColor: color },
                  form.themeColor === color && styles.swatchSelected,
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insignias</Text>
          <View style={styles.badgeGrid}>
            {badgeOptions.map((badge) => {
              const selected = form.badges.includes(badge);
              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={badge}
                  onPress={() => toggleBadge(badge)}
                  style={[
                    styles.badgeOption,
                    selected && { backgroundColor: form.themeColor, borderColor: form.themeColor },
                  ]}
                >
                  <Text style={[styles.badgeText, selected && styles.badgeTextSelected]}>
                    {badge}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contato privado</Text>
          <TextInput
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(value) => updateField("phone", value)}
            placeholder="Telefone"
            style={styles.input}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f5f6fa",
    flex: 1,
  },
  topBar: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomColor: "#e8e8e8",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  iconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  topTitle: {
    color: "#222",
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  saveButton: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.65,
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  loadingBar: {
    alignItems: "center",
    backgroundColor: "#fff",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    color: "#555",
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 34,
  },
  preview: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 14,
    overflow: "hidden",
  },
  cover: {
    height: 120,
    justifyContent: "flex-end",
    padding: 10,
  },
  coverImage: {
    bottom: 0,
    height: "100%",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    width: "100%",
  },
  coverAction: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  coverActionText: {
    color: "#fff",
    fontWeight: "800",
  },
  previewBody: {
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 46,
    borderWidth: 4,
    height: 92,
    justifyContent: "center",
    marginTop: -46,
    overflow: "hidden",
    width: 92,
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  namePreview: {
    color: "#222",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  handlePreview: {
    color: "#666",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    color: "#555",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: "#f8f8f8",
    borderColor: "#dedede",
    borderRadius: 8,
    borderWidth: 1,
    color: "#222",
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  bioInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  counter: {
    color: "#777",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  swatches: {
    flexDirection: "row",
    gap: 12,
  },
  swatch: {
    borderColor: "#fff",
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    width: 36,
  },
  swatchSelected: {
    borderColor: "#222",
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeOption: {
    borderColor: "#ddd",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    color: "#333",
    fontSize: 13,
    fontWeight: "800",
  },
  badgeTextSelected: {
    color: "#fff",
  },
});
