import { useEffect, useState } from "react";
import {
    Animated,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export function AnimatedCard({
  item,
  index,
  cardWidth,
  cardHeight,
  onPress,
  onFavoritePress,
  isFavorite = false,
  formatCardCode,
}) {
  const opacity = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(20))[0];

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
  }, []);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
      }}
    >
      <TouchableOpacity
        style={[styles.card, { width: cardWidth }]}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <Image
          source={{ uri: item.images.small }}
          style={[styles.image, { height: cardHeight }]}
        />

        <TouchableOpacity
          style={[
            styles.favoriteButton,
            isFavorite && styles.favoriteButtonActive,
          ]}
          activeOpacity={0.85}
          onPress={(event) => {
            event.stopPropagation();
            onFavoritePress?.();
          }}
        >
          <Text
            style={[
              styles.favoriteText,
              isFavorite && styles.favoriteTextActive,
            ]}
          >
            {isFavorite ? "Salvo" : "Fav"}
          </Text>
        </TouchableOpacity>

        <View style={styles.cardInfo}>
          <Text numberOfLines={1} style={styles.cardName}>
            {item.name}
          </Text>
          <Text style={styles.cardCode}>
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
    backgroundColor: "#fff",
    elevation: 3,
  },
  image: { width: "100%" },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.92)",
    alignItems: "center",
  },
  favoriteButtonActive: {
    backgroundColor: "#ef5350",
  },
  favoriteText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ef5350",
  },
  favoriteTextActive: {
    color: "#fff",
  },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "600", color: "#333" },
  cardCode: { fontSize: 11, color: "#777", marginTop: 2 },
});
