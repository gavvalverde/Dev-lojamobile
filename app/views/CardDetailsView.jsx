import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { AuthGuard } from "../components/AuthGuard";
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

function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function CardDetailsViewContent() {
  const { id } = useLocalSearchParams();
  const cardId = Array.isArray(id) ? id[0] : id;
  const [produto, setProduto] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribe = FavoritesService.subscribe(setFavorites);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!cardId) {
      setLoading(false);
      setError("ID do produto nao fornecido");
      return;
    }

    let active = true;

    async function fetchCard() {
      try {
        setLoading(true);
        setError(null);
        const produtoEntity = await PokemonService.fetchCardById(cardId);
        if (active) setProduto(produtoEntity);
      } catch (e) {
        console.error("Erro ao carregar produto:", e);
        if (active) setError(`Erro: ${e.message}`);
      } finally {
        if (active) setLoading(false);
      }
    }

    fetchCard();

    return () => {
      active = false;
    };
  }, [cardId]);

  const saleListings = useMemo(
    () => AnuncioService.getListingsForCardId(favorites, cardId),
    [cardId, favorites]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#ef5350" />
        <Text>Carregando detalhes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!produto) {
    return (
      <View style={styles.center}>
        <Text>Produto nao encontrado ou ID invalido.</Text>
      </View>
    );
  }

  return (
    <>
      <TopDropDownMenu title={produto.name ? `Detalhes - ${produto.name}` : "Detalhes da carta"} />
      <ScrollView style={styles.container}>
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="small" color="#ef5350" />
            </View>
          )}
          <Image
            source={{ uri: produto.images?.small || "https://via.placeholder.com/300" }}
            style={styles.image}
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />
        </View>

        <View style={styles.details}>
          <Text style={styles.name}>{produto.name}</Text>
          <Text style={styles.collectionNumber}>
            {produto.collectionNumber || "Posicao na colecao indisponivel"}
          </Text>
          <Text style={styles.set}>{produto.set || "Sem colecao"}</Text>
          <Text style={styles.rarity}>{produto.rarity || "Sem raridade"}</Text>

          <Text style={styles.pricesTitle}>Anuncios desta carta</Text>
          {saleListings.length > 0 ? (
            saleListings.map((listing) => (
              <View key={listing.id} style={styles.listingCard}>
                <View style={styles.listingInfo}>
                  <Text style={styles.listingPrice}>
                    {formatCurrency(parsePrice(listing.price))}
                  </Text>
                  <Text style={styles.listingMeta}>
                    {listing.idioma} - {listing.qualidade}
                  </Text>
                </View>

                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => CartService.addItem(listing)}
                  style={styles.buyButton}
                >
                  <Text style={styles.buyButtonText}>Adicionar</Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyListing}>
              <Text style={styles.emptyListingText}>
                Nenhum anuncio ativo para esta carta.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </>
  );
}

export default function CardDetailsView() {
  return (
    <AuthGuard>
      <CardDetailsViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: 300,
    resizeMode: "contain",
  },
  imageContainer: {
    position: "relative",
    height: 300,
  },
  imageLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f6fa",
  },
  details: {
    padding: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#222",
    marginBottom: 8,
  },
  set: {
    fontSize: 16,
    color: "#555",
    marginBottom: 4,
  },
  collectionNumber: {
    color: "#ef5350",
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  rarity: {
    fontSize: 16,
    color: "#777",
    marginBottom: 4,
  },
  pricesTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
    marginBottom: 10,
    marginTop: 8,
  },
  listingCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 8,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 12,
  },
  listingInfo: {
    flex: 1,
  },
  listingPrice: {
    color: "#ef5350",
    fontSize: 20,
    fontWeight: "800",
  },
  listingMeta: {
    color: "#666",
    fontSize: 13,
    marginTop: 3,
  },
  buyButton: {
    backgroundColor: "#ef5350",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  buyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  emptyListing: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
  },
  emptyListingText: {
    color: "#666",
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    color: "#d32f2f",
    textAlign: "center",
  },
});
