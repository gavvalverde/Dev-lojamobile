import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../services/AppThemeContext";
import { UserService } from "../services/UserService";
import { getProfileAvatarOptions, getProfilePhotoSource } from "../utils/profilePhoto";

const colorOptions = ["#ffc94a", "#039be5", "#06243a", "#ffffff", "#ff8f3d"];
const badgeOptions = [
  "Colecionador",
  "Vendedor",
  "Deck builder",
  "Trocas",
  "Leilão",
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

function getTextColorForProfileColor(color) {
  return color === "#06243a" ? "#ffffff" : "#06243a";
}

function normalizeHexInput(value) {
  const hex = String(value ?? "")
    .replace(/[^0-9a-f]/gi, "")
    .slice(0, 6);

  return `#${hex}`;
}

function isValidHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? ""));
}

export default function ProfileEditModal({ user, onSave, onCancel }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const avatarOptions = getProfileAvatarOptions();
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
    themeColor: user?.themeColor || "#ffc94a",
    badges: user?.badges || [],
    useCoverPhotoInHeader: user?.useCoverPhotoInHeader ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [customColor, setCustomColor] = useState(user?.themeColor || "#ffc94a");
  const [customBadge, setCustomBadge] = useState("");

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

  const openExternalPhotoPicker = async () => {
    setAvatarPickerVisible(false);
    await pickImage("photo", [1, 1]);
  };

  const selectAvatar = (avatarId) => {
    updateField("photo", avatarId);
    setAvatarPickerVisible(false);
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

  const updateCustomColor = (value) => {
    const nextColor = normalizeHexInput(value);
    setCustomColor(nextColor);

    if (isValidHexColor(nextColor)) {
      updateField("themeColor", nextColor);
    }
  };

  const addCustomBadge = () => {
    const badge = customBadge.trim().slice(0, 24);
    if (!badge) return;

    setForm((current) => {
      if (current.badges.includes(badge)) return current;
      return { ...current, badges: [...current.badges, badge] };
    });
    setCustomBadge("");
  };

  const removeBadge = (badge) => {
    setForm((current) => ({
      ...current,
      badges: current.badges.filter((item) => item !== badge),
    }));
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
        photo: form.photo,
        coverPhoto: form.coverPhoto,
        useCoverPhotoInHeader: form.useCoverPhotoInHeader,
      });
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLabel = form.handle ? `@${normalizeHandle(form.handle)}` : "@seu_usuario";
  const selectedBadgeTextColor = getTextColorForProfileColor(form.themeColor);
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceVariant,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.secondary, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={onCancel} style={styles.iconButton}>
          <MaterialCommunityIcons name="close" size={24} color={colors.accent} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.onPrimary }]}>Editar perfil</Text>
        <TouchableOpacity
          disabled={loading}
          onPress={handleSave}
          style={[
            styles.saveButton,
            { backgroundColor: colors.accent },
            loading && styles.disabledButton,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: colors.onAccent }]}>Salvar</Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={[styles.loadingBar, { backgroundColor: colors.surface }]}>
          <ActivityIndicator size="small" color={form.themeColor} />
          <Text style={[styles.loadingText, { color: colors.mutedText }]}>Atualizando perfil...</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.preview, { backgroundColor: colors.surface }]}>
          <View style={[styles.cover, { backgroundColor: form.themeColor }]}>
            {form.coverPhoto && (
              <Image source={{ uri: form.coverPhoto }} style={styles.coverImage} />
            )}
            <View style={styles.coverActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => pickImage("coverPhoto", [3, 1])}
                style={styles.coverAction}
              >
                <MaterialCommunityIcons name="image-edit" size={18} color="#fff" />
                <Text style={styles.coverActionText}>Capa</Text>
              </TouchableOpacity>
              {form.coverPhoto && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => updateField("coverPhoto", null)}
                  style={[styles.coverAction, styles.coverRemoveAction]}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
            {form.coverPhoto && (
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => updateField("useCoverPhotoInHeader", !form.useCoverPhotoInHeader)}
                style={[styles.coverToggle, { backgroundColor: form.useCoverPhotoInHeader ? "rgba(0,200,0,0.3)" : "rgba(200,0,0,0.3)" }]}
              >
                <MaterialCommunityIcons 
                  name={form.useCoverPhotoInHeader ? "check-circle" : "circle-outline"} 
                  size={18} 
                  color={form.useCoverPhotoInHeader ? "#00c800" : "#ff6b6b"} 
                />
                <Text style={[styles.coverToggleText, { color: form.useCoverPhotoInHeader ? "#00c800" : "#ff6b6b" }]}>
                  {form.useCoverPhotoInHeader ? "Capa ativa na barra superior" : "Capa inativa"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.previewBody}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setAvatarPickerVisible(true)}
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceVariant, borderColor: form.themeColor },
              ]}
            >
              {getProfilePhotoSource(form.photo) ? (
                <Image source={getProfilePhotoSource(form.photo)} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={46} color={colors.mutedText} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setAvatarPickerVisible(true)}
              style={styles.avatarActionLink}
            >
              <MaterialCommunityIcons name="image-album" size={16} color={colors.mutedText} />
              <Text style={[styles.avatarActionText, { color: colors.mutedText }]}>Escolher avatar</Text>
            </TouchableOpacity>

            <Text style={[styles.namePreview, { color: colors.text }]}>{form.name || "Seu nome"}</Text>
            <Text style={[styles.handlePreview, { color: colors.mutedText }]}>{handleLabel}</Text>
            {!!form.status.trim() && (
              <View style={[styles.statusPill, { borderColor: form.themeColor }]}>
                <View style={[styles.statusDot, { backgroundColor: form.themeColor }]} />
                <Text style={[styles.statusText, { color: colors.text }]}>{form.status.trim()}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Identidade</Text>
          <TextInput
            value={form.name}
            onChangeText={(value) => updateField("name", value)}
            placeholder="Nome visivel"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
          <TextInput
            autoCapitalize="none"
            value={form.handle}
            onChangeText={(value) => updateField("handle", normalizeHandle(value))}
            placeholder="@usuário"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
          <View style={styles.inlineInputs}>
            <TextInput
              value={form.pronouns}
              onChangeText={(value) => updateField("pronouns", value)}
              placeholder="Pronomes"
              placeholderTextColor={colors.mutedText}
              style={[...inputStyle, styles.inlineInput]}
            />
            <TextInput
              value={form.location}
              onChangeText={(value) => updateField("location", value)}
              placeholder="Cidade"
              placeholderTextColor={colors.mutedText}
              style={[...inputStyle, styles.inlineInput]}
            />
          </View>
          <TextInput
            value={form.status}
            onChangeText={(value) => updateField("status", value)}
            placeholder="Status do perfil"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
          <TextInput
            value={form.favoritePokemon}
            onChangeText={(value) => updateField("favoritePokemon", value)}
            placeholder="Carta ou Pokemon favorito"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Bio</Text>
          <TextInput
            value={form.bio}
            onChangeText={(value) => updateField("bio", value)}
            maxLength={240}
            multiline
            placeholder="Escreva uma bio com cara de perfil publico."
            placeholderTextColor={colors.mutedText}
            style={[...inputStyle, styles.bioInput]}
          />
          <Text style={[styles.counter, { color: colors.mutedText }]}>{form.bio.length}/240</Text>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Cor do perfil</Text>
          <View style={styles.swatches}>
            {colorOptions.map((color) => (
              <TouchableOpacity
                accessibilityLabel={`Selecionar cor ${color}`}
                key={color}
                onPress={() => {
                  setCustomColor(color);
                  updateField("themeColor", color);
                }}
                style={[
                  styles.swatch,
                  { backgroundColor: color, borderColor: colors.surface },
                  form.themeColor === color && { borderColor: colors.accent },
                ]}
              />
            ))}
          </View>
          <TextInput
            autoCapitalize="none"
            maxLength={7}
            onChangeText={updateCustomColor}
            placeholder="#ffc94a"
            placeholderTextColor={colors.mutedText}
            style={[...inputStyle, styles.customColorInput]}
            value={customColor}
          />
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Insignias</Text>
          {form.badges.length > 0 && (
            <View style={styles.selectedBadges}>
              {form.badges.map((badge) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={badge}
                  onPress={() => removeBadge(badge)}
                  style={[
                    styles.selectedBadge,
                    { backgroundColor: form.themeColor, borderColor: form.themeColor },
                  ]}
                >
                  <Text style={[styles.selectedBadgeText, { color: selectedBadgeTextColor }]}>
                    {badge}
                  </Text>
                  <MaterialCommunityIcons
                    name="close"
                    size={14}
                    color={selectedBadgeTextColor}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={styles.customBadgeRow}>
            <TextInput
              maxLength={24}
              onChangeText={setCustomBadge}
              onSubmitEditing={addCustomBadge}
              placeholder="Nova insígnia"
              placeholderTextColor={colors.mutedText}
              style={[...inputStyle, styles.customBadgeInput]}
              value={customBadge}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={addCustomBadge}
              style={[styles.addBadgeButton, { backgroundColor: colors.accent }]}
            >
              <MaterialCommunityIcons name="plus" size={22} color={colors.onAccent} />
            </TouchableOpacity>
          </View>
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
                    { borderColor: colors.border },
                    selected && { backgroundColor: form.themeColor, borderColor: form.themeColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeText,
                      { color: colors.text },
                      selected && { color: selectedBadgeTextColor },
                    ]}
                  >
                    {badge}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Contato privado</Text>
          <TextInput
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(value) => updateField("phone", value)}
            placeholder="Telefone"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        transparent
        visible={avatarPickerVisible}
        onRequestClose={() => setAvatarPickerVisible(false)}
      >
        <Pressable onPress={() => setAvatarPickerVisible(false)} style={styles.avatarPickerOverlay}>
          <Pressable style={[styles.avatarPickerSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.avatarPickerHeader}>
              <Text style={[styles.avatarPickerTitle, { color: colors.text }]}>Escolha seu avatar</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setAvatarPickerVisible(false)}
                style={styles.avatarPickerClose}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.avatarPickerSubtitle, { color: colors.mutedText }]}>Avatares padrão</Text>
            <ScrollView contentContainerStyle={styles.avatarGrid} showsVerticalScrollIndicator={false}>
              {avatarOptions.map((avatar) => {
                const selected = form.photo === avatar.id;

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={avatar.id}
                    onPress={() => selectAvatar(avatar.id)}
                    style={[
                      styles.avatarOption,
                      { borderColor: colors.border },
                      selected && { borderColor: form.themeColor },
                    ]}
                  >
                    <Image source={avatar.source} style={styles.avatarOptionImage} />
                    <View style={[styles.avatarOptionLabelWrap, { backgroundColor: colors.background }]}>
                      <Text style={[styles.avatarOptionLabel, { color: colors.text }]}>{avatar.label}</Text>
                    </View>
                    {selected && (
                      <View style={[styles.avatarSelectedBadge, { backgroundColor: form.themeColor }]}>
                        <MaterialCommunityIcons name="check" size={14} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.avatarPickerActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openExternalPhotoPicker}
                style={[styles.avatarPickerButton, { backgroundColor: colors.accent }]}
              >
                <MaterialCommunityIcons name="image-plus" size={18} color={colors.onAccent} />
                <Text style={[styles.avatarPickerButtonText, { color: colors.onAccent }]}>Enviar foto externa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  updateField("photo", null);
                  setAvatarPickerVisible(false);
                }}
                style={[
                  styles.avatarPickerButton,
                  styles.avatarPickerSecondary,
                  { borderColor: colors.border },
                ]}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text} />
                <Text style={[styles.avatarPickerButtonText, { color: colors.text }]}>Remover foto</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    alignItems: "center",
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
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
  },
  saveButton: {
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
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 34,
  },
  preview: {
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
  coverActions: {
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 8,
  },
  coverRemoveAction: {
    backgroundColor: "rgba(255, 0, 0, 0.6)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  coverActionText: {
    color: "#fff",
    fontWeight: "800",
  },
  coverToggle: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  coverToggleText: {
    fontWeight: "700",
    fontSize: 13,
  },
  previewBody: {
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  avatar: {
    alignItems: "center",
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
  avatarActionLink: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 10,
  },
  avatarActionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  namePreview: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  handlePreview: {
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
    fontSize: 13,
    fontWeight: "700",
  },
  section: {
    borderRadius: 8,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
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
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
  },
  swatches: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
  },
  swatch: {
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    width: 36,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  customColorInput: {
    marginBottom: 0,
  },
  selectedBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  selectedBadge: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  selectedBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  customBadgeRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  customBadgeInput: {
    flex: 1,
    marginBottom: 0,
  },
  addBadgeButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 48,
  },
  badgeOption: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  avatarPickerOverlay: {
    backgroundColor: "rgba(0,0,0,0.6)",
    flex: 1,
    justifyContent: "flex-end",
    padding: 14,
  },
  avatarPickerSheet: {
    borderRadius: 22,
    maxHeight: "88%",
    overflow: "hidden",
    padding: 16,
  },
  avatarPickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  avatarPickerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  avatarPickerClose: {
    alignItems: "center",
    borderRadius: 999,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  avatarPickerSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 14,
  },
  avatarOption: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
    width: "31%",
  },
  avatarOptionImage: {
    aspectRatio: 1,
    width: "100%",
  },
  avatarOptionLabelWrap: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  avatarOptionLabel: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
  },
  avatarSelectedBadge: {
    alignItems: "center",
    borderRadius: 999,
    height: 24,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 24,
  },
  avatarPickerActions: {
    gap: 10,
    paddingTop: 4,
  },
  avatarPickerButton: {
    alignItems: "center",
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 14,
  },
  avatarPickerSecondary: {
    borderWidth: 1,
  },
  avatarPickerButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
});
