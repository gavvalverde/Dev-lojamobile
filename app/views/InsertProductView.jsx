import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { StoreProductService } from "../services/StoreProductService";
import { UserService } from "../services/UserService";
import { getProductImageSource } from "../../utils/productImage";

const categoryOptions = ["Booster Box", "Elite Trainer Box", "Blister", "Deck", "Bundle", "Outro"];
const conditionOptions = ["Lacrado", "Novo", "Com avaria", "Usado"];

function newSealedProductId() {
  return `sealed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

async function createProductImages(image) {
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return { small: image, large: image };

  const [smallResult, largeResult] = await Promise.all([
    ImageManipulator.manipulateAsync(
      image,
      [{ resize: { width: 420 } }],
      { base64: true, compress: 0.42, format: ImageManipulator.SaveFormat.JPEG }
    ),
    ImageManipulator.manipulateAsync(
      image,
      [{ resize: { width: 1100 } }],
      { base64: true, compress: 0.62, format: ImageManipulator.SaveFormat.JPEG }
    ),
  ]);

  return {
    small: `data:image/jpeg;base64,${smallResult.base64}`,
    large: `data:image/jpeg;base64,${largeResult.base64}`,
  };
}

export default function InsertProductView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [products, setProducts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: categoryOptions[0],
    condition: conditionOptions[0],
    stock: "1",
    image: null,
    imageUrl: "",
  });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeUsers = UserService.subscribe((nextUsers) => {
      setUsers(nextUsers);
      setUsersLoaded(true);
    });
    const unsubscribeProducts = StoreProductService.subscribe(setProducts);

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
      unsubscribeProducts();
    };
  }, []);

  const currentUserRecord = useMemo(
    () => users.find((user) => user.id === currentUser?.id) ?? currentUser,
    [currentUser, users]
  );
  const canInsert = currentUserRecord?.isAdmin || currentUser?.isAdmin;
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;

    return products.filter((product) => {
      const searchable = [
        product.name,
        product.description,
        product.descricao,
        product.collectionNumber,
        product.set,
        product.qualidade,
        product.aVenda ? "ativo" : "pausado",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [products, search]);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [4, 3],
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.55,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      updateForm("image", result.assets[0].uri);
    } catch (error) {
      Alert.alert("Imagem", error.message || "Nao foi possivel carregar a foto.");
    }
  };

  const saveProduct = async () => {
    const name = form.name.trim();
    const description = form.description.trim();
    const priceDigits = String(form.price ?? "").replace(/\D/g, "");
    const image = normalizeImageUrl(form.imageUrl) || form.image;

    if (!name) {
      Alert.alert("Nome obrigatorio", "Informe o nome do produto selado.");
      return;
    }
    if (!description) {
      Alert.alert("Descricao obrigatoria", "Descreva o produto, edicao e detalhes importantes.");
      return;
    }
    if (!image && !editingProduct?.images?.small && !editingProduct?.images?.large) {
      Alert.alert("Foto obrigatoria", "Adicione um link de imagem ou uma foto do produto.");
      return;
    }
    if (!priceDigits || priceDigits === "0") {
      Alert.alert("Preco obrigatorio", "Informe um preco maior que zero.");
      return;
    }

    const productId = editingProduct?.cardId ?? newSealedProductId();
    try {
      setSaving(true);
      const imageSource = image || editingProduct?.images?.large || editingProduct?.images?.small;
      const images = await createProductImages(imageSource);
      const product = {
        ...editingProduct,
        id: productId,
        cardId: productId,
        name,
        images: images ?? editingProduct?.images,
        set: form.category,
        rarity: "Produto selado",
        collectionNumber: form.category,
        descricao: description,
        description,
        estoque: Number(form.stock) || 1,
        supertype: "Produto selado",
        cardType: "produto-selado",
        subtypes: [form.category],
        productType: "sealed",
        price: form.price,
        idioma: "Produto selado",
        qualidade: form.condition,
        aVenda: true,
      };

      if (editingProduct) {
        await StoreProductService.updateProduct(editingProduct.id, product);
      } else {
        await StoreProductService.createProduct(product);
      }
      Alert.alert("Produto salvo", `${name} entrou no catalogo da loja.`);
      setEditingProduct(null);
      setAddProductOpen(false);
      setForm({
        name: "",
        description: "",
        price: "",
        category: categoryOptions[0],
        condition: conditionOptions[0],
        stock: "1",
        image: null,
        imageUrl: "",
      });
    } catch (error) {
      Alert.alert("Erro", error.message || "Nao foi possivel inserir o produto.");
    } finally {
      setSaving(false);
    }
  };

  const editProduct = (product) => {
    setEditingProduct(product);
    setAddProductOpen(true);
    setForm({
      name: product.name ?? "",
      description: product.description ?? product.descricao ?? "",
      price: String(product.price ?? ""),
      category: product.collectionNumber ?? product.set ?? categoryOptions[0],
      condition: product.qualidade ?? conditionOptions[0],
      stock: String(product.estoque ?? 1),
      image: null,
      imageUrl: String(product.images?.large ?? "").startsWith("http") ? product.images.large : "",
    });
  };

  const toggleProduct = async (product) => {
    await StoreProductService.updateProduct(product.id, { aVenda: !product.aVenda });
  };

  const removeProduct = async (product) => {
    try {
      await StoreProductService.removeProduct(product.id);
      if (editingProduct?.id === product.id) {
        setEditingProduct(null);
        setAddProductOpen(false);
      }
    } catch (error) {
      Alert.alert("Produto", error.message || "Nao foi possivel excluir o produto.");
    }
  };

  const confirmRemoveProduct = (product) => {
    Alert.alert("Excluir produto", `Excluir ${product.name} da loja?`, [
      { text: "Voltar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: () => removeProduct(product) },
    ]);
  };

  const renderOption = (field, value) => {
    const selected = form[field] === value;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        key={value}
        onPress={() => updateForm(field, value)}
        style={[
          styles.optionButton,
          { borderColor: colors.border, backgroundColor: colors.surface },
          selected && { borderColor: colors.primary, backgroundColor: colors.accent },
        ]}
      >
        <Text style={[styles.optionText, { color: selected ? colors.onAccent : colors.text }]}>
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!usersLoaded) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Gerenciar produtos" />
        <View style={styles.centerState}>
          <LoadingDuck label="Carregando permissoes..." />
        </View>
      </View>
    );
  }

  if (!canInsert) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Acesso restrito" />
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="tag-lock" size={46} color={colors.mutedText} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Acesso administrativo necessario</Text>
          <Text style={[styles.emptyText, { color: colors.mutedText }]}>
            Somente administradores podem gerenciar produtos da loja.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Gerenciar produtos" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.searchBox, styles.topSearchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
          <TextInput
            onChangeText={setSearch}
            placeholder="Buscar produto"
            placeholderTextColor={colors.mutedText}
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
          />
          {!!search && (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setSearch("")} style={styles.searchIconButton}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedText} />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setAddProductOpen((current) => !current)}
          style={[
            styles.dropdownHeader,
            addProductOpen && styles.dropdownHeaderOpen,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.dropdownTitleRow}>
            <MaterialCommunityIcons name="package-variant-plus" size={22} color={colors.primary} />
            <Text style={[styles.dropdownTitle, { color: colors.text }]}>
              {editingProduct ? "Editar produto" : "Adicionar produto"}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={addProductOpen ? "chevron-up" : "chevron-down"}
            size={24}
            color={colors.mutedText}
          />
        </TouchableOpacity>

        {addProductOpen && (
          <>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onChangeText={(value) => updateForm("imageUrl", value)}
          placeholder="Link da imagem (https://...)"
          placeholderTextColor={colors.mutedText}
          style={[
            styles.input,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
          ]}
          value={form.imageUrl}
        />

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={pickImage}
          style={[styles.photoPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {normalizeImageUrl(form.imageUrl) || form.image || editingProduct ? (
            <Image
              source={normalizeImageUrl(form.imageUrl) || form.image
                ? { uri: normalizeImageUrl(form.imageUrl) || form.image }
                : getProductImageSource(editingProduct)}
              style={styles.photoPreview}
            />
          ) : (
            <View style={styles.photoEmpty}>
              <MaterialCommunityIcons name="camera-plus" size={36} color={colors.primary} />
              <Text style={[styles.photoText, { color: colors.text }]}>Selecionar arquivo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={[styles.formPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            onChangeText={(value) => updateForm("name", value)}
            placeholder="Nome do produto"
            placeholderTextColor={colors.mutedText}
            style={[
              styles.input,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
            ]}
            value={form.name}
          />
          <TextInput
            multiline
            onChangeText={(value) => updateForm("description", value)}
            placeholder="Descricao, edicao, idioma da embalagem, estado do lacre..."
            placeholderTextColor={colors.mutedText}
            style={[
              styles.input,
              styles.descriptionInput,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
            ]}
            textAlignVertical="top"
            value={form.description}
          />

          <>
              <View style={styles.inlineInputs}>
                <TextInput
                  keyboardType="decimal-pad"
                  onChangeText={(value) => updateForm("price", value)}
                  placeholder="Preco"
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    styles.inlineInput,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                  ]}
                  value={form.price}
                />
                <TextInput
                  keyboardType="number-pad"
                  onChangeText={(value) => updateForm("stock", value)}
                  placeholder="Qtd."
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    styles.stockInput,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                  ]}
                  value={form.stock}
                />
              </View>

              <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Categoria</Text>
              <View style={styles.optionsRow}>{categoryOptions.map((value) => renderOption("category", value))}</View>

              <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Condicao</Text>
              <View style={styles.optionsRow}>{conditionOptions.map((value) => renderOption("condition", value))}</View>
          </>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={saving}
            onPress={saveProduct}
            style={[styles.saveButton, { backgroundColor: colors.primary }, saving && styles.disabledButton]}
          >
            <MaterialCommunityIcons name="content-save" size={20} color={colors.onPrimary} />
            <Text style={[styles.saveText, { color: colors.onPrimary }]}>
              {editingProduct ? "Salvar produto" : "Inserir produto"}
            </Text>
          </TouchableOpacity>
        </View>
          </>
        )}

        <View style={[styles.formPanel, styles.productsPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.productsTitle, { color: colors.text }]}>Produtos da loja</Text>
            {!!search && filteredProducts.length === 0 && (
              <Text style={[styles.emptySearchText, { color: colors.mutedText }]}>Nenhum produto encontrado.</Text>
            )}
            {filteredProducts.map((product) => (
              <View key={product.id} style={[styles.productItem, { borderTopColor: colors.border }]}>
                {!!getProductImageSource(product) && <Image source={getProductImageSource(product)} style={styles.productImage} />}
                <View style={styles.productInfo}>
                  <Text numberOfLines={2} style={[styles.productName, { color: colors.text }]}>{product.name}</Text>
                  <Text style={[styles.productMeta, { color: colors.mutedText }]}>
                    {product.aVenda ? "Ativo" : "Pausado"} - Estoque: {product.estoque ?? product.stock ?? 1}
                  </Text>
                </View>
                <TouchableOpacity activeOpacity={0.85} onPress={() => editProduct(product)} style={styles.productAction}>
                  <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={() => toggleProduct(product)} style={styles.productAction}>
                  <MaterialCommunityIcons name={product.aVenda ? "pause-circle-outline" : "play-circle-outline"} size={21} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.85} onPress={() => confirmRemoveProduct(product)} style={styles.productAction}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              </View>
            ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 96,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  dropdownHeader: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
  },
  dropdownHeaderOpen: {
    marginBottom: 12,
  },
  dropdownTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  dropdownTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  photoPicker: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    marginBottom: 12,
    minHeight: 220,
    overflow: "hidden",
  },
  photoPreview: {
    aspectRatio: 4 / 3,
    width: "100%",
  },
  photoEmpty: {
    alignItems: "center",
    gap: 8,
    padding: 28,
  },
  photoText: {
    fontSize: 15,
    fontWeight: "900",
  },
  formPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  descriptionInput: {
    minHeight: 112,
    paddingTop: 12,
  },
  inlineInputs: {
    flexDirection: "row",
    gap: 8,
  },
  inlineInput: {
    flex: 1,
  },
  stockInput: {
    width: 86,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 8,
    textTransform: "uppercase",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
    marginTop: 8,
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  optionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    minHeight: 48,
  },
  saveText: {
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.6,
  },
  productsPanel: {
    marginTop: 12,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 12,
  },
  topSearchBox: {
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  searchIconButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    width: 32,
  },
  emptySearchText: {
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 16,
    textAlign: "center",
  },
  productsTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 4,
  },
  productItem: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 68,
    paddingVertical: 8,
  },
  productImage: {
    borderRadius: 6,
    height: 48,
    width: 48,
  },
  productInfo: {
    flex: 1,
    minWidth: 0,
  },
  productName: {
    fontSize: 13,
    fontWeight: "900",
  },
  productMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  productAction: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
  },
});
