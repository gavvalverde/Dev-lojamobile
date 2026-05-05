import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

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
}) {
  const renderCartItem = ({ item }) => (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text numberOfLines={1} style={styles.cartItemName}>
          {item.name}
        </Text>
        <Text style={styles.cartItemPrice}>
          {formatCurrency(item.unitPrice)} cada
        </Text>
      </View>

      <View style={styles.quantityControls}>
        <TouchableOpacity
          accessibilityLabel="Diminuir quantidade"
          onPress={() => onUpdateQuantity(item.id, item.quantity - 1)}
          style={styles.quantityButton}
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.quantityText}>{item.quantity}</Text>
        <TouchableOpacity
          accessibilityLabel="Aumentar quantidade"
          onPress={() => onUpdateQuantity(item.id, item.quantity + 1)}
          style={styles.quantityButton}
        >
          <Text style={styles.quantityButtonText}>+</Text>
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
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.cartModal} onPress={(event) => event.stopPropagation()}>
          <Text style={styles.modalTitle}>Carrinho</Text>

          <FlatList
            data={items}
            renderItem={renderCartItem}
            keyExtractor={(item) => String(item.id)}
            ListEmptyComponent={
              <Text style={styles.emptyCartText}>
                Seu carrinho ainda esta vazio.
              </Text>
            }
          />

          <View style={styles.cartFooter}>
            <Text style={styles.totalText}>Total: {formatCurrency(total)}</Text>
            <View style={styles.cartActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClear}
                style={[styles.modalButton, styles.clearButton]}
              >
                <Text style={styles.clearButtonText}>Limpar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={onClose}
                style={[styles.modalButton, styles.closeButton]}
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
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  cartModal: {
    backgroundColor: "#fff",
    borderRadius: 8,
    maxHeight: "80%",
    maxWidth: 520,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    color: "#222",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
  },
  cartItem: {
    alignItems: "center",
    borderBottomColor: "#eee",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    color: "#222",
    fontSize: 15,
    fontWeight: "700",
  },
  cartItemPrice: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  quantityControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  quantityButton: {
    alignItems: "center",
    backgroundColor: "#eee",
    borderRadius: 6,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  quantityButtonText: {
    color: "#222",
    fontSize: 18,
    fontWeight: "800",
  },
  quantityText: {
    color: "#222",
    fontSize: 15,
    fontWeight: "800",
    minWidth: 20,
    textAlign: "center",
  },
  emptyCartText: {
    color: "#666",
    paddingVertical: 20,
    textAlign: "center",
  },
  cartFooter: {
    borderTopColor: "#eee",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 12,
  },
  totalText: {
    color: "#222",
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
    backgroundColor: "#eee",
  },
  clearButtonText: {
    color: "#333",
    fontWeight: "800",
  },
  closeButton: {
    backgroundColor: "#ef5350",
  },
  closeButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
});
