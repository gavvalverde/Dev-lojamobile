import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ProfileEditModal from "../components/ProfileEditModal";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";

function getInitials(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getPublicHandle(user) {
  if (user?.handle) return `@${user.handle}`;
  return `@${String(user?.name ?? "perfil").trim().toLowerCase().replace(/\s+/g, ".")}`;
}

export default function ProfileView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setUser);
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);

    return () => {
      unsubscribeAuth();
      unsubscribeFavorites();
      unsubscribeMyCards();
    };
  }, []);

  const profileStats = useMemo(() => {
    const saleCount = myCards.filter((item) => item.aVenda).length;
    return [
      { label: "Favoritas", value: favorites.length },
      { label: "Minhas", value: myCards.length },
      { label: "A venda", value: saleCount },
      { label: "Insignias", value: user?.badges?.length ?? 0 },
    ];
  }, [favorites.length, myCards, user?.badges?.length]);

  const handleEditProfile = async (updates) => {
    try {
      setLoading(true);
      const updatedUser = await UserService.updateProfile(user.id, updates);
      AuthService.setCurrentUser(updatedUser);
      FavoritesService.updateSellerProfile(updatedUser);
      MyCardsService.updateSellerProfile(updatedUser);
      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert("Perfil salvo", "Suas alteracoes ja aparecem no perfil.");
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        onPress: async () => {
          try {
            await AuthService.logout();
          } catch (error) {
            Alert.alert("Erro", "Falha ao sair: " + error.message);
          }
        },
        style: "destructive",
      },
    ]);
  };

  const showProfileCard = () => {
    Alert.alert(
      "Cartao publico",
      `${user.name}\n${getPublicHandle(user)}\n\n${user.bio || "Sem bio ainda."}`
    );
  };

  if (!user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const themeColor = user.themeColor || "#ffc94a";
  const badges = user.badges?.length ? user.badges : ["Novo perfil"];

  return (
    <>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Perfil" />
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.profileCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.cover, { backgroundColor: themeColor }]}>
              {user.coverPhoto && (
                <Image source={{ uri: user.coverPhoto }} style={styles.coverImage} />
              )}
              <View style={styles.coverShade} />
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setEditModalVisible(true)}
                style={styles.floatingEditButton}
              >
                <MaterialCommunityIcons name="pencil" size={18} color="#fff" />
                <Text style={styles.floatingEditText}>Editar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.profileBody}>
              <View style={[styles.avatar, { borderColor: themeColor }]}>
                {user.photo ? (
                  <Image source={{ uri: user.photo }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{getInitials(user.name) || "YD"}</Text>
                )}
              </View>

              <Text style={[styles.userName, { color: colors.text }]}>{user.name}</Text>
              <Text style={[styles.userHandle, { color: colors.mutedText }]}>{getPublicHandle(user)}</Text>

              <View style={styles.metaLine}>
                {!!user.pronouns && (
                  <Text style={[styles.metaText, { color: colors.mutedText }]}>{user.pronouns}</Text>
                )}
                {!!user.location && (
                  <Text style={[styles.metaText, { color: colors.mutedText }]}>{user.location}</Text>
                )}
              </View>

              <View style={[styles.statusPill, { borderColor: themeColor }]}>
                <View style={[styles.statusDot, { backgroundColor: themeColor }]} />
                <Text style={[styles.statusText, { color: colors.text }]}>
                  {user.status || "Montando minha coleção"}
                </Text>
              </View>

              <Text style={[styles.bio, { color: colors.text }, !user.bio && styles.emptyBio]}>
                {user.bio ||
                  "Escreva uma bio, escolha uma capa e deixe esse perfil com a sua cara."}
              </Text>

              <View style={styles.badges}>
                {badges.map((badge) => (
                  <View
                    key={badge}
                    style={[
                      styles.badge,
                      { backgroundColor: colors.surface, borderColor: themeColor },
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            {profileStats.map((stat) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedText }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Vitrine</Text>
            <View style={styles.showcaseRow}>
              <View style={[styles.showcaseIcon, { backgroundColor: themeColor }]}>
                <MaterialCommunityIcons name="cards" size={24} color="#fff" />
              </View>
              <View style={styles.showcaseTextBlock}>
                <Text style={[styles.showcaseLabel, { color: colors.mutedText }]}>Carta ou Pokemon favorito</Text>
                <Text style={[styles.showcaseValue, { color: colors.text }, !user.favoritePokemon && styles.emptyText]}>
                  {user.favoritePokemon || "Ainda não escolhido"}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.mutedText }]}>Contato e conta</Text>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email-outline" size={20} color={colors.mutedText} />
              <Text style={[styles.infoText, { color: colors.text }]}>{user.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={colors.mutedText} />
              <Text style={[styles.infoText, { color: colors.text }, !user.phone && styles.emptyText]}>
                {user.phone || "Telefone não informado"}
              </Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={() => setEditModalVisible(true)}
              style={[styles.primaryAction, { backgroundColor: themeColor }]}
            >
              <MaterialCommunityIcons name="account-edit" size={20} color="#fff" />
              <Text style={styles.primaryActionText}>Personalizar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={showProfileCard}
              style={[styles.secondaryAction, { backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="card-account-details-outline" size={20} color={colors.text} />
              <Text style={[styles.secondaryActionText, { color: colors.text }]}>Ver cartao</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={handleLogout}
              style={[styles.logoutAction, { backgroundColor: colors.surface }]}
            >
              <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      <Modal
        animationType="slide"
        onRequestClose={() => {
          if (!loading) setEditModalVisible(false);
        }}
        visible={editModalVisible}
      >
        <ProfileEditModal
          user={user}
          onSave={handleEditProfile}
          onCancel={() => setEditModalVisible(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 32,
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  profileCard: {
    borderRadius: 8,
    marginBottom: 12,
    overflow: "hidden",
  },
  cover: {
    height: 150,
    justifyContent: "flex-start",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  coverShade: {
    backgroundColor: "rgba(0,0,0,0.16)",
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  floatingEditButton: {
    alignItems: "center",
    alignSelf: "flex-end",
    backgroundColor: "rgba(0,0,0,0.42)",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    margin: 12,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  floatingEditText: {
    color: "#fff",
    fontWeight: "800",
  },
  profileBody: {
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 52,
    borderWidth: 4,
    height: 104,
    justifyContent: "center",
    marginTop: -52,
    overflow: "hidden",
    width: 104,
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarText: {
    color: "#fff",
    fontSize: 30,
    fontWeight: "900",
  },
  userName: {
    fontSize: 25,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  userHandle: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 2,
  },
  metaLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "700",
  },
  statusPill: {
    alignItems: "center",
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800",
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 14,
    maxWidth: 560,
    textAlign: "center",
  },
  emptyBio: {
    color: "#888",
    fontStyle: "italic",
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 14,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  statCard: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    paddingVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  section: {
    borderRadius: 8,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0,
    marginBottom: 12,
    textTransform: "uppercase",
  },
  showcaseRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  showcaseIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  showcaseTextBlock: {
    flex: 1,
  },
  showcaseLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  showcaseValue: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    minHeight: 34,
  },
  infoText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  emptyText: {
    color: "#999",
    fontStyle: "italic",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  primaryAction: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  primaryActionText: {
    color: "#fff",
    fontWeight: "900",
  },
  secondaryAction: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  secondaryActionText: {
    fontWeight: "900",
  },
  logoutAction: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 48,
    width: 52,
  },
});
