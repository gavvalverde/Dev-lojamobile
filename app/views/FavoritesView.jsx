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
import { FavoritesService } from "../services/FavoritesService";

const saleOptions = [
  { label: "Sim", value: true },
  { label: "Nao", value: false },
];

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["M", "NM", "LP", "MP", "HP", "DMG"];

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  const cents = Number(digits || "0");

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

  const text = String(value ?? "");
  return text.startsWith("R$") ? text : formatMoneyInput(text);
}

export default function FavoritesView() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  useEffect(() => {
    const unsubscribe = FavoritesService.subscribe(setFavorites);
    return unsubscribe;
  }, []);

  const formatCardCode = (item) => {
    const number = item.id?.toString().padStart(2, "0") || "00";
    const total = item.set || "??";
    return `${number}/${total}`;
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
      FavoritesService.updateFavorite(editingItem.id, draft);
    }
    closeEditor();
  };

  const renderDropdown = (field, label, selectedLabel, options) => {
    const isOpen = openDropdown === field;

    return (
      <View style={styles.field}>
        <Text style={styles.inputLabel}>{label}</Text>
        <TouchableOpacity
          style={styles.selectButton}
          activeOpacity={0.85}
          onPress={() => setOpenDropdown(isOpen ? null : field)}
        >
          <Text style={styles.selectButtonText}>{selectedLabel}</Text>
          <Text style={styles.selectArrow}>{isOpen ? "^" : "v"}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.dropdownList}>
            {options.map((option) => {
              const optionLabel =
                typeof option === "string" ? option : option.label;
              const optionValue =
                typeof option === "string" ? option : option.value;

              return (
                <TouchableOpacity
                  key={optionLabel}
                  style={styles.dropdownOption}
                  activeOpacity={0.8}
                  onPress={() => {
                    setDraft((current) => ({ ...current, [field]: optionValue }));
                    setOpenDropdown(null);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>{optionLabel}</Text>
                </TouchableOpacity>
              );
            })}
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
        style={styles.editButton}
        activeOpacity={0.85}
        onPress={() => openEditor(item)}
      >
        <Text style={styles.editButtonText}>Editar</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Favoritos</Text>
        <TouchableOpacity
          style={styles.homeButton}
          onPress={() => router.push("/")}
          activeOpacity={0.85}
        >
          <Text style={styles.homeButtonText}>Inicio</Text>
        </TouchableOpacity>
      </View>

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
            <Text style={styles.emptyTitle}>Nenhuma carta favorita</Text>
            <Text style={styles.emptyText}>
              Toque em Fav nas cartas do catalogo para montar sua lista.
            </Text>
            <TouchableOpacity
              style={styles.catalogButton}
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
            style={styles.modalCard}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={styles.modalTitle}>Editar carta</Text>
            <Text numberOfLines={1} style={styles.modalSubtitle}>
              {editingItem?.name}
            </Text>

            {draft &&
              renderDropdown(
                "aVenda",
                "Item a venda",
                draft.aVenda ? "Sim" : "Nao",
                saleOptions
              )}

            <View style={styles.field}>
              <Text style={styles.inputLabel}>Preco</Text>
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
                style={styles.input}
              />
            </View>

            {draft &&
              renderDropdown(
                "idioma",
                "Idioma",
                draft.idioma,
                languageOptions
              )}

            {draft &&
              renderDropdown(
                "qualidade",
                "Qualidade",
                draft.qualidade,
                qualityOptions
              )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                activeOpacity={0.85}
                onPress={closeEditor}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
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
    backgroundColor: "#ef5350",
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
    color: "#222",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 16,
  },
  catalogButton: {
    backgroundColor: "#ef5350",
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
    backgroundColor: "#222",
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
    backgroundColor: "#fff",
    borderRadius: 8,
    maxWidth: 420,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    color: "#222",
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    color: "#666",
    fontSize: 14,
    marginBottom: 14,
    marginTop: 4,
  },
  field: {
    marginBottom: 12,
  },
  inputLabel: {
    color: "#555",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    borderColor: "#ddd",
    borderRadius: 8,
    borderWidth: 1,
    color: "#222",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectButton: {
    alignItems: "center",
    borderColor: "#ddd",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  selectButtonText: {
    color: "#222",
    fontSize: 14,
    fontWeight: "600",
  },
  selectArrow: {
    color: "#777",
    fontSize: 12,
    marginLeft: 8,
  },
  dropdownList: {
    borderColor: "#ddd",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    backgroundColor: "#fff",
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownOptionText: {
    color: "#222",
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
  cancelButton: {
    backgroundColor: "#eee",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "700",
  },
  saveButton: {
    backgroundColor: "#ef5350",
  },
  saveButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
