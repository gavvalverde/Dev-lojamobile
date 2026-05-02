import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useTheme } from "react-native-paper";
import ProdutoEntity from "../entities/ProdutoEntity";
import ProdutoService from "../services/ProdutoService";

const emptyForm = {
  name: "",
  image: "",
  rarity: "",
  set: "",
  price: "0",
  descricao: "",
  estoque: "0",
  favorito: false,
};

export default function ContatoListView() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    carregarCards();
  }, []);

  async function carregarCards() {
    try {
      setLoading(true);
      const dados = await ProdutoService.findAll();
      setCards(dados);
    } catch (error) {
      console.error("Erro ao carregar cartas:", error);
  const [cards, setCards] = useState([]); // State to hold card data
  const [loading, setLoading] = useState(true); // Loading state
  const [search, setSearch] = useState(""); // Search term
  const [modalVisible, setModalVisible] = useState(false); // Modal visibility
  const [selectedCard, setSelectedCard] = useState(null); // Selected card for editing
  const [form, setForm] = useState(emptyForm); // Form state for editing cards
      setLoading(false);
    }
  }

  const cardsFiltrados = useMemo(() => {
    const termo = search.trim().toLowerCase();

    if (!termo) {
      return cards;
    }

    return cards.filter((item) => {
      return (
        item.name?.toLowerCase().includes(termo) ||
        item.set?.toLowerCase().includes(termo) ||
        item.rarity?.toLowerCase().includes(termo)
      );
    });
  }, [cards, search]);

  const favoritos = useMemo(
    () => cardsFiltrados.filter((item) => item.favorito),
    [cardsFiltrados]
  );

  function abrirEditor(card) {
    setSelectedCard(card);
    setForm({
      name: card.name ?? "",
      image: card.images?.small ?? "",
      rarity: card.rarity ?? "",
      set: card.set ?? "",
      price: String(card.price ?? 0),
      descricao: card.descricao ?? "",
      estoque: String(card.estoque ?? 0),
      favorito: !!card.favorito,
    });
    setModalVisible(true);
  }

  function fecharEditor() {
    setModalVisible(false);
    setSelectedCard(null);
    setForm(emptyForm);
  }

  async function salvarCard() {
    if (!selectedCard) return;

    const cardAtualizado = new ProdutoEntity(
      selectedCard.id,
      form.name,
      {
        small: form.image,
        large: form.image,
      },
      form.rarity,
      form.set,
      Number(form.price) || 0,
      form.favorito,
      form.descricao,
      Number(form.estoque) || 0
    );

    try {
      await ProdutoService.save(cardAtualizado);
      await carregarCards();
      fecharEditor();
    } catch (error) {
      console.error("Erro ao salvar carta:", error);
    }
  }

  function renderCard({ item }) {
    return (
      <Pressable
        style={[styles.card, { width: cardWidth }]}
        onPress={() => abrirEditor(item)}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{ uri: item.images?.small || "https://via.placeholder.com/300" }}
            style={[styles.cardImage, { height: cardHeight }]}
          />
          {item.favorito && <Text style={styles.favoriteBadge}>★</Text>}
        </View>

        <View style={styles.cardInfo}>
          <Text numberOfLines={1} style={styles.cardName}>
            {item.name}
          </Text>
          <Text style={styles.cardMeta}>{item.set || "Sem coleção"}</Text>
          <Text style={styles.cardMeta}>{item.rarity || "Sem raridade"}</Text>
          <Text style={styles.cardPrice}>
            R$ {(item.price || 0).toFixed(2)}
          </Text>
        </View>
      </Pressable>
    );
  }

  function renderFavorite({ item }) {
    return (
      <Pressable style={styles.favoriteCard} onPress={() => abrirEditor(item)}>
        <Image
          source={{ uri: item.images?.small || "https://via.placeholder.com/300" }}
          style={styles.favoriteImage}
        />
        <Text numberOfLines={1} style={styles.favoriteName}>
          {item.name}
        </Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingArea}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text style={styles.loadingText}>Carregando cartas...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        key={numColumns}
        data={cardsFiltrados}
        keyExtractor={(item) => item.key}
        renderItem={renderCard}
        numColumns={numColumns}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Favoritos editáveis</Text>

            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar carta por nome, coleção ou raridade"
              style={styles.searchInput}
            />

            <Text style={styles.sectionTitle}>Favoritos</Text>
            {favoritos.length > 0 ? (
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={favoritos}
                keyExtractor={(item) => item.key}
                renderItem={renderFavorite}
                contentContainerStyle={styles.favoritesList}
              />
            ) : (
              <Text style={styles.emptyText}>
                Nenhuma carta favorita por enquanto.
              </Text>
            )}

            <Text style={styles.sectionTitle}>Lista geral</Text>
            <Text style={styles.helperText}>
              Toque em qualquer carta para abrir a janela de edição.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            Nenhuma carta encontrada para o filtro atual.
          </Text>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={fecharEditor}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar carta</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                value={form.name}
                onChangeText={(value) => setForm((prev) => ({ ...prev, name: value }))}
                placeholder="Nome"
                style={styles.input}
              />

              <TextInput
                value={form.image}
                onChangeText={(value) => setForm((prev) => ({ ...prev, image: value }))}
                placeholder="URL da imagem"
                style={styles.input}
                autoCapitalize="none"
              />

              <TextInput
                value={form.set}
                onChangeText={(value) => setForm((prev) => ({ ...prev, set: value }))}
                placeholder="Coleção"
                style={styles.input}
              />

              <TextInput
                value={form.rarity}
                onChangeText={(value) => setForm((prev) => ({ ...prev, rarity: value }))}
                placeholder="Raridade"
                style={styles.input}
              />

              <TextInput
                value={form.price}
                onChangeText={(value) => setForm((prev) => ({ ...prev, price: value }))}
                placeholder="Preço"
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <TextInput
                value={form.estoque}
                onChangeText={(value) => setForm((prev) => ({ ...prev, estoque: value }))}
                placeholder="Estoque"
                style={styles.input}
                keyboardType="number-pad"
              />

              <TextInput
                value={form.descricao}
                onChangeText={(value) => setForm((prev) => ({ ...prev, descricao: value }))}
                placeholder="Descrição"
                style={[styles.input, styles.textArea]}
                multiline
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Favorito</Text>
                <Switch
                  value={form.favorito}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, favorito: value }))
                  }
                />
              </View>

              <View style={styles.modalActions}>
                <Pressable style={[styles.actionButton, styles.cancelButton]} onPress={fecharEditor}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </Pressable>

                <Pressable style={[styles.actionButton, styles.saveButton]} onPress={salvarCard}>
                  <Text style={styles.saveText}>Salvar</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  loadingText: { marginTop: 10, color: "#333" },
  listContent: {
    padding: 14,
    paddingBottom: 36,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerBlock: {
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  searchInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 10,
  },
  helperText: {
    color: "#666",
    marginBottom: 12,
  },
  favoritesList: {
    paddingBottom: 10,
  },
  favoriteCard: {
    width: 132,
    marginRight: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#eee",
  },
  favoriteImage: {
    width: "100%",
    height: 92,
    resizeMode: "cover",
  },
  favoriteName: {
    padding: 10,
    fontSize: 13,
    fontWeight: "600",
    color: "#222",
  },
  emptyText: {
    color: "#666",
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#eee",
    marginBottom: 12,
  },
  imageWrapper: {
    position: "relative",
  },
  cardImage: {
    width: "100%",
    resizeMode: "cover",
  },
  favoriteBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255, 215, 0, 0.95)",
    color: "#222",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontWeight: "700",
  },
  cardInfo: {
    padding: 10,
  },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#222",
  },
  cardMeta: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  cardPrice: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#ef5350",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    maxHeight: "88%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#222",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: "#fafafa",
  },
  textArea: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#eceff1",
  },
  saveButton: {
    backgroundColor: "#ef5350",
  },
  cancelText: {
    color: "#333",
    fontWeight: "700",
  },
  saveText: {
    color: "#fff",
    fontWeight: "700",
  },
});