import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  onFavoritePress,
  onPress,
  onAddToCart,
}) {
  const { card, anuncios } = result;
  const { theme } = useAppTheme();
  const colors = theme.colors;

  return (
    <View style={[styles.item, { width: cardWidth }]}>
      <AnimatedCard
        item={card}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={isFavorite}
        onFavoritePress={() => onFavoritePress(card)}
        onPress={() => onPress(card)}
      />

      <View style={[styles.offerPanel, { backgroundColor: colors.surface }]}>
        {anuncios.length > 0 ? (
          anuncios.map((anuncio) => (
            <View key={anuncio.listingId} style={styles.offer}>
              <SellerBadge seller={anuncio.seller} compact />
              <View style={styles.offerInfo}>
                <Text style={[styles.price, { color: colors.primary }]}>
                  {formatCurrency(anuncio.unitPrice)}
                </Text>
                <Text numberOfLines={1} style={[styles.meta, { color: colors.mutedText }]}>
                  {anuncio.idioma} - {anuncio.qualidade}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onAddToCart(anuncio)}
                style={[styles.buyButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.buyButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={[styles.noOffer, { color: colors.mutedText }]}>Sem anuncios ativos</Text>
        )}
      </View>
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
});
