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
        <Image
          source={{ uri: item.images.small }}
          style={[styles.image, { height: cardHeight }]}
        />

        <TouchableOpacity
          style={[
            styles.favoriteButton,
            { backgroundColor: colors.surface },
            isFavorite && { backgroundColor: colors.primary },
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
              { color: colors.primary },
              isFavorite && styles.favoriteTextActive,
            ]}
          >
            {isFavorite ? "Salvo" : "Fav"}
          </Text>
        </TouchableOpacity>

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
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  favoriteText: {
    fontSize: 11,
    fontWeight: "700",
  },
  favoriteTextActive: {
    color: "#fff",
  },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "600" },
  cardCode: { fontSize: 11, marginTop: 2 },
});
