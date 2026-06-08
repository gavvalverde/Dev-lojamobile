import { useRouter } from "expo-router";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAppTheme } from "../services/AppThemeContext";

function getInitials(name) {
  return String(name ?? "YD")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getSellerName(seller) {
  if (seller?.name) return seller.name;
  if (seller?.handle) return `@${seller.handle}`;
  return "Yellow Duck TCG";
}

export default function SellerBadge({ seller, compact = false, onPress }) {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const avatarSize = compact ? 28 : 36;
  const sellerName = getSellerName(seller);
  const avatarColor = seller?.themeColor || colors.accent;
  const handlePress = onPress ?? (
    seller?.id ? () => router.push(`/views/ProfileView?userId=${encodeURIComponent(seller.id)}`) : null
  );
  const Container = handlePress ? TouchableOpacity : View;

  const containerProps = handlePress
    ? { activeOpacity: 0.75, onPress: handlePress, style: styles.container }
    : { style: styles.container };

  return (
    <Container {...containerProps}>
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: avatarColor,
            height: avatarSize,
            width: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        {seller?.photo ? (
          <Image source={{ uri: seller.photo }} style={styles.avatarImage} />
        ) : (
          <Text style={[styles.avatarText, { color: colors.onAccent }]}>
            {getInitials(sellerName)}
          </Text>
        )}
      </View>

      <View style={styles.textBlock}>
        {!compact && (
          <Text style={[styles.label, { color: colors.mutedText }]}>Anunciado por</Text>
        )}
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {sellerName}
        </Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 1,
    gap: 8,
    minWidth: 0,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarText: {
    fontSize: 11,
    fontWeight: "900",
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
  },
  name: {
    fontSize: 13,
    fontWeight: "900",
  },
});
