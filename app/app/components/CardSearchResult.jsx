import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AnimatedCard } from "./AnimatedCard";

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

      <View style={styles.offerPanel}>
        {anuncios.length > 0 ? (
          anuncios.map((anuncio) => (
            <View key={anuncio.id} style={styles.offer}>
              <View style={styles.offerInfo}>
                <Text style={styles.price}>
                  {formatCurrency(anuncio.unitPrice)}
                </Text>
                <Text numberOfLines={1} style={styles.meta}>
                  {anuncio.idioma} - {anuncio.qualidade}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => onAddToCart(anuncio)}
                style={styles.buyButton}
              >
                <Text style={styles.buyButtonText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          ))
        ) : (
          <Text style={styles.noOffer}>Sem anuncios ativos</Text>
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
    backgroundColor: "#fff",
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
    color: "#ef5350",
    fontSize: 16,
    fontWeight: "800",
  },
  meta: {
    color: "#666",
    fontSize: 12,
    marginTop: 2,
  },
  buyButton: {
    alignItems: "center",
    backgroundColor: "#ef5350",
    borderRadius: 8,
    paddingVertical: 10,
  },
  buyButtonText: {
    color: "#fff",
    fontWeight: "800",
  },
  noOffer: {
    color: "#777",
    fontSize: 13,
    fontWeight: "700",
    minHeight: 42,
    textAlign: "center",
    textAlignVertical: "center",
  },
});
