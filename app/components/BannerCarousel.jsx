import {
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  View,
} from "react-native";

const { width } = Dimensions.get("window"); // 👈 adicionar

const banners = [
  { id: "1", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL1JdzAASsNEgSKbz0ObmUVusExibwP02jeQ&s" },
  { id: "2", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL1JdzAASsNEgSKbz0ObmUVusExibwP02jeQ&s" },
  { id: "3", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL1JdzAASsNEgSKbz0ObmUVusExibwP02jeQ&s" },
  { id: "4", image: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRL1JdzAASsNEgSKbz0ObmUVusExibwP02jeQ&s" },
];

export function BannerCarousel({ spacing = 16 }) { // 👈 valor padrão opcional
  const renderBanner = ({ item }) => (
    <View style={styles.banner}>
      <Image source={{ uri: item.image }} style={styles.bannerImage} />
    </View>
  );

  return (
    <FlatList
      data={banners}
      horizontal
      showsHorizontalScrollIndicator={false}
      renderItem={renderBanner}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ paddingHorizontal: spacing }}
    />
  );
}

const styles = StyleSheet.create({
  banner: {
    width: 400 , // 👈 responsivo (70% da tela)
    height: 200 , // 👈 mantém proporção
    marginRight: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  bannerImage: { width: "100%", height: "100%" },
});