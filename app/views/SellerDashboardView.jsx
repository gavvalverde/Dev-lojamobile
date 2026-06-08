import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { AuthGuard } from "../components/AuthGuard";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { MyCardsService } from "../services/MyCardsService";
import { OrderService } from "../services/OrderService";
import { ReviewService } from "../services/ReviewService";
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

function isSealedProduct(item) {
  return item?.productType === "sealed" || item?.cardType === "produto-selado";
}

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function nextStatus(status) {
  if (status === "pending") return "accepted";
  if (status === "accepted") return "paid";
  if (status === "paid") return "shipped";
  if (status === "shipped") return "completed";
  return null;
}

function SellerDashboardContent() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [cards, setCards] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialTab = ["listings", "orders"].includes(tabParam) ? tabParam : "listings";
  const [panelMode, setPanelMode] = useState(initialTab);
  const [editingListing, setEditingListing] = useState(null);
  const [draft, setDraft] = useState({ price: "", estoque: "1" });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeCards = MyCardsService.subscribe((nextCards) => {
      setCards(nextCards);
      setLoaded(true);
    });
    const unsubscribeOrders = OrderService.subscribe(setOrders);
    const unsubscribeReviews = ReviewService.subscribe(setReviews);

    return () => {
      unsubscribeAuth();
      unsubscribeCards();
      unsubscribeOrders();
      unsubscribeReviews();
    };
  }, []);

  useEffect(() => {
    if (["listings", "orders"].includes(tabParam)) {
      setPanelMode(tabParam);
    }
  }, [tabParam]);

  const ownListings = useMemo(() => {
    return cards
      .filter((item) => {
        const isOwner = item.ownerId === currentUser?.id || item.userId === currentUser?.id;
        const hasListingData = item.aVenda || parsePrice(item.price) > 0;
        return isOwner && hasListingData && !isSealedProduct(item);
      })
      .sort((a, b) => Number(Boolean(b.aVenda)) - Number(Boolean(a.aVenda)));
  }, [cards, currentUser?.id]);

  const activeListings = ownListings.filter((item) => item.aVenda);
  const sellerOrders = orders.filter((order) =>
    order.sellerId === currentUser?.id ||
    (currentUser?.isAdmin && order.sellerId === "yellow-duck-store")
  );
  const filteredSellerOrders = sellerOrders
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const pendingOrders = sellerOrders.filter((order) => ["pending", "accepted", "paid"].includes(order.status));
  const completedTotal = sellerOrders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const sellerReviews = reviews.filter((review) => review.sellerId === currentUser?.id);
  const averageRating = sellerReviews.length
    ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length
    : 0;

  const openEditor = (listing) => {
    setEditingListing(listing);
    setDraft({
      price: String(listing.price ?? ""),
      estoque: String(listing.estoque ?? listing.stock ?? 1),
    });
  };

  const saveEditor = () => {
    const priceValue = parsePrice(draft.price);

    if (priceValue <= 0) {
      Alert.alert("Preco invalido", "Informe um preco maior que zero.");
      return;
    }

    MyCardsService.updateCard(editingListing.id, {
      price: draft.price,
      estoque: Number(draft.estoque) || 1,
      stock: Number(draft.estoque) || 1,
      aVenda: true,
    });
    setEditingListing(null);
  };

  const setListingActive = (listing, active) => {
    MyCardsService.updateCard(listing.id, { aVenda: active });
  };

  const confirmPause = (listing) => {
    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(`Pausar ${listing.name}?`) ?? true;
      if (confirmed) setListingActive(listing, false);
      return;
    }

    Alert.alert("Pausar anuncio", `Pausar ${listing.name}?`, [
      { text: "Voltar", style: "cancel" },
      { text: "Pausar", style: "destructive", onPress: () => setListingActive(listing, false) },
    ]);
  };

  const deleteListing = (listing) => {
    try {
      MyCardsService.deleteListing(listing.id);
    } catch (error) {
      Alert.alert("Anuncio", error.message || "Nao foi possivel excluir o anuncio.");
    }
  };

  const confirmDelete = (listing) => {
    const message = `Excluir o anuncio de ${listing.name}? A carta continuara na sua colecao.`;

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(message) ?? true;
      if (confirmed) deleteListing(listing);
      return;
    }

    Alert.alert("Excluir anuncio", message, [
      { text: "Voltar", style: "cancel" },
      {
        text: "Excluir anuncio",
        style: "destructive",
        onPress: () => deleteListing(listing),
      },
    ]);
  };

  const renderListing = ({ item }) => {
    const active = !!item.aVenda;

    return (
      <View style={[styles.listingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {!!getProductImageSource(item) && <Image source={getProductImageSource(item)} style={styles.listingImage} />}
        <View style={styles.listingInfo}>
          <Text numberOfLines={2} style={[styles.listingName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text numberOfLines={1} style={[styles.listingMeta, { color: colors.mutedText }]}>
            {[isSealedProduct(item) ? "Selado" : item.set, item.qualidade].filter(Boolean).join(" - ")}
          </Text>
          <Text style={[styles.listingPrice, { color: colors.primary }]}>
            {formatCurrency(parsePrice(item.price))}
          </Text>
          <Text style={[styles.stockText, { color: colors.mutedText }]}>
            Estoque: {item.estoque ?? item.stock ?? 1}
          </Text>
        </View>
        <View style={styles.itemActions}>
          <View style={[styles.statusPill, { borderColor: active ? colors.primary : colors.border }]}>
            <Text style={[styles.statusText, { color: active ? colors.primary : colors.mutedText }]}>
              {active ? "Ativo" : "Pausado"}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openEditor(item)}
            style={[styles.iconButton, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="pencil" size={18} color={colors.onPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => (active ? confirmPause(item) : setListingActive(item, true))}
            style={[styles.iconButton, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons
              name={active ? "pause" : "play"}
              size={18}
              color={active ? colors.danger : colors.primary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => confirmDelete(item)}
            style={[styles.iconButton, { borderColor: colors.danger }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const updateOrderStatus = async (order, status) => {
    try {
      await OrderService.updateStatus(order.id, status, currentUser);
    } catch (error) {
      Alert.alert("Pedido", error.message || "Nao foi possivel atualizar o pedido.");
    }
  };

  const confirmCancelOrder = (order) => {
    const message = `Cancelar o pedido #${String(order.id).slice(-6).toUpperCase()}?`;

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(message) ?? true;
      if (confirmed) updateOrderStatus(order, "canceled");
      return;
    }

    Alert.alert("Cancelar pedido", message, [
      { text: "Voltar", style: "cancel" },
      { text: "Cancelar pedido", style: "destructive", onPress: () => updateOrderStatus(order, "canceled") },
    ]);
  };

  const renderOrder = ({ item }) => {
    const actionStatus = nextStatus(item.status);
    const canCancel = !["completed", "canceled"].includes(item.status);

    return (
      <View style={[styles.orderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.orderHeader}>
          <View style={styles.orderInfo}>
            <Text style={[styles.listingName, { color: colors.text }]}>
              Pedido #{String(item.id).slice(-6).toUpperCase()}
            </Text>
            <Text style={[styles.listingMeta, { color: colors.mutedText }]}>
              {formatDate(item.createdAt)} - {item.buyer?.name || "Cliente"}
            </Text>
          </View>
          <View style={[styles.statusPill, { borderColor: colors.border }]}>
            <Text style={[styles.statusText, { color: colors.primary }]}>
              {OrderService.statusLabels[item.status] ?? item.status}
            </Text>
          </View>
        </View>

        {item.items.map((orderItem) => (
          <View key={orderItem.id} style={styles.orderItem}>
            {!!getProductImageSource(orderItem) && <Image source={getProductImageSource(orderItem)} style={styles.orderImage} />}
            <View style={styles.orderInfo}>
              <Text numberOfLines={2} style={[styles.orderItemName, { color: colors.text }]}>{orderItem.name}</Text>
              <Text style={[styles.listingMeta, { color: colors.mutedText }]}>
                {orderItem.quantity} x {formatCurrency(orderItem.unitPrice)}
              </Text>
            </View>
          </View>
        ))}

        <View style={[styles.orderFooter, { borderTopColor: colors.border }]}>
          <Text style={[styles.orderTotal, { color: colors.text }]}>Total: {formatCurrency(item.total)}</Text>
          <View style={styles.orderActions}>
            {actionStatus && item.status !== "canceled" && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => updateOrderStatus(item, actionStatus)}
                style={[styles.orderAction, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.orderActionText, { color: colors.onPrimary }]}>
                  {OrderService.statusLabels[actionStatus]}
                </Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => confirmCancelOrder(item)}
                style={[styles.orderAction, { borderColor: colors.danger }]}
              >
                <Text style={[styles.orderActionText, { color: colors.danger }]}>Cancelar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  if (!loaded) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu showBack={false} title="Painel vendedor" />
        <View style={styles.centerState}>
          <LoadingDuck label="Carregando painel..." />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu showBack={false} title="Painel vendedor" />
      <FlatList
        data={panelMode === "listings" ? ownListings : filteredSellerOrders}
        keyExtractor={(item) => item.id}
        renderItem={panelMode === "listings" ? renderListing : renderOrder}
        contentContainerStyle={[
          styles.content,
          (
            panelMode === "listings" ? ownListings.length === 0 : filteredSellerOrders.length === 0
          ) && styles.emptyContent,
        ]}
        ListHeaderComponent={
          <View>
            <View style={[styles.summary, { backgroundColor: colors.secondary }]}>
              <View style={styles.summaryTextBlock}>
                <Text style={[styles.summaryTitle, { color: colors.onPrimary }]}>Painel vendedor</Text>
                <Text style={[styles.summaryText, { color: colors.accent }]}>
                  Controle anuncios, estoque e pedidos recebidos.
                </Text>
              </View>
              <MaterialCommunityIcons name="storefront" size={42} color={colors.accent} />
            </View>

            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{activeListings.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedText }]}>Ativos</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{pendingOrders.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedText }]}>Pedidos abertos</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, styles.statMoney, { color: colors.text }]}>
                  {formatCurrency(completedTotal)}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedText }]}>Concluido</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {averageRating ? averageRating.toFixed(1) : "-"}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedText }]}>Avaliacao</Text>
              </View>
            </View>

            <View style={styles.panelTabs}>
              {[
                { label: "Anuncios", value: "listings" },
                { label: "Vendas", value: "orders" },
              ].map((option) => {
                const selected = panelMode === option.value;

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={option.value}
                    onPress={() => setPanelMode(option.value)}
                    style={[
                      styles.panelTab,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.panelTabText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {panelMode === "listings" ? (
              <>
              <View style={styles.quickActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => router.push("/views/InsertProductView")}
                style={[styles.quickAction, { backgroundColor: colors.primary }]}
              >
                <MaterialCommunityIcons name="package-variant-plus" size={18} color={colors.onPrimary} />
                <Text style={[styles.quickActionText, { color: colors.onPrimary }]}>Novo selado</Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Meus anuncios</Text>
              </>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  Pedidos recebidos
                </Text>
              </>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name={panelMode === "listings" ? "storefront-outline" : "receipt-text-outline"} size={42} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {panelMode === "listings" ? "Nenhum anuncio ainda" : "Nenhum pedido recebido"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              {panelMode === "listings"
                ? "Marque cartas como item a venda para criar seus anuncios."
                : "Os pedidos recebidos aparecerao aqui."}
            </Text>
          </View>
        }
      />

      <Modal animationType="fade" onRequestClose={() => setEditingListing(null)} transparent visible={!!editingListing}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setEditingListing(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text numberOfLines={1} style={[styles.modalTitle, { color: colors.text }]}>
                Editar anuncio
              </Text>
              <TouchableOpacity activeOpacity={0.75} onPress={() => setEditingListing(null)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preco</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={(value) => setDraft((current) => ({ ...current, price: value }))}
              placeholder="Preco"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              value={draft.price}
            />

            <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Estoque</Text>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(value) => setDraft((current) => ({ ...current, estoque: value }))}
              placeholder="Estoque"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              value={draft.estoque}
            />

            <TouchableOpacity activeOpacity={0.85} onPress={saveEditor} style={[styles.saveButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>Salvar anuncio</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function SellerDashboardView() {
  return (
    <AuthGuard>
      <SellerDashboardContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: 980,
    padding: 14,
    paddingBottom: 96,
    width: "100%",
  },
  emptyContent: {
    flexGrow: 1,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  summary: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 18,
  },
  summaryTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  summaryTitle: {
    fontSize: 25,
    fontWeight: "900",
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statCard: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minWidth: 126,
    minHeight: 76,
    justifyContent: "center",
    padding: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  statMoney: {
    fontSize: 16,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 4,
    textTransform: "uppercase",
  },
  quickActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  panelTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  panelTab: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 42,
  },
  panelTabText: {
    fontSize: 14,
    fontWeight: "900",
  },
  quickAction: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  quickActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryAction: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  secondaryActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  listingCard: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    padding: 10,
  },
  listingImage: {
    borderRadius: 4,
    height: 76,
    resizeMode: "contain",
    width: 58,
  },
  listingInfo: {
    flex: 1,
    minWidth: 0,
  },
  listingName: {
    fontSize: 15,
    fontWeight: "900",
  },
  listingMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  listingPrice: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 4,
  },
  stockText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  itemActions: {
    alignItems: "center",
    gap: 7,
  },
  statusPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 42,
  },
  orderCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 10,
  },
  orderHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  orderInfo: {
    flex: 1,
    minWidth: 0,
  },
  orderItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  orderImage: {
    borderRadius: 4,
    height: 48,
    resizeMode: "contain",
    width: 42,
  },
  orderItemName: {
    fontSize: 13,
    fontWeight: "900",
  },
  orderFooter: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
  },
  orderTotal: {
    fontSize: 14,
    fontWeight: "900",
  },
  orderActions: {
    flexDirection: "row",
    gap: 6,
  },
  orderAction: {
    alignItems: "center",
    borderRadius: 7,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 9,
  },
  orderActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 8,
    maxWidth: 420,
    padding: 16,
    width: "100%",
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  closeButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 46,
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    fontWeight: "900",
  },
});
