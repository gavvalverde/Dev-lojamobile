import { useEffect, useRef } from "react";
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useAppTheme } from "../services/AppThemeContext";

const favA = require("../../assets/images/icons/favA.png");
const favB = require("../../assets/images/icons/favB.png");
const addA = require("../../assets/images/icons/addA.png");
const addB = require("../../assets/images/icons/addB.png");
const buyA = require("../../assets/images/icons/buyA.png");
const dellA = require("../../assets/images/icons/dellA.png");

export function AnimatedCard({
  item,
  index,
  cardWidth,
  cardHeight,
  onPress,
  onFavoritePress,
  onMyCardPress,
  onMyCardRemovePress,
  onSellPress,
  isFavorite = false,
  isMyCard = false,
  myCardQuantity = 0,
  formatCardCode,
  favoriteDisabled = false,
  hideAddButton = false,
  showMyCardQuantity = true,
}) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        delay: index * 40,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay: index * 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [index, opacity, translateY]);

  const myCardLabel = isMyCard
    ? myCardQuantity > 1
      ? `Minha x${myCardQuantity}`
      : "Minha"
    : "Minhas";

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        style={[styles.card, { width: cardWidth, backgroundColor: colors.surface }]}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={{ backgroundColor: "#fff", width: cardWidth, height: cardHeight, justifyContent: "center", alignItems: "center" }}>
          <Image
            source={{ uri: item.images.small }}
            style={{ width: "100%", height: "100%", resizeMode: "cover" }}
          />
        </View>

        {showMyCardQuantity && myCardQuantity > 1 && (
          <View style={[styles.quantityBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.quantityBadgeText}>{myCardQuantity}x</Text>
          </View>
        )}

        <View style={styles.actionStack}>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={favoriteDisabled ? 1 : 0.85}
            onPress={(event) => {
              event.stopPropagation();
              if (!favoriteDisabled) onFavoritePress?.();
            }}
          >
            <Image
              source={isFavorite ? favB : favA}
              style={styles.iconImage}
            />
          </TouchableOpacity>

          {!hideAddButton && (
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={(event) => {
                event.stopPropagation();
                onMyCardPress?.();
              }}
            >
              <Image
                source={isMyCard ? addB : addA}
                style={styles.iconImage}
              />
            </TouchableOpacity>
          )}

          {isMyCard && onSellPress && (
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={(event) => {
                event.stopPropagation();
                onSellPress?.();
              }}
            >
              <Image source={buyA} style={styles.iconImage} />
            </TouchableOpacity>
          )}

          {isMyCard && onMyCardRemovePress && (
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={(event) => {
                event.stopPropagation();
                onMyCardRemovePress?.();
              }}
            >
              <Image source={dellA} style={styles.iconImage} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[styles.cardCode, { color: colors.mutedText }]}>
            {formatCardCode(item)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 3,
  },
  image: { width: "100%" },
  quantityBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  quantityBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "800",
  },
  actionStack: {
    position: "absolute",
    top: 8,
    right: 8,
    gap: 6,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.9)",


  },
  iconImage: {
    width: "100%",
    height: "100%",
    resizeMode: "contain",
  },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "600" },
  cardCode: { fontSize: 11, marginTop: 2 },
});