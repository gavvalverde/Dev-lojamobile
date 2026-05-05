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
import { PokemonService } from "../services/PokemonService";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default function HomeView() {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  const [favorites, setFavorites] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [search, setSearch] = useState("");
  const [apiCards, setApiCards] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [cartVisible, setCartVisible] = useState(false);

  useEffect(() => {
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeCart = CartService.subscribe(setCartItems);

    return () => {
      unsubscribeFavorites();
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
          setSearchError("Nao foi possivel buscar cartas agora.");
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
      return AnuncioService.buildSearchResults(apiCards, favorites);
    }

    return AnuncioService.buildCatalogResults(favorites);
  }, [apiCards, favorites, search]);

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
      onFavoritePress={(card) => FavoritesService.toggleFavorite(card)}
      onPress={(card) => router.push(`/views/CardDetailsView?id=${card.id}`)}
      onAddToCart={(anuncio) => CartService.addItem(anuncio)}
    />
  );

  return (
    <View style={styles.screen}>
      <TopDropDownMenu title="Minha Loja Pokemon" />

      <View style={styles.cartSummary}>
        <View>
          <Text style={styles.cartSummaryLabel}>Carrinho</Text>
          <Text style={styles.cartSummaryText}>
            {cartQuantity} item(ns) - {formatCurrency(cartTotal)}
          </Text>
        </View>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setCartVisible(true)}
          style={styles.cartButton}
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
              placeholder="Buscar qualquer carta ou Pokemon"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />

            <Text style={styles.sectionTitle}>
              {search.trim() ? "Cartas encontradas" : "Cartas a venda"}
            </Text>
            {searchLoading && (
              <Text style={styles.searchStatus}>Buscando na API...</Text>
            )}
            {!!searchError && (
              <Text style={styles.searchError}>{searchError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {search.trim() ? "Nenhuma carta encontrada" : "Nenhuma carta a venda"}
            </Text>
            <Text style={styles.emptyText}>
              {search.trim()
                ? "Tente buscar por outro nome de carta ou Pokemon."
                : "Va em Favoritos, toque em Editar e marque uma carta como item a venda."}
            </Text>
            {!search.trim() && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/views/FavoritesView")}
                style={styles.emptyButton}
              >
                <Text style={styles.emptyButtonText}>Abrir favoritos</Text>
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
    backgroundColor: "#fff",
    borderTopColor: "#eee",
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cartSummaryLabel: {
    color: "#666",
    fontSize: 12,
    fontWeight: "700",
  },
  cartSummaryText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "700",
    marginTop: 2,
  },
  cartButton: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  cartButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  searchInput: {
    backgroundColor: "#fff",
    borderColor: "#ddd",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  sectionTitle: {
    color: "#333",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 4,
  },
  searchStatus: {
    color: "#666",
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },
  searchError: {
    color: "#d32f2f",
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
    color: "#222",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    color: "#666",
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyButton: {
    backgroundColor: "#ef5350",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
