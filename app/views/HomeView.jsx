import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
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
      onFavoritePress={(card) => FavoritesService.toggleFavorite(card)}
      onMyCardPress={(card) => MyCardsService.toggleCard(card)}
      onPress={(card) => router.push(`/views/CardDetailsView?id=${card.id}`)}
      onAddToCart={(anuncio) => CartService.addItem(anuncio)}
    />
  );

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

      {/* Botão rápido para abrir conversas - integrado na página principal */}
      <View style={{ paddingHorizontal: 16, paddingVertical: 8 }}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/views/ChatsView")}
          style={[styles.cartButton, { backgroundColor: colors.primary }]}
        >
          <Text style={styles.cartButtonText}>Conversas com vendedores</Text>
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
              <Text style={[styles.searchStatus, { color: colors.mutedText }]}>Buscando na API...</Text>
            )}
            {!!searchError && (
              <Text style={[styles.searchError, { color: colors.danger }]}>{searchError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
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
});
