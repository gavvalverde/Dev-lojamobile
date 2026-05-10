import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Image,
    ScrollView,
  Alert,
  Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { AuthGuard } from "../components/AuthGuard";
import SellerBadge from "../components/SellerBadge";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AnuncioService } from "../services/AnuncioService";
import { CartService } from "../services/CartService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";
import { ChatService } from "../services/ChatService";
import { useAppTheme } from "../services/AppThemeContext";

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
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const cardId = Array.isArray(id) ? id[0] : id;
  const [produto, setProduto] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [imageLoading, setImageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddedModal, setShowAddedModal] = useState(false);
  const [modalListing, setModalListing] = useState(null);

  useEffect(() => {
    const unsubscribe = MyCardsService.subscribe(setMyCards);
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!cardId) {
      setLoading(false);
      setError("ID do produto não fornecido");
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
    () => AnuncioService.getListingsForCardId(myCards, cardId),
    [cardId, myCards]
  );

  function resolveSellerName(seller) {
    if (seller?.name) return seller.name;
    if (seller?.handle) return `@${seller.handle}`;
    return "Vendedor";
  }

  function handleTalk(listing) {
    const sellerName = resolveSellerName(listing.seller);
    const existing = ChatService.getAll().find((c) => c.seller === sellerName);
    const chat = existing || ChatService.createChat(sellerName);

    // adiciona a mensagem padrão e abre a tela de chat
    const initial = "Olá essa carta ainda esta disponivel. Tenho interesse.";
    ChatService.addMessage(chat.id, { from: "user", text: initial });

    router.push(`/views/ChatDetailView?id=${chat.id}`);
  }

  function handleAdd(listing) {
    CartService.addItem(listing);
    setModalListing(listing);
    setShowAddedModal(true);
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ color: colors.text }}>Carregando detalhes...</Text>
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
        <Text style={{ color: colors.text }}>Produto não encontrado ou ID inválido.</Text>
      </View>
    );
  }

  return (
    <>
      <TopDropDownMenu title={produto.name ? `Detalhes - ${produto.name}` : "Detalhes da carta"} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.imageContainer}>
          {imageLoading && (
            <View style={styles.imageLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
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
          <Text style={[styles.name, { color: colors.text }]}>{produto.name}</Text>
          <Text style={[styles.collectionNumber, { color: colors.primary }]}>
            {produto.collectionNumber || "Posição na coleção indisponivel"}
          </Text>
          <Text style={[styles.set, { color: colors.mutedText }]}>{produto.set || "Sem coleção"}</Text>
          <Text style={[styles.rarity, { color: colors.mutedText }]}>{produto.rarity || "Sem raridade"}</Text>

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
                    {listing.idioma} - {listing.qualidade}
                  </Text>
                </View>

                <View style={styles.buttonsContainer}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleAdd(listing)}
                    style={[styles.buyButton, { backgroundColor: colors.primary }]}
                  >
                    <Text style={styles.buyButtonText}>Adicionar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => handleTalk(listing)}
                    style={[styles.talkButton, { borderColor: colors.primary }]}
                  >
                    <Text style={[styles.talkButtonText, { color: colors.primary }]}>Falar com vendedor</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={[styles.emptyListing, { backgroundColor: colors.surface }]}>
              <Text style={[styles.emptyListingText, { color: colors.mutedText }]}>
                Nenhum anuncio ativo para esta carta.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal visible={showAddedModal} transparent animationType="fade" onRequestClose={() => setShowAddedModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Adicionado ao carrinho</Text>
            <Text style={[styles.modalMessage, { color: colors.mutedText }]}>Produto adicionado ao carrinho com sucesso.</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalButton, { backgroundColor: colors.border }]} onPress={() => setShowAddedModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.text }]}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  buyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  buttonsContainer: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 8,
  },
  talkButton: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  talkButtonText: { fontWeight: "800" },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    borderRadius: 12,
    padding: 18,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 6 },
  modalMessage: { fontSize: 14, marginBottom: 12 },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalButton: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8 },
  modalButtonText: { color: "#fff", fontWeight: "700" },
  modalCancelText: { fontWeight: "700" },
});
