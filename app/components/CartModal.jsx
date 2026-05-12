import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../services/AppThemeContext";
import SellerBadge from "./SellerBadge";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CartModal({
  visible,
  items,
  total,
  onClose,
  onClear,
  onUpdateQuantity,
  onRemoveItem,
}) {
  const { theme } = useAppTheme();
  const colors = theme.colors;

  const renderCartItem = ({ item }) => (
    <View style={[styles.cartItem, { borderBottomColor: colors.border }]}>
      {item.images?.small && (
        <Image source={{ uri: item.images.small }} style={styles.cartItemImage} />
      )}
      <View style={styles.cartItemInfo}>
        <SellerBadge seller={item.seller} compact />
        <Text numberOfLines={1} style={[styles.cartItemName, { color: colors.text }]}>
          {item.name}
        </Text>
        <Text style={[styles.cartItemPrice, { color: colors.mutedText }]}>
          {formatCurrency(item.unitPrice)} cada
        </Text>
        <Text style={[styles.cartItemSubtotal, { color: colors.text }]}>
          Subtotal: {formatCurrency(item.unitPrice * item.quantity)}
        </Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity
          accessibilityLabel="Diminuir quantidade"
          onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
          style={[styles.quantityButton, { backgroundColor: colors.surfaceVariant }]}
        >
          <Text style={[styles.quantityButtonText, { color: colors.text }]}>-</Text>
        </TouchableOpacity>
        <Text style={[styles.quantityText, { color: colors.text }]}>{item.quantity}</Text>
        <TouchableOpacity
          accessibilityLabel="Aumentar quantidade"
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          style={[styles.quantityButton, { backgroundColor: colors.surfaceVariant }]}
        >
          <Text style={[styles.quantityButtonText, { color: colors.text }]}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityLabel="Remover item"
          onPress={() => onRemoveItem(item.id)}
          style={[styles.removeButton, { backgroundColor: colors.error }]}
        >
          <Text style={styles.removeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Pressable style={[styles.cartModal, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>Carrinho</Text>

          <FlatList
            data={items}
            renderItem={renderCartItem}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <Text style={[styles.emptyCartText, { color: colors.mutedText }]}>
                Seu carrinho ainda esta vazio.
              </Text>
            }
          />

          <View style={[styles.cartFooter, { borderTopColor: colors.border }]}>
            <Text style={[styles.totalText, { color: colors.text }]}>Total: {formatCurrency(total)}</Text>
            <View style={styles.cartActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClear}
                style={[
                  styles.modalButton,
                  styles.clearButton,
                  { backgroundColor: colors.surfaceVariant },
                ]}
              >
                <Text style={[styles.clearButtonText, { color: colors.text }]}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onCheckout && onCheckout()}
                style={[styles.modalButton, styles.checkoutButton, { backgroundColor: colors.primary }]}
                disabled={items.length === 0}
              >
                <Text style={styles.checkoutButtonText}>Finalizar Compra</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={[styles.modalButton, styles.closeButton, { backgroundColor: colors.secondary }]}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  cartModal: {
    borderRadius: 8,
    maxHeight: "80%",
    maxWidth: 520,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  cartItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  cartItemImage: {
    width: 50,
    height: 70,
    borderRadius: 4,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 15,
    fontWeight: "700",
  },
  cartItemPrice: {
    fontSize: 12,
    marginTop: 2,
  },
  cartItemSubtotal: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
  },
  quantityControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  quantityButton: {
    alignItems: "center",
    borderRadius: 6,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: "800",
  },
  quantityText: {
    fontSize: 15,
    fontWeight: "800",
    minWidth: 20,
    textAlign: "center",
  },
  removeButton: {
    alignItems: "center",
    borderRadius: 6,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  removeButtonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
  },
  emptyCartText: {
    paddingVertical: 20,
    textAlign: "center",
  },
  cartFooter: {
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  totalText: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
    textAlign: "right",
  },
  cartActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  modalButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  clearButton: {
  },
  checkoutButton: {
  },
  closeButton: {
  },
  clearButtonText: {
    fontWeight: "800",
  },
  closeButton: {
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
