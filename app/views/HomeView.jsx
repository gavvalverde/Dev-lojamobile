import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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
    Image,
} from "react-native";
import { CardSearchResult } from "../components/CardSearchResult";
import { CartModal } from "../components/CartModal";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AnuncioService } from "../services/AnuncioService";
import { CartService } from "../services/CartService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";
import { useAppTheme } from "../services/AppThemeContext";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function HomeView() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  const [, setFavorites] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [search, setSearch] = useState("");
  const [apiCards, setApiCards] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [cartVisible, setCartVisible] = useState(false);
  const [quantityModalVisible, setQuantityModalVisible] = useState(false);
  const [selectedMyCard, setSelectedMyCard] = useState(null);
  const [quantityToAdd, setQuantityToAdd] = useState("1");

  useEffect(() => {
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);
    const unsubscribeCart = CartService.subscribe(setCartItems);

    return () => {
      unsubscribeFavorites();
      unsubscribeMyCards();
      unsubscribeCart();
    };
  }, []);

  useEffect(() => {
    const term = search.trim();

    if (!term) {
      setApiCards([]);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);
    setSearchError("");

    const timeout = setTimeout(async () => {
      try {
        const cards = await PokemonService.searchCards(term);
        if (active) setApiCards(cards);
      } catch (error) {
        console.error("Erro ao buscar cartas na API:", error);
        if (active) {
          setApiCards([]);
          setSearchError("Não foi possível buscar cartas agora.");
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [search]);

  const cardResults = useMemo(() => {
    if (search.trim()) {
      return AnuncioService.buildSearchResults(apiCards, myCards);
    }

    return AnuncioService.buildCatalogResults(myCards);
  }, [apiCards, myCards, search]);

  const cartTotal = CartService.getTotal(cartItems);
  const cartQuantity = cartItems.reduce((total, item) => total + item.quantity, 0);

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
  };

  const renderCard = ({ item, index }) => (
    <CardSearchResult
      result={item}
      index={index}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      formatCardCode={formatCardCode}
      isFavorite={FavoritesService.isFavorite(item.card.id)}
      isMyCard={MyCardsService.isMyCard(item.card.id)}
      myCardQuantity={MyCardsService.getQuantity(item.card.id)}
      onFavoritePress={(card) => FavoritesService.toggleFavorite(card)}
      onMyCardPress={(card) => {
        setSelectedMyCard(card);
        setQuantityToAdd("1");
        setQuantityModalVisible(true);
      }}
      onPress={(card) => router.push(`/views/CardDetailsView?id=${card.id}`)}
      onAddToCart={(anuncio) => CartService.addItem(anuncio)}
    />
  );

  const confirmAddMyCard = () => {
    if (!selectedMyCard) return;

    const quantity = Math.max(1, Number(quantityToAdd) || 1);
    MyCardsService.addCopies(selectedMyCard, quantity);
    setQuantityModalVisible(false);
    setSelectedMyCard(null);
    setQuantityToAdd("1");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Yellow Duck TCG" />

      <View
        style={[
          styles.cartSummary,
          { backgroundColor: colors.surface, borderTopColor: colors.border },
        ]}
      >
        <View>
          <Text style={[styles.cartSummaryLabel, { color: colors.mutedText }]}>Carrinho</Text>
          <Text style={[styles.cartSummaryText, { color: colors.text }]}>
            {cartQuantity} item(ns) - {formatCurrency(cartTotal)}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setCartVisible(true)}
          style={[styles.cartButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={styles.cartButtonText}>Ver carrinho</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        key={numColumns}
        data={cardResults}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.card.id)}
        numColumns={numColumns}
        contentContainerStyle={[
          { padding: spacing },
          cardResults.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        ListHeaderComponent={
          <View>
            <TextInput
              placeholder="Buscar cartas Pokemon TCG"
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={colors.mutedText}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
            />

            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              {search.trim() ? "Cartas encontradas" : "Cartas à venda"}
            </Text>
            {searchLoading && (
              <View style={styles.loadingContainer}>
                <Image
                  source={require('../../assets/images/backgrounds/load.gif')}
                  style={styles.loadingGif}
                />
                <Text style={[styles.searchStatus, { color: colors.mutedText }]}>Buscando na API...</Text>
              </View>
            )}
            {!!searchError && (
              <Text style={[styles.searchError, { color: colors.danger }]}>{searchError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !searchLoading ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {search.trim() ? "Nenhuma carta encontrada" : "Nenhuma carta à venda"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                {search.trim()
                  ? "Tente buscar por outro nome de carta Pokemon TCG."
                  : "Vá em Minhas Cartas, toque em Editar e marque uma carta como item à venda."}
              </Text>
              {!search.trim() && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => router.push("/views/MyCardsView")}
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={styles.emptyButtonText}>Abrir minhas cartas</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
      />

      <CartModal
        visible={cartVisible}
        items={cartItems}
        total={cartTotal}
        onClose={() => setCartVisible(false)}
        onClear={() => CartService.clear()}
        onUpdateQuantity={(id, quantity) => CartService.updateQuantity(id, quantity)}
      />

      <Modal
        animationType="fade"
        transparent
        visible={quantityModalVisible}
        onRequestClose={() => setQuantityModalVisible(false)}
      >
        <Pressable
          style={[styles.quantityModalOverlay, { backgroundColor: colors.overlay }]}
          onPress={() => setQuantityModalVisible(false)}
        >
          <Pressable
            style={[styles.quantityModalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.quantityModalTitle, { color: colors.text }]}>Adicionar às minhas cartas</Text>
            <Text style={[styles.quantityModalSubtitle, { color: colors.mutedText }]}> 
              {selectedMyCard?.name || "Carta selecionada"}
            </Text>
            <Text style={[styles.quantityModalHint, { color: colors.mutedText }]}>Quantas cópias deseja adicionar?</Text>

            <TextInput
              keyboardType="number-pad"
              value={quantityToAdd}
              onChangeText={setQuantityToAdd}
              placeholder="1"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.quantityModalInput,
                {
                  borderColor: colors.border,
                  color: colors.text,
                  backgroundColor: colors.surfaceVariant,
                },
              ]}
            />

            {!!selectedMyCard && (
              <Text style={[styles.quantityModalFootnote, { color: colors.mutedText }]}>Atual: {MyCardsService.getQuantity(selectedMyCard.id)} cópia(s) na coleção.</Text>
            )}

            <View style={styles.quantityModalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setQuantityModalVisible(false)}
                style={[styles.quantityModalButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.quantityModalCancelText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={confirmAddMyCard}
                style={[styles.quantityModalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.quantityModalConfirmText}>Adicionar</Text>
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
  cartSummary: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartSummaryLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  cartSummaryText: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  cartButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cartButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  searchStatus: {
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },
  loadingContainer: {
    alignItems: "center",
    marginBottom: 10,
    marginTop: 4,
  },
  loadingGif: {
    width: 200,
    height: 200,
    marginBottom: 8,
    resizeMode: "contain",
  },
  searchError: {
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  quantityModalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  quantityModalCard: {
    borderRadius: 14,
    maxWidth: 420,
    padding: 18,
    width: "100%",
  },
  quantityModalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  quantityModalSubtitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  quantityModalHint: {
    fontSize: 13,
    marginTop: 16,
  },
  quantityModalInput: {
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quantityModalFootnote: {
    fontSize: 12,
    marginTop: 10,
  },
  quantityModalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 18,
  },
  quantityModalButton: {
    borderRadius: 10,
    minWidth: 110,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  quantityModalCancelText: {
    fontWeight: "800",
    textAlign: "center",
  },
  quantityModalConfirmText: {
    color: "#fff",
    fontWeight: "800",
    textAlign: "center",
  },
});
