import { useLocalSearchParams, useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AuthGuard } from "../components/AuthGuard";
import LoadingDuck from "../components/LoadingDuck";
import SellerBadge from "../components/SellerBadge";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AnuncioService } from "../services/AnuncioService";
import { AuthService } from "../services/AuthService";
import { CartService } from "../services/CartService";
import { ChatService } from "../services/ChatService";
import { MyCardsService } from "../services/MyCardsService";
import { OrderService } from "../services/OrderService";
import { PokemonService } from "../services/PokemonService";
import { ReviewService } from "../services/ReviewService";
import { StoreProductService } from "../services/StoreProductService";
import { useAppTheme } from "../services/AppThemeContext";
import { getProductImageSource } from "../../utils/productImage";

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

function isSealedProduct(product) {
  return product?.productType === "sealed" || product?.cardType === "produto-selado";
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function CardDetailsViewContent() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const cardId = Array.isArray(id) ? id[0] : id;
  const [produto, setProduto] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [productReviewDraft, setProductReviewDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribe = MyCardsService.subscribe(setMyCards);
    const unsubscribeStoreProducts = StoreProductService.subscribe(setStoreProducts);
    const unsubscribeOrders = OrderService.subscribe(setOrders);
    const unsubscribeReviews = ReviewService.subscribe(setReviews);
    return () => {
      unsubscribeAuth();
      unsubscribe();
      unsubscribeStoreProducts();
      unsubscribeOrders();
      unsubscribeReviews();
    };
  }, []);

  const saleListings = useMemo(
    () => AnuncioService.getListingsForCardId([...storeProducts, ...myCards], cardId),
    [cardId, myCards, storeProducts]
  );

  const localCard = useMemo(() => {
    return [...storeProducts, ...myCards].find((card) => (
      card.cardId === String(cardId) ||
      card.id === String(cardId) ||
      card.listingId === String(cardId)
    )) ?? saleListings[0] ?? null;
  }, [cardId, myCards, saleListings, storeProducts]);

  const productReviews = useMemo(
    () => reviews.filter((review) => review.productId === String(cardId)),
    [cardId, reviews]
  );
  const productReviewAverage = useMemo(() => {
    if (productReviews.length === 0) return 0;

    return productReviews.reduce((sum, review) => sum + review.rating, 0) / productReviews.length;
  }, [productReviews]);
  const completedProductOrder = useMemo(() => {
    if (!currentUser?.id || !cardId) return null;

    return orders.find((order) =>
      order.buyerId === currentUser.id &&
      order.status === "completed" &&
      order.items.some((item) => String(item.cardId ?? item.id) === String(cardId)) &&
      !reviews.some((review) => review.orderId === order.id && review.productId === String(cardId))
    ) ?? null;
  }, [cardId, currentUser?.id, orders, reviews]);

  useEffect(() => {
    if (!cardId) {
      setLoading(false);
      setError("ID do produto nao fornecido");
      return;
    }

    let active = true;

    async function fetchCard() {
      try {
        if (localCard) {
          setProduto(localCard);
          setLoading(false);
          setError(null);
          return;
        }

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
  }, [cardId, localCard]);

  const negotiateListing = (listing) => {
    try {
      const conversation = ChatService.startConversation({
        currentUser,
        otherUser: listing.seller,
        listing,
      });

      router.push(`/views/ChatView?conversationId=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      console.error("Erro ao iniciar conversa:", error);
    }
  };

  const addToCart = (listing) => {
    try {
      CartService.addItem(listing, currentUser);
      Alert.alert("Carrinho", "Produto adicionado ao carrinho.");
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const saveProductReview = async () => {
    try {
      await ReviewService.createForProduct(produto, currentUser, productReviewDraft, completedProductOrder);
      setProductReviewDraft("");
      Alert.alert("Avaliacao", "Sua avaliacao foi salva.");
    } catch (error) {
      Alert.alert("Avaliacao", error.message);
    }
  };

  const renderStars = (rating, size = 16) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <MaterialCommunityIcons
          key={star}
          name={star <= Math.round(rating) ? "star" : "star-outline"}
          size={size}
          color={colors.accent}
        />
      ))}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LoadingDuck label="Carregando detalhes..." />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
      </View>
    );
  }

  if (!produto) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Produto nao encontrado ou ID invalido.</Text>
      </View>
    );
  }

  const sealed = isSealedProduct(produto);
  const description = produto.descricao || produto.description;
  const sealedListing = saleListings[0];

  return (
    <>
      <TopDropDownMenu title={produto.name ? `Detalhes - ${produto.name}` : "Detalhes"} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoader}>
              <LoadingDuck size={42} />
            </View>
          )}
          <Image
            source={getProductImageSource(produto, "large") || { uri: "https://via.placeholder.com/300" }}
            style={styles.image}
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />
        </View>

        <View style={styles.details}>
          <Text style={[styles.name, { color: colors.text }]}>{produto.name}</Text>
          <Text style={[styles.collectionNumber, { color: colors.primary }]}>
            {sealed ? "Produto selado" : produto.collectionNumber || "Posicao na colecao indisponivel"}
          </Text>
          <Text style={[styles.set, { color: colors.mutedText }]}>{produto.set || "Sem categoria"}</Text>
          <Text style={[styles.rarity, { color: colors.mutedText }]}>{produto.rarity || "Sem raridade"}</Text>
          {!!description && <Text style={[styles.description, { color: colors.text }]}>{description}</Text>}

          {sealed ? (
            <View style={styles.sealedActions}>
              {sealedListing ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => addToCart(sealedListing)}
                  style={[styles.sealedBuyButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.sealedBuyText, { color: colors.onPrimary }]}>
                    Comprar por {formatCurrency(parsePrice(sealedListing.price))}
                  </Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.emptyListing, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.emptyListingText, { color: colors.mutedText }]}>
                    Produto indisponivel no momento.
                  </Text>
                </View>
              )}

              <View style={[styles.productReviewsSection, { borderColor: colors.border }]}>
                <View style={styles.productReviewsHeader}>
                  <View style={styles.productReviewsTitleRow}>
                    <MaterialCommunityIcons name="star" size={17} color={colors.primary} />
                    <Text style={[styles.productReviewsTitle, { color: colors.text }]}>Avaliacoes dos usuarios</Text>
                  </View>
                </View>

                <View style={styles.productReviewsSummary}>
                  <Text style={[styles.productReviewsScore, { color: colors.primary }]}>
                    {productReviews.length > 0 ? productReviewAverage.toFixed(1).replace(".", ",") : "0"}
                  </Text>
                  <View style={styles.productReviewsScoreMeta}>
                    <Text style={[styles.productReviewsCount, { color: colors.text }]}>
                      ({productReviews.length} avaliacao{productReviews.length === 1 ? "" : "es"})
                    </Text>
                    {renderStars(productReviewAverage || 0, 15)}
                  </View>
                </View>

                <View style={styles.productReviewBox}>
                {completedProductOrder ? (
                  <>
                    <TextInput
                      onChangeText={setProductReviewDraft}
                      placeholder="Como foi o produto?"
                      placeholderTextColor={colors.mutedText}
                      style={[
                        styles.productReviewInput,
                        { color: colors.text },
                      ]}
                      value={productReviewDraft}
                    />
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={saveProductReview}
                      style={[styles.reviewSaveButton, { backgroundColor: colors.primary }]}
                    >
                      <Text style={[styles.buyButtonText, { color: colors.onPrimary }]}>Enviar</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={[styles.reviewLockedText, { color: colors.mutedText }]}>
                    Avaliacoes ficam disponiveis apos a compra concluida.
                  </Text>
                )}

                {productReviews.length > 0 && (
                  <View style={styles.productReviewsList}>
                    {productReviews.slice(0, 3).map((review) => (
                      <View key={review.id} style={[styles.productReviewItem, { borderColor: colors.border }]}>
                        <View style={styles.productReviewItemHeader}>
                          <Text style={[styles.productReviewAuthor, { color: colors.text }]}>
                            {review.buyerName || "Usuario"}
                          </Text>
                          {renderStars(review.rating, 14)}
                        </View>
                        <Text style={[styles.productReviewDate, { color: colors.mutedText }]}>
                          Avaliado em {formatDate(review.createdAt)}
                        </Text>
                        <Text style={[styles.productReviewComment, { color: colors.text }]}>
                          {review.comment}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
                </View>
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.pricesTitle, { color: colors.text }]}>Anuncios desta carta</Text>
              {saleListings.length > 0 ? (
            saleListings.map((listing) => (
              <View key={listing.listingId} style={[styles.listingCard, { backgroundColor: colors.surface }]}>
                <View style={styles.listingInfo}>
                  <SellerBadge seller={listing.seller} />
                  <Text style={[styles.listingPrice, { color: colors.primary }]}>
                    {formatCurrency(parsePrice(listing.price))}
                  </Text>
                  <Text style={[styles.listingMeta, { color: colors.mutedText }]}>
                    {[listing.idioma, listing.qualidade].filter(Boolean).join(" - ")}
                  </Text>
                </View>

                <View style={styles.listingActions}>
                  {listing.sellerId !== currentUser?.id && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => negotiateListing(listing)}
                      style={[styles.secondaryButton, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Conversar</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => addToCart(listing)}
                    style={[styles.buyButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={[styles.buyButtonText, { color: colors.onPrimary }]}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
              ) : (
            <View style={[styles.emptyListing, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyListingText, { color: colors.mutedText }]}>
                Nenhum anuncio ativo para este produto.
              </Text>
            </View>
              )}
            </>
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
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  image: {
    height: 300,
    resizeMode: "contain",
    width: "100%",
  },
  imageContainer: {
    height: 300,
    position: "relative",
  },
  imageLoader: {
    alignItems: "center",
    bottom: 0,
    justifyContent: "center",
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  details: {
    padding: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 8,
  },
  set: {
    fontSize: 16,
    marginBottom: 4,
  },
  collectionNumber: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  rarity: {
    fontSize: 16,
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
    marginTop: 8,
  },
  pricesTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 8,
  },
  listingCard: {
    alignItems: "center",
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
    fontSize: 20,
    fontWeight: "800",
  },
  listingMeta: {
    fontSize: 13,
    marginTop: 3,
  },
  buyButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  listingActions: {
    gap: 8,
  },
  sealedActions: {
    gap: 14,
    marginTop: 14,
  },
  sealedBuyButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  sealedBuyText: {
    fontSize: 15,
    fontWeight: "900",
  },
  productReviewsSection: {
    borderTopWidth: 1,
    gap: 14,
    paddingTop: 16,
  },
  productReviewsHeader: {
    gap: 8,
  },
  productReviewsTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  productReviewsTitle: {
    fontSize: 14,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  productReviewsSummary: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
  },
  productReviewsScore: {
    fontSize: 48,
    fontWeight: "900",
    lineHeight: 52,
  },
  productReviewsScoreMeta: {
    gap: 5,
  },
  productReviewsCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  productReviewBox: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  productReviewInput: {
    flex: 1,
    minHeight: 40,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  reviewSaveButton: {
    alignItems: "center",
    borderRadius: 8,
    alignSelf: "flex-start",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  reviewLockedText: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  productReviewsList: {
    flexBasis: "100%",
    gap: 14,
    marginTop: 4,
  },
  productReviewItem: {
    borderTopWidth: 1,
    gap: 6,
    paddingTop: 14,
  },
  productReviewItemHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  productReviewAuthor: {
    fontSize: 13,
    fontWeight: "900",
  },
  productReviewDate: {
    fontSize: 11,
    fontWeight: "700",
  },
  productReviewComment: {
    fontSize: 14,
    lineHeight: 21,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  secondaryButtonText: {
    fontWeight: "800",
  },
  buyButtonText: {
    fontWeight: "800",
  },
  emptyListing: {
    borderRadius: 8,
    padding: 14,
  },
  emptyListingText: {
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
});
