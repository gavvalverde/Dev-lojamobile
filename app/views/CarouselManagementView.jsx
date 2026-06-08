import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AnuncioService } from "../services/AnuncioService";
import { CarouselHighlightService } from "../services/CarouselHighlightService";
import { MyCardsService } from "../services/MyCardsService";
import { StoreProductService } from "../services/StoreProductService";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";
import { getProductImageSource } from "../../utils/productImage";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isSealedProduct(item) {
  return item?.productType === "sealed" || item?.cardType === "produto-selado";
}

function normalizeImageUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

export default function CarouselManagementView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [highlights, setHighlights] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState({ title: "", subtitle: "", image: null, imageUrl: "" });
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    const unsubscribeHighlights = CarouselHighlightService.subscribe((nextHighlights) => {
      setHighlights(nextHighlights);
      setLoaded(true);
    });
    const unsubscribeCards = MyCardsService.subscribe(setMyCards);
    const unsubscribeStoreProducts = StoreProductService.subscribe(setStoreProducts);

    return () => {
      unsubscribeHighlights();
      unsubscribeCards();
      unsubscribeStoreProducts();
    };
  }, []);

  const sealedProducts = useMemo(() => {
    return AnuncioService.buildCatalogResults([...storeProducts, ...myCards])
      .filter((result) => isSealedProduct(result.card) && result.anuncios.length > 0);
  }, [myCards, storeProducts]);

  const highlightedProductIds = useMemo(
    () => new Set(highlights.filter((item) => item.type === "product").map((item) => String(item.productId))),
    [highlights]
  );

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [16, 9],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.55,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      const base64 = await UserService.convertImageToBase64(result.assets[0].uri);
      setDraft((current) => ({ ...current, image: base64 }));
    } catch (error) {
      Alert.alert("Imagem", error.message || "Nao foi possivel carregar a imagem.");
    }
  };

  const addImageHighlight = async () => {
    const imageUrl = normalizeImageUrl(draft.imageUrl);
    const image = imageUrl || draft.image;

    if (!image) {
      Alert.alert("Imagem", "Adicione um link de imagem ou selecione um arquivo.");
      return;
    }

    try {
      await CarouselHighlightService.createImageHighlight({ ...draft, image });
      setDraft({ title: "", subtitle: "", image: null, imageUrl: "" });
    } catch (error) {
      Alert.alert("Carrossel", error.message);
    }
  };

  const addProductHighlight = async (result) => {
    try {
      await CarouselHighlightService.createProductHighlight(result);
    } catch (error) {
      Alert.alert("Carrossel", error.message);
    }
  };

  const toggleHighlight = async (highlight) => {
    await CarouselHighlightService.updateHighlight(highlight.id, { active: !highlight.active });
  };

  const deleteHighlight = async (highlight) => {
    try {
      await CarouselHighlightService.removeHighlight(highlight.id);
    } catch (error) {
      Alert.alert("Carrossel", error.message || "Nao foi possivel remover o destaque.");
    }
  };

  const removeHighlight = (highlight) => {
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.("Deseja remover este item do carrossel?") ?? true;
      if (confirmed) deleteHighlight(highlight);
      return;
    }

    Alert.alert("Remover destaque", "Deseja remover este item do carrossel?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Remover", style: "destructive", onPress: () => deleteHighlight(highlight) },
    ]);
  };

  const renderDropdownSection = (sectionKey, title, icon, children) => {
    const isOpen = openSection === sectionKey;

    return (
      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpenSection((current) => (current === sectionKey ? null : sectionKey))}
          style={styles.dropdownHeader}
        >
          <View style={styles.dropdownTitleRow}>
            <MaterialCommunityIcons name={icon} size={22} color={colors.primary} />
            <Text style={[styles.sectionTitle, styles.dropdownTitle, { color: colors.text }]}>{title}</Text>
          </View>
          <MaterialCommunityIcons
            name={isOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color={colors.mutedText}
          />
        </TouchableOpacity>
        {isOpen && <View style={styles.dropdownContent}>{children}</View>}
      </View>
    );
  };

  if (!loaded) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Carrossel" />
        <View style={styles.centerState}>
          <LoadingDuck label="Carregando destaques..." />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Carrossel" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Destaques no carrossel</Text>
          {highlights.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>Nenhum destaque cadastrado.</Text>
          ) : (
            highlights.map((highlight) => (
              <View key={highlight.id} style={[styles.highlightItem, { borderColor: colors.border }]}>
                {!!highlight.image && <Image source={{ uri: highlight.image }} style={styles.highlightImage} />}
                <View style={styles.highlightInfo}>
                  <Text numberOfLines={1} style={[styles.highlightTitle, { color: colors.text }]}>
                    {highlight.title || (highlight.type === "product" ? "Produto" : "Imagem")}
                  </Text>
                  <Text style={[styles.highlightMeta, { color: colors.mutedText }]}>
                    {highlight.type === "product" ? "Produto" : "Imagem"} - {highlight.active ? "Ativo" : "Inativo"}
                  </Text>
                </View>
                <TouchableOpacity activeOpacity={0.85} onPress={() => toggleHighlight(highlight)} style={styles.iconButton}>
                  <MaterialCommunityIcons
                    name={highlight.active ? "eye-outline" : "eye-off-outline"}
                    size={21}
                    color={highlight.active ? colors.primary : colors.mutedText}
                  />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={() => removeHighlight(highlight)} style={styles.iconButton}>
                  <MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>

        {renderDropdownSection("image", "Adicionar imagem", "image-plus", (
          <>
          <Text style={[styles.helperText, { color: colors.mutedText }]}>
            Use imagens em 16:9, idealmente 1600 x 900 px. As bordas podem ser cortadas para preencher o carrossel.
          </Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            onChangeText={(value) => setDraft((current) => ({ ...current, imageUrl: value }))}
            placeholder="Link da imagem (https://...)"
            placeholderTextColor={colors.mutedText}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
            value={draft.imageUrl}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={pickImage}
            style={[styles.imagePicker, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
          >
            {normalizeImageUrl(draft.imageUrl) || draft.image ? (
              <Image source={{ uri: normalizeImageUrl(draft.imageUrl) || draft.image }} style={styles.imagePreview} />
            ) : (
              <>
                <MaterialCommunityIcons name="image-plus" size={30} color={colors.primary} />
                <Text style={[styles.imagePickerText, { color: colors.text }]}>Selecionar arquivo</Text>
              </>
            )}
          </TouchableOpacity>
          <TextInput
            onChangeText={(value) => setDraft((current) => ({ ...current, title: value }))}
            placeholder="Titulo"
            placeholderTextColor={colors.mutedText}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
            value={draft.title}
          />
          <TextInput
            onChangeText={(value) => setDraft((current) => ({ ...current, subtitle: value }))}
            placeholder="Subtitulo"
            placeholderTextColor={colors.mutedText}
            style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
            value={draft.subtitle}
          />
          <TouchableOpacity activeOpacity={0.85} onPress={addImageHighlight} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Adicionar imagem</Text>
          </TouchableOpacity>
          </>
        ))}

        {renderDropdownSection("product", "Adicionar produto", "package-variant-closed-plus", (
          <>
          {sealedProducts.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>Nenhum produto lacrado ativo.</Text>
          ) : (
            sealedProducts.map((result) => {
              const listing = result.anuncios[0];
              const alreadyAdded = highlightedProductIds.has(String(result.card.id));

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={alreadyAdded}
                  key={listing.listingId}
                  onPress={() => addProductHighlight(result)}
                  style={[styles.productItem, { borderColor: colors.border }, alreadyAdded && styles.disabledItem]}
                >
                  {!!getProductImageSource(result.card) && <Image source={getProductImageSource(result.card)} style={styles.productImage} />}
                  <View style={styles.productInfo}>
                    <Text numberOfLines={2} style={[styles.productName, { color: colors.text }]}>{result.card.name}</Text>
                    <Text style={[styles.productPrice, { color: colors.primary }]}>{formatCurrency(listing.unitPrice)}</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={alreadyAdded ? "check" : "plus-circle-outline"}
                    size={23}
                    color={alreadyAdded ? colors.mutedText : colors.primary}
                  />
                </TouchableOpacity>
              );
            })
          )}
          </>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    gap: 12,
    padding: 14,
    paddingBottom: 96,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  dropdownHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
  },
  dropdownTitleRow: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  dropdownTitle: {
    flex: 1,
    marginBottom: 0,
  },
  dropdownContent: {
    paddingTop: 10,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
  },
  helperText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 10,
  },
  highlightItem: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 66,
    paddingVertical: 10,
  },
  highlightImage: {
    borderRadius: 6,
    height: 46,
    width: 64,
  },
  highlightInfo: {
    flex: 1,
    minWidth: 0,
  },
  highlightTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  highlightMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  iconButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 34,
  },
  imagePicker: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    justifyContent: "center",
    marginBottom: 10,
    minHeight: 150,
    overflow: "hidden",
  },
  imagePreview: {
    aspectRatio: 16 / 9,
    width: "100%",
  },
  imagePickerText: {
    fontSize: 14,
    fontWeight: "900",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 44,
    justifyContent: "center",
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  productItem: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 72,
    paddingVertical: 10,
  },
  disabledItem: {
    opacity: 0.55,
  },
  productImage: {
    borderRadius: 6,
    height: 52,
    width: 52,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: "900",
  },
  productPrice: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
});
