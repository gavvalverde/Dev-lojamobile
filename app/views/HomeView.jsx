import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import { BannerCarousel } from "../components/BannerCarousel";
import { PokemonService } from "../services/PokemonService";

export default function HomeView() {
  const { width } = useWindowDimensions();
  const router = useRouter();

  const numColumns = Math.max(
    2,
    width > 900 ? 4 : width > 600 ? 3 : 2
  );

  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  const [cards, setCards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showLoadMore, setShowLoadMore] = useState(false);

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async () => {
    try {
      const produtos = await PokemonService.fetchCards(30, 1);
      setCards(produtos);
      setFilteredCards(produtos);
    } catch (e) {
      console.error('Erro ao carregar cartas:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCardsByName = async (name) => {
    try {
      setLoading(true);
      const produtos = await PokemonService.searchCardsByName(name);
      setFilteredCards(produtos);
    } catch (e) {
      console.error('Erro ao buscar cartas:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (!search.trim()) {
        setFilteredCards(cards);
      } else {
        fetchCardsByName(search);
      }
    }, 400);

    return () => clearTimeout(delay);
  }, [search]);

  const loadMore = async () => {
    if (loadingMore) return;

    setLoadingMore(true);
    const nextPage = page + 1;

    try {
      const novosProdutos = await PokemonService.fetchCards(30, nextPage);
      const newCards = [...cards, ...novosProdutos];

      setCards(newCards);
      if (!search.trim()) setFilteredCards(newCards);

      setPage(nextPage);
    } catch (e) {
      console.error('Erro ao carregar mais:', e);
    } finally {
      setLoadingMore(false);
      setShowLoadMore(false);
    }
  };

  const formatCardCode = (item) => {
    const number = item.id?.toString().padStart(2, "0") || "00";
    const total = item.set || "??";
    return `${number}/${total}`;
  };

  const renderCard = ({ item, index }) => (
    <AnimatedCard
      item={item}
      index={index}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      formatCardCode={formatCardCode}
      onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
    />
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text style={{ marginTop: 10 }}>Carregando cartas...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Minha Loja Pokémon</Text>
      </View>

      <FlatList
        key={numColumns}
        data={filteredCards}
        renderItem={renderCard}
        keyExtractor={(item) => item.key}
        numColumns={numColumns}
        contentContainerStyle={{ padding: spacing }}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        onEndReached={() => setShowLoadMore(true)}
        onEndReachedThreshold={0.2}
        ListHeaderComponent={
          <View>
            <TextInput
              placeholder="Buscar Pokémon (ex: pikachu)"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />

            <BannerCarousel spacing={spacing} />

            <Text style={styles.sectionTitle}>Catálogo</Text>
          </View>
        }
        ListFooterComponent={
          showLoadMore && !search.trim() && (
            <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
              {loadingMore ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loadMoreText}>Ver mais</Text>
              )}
            </TouchableOpacity>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f5f6fa" },
  header: { padding: 16, backgroundColor: "#fff", elevation: 4 },
  headerText: { fontSize: 22, fontWeight: "bold", color: "#222" },
  searchInput: {
    backgroundColor: "#fff",
    marginBottom: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginVertical: 10,
    marginLeft: 4,
    color: "#333",
  },
  loadMoreButton: {
    backgroundColor: "#ef5350",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    marginVertical: 20,
  },
  loadMoreText: { color: "#fff", fontWeight: "bold" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
