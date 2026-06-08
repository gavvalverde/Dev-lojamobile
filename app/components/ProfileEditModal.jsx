import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
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
import LoadingDuck from "./LoadingDuck";
import { useAppTheme } from "../services/AppThemeContext";
import { PokemonService } from "../services/PokemonService";
import { UserService } from "../services/UserService";

const profilePanelOptions = [
  { id: "stats", label: "Resumo", icon: "chart-box-outline" },
  { id: "showcase", label: "Vitrine", icon: "cards-outline" },
  { id: "mural", label: "Mural", icon: "post-outline" },
  { id: "contact", label: "Contato", icon: "card-account-phone-outline" },
];

function normalizePanelOrder(order) {
  const knownIds = profilePanelOptions.map((panel) => panel.id);
  const selectedIds = Array.isArray(order)
    ? order.filter((id) => knownIds.includes(id))
    : [];

  return [...selectedIds, ...knownIds.filter((id) => !selectedIds.includes(id))];
}

function normalizeHandle(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 24);
}

function getTextColorForProfileColor(color, colors) {
  return color === colors.secondary ? colors.onDark : colors.secondary;
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

function componentToHex(value) {
  return Math.round(value).toString(16).padStart(2, "0");
}

function hsvToHex(hue, saturation, value) {
  const chroma = value * saturation;
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const match = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hue < 60) [red, green, blue] = [chroma, x, 0];
  else if (hue < 120) [red, green, blue] = [x, chroma, 0];
  else if (hue < 180) [red, green, blue] = [0, chroma, x];
  else if (hue < 240) [red, green, blue] = [0, x, chroma];
  else if (hue < 300) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${componentToHex((red + match) * 255)}${componentToHex((green + match) * 255)}${componentToHex((blue + match) * 255)}`;
}

function hexToHsv(hexColor) {
  if (!isValidHexColor(hexColor)) return { h: 0, s: 1, v: 1 };

  const red = parseInt(hexColor.slice(1, 3), 16) / 255;
  const green = parseInt(hexColor.slice(3, 5), 16) / 255;
  const blue = parseInt(hexColor.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  if (hue < 0) hue += 360;

  return {
    h: Math.round(hue),
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function buildProfileColors(user, colors) {
  const savedColors = user?.profileColors && typeof user.profileColors === "object"
    ? user.profileColors
    : {};

  return {
    primary: savedColors.primary || user?.themeColor || colors.accent,
    theme: savedColors.theme || "custom",
    background: savedColors.background || colors.surface,
    surface: savedColors.surface || colors.surface,
    text: savedColors.text || colors.text,
    mutedText: savedColors.mutedText || colors.mutedText,
    border: savedColors.border || colors.border,
  };
}

function buildProfileForm(user, colors) {
  const profileColors = buildProfileColors(user, colors);

  return {
    name: user?.name || "",
    handle: user?.handle || "",
    pronouns: user?.pronouns || "",
    status: user?.status || "",
    location: user?.location || "",
    favoritePokemon: user?.favoritePokemon || "",
    profileTitle: user?.profileTitle || "",
    collectionFocus: user?.collectionFocus || "",
    tradePreferences: user?.tradePreferences || "",
    phone: user?.phone || "",
    bio: user?.bio || "",
    photo: user?.photo || null,
    coverPhoto: user?.coverPhoto || null,
    themeColor: profileColors.primary,
    profileColors,
    profilePanelOrder: normalizePanelOrder(user?.profilePanelOrder),
    hiddenProfilePanels: Array.isArray(user?.hiddenProfilePanels) ? user.hiddenProfilePanels : [],
  };
}

function getCardCode(card) {
  return card?.collectionNumber || card?.id || "";
}

export default function ProfileEditModal({ user, onSave, onCancel }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const initialProfileColors = buildProfileColors(user, colors);
  const profileFormKey = JSON.stringify(buildProfileForm(user, colors));
  const [form, setForm] = useState(() => buildProfileForm(user, colors));
  const [loading, setLoading] = useState(false);
  const [customColor, setCustomColor] = useState(initialProfileColors.primary);
  const [favoriteSearch, setFavoriteSearch] = useState(user?.favoritePokemon || "");
  const [favoriteResults, setFavoriteResults] = useState([]);
  const [favoriteSearchLoading, setFavoriteSearchLoading] = useState(false);
  const [favoriteSearchError, setFavoriteSearchError] = useState("");
  const [activeColorPicker, setActiveColorPicker] = useState(null);
  const [pickerHue, setPickerHue] = useState(hexToHsv(initialProfileColors.primary).h);

  useEffect(() => {
    const nextForm = JSON.parse(profileFormKey);
    const nextProfileColors = nextForm.profileColors;
    setForm(nextForm);
    setCustomColor(nextProfileColors.primary);
    setFavoriteSearch(nextForm.favoritePokemon || "");
    setFavoriteResults([]);
    setFavoriteSearchError("");
    setFavoriteSearchLoading(false);
    setPickerHue(hexToHsv(nextProfileColors.primary).h);
  }, [profileFormKey]);

  useEffect(() => {
    const term = favoriteSearch.trim();

    if (!term || term === form.favoritePokemon) {
      setFavoriteResults([]);
      setFavoriteSearchError("");
      setFavoriteSearchLoading(false);
      return;
    }

    let active = true;
    setFavoriteSearchLoading(true);
    setFavoriteSearchError("");

    const timeout = setTimeout(async () => {
      try {
        const cards = await PokemonService.searchCards(term);
        if (active) setFavoriteResults(cards.slice(0, 20));
      } catch (error) {
        console.error("Erro ao buscar carta favorita:", error);
        if (active) {
          setFavoriteResults([]);
          setFavoriteSearchError("Nao foi possivel buscar cartas agora.");
        }
      } finally {
        if (active) setFavoriteSearchLoading(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [favoriteSearch, form.favoritePokemon]);

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

  const updateCustomColor = (value) => {
    const nextColor = normalizeHexInput(value);
    setCustomColor(nextColor);

    if (isValidHexColor(nextColor)) {
      updateField("themeColor", nextColor);
      updateField("profileColors", { ...form.profileColors, theme: "custom", primary: nextColor });
    }
  };

  const updateProfileColor = (field, value) => {
    const nextColor = normalizeHexInput(value);
    setForm((current) => {
      const nextProfileColors = { ...current.profileColors, theme: "custom", [field]: nextColor };
      return {
        ...current,
        profileColors: nextProfileColors,
        themeColor: field === "primary" && isValidHexColor(nextColor) ? nextColor : current.themeColor,
      };
    });

    if (field === "primary") {
      setCustomColor(nextColor);
    }
  };

  const setProfileColor = (field, value) => {
    if (field === "primary") {
      updateCustomColor(value);
      return;
    }

    updateProfileColor(field, value);
  };

  const openColorPicker = (field, label, value) => {
    setPickerHue(hexToHsv(value).h);
    setActiveColorPicker({ field, label });
  };

  const toggleProfilePanel = (panelId) => {
    setForm((current) => {
      const hidden = current.hiddenProfilePanels.includes(panelId);
      return {
        ...current,
        hiddenProfilePanels: hidden
          ? current.hiddenProfilePanels.filter((id) => id !== panelId)
          : [...current.hiddenProfilePanels, panelId],
      };
    });
  };

  const moveProfilePanel = (panelId, direction) => {
    setForm((current) => {
      const order = normalizePanelOrder(current.profilePanelOrder);
      const index = order.indexOf(panelId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= order.length) return current;

      const nextOrder = [...order];
      [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
      return { ...current, profilePanelOrder: nextOrder };
    });
  };

  const selectFavoriteCard = (card) => {
    const code = getCardCode(card);
    const label = code ? `${card.name} (${code})` : card.name;
    updateField("favoritePokemon", label);
    setFavoriteSearch(label);
    setFavoriteResults([]);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert("Erro", "Informe seu nome.");
      return;
    }

    setLoading(true);
    try {
      const profileColorValues = Object.entries(form.profileColors)
        .filter(([key]) => key !== "theme")
        .map(([, value]) => value);
      const validProfileColors = profileColorValues.every(isValidHexColor);
      if (!validProfileColors) {
        Alert.alert("Erro", "Confira as cores do perfil em formato hexadecimal.");
        return;
      }

      await onSave({
        ...form,
        themeColor: form.profileColors.primary,
        name: form.name.trim(),
        handle: normalizeHandle(form.handle),
        pronouns: form.pronouns.trim(),
        status: form.status.trim(),
        location: form.location.trim(),
        favoritePokemon: form.favoritePokemon.trim(),
        profileTitle: form.profileTitle.trim(),
        collectionFocus: form.collectionFocus.trim(),
        tradePreferences: form.tradePreferences.trim(),
        phone: form.phone.trim(),
        bio: form.bio.trim(),
        profilePanelOrder: normalizePanelOrder(form.profilePanelOrder),
        hiddenProfilePanels: form.hiddenProfilePanels,
      });
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLabel = form.handle ? `@${normalizeHandle(form.handle)}` : "@seu_usuario";
  const selectedBadgeTextColor = getTextColorForProfileColor(form.profileColors.primary, colors);
  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.surfaceVariant,
      borderColor: colors.border,
      color: colors.text,
    },
  ];

  const renderColorPicker = ({ field, label, value, onChangeText, placeholder }) => (
    <View style={styles.colorPickerBlock}>
      <View style={styles.profileColorRow}>
        <View style={[styles.profileColorSwatch, { backgroundColor: value }]} />
        <Text style={[styles.profileColorLabel, { color: colors.text }]}>{label}</Text>
        <TextInput
          autoCapitalize="none"
          maxLength={7}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedText}
          style={[...inputStyle, styles.profileColorInput]}
          value={value}
        />
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openColorPicker(field, label, value)}
          style={[styles.openPickerButton, { backgroundColor: colors.primary }]}
        >
          <MaterialCommunityIcons name="palette-outline" size={20} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const activeColor = activeColorPicker?.field === "primary"
    ? customColor
    : form.profileColors[activeColorPicker?.field] || colors.accent;
  const activeHsv = hexToHsv(activeColor);
  const saturationSteps = Array.from({ length: 12 }, (_, index) => index / 11);
  const valueSteps = Array.from({ length: 12 }, (_, index) => 1 - index / 11);
  const hueSteps = Array.from({ length: 24 }, (_, index) => index * 15);

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
          <LoadingDuck compact label="Atualizando perfil..." size={36} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={[styles.preview, { backgroundColor: form.profileColors.background, borderColor: form.profileColors.border }]}>
          <View style={[styles.cover, { backgroundColor: form.profileColors.primary }]}>
            {form.coverPhoto && (
              <Image source={{ uri: form.coverPhoto }} style={styles.coverImage} />
            )}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => pickImage("coverPhoto", [3, 1])}
              style={[styles.coverAction, { backgroundColor: colors.overlay }]}
            >
              <MaterialCommunityIcons name="image-edit" size={18} color={colors.onDark} />
              <Text style={[styles.coverActionText, { color: colors.onDark }]}>Capa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewBody}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => pickImage("photo", [1, 1])}
              style={[
                styles.avatar,
                { backgroundColor: colors.surfaceVariant, borderColor: form.profileColors.primary },
              ]}
            >
              {form.photo ? (
                <Image source={{ uri: form.photo }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons name="account" size={46} color={colors.mutedText} />
              )}
            </TouchableOpacity>

            <Text style={[styles.namePreview, { color: form.profileColors.text }]}>{form.name || "Seu nome"}</Text>
            <Text style={[styles.handlePreview, { color: form.profileColors.mutedText }]}>{handleLabel}</Text>
            {!!form.profileTitle.trim() && (
              <Text style={[styles.titlePreview, { color: form.profileColors.primary }]}>
                {form.profileTitle.trim()}
              </Text>
            )}
            {!!form.status.trim() && (
              <View style={[styles.statusPill, { borderColor: form.profileColors.primary }]}>
                <View style={[styles.statusDot, { backgroundColor: form.profileColors.primary }]} />
                <Text style={[styles.statusText, { color: form.profileColors.text }]}>{form.status.trim()}</Text>
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
            placeholder="@usuario"
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
            value={form.profileTitle}
            onChangeText={(value) => updateField("profileTitle", value)}
            placeholder="Titulo do perfil"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
          <View style={styles.cardSearchBox}>
            <TextInput
              value={favoriteSearch}
              onChangeText={(value) => {
                setFavoriteSearch(value);
                updateField("favoritePokemon", value);
              }}
              placeholder="Buscar carta favorita"
              placeholderTextColor={colors.mutedText}
              style={inputStyle}
            />
            {favoriteSearchLoading && (
              <View style={styles.searchLoadingRow}>
                <LoadingDuck compact label="Buscando cartas..." size={34} />
              </View>
            )}
            {!!favoriteSearchError && (
              <Text style={[styles.searchStatus, { color: colors.danger }]}>{favoriteSearchError}</Text>
            )}
            {favoriteResults.length > 0 && (
              <View style={[styles.cardResults, { borderColor: colors.border }]}>
                {favoriteResults.map((card) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={card.id}
                    onPress={() => selectFavoriteCard(card)}
                    style={[styles.cardResult, { borderBottomColor: colors.border }]}
                  >
                    {!!card.images?.small && (
                      <Image source={{ uri: card.images.small }} style={styles.cardResultImage} />
                    )}
                    <View style={styles.cardResultText}>
                      <Text numberOfLines={1} style={[styles.cardResultName, { color: colors.text }]}>
                        {card.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.cardResultMeta, { color: colors.mutedText }]}>
                        {[card.set, getCardCode(card)].filter(Boolean).join(" - ")}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <TextInput
            value={form.collectionFocus}
            onChangeText={(value) => updateField("collectionFocus", value)}
            placeholder="Foco da colecao"
            placeholderTextColor={colors.mutedText}
            style={inputStyle}
          />
          <TextInput
            value={form.tradePreferences}
            onChangeText={(value) => updateField("tradePreferences", value)}
            placeholder="Preferencias de troca"
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
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Cores do perfil</Text>
          {renderColorPicker({
            field: "primary",
            label: "Principal",
            onChangeText: updateCustomColor,
            placeholder: colors.accent,
            value: customColor,
          })}
          {renderColorPicker({
            field: "background",
            label: "Fundo do perfil",
            onChangeText: (value) => updateProfileColor("background", value),
            placeholder: colors.surface,
            value: form.profileColors.background,
          })}
          {renderColorPicker({
            field: "surface",
            label: "Blocos",
            onChangeText: (value) => updateProfileColor("surface", value),
            placeholder: colors.surface,
            value: form.profileColors.surface,
          })}
          {renderColorPicker({
            field: "text",
            label: "Texto do perfil",
            onChangeText: (value) => updateProfileColor("text", value),
            placeholder: colors.text,
            value: form.profileColors.text,
          })}
          {renderColorPicker({
            field: "mutedText",
            label: "Texto secundario",
            onChangeText: (value) => updateProfileColor("mutedText", value),
            placeholder: colors.mutedText,
            value: form.profileColors.mutedText,
          })}
          {renderColorPicker({
            field: "border",
            label: "Bordas",
            onChangeText: (value) => updateProfileColor("border", value),
            placeholder: colors.border,
            value: form.profileColors.border,
          })}
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Paineis do perfil</Text>
          {normalizePanelOrder(form.profilePanelOrder).map((panelId, index) => {
            const panel = profilePanelOptions.find((item) => item.id === panelId);
            if (!panel) return null;

            const visible = !form.hiddenProfilePanels.includes(panelId);

            return (
              <View key={panel.id} style={[styles.panelRow, { borderColor: colors.border }]}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => toggleProfilePanel(panel.id)}
                  style={[
                    styles.panelVisibilityButton,
                    { backgroundColor: visible ? form.profileColors.primary : colors.surfaceVariant },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={visible ? "eye" : "eye-off-outline"}
                    size={20}
                    color={visible ? selectedBadgeTextColor : colors.mutedText}
                  />
                </TouchableOpacity>
                <MaterialCommunityIcons name={panel.icon} size={21} color={colors.mutedText} />
                <Text style={[styles.panelLabel, { color: colors.text }]}>{panel.label}</Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={index === 0}
                  onPress={() => moveProfilePanel(panel.id, -1)}
                  style={[styles.panelMoveButton, index === 0 && styles.panelMoveButtonDisabled]}
                >
                  <MaterialCommunityIcons name="chevron-up" size={22} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={index === profilePanelOptions.length - 1}
                  onPress={() => moveProfilePanel(panel.id, 1)}
                  style={[
                    styles.panelMoveButton,
                    index === profilePanelOptions.length - 1 && styles.panelMoveButtonDisabled,
                  ]}
                >
                  <MaterialCommunityIcons name="chevron-down" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
            );
          })}
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
        onRequestClose={() => setActiveColorPicker(null)}
        transparent
        visible={!!activeColorPicker}
      >
        <Pressable
          style={[styles.pickerOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setActiveColorPicker(null)}
        >
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.pickerModal, { backgroundColor: colors.surface }]}
          >
            <View style={styles.pickerHeader}>
              <View>
                <Text style={[styles.pickerTitle, { color: colors.text }]}>
                  {activeColorPicker?.label}
                </Text>
                <Text style={[styles.pickerValue, { color: colors.mutedText }]}>
                  {activeColor}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setActiveColorPicker(null)}
                style={styles.pickerClose}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerBody}>
              <View style={[styles.saturationPanel, { borderColor: colors.border }]}>
                {valueSteps.map((valueStep) => (
                  <View key={`value-${valueStep}`} style={styles.saturationRow}>
                    {saturationSteps.map((saturationStep) => {
                      const color = hsvToHex(pickerHue, saturationStep, valueStep);
                      const selected = Math.abs(activeHsv.s - saturationStep) < 0.06
                        && Math.abs(activeHsv.v - valueStep) < 0.06;

                      return (
                        <TouchableOpacity
                          accessibilityLabel={`Selecionar cor ${color}`}
                          activeOpacity={0.9}
                          key={`${valueStep}-${saturationStep}`}
                          onPress={() => setProfileColor(activeColorPicker.field, color)}
                          style={[styles.saturationCell, { backgroundColor: color }]}
                        >
                          {selected && <View style={[styles.pickerMarker, { borderColor: colors.onDark }]} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={[styles.hueBar, { borderColor: colors.border }]}>
                {hueSteps.map((hue) => {
                  const selected = Math.abs(pickerHue - hue) < 8;
                  const color = hsvToHex(hue, 1, 1);

                  return (
                    <TouchableOpacity
                      accessibilityLabel={`Selecionar matiz ${hue}`}
                      activeOpacity={0.9}
                      key={hue}
                      onPress={() => {
                        setPickerHue(hue);
                        setProfileColor(activeColorPicker.field, hsvToHex(hue, activeHsv.s, activeHsv.v));
                      }}
                      style={[styles.hueStep, { backgroundColor: color }]}
                    >
                      {selected && <View style={[styles.hueMarker, { borderColor: colors.onDark }]} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.pickerFooter}>
              <View style={[styles.pickerPreview, { backgroundColor: activeColor, borderColor: colors.border }]} />
              <TextInput
                autoCapitalize="none"
                maxLength={7}
                onChangeText={(value) => setProfileColor(activeColorPicker.field, value)}
                placeholder={colors.accent}
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.pickerHexInput,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                ]}
                value={activeColor}
              />
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
    fontWeight: "800",
  },
  loadingBar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
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
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  coverActionText: {
    fontWeight: "800",
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
  titlePreview: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
    textAlign: "center",
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
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionTitleInline: {
    marginBottom: 0,
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
  cardSearchBox: {
    marginBottom: 10,
  },
  searchStatus: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 2,
    marginTop: -4,
  },
  searchLoadingRow: {
    alignItems: "flex-start",
    marginBottom: 8,
    marginTop: -4,
  },
  cardResults: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: -2,
    overflow: "hidden",
  },
  cardResult: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  cardResultImage: {
    borderRadius: 4,
    height: 58,
    resizeMode: "contain",
    width: 42,
  },
  cardResultText: {
    flex: 1,
    minWidth: 0,
  },
  cardResultName: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardResultMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
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
  colorPickerBlock: {
    marginBottom: 14,
  },
  profileColorRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  profileColorSwatch: {
    borderRadius: 8,
    height: 34,
    width: 34,
  },
  profileColorLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  profileColorInput: {
    marginBottom: 0,
    minHeight: 40,
    width: 104,
  },
  openPickerButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 44,
  },
  pickerOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  pickerModal: {
    borderRadius: 8,
    maxWidth: 360,
    padding: 14,
    width: "100%",
  },
  pickerHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "900",
  },
  pickerValue: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textTransform: "uppercase",
  },
  pickerClose: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  pickerBody: {
    flexDirection: "row",
    gap: 10,
  },
  saturationPanel: {
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    overflow: "hidden",
  },
  saturationRow: {
    flex: 1,
    flexDirection: "row",
  },
  saturationCell: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pickerMarker: {
    borderRadius: 8,
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  hueBar: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    width: 34,
  },
  hueStep: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    minHeight: 8,
  },
  hueMarker: {
    borderRadius: 7,
    borderWidth: 2,
    height: 14,
    width: 14,
  },
  pickerFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  pickerPreview: {
    borderRadius: 8,
    borderWidth: 1,
    height: 42,
    width: 42,
  },
  pickerHexInput: {
    flex: 1,
    marginBottom: 0,
  },
  panelRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    marginBottom: 8,
    minHeight: 48,
    paddingHorizontal: 8,
  },
  panelVisibilityButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 38,
  },
  panelLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "900",
  },
  panelMoveButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 34,
  },
  panelMoveButtonDisabled: {
    opacity: 0.28,
  },
});
