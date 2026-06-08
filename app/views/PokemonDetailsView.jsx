import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";
import { useAppTheme } from "../services/AppThemeContext";

function formatCardCode(item) {
  return item.collectionNumber || item.id;
}

function formatNumber(value, suffix) {
  if (!value) return "Indisponivel";
  return `${String(value).replace(".", ",")} ${suffix}`;
}

export default function PokemonDetailsView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const name = Array.isArray(params.name) ? params.name[0] : params.name;
  const spacing = 12;
  const contentMaxWidth = Math.min(width, 1180);
  const gridWidth = contentMaxWidth - spacing * 2;
  const numColumns = Math.max(2, gridWidth > 980 ? 5 : gridWidth > 760 ? 4 : gridWidth > 520 ? 3 : 2);
  const cardWidth = (gridWidth - spacing * (numColumns - 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;
  const [pokemon, setPokemon] = useState(null);
  const [cards, setCards] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);

    return () => {
      unsubscribeAuth();
      unsubscribeFavorites();
      unsubscribeMyCards();
    };
  }, []);

  useEffect(() => {
    if (!name) return;

    let active = true;
    setLoading(true);
    setError("");

    Promise.all([
      PokemonService.fetchPokemonProfile(name),
      PokemonService.searchCardsByName(name),
    ])
      .then(([nextPokemon, nextCards]) => {
        if (!active) return;
        setPokemon(nextPokemon);
        setCards(nextCards);
        if (!nextPokemon) setError("Pokemon nao encontrado.");
      })
      .catch((err) => {
        console.error("Erro ao carregar Pokemon:", err);
        if (active) setError("Nao foi possivel carregar esse Pokemon agora.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [name]);

  const favoriteCardIds = useMemo(
    () => new Set(favorites.map((item) => String(item.cardId ?? item.id))),
    [favorites]
  );
  const myCardIds = useMemo(
    () => new Set(
      myCards
        .filter((item) => item.ownerId === currentUser?.id || item.userId === currentUser?.id)
        .map((item) => String(item.cardId ?? item.id))
    ),
    [currentUser?.id, myCards]
  );
  const extraData = useMemo(
    () => `${[...favoriteCardIds].sort().join("|")}:${[...myCardIds].sort().join("|")}`,
    [favoriteCardIds, myCardIds]
  );

  const renderCard = ({ item, index }) => (
    <View style={{ width: cardWidth }}>
      <AnimatedCard
        item={item}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={favoriteCardIds.has(String(item.id))}
        isMyCard={myCardIds.has(String(item.id))}
        onFavoritePress={() => FavoritesService.toggleFavorite(item)}
        onMyCardPress={() => MyCardsService.toggleCard(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu />
        <View style={styles.center}>
          <LoadingDuck label="Carregando Pokemon..." size={154} />
        </View>
      </View>
    );
  }

  if (error || !pokemon) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu />
        <View style={styles.center}>
          <MaterialCommunityIcons name="pokeball" size={44} color={colors.mutedText} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{error || "Pokemon nao encontrado."}</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.backButtonText, { color: colors.onPrimary }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu />
      <FlatList
        key={`pokemon-cards-${numColumns}`}
        data={cards}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        extraData={extraData}
        numColumns={numColumns}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        contentContainerStyle={[styles.content, { padding: spacing }]}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity activeOpacity={0.75} onPress={() => router.back()} style={styles.iconButton}>
                <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
              </TouchableOpacity>
              <View style={[styles.heroImageWrap, { backgroundColor: colors.surfaceVariant }]}>
                {pokemon.image ? (
                  <Image source={{ uri: pokemon.image }} style={styles.heroImage} />
                ) : (
                  <MaterialCommunityIcons name="pokeball" size={54} color={colors.mutedText} />
                )}
              </View>
              <View style={styles.heroText}>
                <Text style={[styles.dexNumber, { color: colors.mutedText }]}>#{String(pokemon.id).padStart(4, "0")}</Text>
                <Text style={[styles.title, { color: colors.text }]}>{pokemon.name}</Text>
                <View style={styles.typeRow}>
                  {pokemon.types.map((type) => (
                    <View key={type} style={[styles.typePill, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.typeText, { color: colors.onPrimary }]}>{type}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedText }]}>Altura</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatNumber(pokemon.height, "m")}</Text>
              </View>
              <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.infoLabel, { color: colors.mutedText }]}>Peso</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatNumber(pokemon.weight, "kg")}</Text>
              </View>
            </View>

            {!!pokemon.description && (
              <Text style={[styles.description, { color: colors.text }]}>{pokemon.description}</Text>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Cartas de {pokemon.name}</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma carta encontrada</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Tente buscar pelo nome do Pokemon na pagina principal.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 18,
  },
  content: {
    alignSelf: "center",
    maxWidth: 1180,
    paddingBottom: 96,
    width: "100%",
  },
  hero: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
    padding: 12,
  },
  iconButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  heroImageWrap: {
    alignItems: "center",
    borderRadius: 8,
    height: 116,
    justifyContent: "center",
    overflow: "hidden",
    width: 116,
  },
  heroImage: {
    height: "100%",
    resizeMode: "contain",
    width: "100%",
  },
  heroText: {
    flex: 1,
    minWidth: 0,
  },
  dexNumber: {
    fontSize: 13,
    fontWeight: "900",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 2,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  typePill: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  infoGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  infoCard: {
    borderRadius: 8,
    flex: 1,
    padding: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  infoValue: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    padding: 22,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  backButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    fontWeight: "900",
  },
});
