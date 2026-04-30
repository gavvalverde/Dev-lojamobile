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
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 3,
  },
  image: { width: "100%" },
  cardInfo: { padding: 8 },
  cardName: { fontSize: 13, fontWeight: "600", color: "#333" },
  cardCode: { fontSize: 11, color: "#777", marginTop: 2 },
});
