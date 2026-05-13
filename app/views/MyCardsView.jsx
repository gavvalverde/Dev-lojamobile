import { useRouter, useLocalSearchParams } from "expo-router";
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
import { UserService } from "../services/UserService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";import AnimatedScreenWrapper from "../components/AnimatedScreenWrapper";import { useAppTheme } from "../services/AppThemeContext";

const languageOptions = ["Português", "Inglês", "Japonês", "Espanhol", "Francês"];
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

function MyCardsViewContent() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams();
  const editId = params?.editId;
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [myCards, setMyCards] = useState([]);
  const [, setFavorites] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [removingItem, setRemovingItem] = useState(null);
  const [removeQuantity, setRemoveQuantity] = useState("1");
  const [userCoverPhoto, setUserCoverPhoto] = useState("");
  const [useCoverPhotoInHeader, setUseCoverPhotoInHeader] = useState(true);
  const [searchText, setSearchText] = useState("");

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;
  const ownedQuantity = editingItem ? MyCardsService.getQuantity(editingItem.id) : 0;
  const saleQuantityOptions = Array.from({ length: Math.max(1, ownedQuantity) }, (_, index) => {
    const quantity = index + 1;
    return { label: String(quantity), value: quantity };
  });

  useEffect(() => {
    const fetchUserCover = async () => {
      const session = await UserService.getSession();
      if (session?.coverPhoto) {
        setUserCoverPhoto(session.coverPhoto);
      }
      if ('useCoverPhotoInHeader' in session) {
        setUseCoverPhotoInHeader(session.useCoverPhotoInHeader);
      }
    };
    fetchUserCover();
  }, []);

  useEffect(() => {
    const unsubscribe = MyCardsService.subscribe(setMyCards);
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    return () => {
      unsubscribe();
      unsubscribeFavorites();
    };
  }, []);

  useEffect(() => {
    if (!editId) return;
    if (editingItem) return;

    const target = myCards.find((c) => String(c.id) === String(editId));
    if (target) {
      openEditor(target);
      // remove query param to avoid reopening
      try {
        router.replace('/views/MyCardsView');
      } catch (e) {
        // ignore
      }
    }
  }, [editId, myCards]);

  const filteredCards = myCards.filter(item => !searchText || (item.name && item.name.toLowerCase().includes(searchText.toLowerCase())));

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
  };

  const openEditor = (item) => {
    const currentQuantity = MyCardsService.getQuantity(item.id);

    setEditingItem(item);
    setDraft({
      price: normalizeMoneyValue(item.price),
      idioma: item.idioma ?? "Português",
      qualidade: item.qualidade ?? "NM",
      quantidadeVenda: String(
        Math.max(
          1,
          Math.min(currentQuantity, Number(item.quantidadeVenda ?? item.quantity) || 1)
        )
      ),
    });
    setOpenDropdown(null);
  };

  const closeEditor = () => {
    setEditingItem(null);
    setDraft(null);
    setOpenDropdown(null);
  };

  const openRemovePopup = (item) => {
    setRemovingItem(item);
    setRemoveQuantity("1");
  };

  const closeRemovePopup = () => {
    setRemovingItem(null);
    setRemoveQuantity("1");
  };

  const confirmRemove = () => {
    if (!removingItem) return;

    const quantity = MyCardsService.getQuantity(removingItem.id);
    const amount = quantity > 1 ? Math.max(1, Math.min(quantity, Number(removeQuantity) || 1)) : 1;

    MyCardsService.removeCopies(removingItem, amount);
    closeRemovePopup();
  };

  const saveEditor = () => {
    if (editingItem && draft) {
      // Validar preço
      const priceText = String(draft.price ?? "").replace(/\D/g, "");
      if (!priceText || priceText === "0") {
        alert("Por favor, insira um preço válido");
        return;
      }

      const saleQuantity = Number(String(draft.quantidadeVenda ?? "").replace(/\D/g, "")) || 0;
      if (saleQuantity < 1) {
        alert("Informe uma quantidade disponível para venda");
        return;
      }

      // Save as a sale: ensure aVenda is true and set quantidadeVenda (do not overwrite owned quantity)
      MyCardsService.updateCard(editingItem.id, {
        price: draft.price,
        idioma: draft.idioma,
        qualidade: draft.qualidade,
        aVenda: true,
        quantidadeVenda: saleQuantity,
      });
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
        isMyCard={MyCardsService.isMyCard(item.id)}
        myCardQuantity={MyCardsService.getQuantity(item.id)}
        onFavoritePress={() => FavoritesService.toggleFavorite(item)}
        onMyCardPress={() => MyCardsService.addCopies(item, 1)}
        onMyCardRemovePress={() => openRemovePopup(item)}
        onSellPress={() => openEditor(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
      />
    </View>
  );

  const idiomaDropdown = draft ? renderDropdown("idioma", "Idioma", draft.idioma, languageOptions) : null;
  const qualidadeDropdown = draft ? renderDropdown("qualidade", "Qualidade", draft.qualidade, qualityOptions) : null;
  const quantidadeVendaDropdown = draft
    ? renderDropdown(
        "quantidadeVenda",
        "Quantidade disponível para venda",
        String(draft.quantidadeVenda ?? 1),
        saleQuantityOptions
      )
    : null;

  return (
    <AnimatedScreenWrapper>
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Minhas Cartas" backgroundImage={useCoverPhotoInHeader ? userCoverPhoto : null} />

      <View style={styles.searchContainer}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Buscar cartas..."
          placeholderTextColor={colors.mutedText}
          style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
      </View>

      <FlatList
        key={numColumns}
        data={filteredCards}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        numColumns={numColumns}
        contentContainerStyle={[
          { padding: spacing },
          myCards.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma carta na sua coleção</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Toque em Minhas nas cartas do catálogo para montar sua coleção.
            </Text>
            <TouchableOpacity
              style={[styles.catalogButton, { backgroundColor: colors.primary }]}
              onPress={() => router.push("/views/HomeView")}
              activeOpacity={0.85}
            >
              <Text style={styles.catalogButtonText}>Ver catálogo</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Vender Carta</Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              {editingItem?.name}
            </Text>

            <View style={styles.field}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preço</Text>
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

            {quantidadeVendaDropdown}

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

      <Modal
        animationType="fade"
        transparent
        visible={!!removingItem}
        onRequestClose={closeRemovePopup}
      >
        <Pressable style={styles.modalOverlay} onPress={closeRemovePopup}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Remover carta</Text>
            <Text numberOfLines={2} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              {removingItem?.name}
            </Text>

            {removingItem && MyCardsService.getQuantity(removingItem.id) > 1 ? (
              <View style={styles.field}>
                <Text style={[styles.inputLabel, { color: colors.mutedText }]}>
                  Quantas unidades deseja remover?
                </Text>
                <TextInput
                  value={removeQuantity}
                  onChangeText={(value) => setRemoveQuantity(String(value).replace(/\D/g, ""))}
                  keyboardType="numeric"
                  placeholder="1"
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
                <Text style={[styles.removeHint, { color: colors.mutedText }]}>
                  Você tem {MyCardsService.getQuantity(removingItem.id)} unidades desta carta.
                </Text>
              </View>
            ) : (
              <Text style={[styles.removeMessage, { color: colors.mutedText }]}>
                Quer remover esta carta da sua coleção?
              </Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
                activeOpacity={0.85}
                onPress={closeRemovePopup}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.removeButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={confirmRemove}
              >
                <Text style={styles.removeButtonText}>Remover</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
    </AnimatedScreenWrapper>
  );
}

export default function MyCardsView() {
  return (
    <AuthGuard>
      <MyCardsViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f6fa" },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
  },
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
  removeMessage: {
    fontSize: 14,
    marginBottom: 6,
  },
  removeHint: {
    fontSize: 12,
    marginTop: 6,
  },
  removeButton: {
  },
  removeButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
