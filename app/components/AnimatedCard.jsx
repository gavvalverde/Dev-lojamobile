import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import {
    Animated,
    Image,
    Text as RNText,
    StyleSheet,
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
  onMyCardPress,
  isFavorite = false,
  isMyCard = false,
  formatCardCode,
  embedded = false,
  detailsLine,
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
        style={[
          styles.card,
          embedded && styles.embeddedCard,
          { width: cardWidth, backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <Image
          source={{ uri: item.images.small }}
          style={[styles.image, { height: cardHeight, backgroundColor: colors.surfaceVariant }]}
        />

        <View style={styles.actionStack}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isFavorite && { backgroundColor: colors.danger },
            ]}
            activeOpacity={0.85}
            onPress={(event) => {
              event.stopPropagation();
              onFavoritePress?.();
            }}
          >
            <MaterialCommunityIcons
              name={isFavorite ? "heart" : "heart-outline"}
              size={20}
              color={isFavorite ? colors.onPrimary : colors.danger}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isMyCard && { backgroundColor: colors.accent },
            ]}
            activeOpacity={0.85}
            onPress={(event) => {
              event.stopPropagation();
              onMyCardPress?.();
            }}
          >
            <MaterialCommunityIcons
              name={isMyCard ? "cards" : "cards-outline"}
              size={20}
              color={isMyCard ? colors.onAccent : colors.accent}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.cardInfo}>
          <RNText numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>
            {item.name}
          </RNText>
          <RNText style={[styles.cardCode, { color: colors.mutedText }]}>
            {formatCardCode(item)}
          </RNText>
          {!!detailsLine && (
            <RNText numberOfLines={1} style={[styles.cardDetails, { color: colors.mutedText }]}>
              {detailsLine}
            </RNText>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    elevation: 1,
  },
  embeddedCard: {
    borderRadius: 0,
    borderWidth: 0,
    elevation: 0,
  },
  image: { resizeMode: "contain", width: "100%" },
  actionStack: {
    position: "absolute",
    top: 8,
    right: 8,
    gap: 6,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { paddingHorizontal: 10, paddingVertical: 10 },
  cardName: { fontSize: 13, fontWeight: "900" },
  cardCode: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  cardDetails: { fontSize: 11, fontWeight: "700", marginTop: 2 },
});
