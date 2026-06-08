import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../services/AppThemeContext";
import { AnimatedCard } from "./AnimatedCard";
import SellerBadge from "./SellerBadge";
import { getProductImageSource } from "../../utils/productImage";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function isSealedProduct(product) {
  return product?.productType === "sealed" || product?.cardType === "produto-selado";
}

export function CardSearchResult({
  result,
  index,
  cardWidth,
  cardHeight,
  formatCardCode,
  isFavorite,
  isMyCard,
  onFavoritePress,
  onMyCardPress,
  onPress,
  onAddToCart,
  onEditListing,
  onRemoveListing,
  onSellerPress,
  onNegotiate,
  onSaveListing,
  currentUser,
}) {
  const { card, anuncios } = result;
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const sealed = isSealedProduct(card);
  const sealedListing = sealed ? anuncios[0] : null;
  const primaryListing = anuncios[0];
  const cardDetailsLine = primaryListing
    ? [primaryListing.idioma, primaryListing.qualidade].filter(Boolean).join(" - ")
    : "";

  if (sealed) {
    const isOwnListing = !!currentUser?.id && sealedListing?.sellerId === currentUser.id;
    const sealedImageSource = getProductImageSource(card, "small");

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => onPress(card)}
        style={[styles.sealedCard, { backgroundColor: colors.surface, borderColor: colors.border, width: cardWidth }]}
      >
        <View style={[styles.sealedCardImageWrap, { backgroundColor: colors.surfaceVariant }]}>
          {sealedImageSource ? (
            <Image
              cachePolicy="disk"
              contentFit="cover"
              recyclingKey={String(card.id)}
              source={sealedImageSource}
              style={[styles.sealedCardImage, { height: cardHeight }]}
              transition={120}
            />
          ) : (
            <View style={[styles.sealedCardImage, styles.sealedImagePlaceholder, { height: cardHeight }]}>
              <MaterialCommunityIcons name="package-variant-closed" size={34} color={colors.mutedText} />
            </View>
          )}
          <View style={styles.actionStack}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={(event) => {
                event.stopPropagation();
                onFavoritePress(card);
              }}
              style={[
                styles.actionButton,
                { backgroundColor: colors.surface, borderColor: colors.border },
                isFavorite && { backgroundColor: colors.danger },
              ]}
            >
              <MaterialCommunityIcons
                name={isFavorite ? "heart" : "heart-outline"}
                size={20}
                color={isFavorite ? colors.onPrimary : colors.danger}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sealedCardBody}>
          <Text numberOfLines={2} style={[styles.sealedCardName, { color: colors.text }]}>
            {card.name}
          </Text>
          <Text style={[styles.meta, { color: colors.mutedText }]}>Produto lacrado</Text>

          {sealedListing ? (
            <View style={styles.sealedCardFooter}>
              <View style={styles.sealedPriceBlock}>
                <Text style={[styles.price, { color: colors.primary }]}>
                  {formatCurrency(sealedListing.unitPrice)}
                </Text>
                {!!sealedListing.estoque && (
                  <Text style={[styles.meta, { color: colors.mutedText }]}>{sealedListing.estoque} un.</Text>
                )}
              </View>

              {isOwnListing ? (
                <View style={styles.sealedOwnerActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onEditListing(sealedListing)}
                    style={[styles.iconActionButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.onPrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => onRemoveListing(sealedListing)}
                    style={[styles.iconActionButton, { borderColor: colors.border }]}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => onAddToCart(sealedListing)}
                  style={[styles.sealedBuyButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.buyButtonText, { color: colors.onPrimary }]}>Comprar</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={[styles.noOffer, { color: colors.mutedText }]}>Sem anuncios ativos</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.item, { width: cardWidth }]}>
      <View style={[styles.listingCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AnimatedCard
          item={card}
          index={index}
          cardWidth={cardWidth}
          cardHeight={cardHeight}
          embedded
          detailsLine={cardDetailsLine}
          formatCardCode={formatCardCode}
          isFavorite={isFavorite}
          isMyCard={isMyCard}
          onFavoritePress={() => onFavoritePress(card)}
          onMyCardPress={() => onMyCardPress(card)}
          onPress={() => onPress(card)}
        />

        <View style={styles.offerPanel}>
          {anuncios.length > 0 ? (
            anuncios.map((anuncio) => {
              const isOwnListing = !!currentUser?.id && anuncio.sellerId === currentUser.id;
              const saved = currentUser?.savedListingIds?.includes(anuncio.listingId);

              return (
                <View key={anuncio.listingId} style={styles.offer}>
                  <View style={styles.offerSellerRow}>
                    <SellerBadge
                      seller={anuncio.seller}
                      compact
                      onPress={anuncio.sellerId ? () => onSellerPress?.(anuncio) : undefined}
                    />
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>
                    {formatCurrency(anuncio.unitPrice)}
                  </Text>

                  {isOwnListing ? (
                    <View style={styles.ownerActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onEditListing(anuncio)}
                        style={[styles.ownerButton, { backgroundColor: colors.primary }]}
                      >
                        <Text style={[styles.buyButtonText, { color: colors.onPrimary }]}>Editar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onRemoveListing(anuncio)}
                        style={[
                          styles.ownerButton,
                          styles.removeButton,
                          { borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.removeButtonText, { color: colors.text }]}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.buyerActions}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onSaveListing?.(anuncio)}
                        style={[styles.iconActionButton, { borderColor: colors.border }]}
                      >
                        <MaterialCommunityIcons
                          name={saved ? "bookmark" : "bookmark-outline"}
                          size={18}
                          color={saved ? colors.primary : colors.text}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onNegotiate?.(anuncio)}
                        style={[styles.iconActionButton, { borderColor: colors.border }]}
                      >
                        <MaterialCommunityIcons name="message-text-outline" size={18} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => onAddToCart(anuncio)}
                        style={[styles.buyButton, { backgroundColor: colors.primary }]}
                      >
                        <Text style={[styles.buyButtonText, { color: colors.onPrimary }]}>Adicionar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={[styles.noOffer, { color: colors.mutedText }]}>Sem anuncios ativos</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    marginBottom: 18,
  },
  listingCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  sealedCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 18,
    overflow: "hidden",
  },
  sealedCardImageWrap: {
    position: "relative",
  },
  sealedCardImage: {
    resizeMode: "cover",
    width: "100%",
  },
  sealedImagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  actionStack: {
    gap: 6,
    position: "absolute",
    right: 8,
    top: 8,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  sealedCardBody: {
    padding: 10,
  },
  sealedCardName: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  sealedCardFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 9,
  },
  sealedPriceBlock: {
    flex: 1,
    minWidth: 0,
  },
  offerPanel: {
    padding: 10,
    paddingTop: 8,
  },
  sealedOffer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 36,
  },
  sealedOfferInfo: {
    flex: 1,
    minWidth: 0,
  },
  offer: {
    gap: 7,
  },
  offerSellerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  offerInfo: {
    minHeight: 38,
  },
  price: {
    fontSize: 16,
    fontWeight: "900",
  },
  meta: {
    fontSize: 11,
    fontWeight: "700",
  },
  buyButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  buyButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  ownerActions: {
    flexDirection: "row",
    gap: 8,
  },
  buyerActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  sealedOwnerActions: {
    flexDirection: "row",
    gap: 8,
  },
  sealedBuyButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  iconActionButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 36,
    justifyContent: "center",
    width: 38,
  },
  ownerButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
  },
  removeButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  removeButtonText: {
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
