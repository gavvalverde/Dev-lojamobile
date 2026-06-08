import { Image, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../services/AppThemeContext";

const loadingDuck = require("../../assets/images/loading-duck.gif");

export default function LoadingDuck({ label, size = 96, compact = false }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <Image
        accessibilityIgnoresInvertColors
        resizeMode="contain"
        source={loadingDuck}
        style={{ height: size, width: size }}
      />
      {!!label && (
        <Text style={[styles.label, compact && styles.compactLabel, { color: colors.mutedText }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
  },
  compact: {
    flexDirection: "row",
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  compactLabel: {
    fontSize: 12,
  },
});
