import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import { AuthGuard } from "../components/AuthGuard";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { FavoritesService } from "../services/FavoritesService";
import { useAppTheme } from "../services/AppThemeContext";

const saleOptions = [
  { label: "Sim", value: true },
  { label: "Nao", value: false },
];

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["NM", "LP", "MP", "HP", "DMG"];

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  let cents = Number(digits || "0");
  
  // Se tem 2 ou menos dígitos, é reais direto (não centavos)
  if (digits.length <= 2) {
    cents = cents * 100;
  }

  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeMoneyValue(value) {
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (!value || value === "" || value === "undefined") return "R$ 0,00";
  const text = String(value);
  return text.startsWith("R$") ? text : formatMoneyInput(text);
}

function FavoritesViewContent() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [favorites, setFavorites] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;
  const saleLabel = draft?.aVenda ? "Sim" : "Nao";

  useEffect(() => {
    const unsubscribe = FavoritesService.subscribe(setFavorites);
    return unsubscribe;
  }, []);

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
  };

  const openEditor = (item) => {
    setEditingItem(item);
    setDraft({
      aVenda: item.aVenda ?? false,
      price: normalizeMoneyValue(item.price),
      idioma: item.idioma ?? "Portugues",
      qualidade: item.qualidade ?? "NM",
    });
    setOpenDropdown(null);
  };

  const closeEditor = () => {
    setEditingItem(null);
    setDraft(null);
    setOpenDropdown(null);
  };

  const saveEditor = () => {
    if (editingItem && draft) {
      // Validar preço
      const priceText = String(draft.price ?? "").replace(/\D/g, "");
      if (draft.aVenda && (!priceText || priceText === "0")) {
        alert("Por favor, insira um preço válido");
        return;
      }
      FavoritesService.updateFavorite(editingItem.id, draft);
    }
    closeEditor();
  };

  const renderDropdown = (field, label, selectedLabel, options) => {
    const isOpen = openDropdown === field;
    const normalizedOptions = options.map((option) => {
      if (typeof option === "string") {
        return { label: option, value: option };
      }

      return { label: option.label, value: option.value };
    });

    return (
      <View style={styles.field}>
        <Text style={[styles.inputLabel, { color: colors.mutedText }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.selectButton, { borderColor: colors.border }]}
          activeOpacity={0.85}
          onPress={() => setOpenDropdown(isOpen ? null : field)}
        >
          <Text style={[styles.selectButtonText, { color: colors.text }]}>{selectedLabel}</Text>
          <Text style={[styles.selectArrow, { color: colors.mutedText }]}>{isOpen ? "^" : "v"}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={[styles.dropdownList, { borderColor: colors.border }]}>
            {normalizedOptions.map((option) => (
              <TouchableOpacity
                key={option.label}
                style={[
                  styles.dropdownOption,
                  { backgroundColor: colors.surface, borderBottomColor: colors.border },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  setDraft((current) => ({ ...current, [field]: option.value }));
                  setOpenDropdown(null);
                }}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCard = ({ item, index }) => (
    <View style={[styles.favoriteItem, { width: cardWidth }]}>
      <AnimatedCard
        item={item}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={FavoritesService.isFavorite(item.id)}
        onFavoritePress={() => FavoritesService.toggleFavorite(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
      />

      <TouchableOpacity
        style={[styles.editButton, { backgroundColor: colors.secondary }]}
        activeOpacity={0.85}
        onPress={() => openEditor(item)}
      >
        <Text style={styles.editButtonText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );

  const aVendaDropdown = draft ? renderDropdown("aVenda", "Item a venda", saleLabel, saleOptions) : null;
  const idiomaDropdown = draft ? renderDropdown("idioma", "Idioma", draft.idioma, languageOptions) : null;
  const qualidadeDropdown = draft ? renderDropdown("qualidade", "Qualidade", draft.qualidade, qualityOptions) : null;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Favoritos" />

      <FlatList
        key={numColumns}
        data={favorites}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        numColumns={numColumns}
        contentContainerStyle={[
          { padding: spacing },
          favorites.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma carta favorita</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Toque em Fav nas cartas do catalogo para montar sua lista.
            </Text>
            <TouchableOpacity
              style={[styles.catalogButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/")}
              activeOpacity={0.85}
            >
              <Text style={styles.catalogButtonText}>Ver catalogo</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        animationType="fade"
        transparent
        visible={!!editingItem}
        onRequestClose={closeEditor}
      >
        <Pressable style={styles.modalOverlay} onPress={closeEditor}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar carta</Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              {editingItem?.name}
            </Text>

            {aVendaDropdown}

            <View style={styles.field}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preco</Text>
              <TextInput
                value={String(draft?.price ?? "")}
                onChangeText={(price) =>
                  setDraft((current) => ({
                    ...current,
                    price: formatMoneyInput(price),
                  }))
                }
                keyboardType="numeric"
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  {
                    borderColor: colors.border,
                    color: colors.text,
                    backgroundColor: colors.surface,
                  },
                ]}
              />
            </View>

            {idiomaDropdown}

            {qualidadeDropdown}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.surfaceVariant },
                ]}
                activeOpacity={0.85}
                onPress={closeEditor}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={saveEditor}
              >
                <Text style={styles.saveButtonText}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function FavoritesView() {
  return (
    <AuthGuard>
      <FavoritesViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f6fa" },
  header: {
    padding: 16,
    backgroundColor: "#fff",
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { fontSize: 22, fontWeight: "bold", color: "#222" },
  homeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  homeButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  catalogButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  catalogButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  favoriteItem: {
    marginBottom: 12,
  },
  editButton: {
    alignItems: "center",
    borderRadius: 8,
    marginTop: 8,
    paddingVertical: 10,
  },
  editButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderRadius: 8,
    maxWidth: 420,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 14,
    marginTop: 4,
  },
  field: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectArrow: {
    fontSize: 12,
    marginLeft: 8,
  },
  dropdownList: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownOptionText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  modalButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cancelButtonText: {
    fontWeight: "700",
  },
  saveButton: {
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
