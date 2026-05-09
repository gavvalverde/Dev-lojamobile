import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import { AuthGuard } from "../components/AuthGuard";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";

function FavoritesViewContent() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [favorites, setFavorites] = useState([]);
  const [, setMyCards] = useState([]);

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  useEffect(() => {
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);

    return () => {
      unsubscribeFavorites();
      unsubscribeMyCards();
    };
  }, []);

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
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
        onFavoritePress={() => FavoritesService.toggleFavorite(item)}
        onMyCardPress={() => MyCardsService.toggleCard(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
      />
    </View>
  );

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
              Toque em Favorito nas cartas do catálogo para montar sua lista.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/views/HomeView")}
              style={[styles.catalogButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.catalogButtonText}>Ver catálogo</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  screen: {
    flex: 1,
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
    marginBottom: 16,
    textAlign: "center",
  },
  catalogButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catalogButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  favoriteItem: {
    marginBottom: 12,
  },
});
