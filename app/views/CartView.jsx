import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getProductImageSource } from "../../utils/productImage";
import { AuthGuard } from "../components/AuthGuard";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { CartService } from "../services/CartService";
import { OrderService } from "../services/OrderService";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function CartViewContent() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [items, setItems] = useState([]);
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState({
    method: "combine",
    address: "",
    notes: "",
  });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeCart = CartService.subscribe(setItems);

    return () => {
      unsubscribeAuth();
      unsubscribeCart();
    };
  }, []);

  const total = CartService.getTotal(items);
  const quantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const clearCart = () => {
    if (items.length === 0) return;

    Alert.alert("Limpar carrinho", "Remover todos os itens do seu carrinho?", [
      { text: "Cancelar", style: "cancel" },
      { text: "Limpar", style: "destructive", onPress: () => CartService.clear() },
    ]);
  };

  const updateCheckoutDraft = (field, value) => {
    setCheckoutDraft((current) => ({ ...current, [field]: value }));
  };

  const finishOrder = () => {
    if (items.length === 0) return;
    if (checkoutDraft.method === "delivery" && !checkoutDraft.address.trim()) {
      Alert.alert("Endereco", "Informe o endereco para entrega.");
      return;
    }

    Alert.alert(
      "Finalizar pedido",
      "Criar pedido para os vendedores dos itens selecionados?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Finalizar",
          onPress: async () => {
            try {
              const createdOrders = await OrderService.createFromCart(items, currentUser, checkoutDraft);
              CartService.clear();
              setCheckoutVisible(false);
              setCheckoutDraft({ method: "combine", address: "", notes: "" });
              Alert.alert(
                "Pedido criado",
                `${createdOrders.length} pedido(s) criado(s).`,
                [{ text: "Voltar para a loja", onPress: () => router.push("/views/HomeView") }]
              );
            } catch (error) {
              Alert.alert("Nao permitido", error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!!getProductImageSource(item) && <Image source={getProductImageSource(item)} style={styles.image} />}
      <View style={styles.info}>
        <Text numberOfLines={2} style={[styles.name, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedText }]}>
          {[item.set, item.seller?.name].filter(Boolean).join(" - ")}
        </Text>
        <Text style={[styles.price, { color: colors.primary }]}>
          {formatCurrency(item.unitPrice ?? item.price)}
        </Text>
      </View>
      <View style={styles.quantityBox}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => CartService.updateQuantity(item.id, item.quantity - 1)}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <MaterialIcons name="remove" size={18} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.quantity, { color: colors.text }]}>{item.quantity}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => CartService.updateQuantity(item.id, item.quantity + 1)}
          style={[styles.iconButton, { borderColor: colors.border }]}
        >
          <MaterialIcons name="add" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Carrinho" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.content, items.length === 0 && styles.emptyContent]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Seu carrinho</Text>
              <Text style={[styles.subtitle, { color: colors.mutedText }]}>
                {quantity} item(ns) selecionado(s)
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={clearCart}
              style={[styles.clearButton, { borderColor: colors.border }]}
            >
              <MaterialIcons name="delete-outline" size={18} color={colors.danger} />
              <Text style={[styles.clearText, { color: colors.danger }]}>Limpar</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="shopping-cart" size={36} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Carrinho vazio</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Adicione produtos dos anuncios para montar seu pedido.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/views/HomeView")}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Ver anuncios</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {items.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.totalLabel, { color: colors.mutedText }]}>Total</Text>
            <Text style={[styles.total, { color: colors.text }]}>{formatCurrency(total)}</Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCheckoutVisible(true)}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Finalizar</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal animationType="fade" onRequestClose={() => setCheckoutVisible(false)} transparent visible={checkoutVisible}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setCheckoutVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Finalizar pedido</Text>
            <Text style={[styles.modalText, { color: colors.mutedText }]}>
              Combine entrega ou retirada com o vendedor.
            </Text>

            <View style={styles.methodRow}>
              {[
                { label: "Combinar", value: "combine" },
                { label: "Entrega", value: "delivery" },
                { label: "Retirada", value: "pickup" },
              ].map((option) => {
                const selected = checkoutDraft.method === option.value;

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={option.value}
                    onPress={() => updateCheckoutDraft("method", option.value)}
                    style={[
                      styles.methodButton,
                      {
                        backgroundColor: selected ? colors.primary : colors.surfaceVariant,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.methodText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {checkoutDraft.method === "delivery" && (
              <TextInput
                multiline
                onChangeText={(value) => updateCheckoutDraft("address", value)}
                placeholder="Endereco para entrega"
                placeholderTextColor={colors.mutedText}
                style={[styles.modalInput, styles.multilineInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                textAlignVertical="top"
                value={checkoutDraft.address}
              />
            )}

            <TextInput
              multiline
              onChangeText={(value) => updateCheckoutDraft("notes", value)}
              placeholder="Observacoes para o vendedor"
              placeholderTextColor={colors.mutedText}
              style={[styles.modalInput, styles.multilineInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              textAlignVertical="top"
              value={checkoutDraft.notes}
            />

            <TouchableOpacity activeOpacity={0.85} onPress={finishOrder} style={[styles.modalPrimary, { backgroundColor: colors.primary }]}>
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Criar pedido</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function CartView() {
  return (
    <AuthGuard>
      <CartViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    alignSelf: "center",
    maxWidth: 900,
    padding: 14,
    paddingBottom: 110,
    width: "100%",
  },
  emptyContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 3,
  },
  clearButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  clearText: {
    fontSize: 12,
    fontWeight: "900",
  },
  item: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 10,
    padding: 10,
  },
  image: {
    borderRadius: 4,
    height: 80,
    resizeMode: "contain",
    width: 58,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: "900",
  },
  meta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 5,
  },
  quantityBox: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  quantity: {
    fontSize: 15,
    fontWeight: "900",
    minWidth: 20,
    textAlign: "center",
  },
  empty: {
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
    marginBottom: 16,
    marginTop: 6,
    textAlign: "center",
  },
  footer: {
    alignItems: "center",
    borderTopWidth: 1,
    bottom: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    left: 0,
    padding: 14,
    position: "absolute",
    right: 0,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  total: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 2,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: "900",
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
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  modalText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 12,
  },
  methodRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  methodButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 8,
  },
  methodText: {
    fontSize: 12,
    fontWeight: "900",
  },
  modalInput: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  multilineInput: {
    minHeight: 82,
    paddingTop: 10,
  },
  modalPrimary: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 46,
  },
});
