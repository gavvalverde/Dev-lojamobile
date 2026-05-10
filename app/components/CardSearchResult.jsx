import { StyleSheet, Text, TouchableOpacity, View, Modal, Pressable, TextInput } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { AuthService } from "../services/AuthService";
import { MyCardsService } from "../services/MyCardsService";
import { useAppTheme } from "../services/AppThemeContext";
import { AnimatedCard } from "./AnimatedCard";
import SellerBadge from "./SellerBadge";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CardSearchResult({
  result,
  index,
  cardWidth,
  cardHeight,
  formatCardCode,
  isFavorite,
  isMyCard,
  myCardQuantity = 0,
  onFavoritePress,
  onMyCardPress,
  onPress,
  onAddToCart,
  catalogView = false,
}) {
  const { card, anuncios } = result;
  const router = useRouter();
  const currentUser = AuthService.getCurrentUser();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [removingListing, setRemovingListing] = useState(null);
  const [editVisible, setEditVisible] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  return (
    <View style={[styles.item, { width: cardWidth }]}>
      <AnimatedCard
        item={card}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={isFavorite}
        isMyCard={isMyCard}
        myCardQuantity={myCardQuantity}
        onFavoritePress={() => onFavoritePress(card)}
        onMyCardPress={() => onMyCardPress(card)}
        favoriteDisabled={catalogView}
        hideAddButton={catalogView}
        showMyCardQuantity={!catalogView}
        onPress={() => onPress(card)}
      />

      <View style={[styles.offerPanel, { backgroundColor: colors.surface }]}>
        {anuncios.length > 0 ? (
          anuncios.map((anuncio) => {
            const isOwnListing = Boolean(
              anuncio.seller?.id && currentUser && String(anuncio.seller.id) === String(currentUser.id)
            );

            return (
              <View key={anuncio.listingId} style={styles.offer}>
                <SellerBadge seller={anuncio.seller} compact />
                <View style={styles.offerInfo}>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    {formatCurrency(anuncio.unitPrice)}
                  </Text>
                  <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedText }]}> 
                    {anuncio.idioma} - {anuncio.qualidade}
                  </Text>
                  <Text style={[styles.quantityOnSale, { color: colors.mutedText }]}> 
                    {String(anuncio.quantity ?? anuncio.qtd ?? 1)} à venda
                  </Text>
                </View>

                {isOwnListing ? (
                  <View style={styles.ownerButtons}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setEditingListing(anuncio);
                        setEditDraft({
                          price: anuncio.price ?? formatCurrency(anuncio.unitPrice),
                          quantidadeVenda: String(anuncio.quantity ?? 1),
                          idioma: anuncio.idioma ?? "Português",
                          qualidade: anuncio.qualidade ?? "NM",
                        });
                        setEditVisible(true);
                      }}
                      style={[styles.ownerButton, { backgroundColor: colors.surfaceVariant }]}
                    >
                      <Text style={[styles.ownerButtonText, { color: colors.text }]}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        setRemovingListing(anuncio);
                        setConfirmVisible(true);
                      }}
                      style={[styles.ownerButton, { backgroundColor: colors.secondary }]}
                    >
                      <Text style={[styles.ownerButtonText, { color: "#fff" }]}>Remover da venda</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  !catalogView && (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => onAddToCart(anuncio)}
                      style={[styles.buyButton, { backgroundColor: colors.primary }]}
                    >
                      <Text style={styles.buyButtonText}>Adicionar</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            );
          })
        ) : (
          <Text style={[styles.noOffer, { color: colors.mutedText }]}>Sem anuncios ativos</Text>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={confirmVisible}
        onRequestClose={() => setConfirmVisible(false)}
      >
        <Pressable style={[styles.confirmOverlay]} onPress={() => setConfirmVisible(false)}>
          <Pressable
            style={[styles.confirmCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Remover anúncio</Text>
            <Text style={[styles.confirmMessage, { color: colors.mutedText }]}>Tem certeza que deseja remover este anúncio da página de vendas?</Text>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.surfaceVariant }]}
                activeOpacity={0.85}
                onPress={() => {
                  setConfirmVisible(false);
                  setRemovingListing(null);
                }}
              >
                <Text style={[styles.confirmCancelText, { color: colors.text }]}>Não</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.secondary }]}
                activeOpacity={0.85}
                onPress={() => {
                  if (removingListing) {
                    MyCardsService.updateCard(removingListing.id, { aVenda: false, seller: null });
                  }
                  setConfirmVisible(false);
                  setRemovingListing(null);
                }}
              >
                <Text style={[styles.confirmRemoveText, { color: "#fff" }]}>Sim</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={editVisible}
        onRequestClose={() => setEditVisible(false)}
      >
        <Pressable style={[styles.confirmOverlay]} onPress={() => setEditVisible(false)}>
          <Pressable
            style={[styles.editCard, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.confirmTitle, { color: colors.text }]}>Editar anúncio</Text>
            <Text numberOfLines={1} style={[styles.confirmMessage, { color: colors.mutedText }]}>
              {editingListing?.name}
            </Text>

            <View style={{ marginTop: 8 }}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preço</Text>
              <TextInput
                value={String(editDraft?.price ?? "")}
                onChangeText={(value) => setEditDraft((d) => ({ ...d, price: value }))}
                keyboardType="numeric"
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedText, marginTop: 8 }]}>Quantidade disponível para venda</Text>
              <TextInput
                value={String(editDraft?.quantidadeVenda ?? "1")}
                onChangeText={(value) => setEditDraft((d) => ({ ...d, quantidadeVenda: String(value).replace(/\D/g, "") }))}
                keyboardType="numeric"
                placeholder="1"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedText, marginTop: 8 }]}>Idioma</Text>
              <TextInput
                value={String(editDraft?.idioma ?? "")}
                onChangeText={(value) => setEditDraft((d) => ({ ...d, idioma: value }))}
                placeholder="Idioma"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />

              <Text style={[styles.inputLabel, { color: colors.mutedText, marginTop: 8 }]}>Qualidade</Text>
              <TextInput
                value={String(editDraft?.qualidade ?? "")}
                onChangeText={(value) => setEditDraft((d) => ({ ...d, qualidade: value }))}
                placeholder="Qualidade"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
              />
            </View>

            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.surfaceVariant }]}
                activeOpacity={0.85}
                onPress={() => setEditVisible(false)}
              >
                <Text style={[styles.confirmCancelText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, { backgroundColor: colors.primary }]}
                activeOpacity={0.85}
                onPress={() => {
                  const priceText = String(editDraft?.price ?? "").replace(/\D/g, "");
                  if (!priceText || priceText === "0") {
                    alert("Por favor, insira um preço válido");
                    return;
                  }

                  const saleQuantity = Number(String(editDraft?.quantidadeVenda ?? "").replace(/\D/g, "")) || 0;
                  if (saleQuantity < 1) {
                    alert("Informe uma quantidade disponível para venda");
                    return;
                  }

                  if (editingListing) {
                    MyCardsService.updateCard(editingListing.id, {
                      price: editDraft.price,
                      idioma: editDraft.idioma,
                      qualidade: editDraft.qualidade,
                      aVenda: true,
                      quantity: saleQuantity,
                    });
                  }

                  setEditVisible(false);
                  setEditingListing(null);
                  setEditDraft(null);
                }}
              >
                <Text style={[styles.confirmRemoveText, { color: "#fff" }]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    marginBottom: 14,
  },
  offerPanel: {
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -6,
    padding: 10,
  },
  offer: {
    gap: 8,
  },
  offerInfo: {
    minHeight: 38,
  },
  price: {
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    fontSize: 12,
    marginTop: 2,
  },
  buyButton: {
    alignItems: "center",
    borderRadius: 8,
    paddingVertical: 10,
  },
  buyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  noOffer: {
    fontSize: 13,
    fontWeight: "700",
    minHeight: 42,
    textAlign: "center",
    textAlignVertical: "center",
  },
  quantityOnSale: {
    fontSize: 12,
    marginTop: 4,
  },
  ownerButtons: {
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-end",
  },
  ownerButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 120,
    alignItems: "center",
  },
  ownerButtonText: {
    fontWeight: "700",
  },
  confirmOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
  },
  confirmTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  confirmMessage: {
    fontSize: 14,
    marginBottom: 12,
  },
  confirmActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  confirmButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 100,
    alignItems: "center",
  },
  confirmCancelText: { fontWeight: "700" },
  confirmRemoveText: { fontWeight: "700" },
  editCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 12,
    padding: 16,
  },
  inputLabel: {
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
});
