import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import LoadingDuck from "../components/LoadingDuck";
import ProfileEditModal from "../components/ProfileEditModal";
import { AuthService } from "../services/AuthService";
import { ChatService } from "../services/ChatService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";
import { ProfilePostService } from "../services/ProfilePostService";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";
import {
  buildProfileColors,
  getPublicHandle,
  normalizeProfilePanelOrder,
} from "../../utils/profile";

function getInitials(name) {
  return String(name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function formatPostTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getCardCode(card) {
  return card?.collectionNumber || card?.id || "";
}

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  let cents = Number(digits || "0");

  if (digits.length <= 2) {
    cents = cents * 100;
  }

  return formatCurrency(cents / 100);
}

function postSortDate(post, profileUserId) {
  if (post.reposts?.includes(profileUserId) && post.userId !== profileUserId) {
    return new Date(post.updatedAt);
  }

  return new Date(post.createdAt);
}

const wantedQualityOptions = ["NM", "LP", "MP", "HP", "DMG"];
const wantedTypeOptions = ["Comum", "Foil", "Reverse foil", "Holo", "Promocional"];

function cardBelongsToUser(card, userId) {
  if (!userId) return false;
  return card.owner?.id === userId || card.seller?.id === userId;
}

function getCardImage(card) {
  return card?.images?.small || card?.image || card?.imageUrl || null;
}

function useProfileSubscriptions() {
  const [sessionUser, setSessionUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setSessionUser);
    const unsubscribeUsers = UserService.subscribe(setUsers);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);
    const unsubscribePosts = ProfilePostService.subscribe(setPosts);

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
      unsubscribeMyCards();
      unsubscribePosts();
    };
  }, []);

  return {
    myCards,
    posts,
    sessionUser,
    setSessionUser,
    users,
  };
}

function useWantedCardSearch(postMode, cardName) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const clearSearch = () => {
      setResults([]);
      setError("");
      setLoading(false);
    };

    if (postMode !== "wanted") {
      clearSearch();
      return;
    }

    const term = cardName.trim();
    if (!term) {
      clearSearch();
      return;
    }

    let active = true;
    setLoading(true);
    setError("");

    const timeout = setTimeout(async () => {
      try {
        const cards = await PokemonService.searchCards(term);
        if (active) setResults(cards.slice(0, 20));
      } catch (searchError) {
        console.error("Erro ao buscar carta procurada:", searchError);
        if (active) {
          setResults([]);
          setError("Nao foi possivel buscar cartas agora.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 450);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [cardName, postMode]);

  return {
    clearResults: () => setResults([]),
    error,
    loading,
    results,
  };
}

function useProfileData({ myCards, posts, user, users }) {
  const profileSaleCards = useMemo(() => {
    if (!user?.id) return [];
    return myCards.filter((item) => item.aVenda && cardBelongsToUser(item, user.id));
  }, [myCards, user?.id]);

  const profileCards = useMemo(() => {
    if (!user?.id) return [];
    return myCards.filter((item) => cardBelongsToUser(item, user.id));
  }, [myCards, user?.id]);

  const profileShowcaseCards = useMemo(() => {
    const selectedIds = Array.isArray(user?.showcaseCardIds) ? user.showcaseCardIds : [];
    const cardsById = new Map(profileCards.map((card) => [card.id, card]));

    return selectedIds.map((id) => cardsById.get(id)).filter(Boolean);
  }, [profileCards, user?.showcaseCardIds]);

  const profilePosts = useMemo(() => {
    if (!user?.id) return [];
    return posts
      .filter((post) => post.userId === user.id || post.reposts?.includes(user.id))
      .sort((a, b) => postSortDate(b, user.id) - postSortDate(a, user.id));
  }, [posts, user?.id]);

  const wantedPosts = useMemo(
    () => profilePosts.filter((post) => post.type === "wanted"),
    [profilePosts]
  );

  const profileStats = useMemo(() => {
    const wantedCount = wantedPosts.length;
    const followersCount = users.filter((item) => item.followingIds?.includes(user?.id)).length;

    return [
      { id: "followers", label: "Seguidores", value: followersCount },
      { id: "following", label: "Seguindo", value: user?.followingIds?.length ?? 0 },
      { id: "sale", label: "A venda", value: profileSaleCards.length },
      { id: "wanted", label: "Procurando", value: wantedCount },
    ];
  }, [profileSaleCards.length, user?.followingIds?.length, user?.id, users, wantedPosts.length]);

  const followerUsers = useMemo(() => {
    if (!user?.id) return [];
    return users.filter((item) => item.followingIds?.includes(user.id));
  }, [user?.id, users]);

  const followingUsers = useMemo(() => {
    const followingIds = Array.isArray(user?.followingIds) ? user.followingIds : [];
    return followingIds
      .map((id) => users.find((item) => item.id === id))
      .filter(Boolean);
  }, [user?.followingIds, users]);

  return {
    followerUsers,
    followingUsers,
    profileCards,
    profilePosts,
    profileSaleCards,
    profileShowcaseCards,
    profileStats,
    wantedPosts,
  };
}

export default function ProfileView() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const isDesktop = width >= 900;
  const viewedUserId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const {
    myCards,
    posts,
    sessionUser,
    setSessionUser,
    users,
  } = useProfileSubscriptions();
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showcaseEditorVisible, setShowcaseEditorVisible] = useState(false);
  const [showcaseDraftIds, setShowcaseDraftIds] = useState([]);
  const [statsModal, setStatsModal] = useState(null);
  const [postMode, setPostMode] = useState("post");
  const [postDraft, setPostDraft] = useState({
    text: "",
    cardName: "",
    offer: "",
    minQuality: "NM",
    cardType: "Comum",
    image: null,
  });
  const {
    clearResults: clearWantedSearchResults,
    error: wantedSearchError,
    loading: wantedSearchLoading,
    results: wantedSearchResults,
  } = useWantedCardSearch(postMode, postDraft.cardName);

  const user = useMemo(() => {
    if (!viewedUserId || viewedUserId === sessionUser?.id) return sessionUser;
    return users.find((item) => item.id === viewedUserId) ?? null;
  }, [sessionUser, users, viewedUserId]);

  const isPublicProfile = !!viewedUserId && viewedUserId !== sessionUser?.id;
  const {
    followerUsers,
    followingUsers,
    profileCards,
    profilePosts,
    profileSaleCards,
    profileShowcaseCards,
    profileStats,
    wantedPosts,
  } = useProfileData({ myCards, posts, user, users });

  const handleEditProfile = async (updates) => {
    try {
      setLoading(true);
      const updatedUser = await UserService.updateProfile(user.id, updates);
      await AuthService.setCurrentUser(updatedUser);
      FavoritesService.updateSellerProfile(updatedUser);
      MyCardsService.updateSellerProfile(updatedUser);
      ProfilePostService.updateAuthorProfile(updatedUser);
      await ChatService.updateParticipantProfile(updatedUser);
      setSessionUser(updatedUser);
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

  const openOwnProfile = () => {
    router.replace("/views/ProfileView");
  };

  const negotiateWithUser = () => {
    try {
      const conversation = ChatService.startConversation({
        currentUser: sessionUser,
        otherUser: user,
      });

      router.push(`/views/ChatView?conversationId=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const syncSessionUser = (updatedUser) => {
    void AuthService.setCurrentUser(updatedUser);
    setSessionUser(updatedUser);
  };

  const toggleFollowProfile = async () => {
    try {
      const updatedUser = await UserService.toggleFollow(sessionUser?.id, user?.id);
      syncSessionUser(updatedUser);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const toggleFollowUser = async (targetUserId) => {
    try {
      const updatedUser = await UserService.toggleFollow(sessionUser?.id, targetUserId);
      syncSessionUser(updatedUser);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const openProfile = (profileId) => {
    setStatsModal(null);

    if (!profileId || profileId === sessionUser?.id) {
      router.replace("/views/ProfileView");
      return;
    }

    router.push(`/views/ProfileView?userId=${encodeURIComponent(profileId)}`);
  };

  const updatePostDraft = (field, value) => {
    setPostDraft((current) => ({ ...current, [field]: value }));
  };

  const pickPostImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.82,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        const base64 = await UserService.convertImageToBase64(result.assets[0].uri);
        updatePostDraft("image", base64);
      }
    } catch (error) {
      Alert.alert("Erro", "Falha ao selecionar imagem: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const publishPost = async () => {
    try {
      setLoading(true);
      ProfilePostService.createPost(sessionUser, {
        ...postDraft,
        type: postMode,
      });
      const updatedUser = await UserService.awardExperience(sessionUser?.id, postMode === "wanted" ? 18 : 12);
      if (updatedUser) syncSessionUser(updatedUser);
      setPostDraft({ text: "", cardName: "", offer: "", minQuality: "NM", cardType: "Comum", image: null });
      clearWantedSearchResults();
    } catch (error) {
      Alert.alert("Nao foi possivel postar", error.message);
    } finally {
      setLoading(false);
    }
  };

  const selectWantedCard = (card) => {
    const code = getCardCode(card);
    const label = code ? `${card.name} (${code})` : card.name;
    setPostDraft((current) => ({
      ...current,
      cardName: label,
      image: current.image || card.images?.small || null,
    }));
    clearWantedSearchResults();
  };

  const removePost = (postId) => {
    try {
      ProfilePostService.deletePost(postId, sessionUser?.id);
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const togglePostLike = (postId) => {
    try {
      ProfilePostService.toggleLike(postId, sessionUser?.id);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const togglePostRepost = (postId) => {
    try {
      ProfilePostService.toggleRepost(postId, sessionUser?.id);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const toggleSavedPost = async (postId) => {
    try {
      const updatedUser = await UserService.toggleSavedPost(sessionUser?.id, postId);
      syncSessionUser(updatedUser);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const openShowcaseEditor = () => {
    const availableIds = new Set(profileCards.map((card) => card.id));
    const selectedIds = Array.isArray(user?.showcaseCardIds) ? user.showcaseCardIds : [];

    setShowcaseDraftIds(selectedIds.filter((id) => availableIds.has(id)));
    setShowcaseEditorVisible(true);
  };

  const closeShowcaseEditor = () => {
    setShowcaseEditorVisible(false);
    setShowcaseDraftIds([]);
  };

  const toggleShowcaseCard = (cardId) => {
    setShowcaseDraftIds((current) =>
      current.includes(cardId)
        ? current.filter((id) => id !== cardId)
        : [...current, cardId]
    );
  };

  const moveShowcaseCard = (cardId, direction) => {
    setShowcaseDraftIds((current) => {
      const index = current.indexOf(cardId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const saveShowcase = async () => {
    try {
      setLoading(true);
      const updatedUser = await UserService.updateProfile(user.id, {
        showcaseCardIds: showcaseDraftIds,
      });

      syncSessionUser(updatedUser);
      closeShowcaseEditor();
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderWantedChoice = (field, options) => (
    <View style={styles.wantedChoiceRow}>
      {options.map((option) => {
        const selected = postDraft[field] === option;

        return (
          <TouchableOpacity
            activeOpacity={0.85}
            key={option}
            onPress={() => updatePostDraft(field, option)}
            style={[
              styles.wantedChoice,
              { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
              selected && { backgroundColor: themeColor, borderColor: themeColor },
            ]}
          >
            <Text style={[styles.wantedChoiceText, { color: selected ? colors.onPrimary : colors.text }]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderStatsUserRow = (item) => {
    const followsUser = !!sessionUser?.followingIds?.includes(item.id);
    const isMe = item.id === sessionUser?.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        key={item.id}
        onPress={() => openProfile(item.id)}
        style={[styles.statsListRow, { borderColor: colors.border }]}
      >
        <View style={[styles.statsListAvatar, { backgroundColor: item.themeColor ?? colors.avatarBackground }]}>
          {item.photo ? (
            <Image source={{ uri: item.photo }} style={styles.statsListAvatarImage} />
          ) : (
            <Text style={styles.statsListAvatarText}>{getInitials(item.name) || "YD"}</Text>
          )}
        </View>
        <View style={styles.statsListInfo}>
          <Text numberOfLines={1} style={[styles.statsListTitle, { color: colors.text }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[styles.statsListSubtitle, { color: colors.mutedText }]}>
            {getPublicHandle(item)}
          </Text>
        </View>
        {!isMe && (
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={(event) => {
              event.stopPropagation();
              toggleFollowUser(item.id);
            }}
            style={[
              styles.statsFollowButton,
              { backgroundColor: followsUser ? colors.surface : themeColor, borderColor: themeColor },
            ]}
          >
            <Text style={[styles.statsFollowButtonText, { color: followsUser ? themeColor : colors.onPrimary }]}>
              {followsUser ? "Seguindo" : "Seguir"}
            </Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const statsModalConfig = {
    followers: {
      title: "Seguidores",
      empty: "Este perfil ainda nao tem seguidores.",
      items: followerUsers,
      renderItem: renderStatsUserRow,
    },
    following: {
      title: "Seguindo",
      empty: "Este perfil ainda nao segue ninguem.",
      items: followingUsers,
      renderItem: renderStatsUserRow,
    },
    sale: {
      title: "A venda",
      empty: "Nenhuma carta a venda neste perfil.",
      items: profileSaleCards,
      renderItem: (item) => {
        const image = getCardImage(item);

        return (
          <TouchableOpacity
            activeOpacity={0.85}
            key={item.id}
            onPress={() => {
              setStatsModal(null);
              router.push(`/views/CardDetailsView?id=${encodeURIComponent(item.cardId ?? item.id)}`);
            }}
            style={[styles.statsListRow, { borderColor: colors.border }]}
          >
            <View style={[styles.statsListThumb, { backgroundColor: colors.surfaceVariant }]}>
              {image ? (
                <Image source={{ uri: image }} style={styles.statsListThumbImage} />
              ) : (
                <MaterialCommunityIcons name="cards-outline" size={24} color={colors.mutedText} />
              )}
            </View>
            <View style={styles.statsListInfo}>
              <Text numberOfLines={1} style={[styles.statsListTitle, { color: colors.text }]}>{item.name}</Text>
              <Text numberOfLines={1} style={[styles.statsListSubtitle, { color: colors.mutedText }]}>
                {[item.qualidade, item.idioma, item.price].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.mutedText} />
          </TouchableOpacity>
        );
      },
    },
    wanted: {
      title: "Procurando",
      empty: "Nenhuma procura publicada neste perfil.",
      items: wantedPosts,
      renderItem: (item) => (
        <View key={item.id} style={[styles.statsWantedCard, { borderColor: colors.border }]}>
          <View style={styles.statsWantedHeader}>
            <MaterialCommunityIcons name="magnify" size={20} color={themeColor} />
            <Text numberOfLines={1} style={[styles.statsListTitle, { color: colors.text }]}>
              {item.cardName || "Carta sem nome"}
            </Text>
          </View>
          {!!item.offer && <Text style={[styles.statsWantedMeta, { color: themeColor }]}>Preco: {item.offer}</Text>}
          <Text style={[styles.statsWantedMeta, { color: colors.mutedText }]}>
            {[item.minQuality && `Min. ${item.minQuality}`, item.cardType].filter(Boolean).join(" - ")}
          </Text>
          {!!item.text && (
            <Text numberOfLines={3} style={[styles.statsWantedText, { color: colors.text }]}>{item.text}</Text>
          )}
        </View>
      ),
    },
  };
  const activeStatsModal = statsModal ? statsModalConfig[statsModal] : null;

  if (!user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <LoadingDuck label="Carregando perfil..." />
      </View>
    );
  }

  const profileColors = buildProfileColors(user, colors);
  const themeColor = profileColors.primary;
  const profileSurface = profileColors.surface;
  const profileText = profileColors.text;
  const profileMutedText = profileColors.mutedText;
  const profileBorder = profileColors.border;
  const isOwnProfile = !isPublicProfile;
  const isFollowing = !!sessionUser?.followingIds?.includes(user.id);
  const visibleProfilePanels = normalizeProfilePanelOrder(user.profilePanelOrder).filter(
    (panelId) => !(user.hiddenProfilePanels ?? []).includes(panelId)
  );
  const levelInfo = UserService.getLevelInfo(user.experience);
  const levelProgressPercent = `${Math.round(levelInfo.progress * 100)}%`;

  const renderProfilePanel = (panelId) => {
    if (panelId === "stats") {
      return (
        <View key={panelId} style={styles.statsRow}>
          {profileStats.map((stat) => (
            <TouchableOpacity
              activeOpacity={0.85}
              key={stat.id}
              onPress={() => setStatsModal(stat.id)}
              style={[styles.statCard, { backgroundColor: profileSurface }]}
            >
              <Text style={[styles.statValue, { color: profileText }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: profileMutedText }]}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    }

    if (panelId === "showcase") {
      return (
        <View key={panelId} style={[styles.section, { backgroundColor: profileSurface }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: profileMutedText }]}>Vitrine</Text>
            {isOwnProfile && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={openShowcaseEditor}
                style={[styles.sectionAction, { backgroundColor: themeColor, borderColor: themeColor }]}
              >
                <MaterialCommunityIcons name="pencil" size={17} color={colors.onPrimary} />
                <Text style={[styles.sectionActionText, { color: colors.onPrimary }]}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>

          {profileShowcaseCards.length > 0 ? (
            <View style={styles.showcaseCardsGrid}>
              {profileShowcaseCards.map((card) => {
                const image = getCardImage(card);

                return (
                  <TouchableOpacity
                    activeOpacity={0.88}
                    key={card.id}
                    onPress={() => router.push(`/views/CardDetailsView?id=${encodeURIComponent(card.id)}`)}
                    style={styles.showcaseCard}
                  >
                    <View style={styles.showcaseCardImageWrap}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.showcaseCardImage} />
                      ) : (
                        <MaterialCommunityIcons name="cards-outline" size={34} color={colors.mutedText} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={[styles.showcaseEmpty, { borderColor: profileBorder }]}>
              <MaterialCommunityIcons name="cards-outline" size={28} color={profileMutedText} />
              <Text style={[styles.showcaseEmptyText, { color: profileMutedText }]}>
                {isOwnProfile
                  ? "Escolha cartas da sua colecao para montar sua vitrine."
                  : "Este perfil ainda nao montou uma vitrine."}
              </Text>
              {isOwnProfile && (
                <TouchableOpacity activeOpacity={0.85} onPress={openShowcaseEditor} style={[styles.showcaseEmptyButton, { backgroundColor: themeColor }]}>
                  <Text style={[styles.showcaseEmptyButtonText, { color: colors.onPrimary }]}>Montar vitrine</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      );
    }

    if (panelId === "mural") {
      return (
        <View key={panelId} style={[styles.section, { backgroundColor: profileSurface }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.sectionTitle, styles.sectionTitleInline, { color: profileMutedText }]}>Mural</Text>
            <Text style={[styles.postCount, { color: profileMutedText }]}>
              {profilePosts.length} post(s)
            </Text>
          </View>

          {isOwnProfile && (
            <View style={[styles.composer, { borderColor: profileBorder }]}>
              <View style={styles.modeTabs}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPostMode("post")}
                  style={[
                    styles.modeTab,
                    { borderColor: colors.border },
                    postMode === "post" && { backgroundColor: themeColor, borderColor: themeColor },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="post-outline"
                    size={18}
                    color={postMode === "post" ? colors.onPrimary : colors.text}
                  />
                  <Text style={[styles.modeText, { color: postMode === "post" ? colors.onPrimary : colors.text }]}>Post</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setPostMode("wanted")}
                  style={[
                    styles.modeTab,
                    { borderColor: colors.border },
                    postMode === "wanted" && { backgroundColor: themeColor, borderColor: themeColor },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={postMode === "wanted" ? colors.onPrimary : colors.text}
                  />
                  <Text style={[styles.modeText, { color: postMode === "wanted" ? colors.onPrimary : colors.text }]}>Procuro</Text>
                </TouchableOpacity>
              </View>

              {postMode === "wanted" && (
                <View style={styles.wantedInputs}>
                  <View>
                    <TextInput
                      onChangeText={(value) => updatePostDraft("cardName", value)}
                      placeholder="Buscar carta que voce procura"
                      placeholderTextColor={colors.mutedText}
                      style={[styles.postInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                      value={postDraft.cardName}
                    />
                    {wantedSearchLoading && (
                      <View style={styles.searchLoadingRow}>
                        <LoadingDuck compact label="Buscando cartas..." size={34} />
                      </View>
                    )}
                    {!!wantedSearchError && (
                      <Text style={[styles.searchStatus, { color: colors.danger }]}>{wantedSearchError}</Text>
                    )}
                    {wantedSearchResults.length > 0 && (
                      <View style={[styles.cardResults, { borderColor: colors.border }]}>
                        {wantedSearchResults.map((card) => (
                          <TouchableOpacity
                            activeOpacity={0.85}
                            key={card.id}
                            onPress={() => selectWantedCard(card)}
                            style={[styles.cardResult, { borderBottomColor: colors.border }]}
                          >
                            {!!card.images?.small && (
                              <Image source={{ uri: card.images.small }} style={styles.cardResultImage} />
                            )}
                            <View style={styles.cardResultText}>
                              <Text numberOfLines={1} style={[styles.cardResultName, { color: colors.text }]}>
                                {card.name}
                              </Text>
                              <Text numberOfLines={1} style={[styles.cardResultMeta, { color: colors.mutedText }]}>
                                {[card.set, getCardCode(card)].filter(Boolean).join(" - ")}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={(value) => updatePostDraft("offer", formatMoneyInput(value))}
                    placeholder="Preco maximo"
                    placeholderTextColor={colors.mutedText}
                    style={[styles.postInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                    value={postDraft.offer}
                  />
                  <View>
                    <Text style={[styles.wantedFieldLabel, { color: colors.mutedText }]}>Qualidade minima</Text>
                    {renderWantedChoice("minQuality", wantedQualityOptions)}
                  </View>
                  <View>
                    <Text style={[styles.wantedFieldLabel, { color: colors.mutedText }]}>Tipo</Text>
                    {renderWantedChoice("cardType", wantedTypeOptions)}
                  </View>
                </View>
              )}

              <TextInput
                multiline
                onChangeText={(value) => updatePostDraft("text", value)}
                placeholder={postMode === "wanted" ? "Detalhes, idioma, estado ou edicao..." : "Compartilhe uma atualizacao..."}
                placeholderTextColor={colors.mutedText}
                style={[styles.postTextArea, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                value={postDraft.text}
              />

              {postDraft.image && (
                <View style={styles.previewImageWrap}>
                  <Image source={{ uri: postDraft.image }} style={styles.previewImage} />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => updatePostDraft("image", null)}
                    style={[styles.removeImageButton, { backgroundColor: colors.overlayStrong }]}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.onDark} />
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.composerActions}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={pickPostImage}
                  style={[styles.iconTextButton, { borderColor: colors.border }]}
                >
                  <MaterialCommunityIcons name="image-plus" size={20} color={colors.text} />
                  <Text style={[styles.iconTextButtonText, { color: colors.text }]}>Imagem</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={loading}
                  onPress={publishPost}
                  style={[styles.publishButton, { backgroundColor: themeColor }, loading && styles.disabledButton]}
                >
                  <MaterialCommunityIcons name="send" size={18} color={colors.onPrimary} />
                  <Text style={[styles.publishButtonText, { color: colors.onPrimary }]}>Publicar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {profilePosts.length === 0 ? (
            <View style={styles.emptyPosts}>
              <MaterialCommunityIcons name="message-outline" size={34} color={colors.mutedText} />
              <Text style={[styles.emptyPostTitle, { color: colors.text }]}>Nenhum post ainda</Text>
              <Text style={[styles.emptyPostText, { color: colors.mutedText }]}>
                {isOwnProfile
                  ? "Publique atualizacoes ou cartas que voce esta procurando."
                  : "Este perfil ainda nao publicou no mural."}
              </Text>
            </View>
          ) : (
            profilePosts.map((post) => {
              const liked = post.likes.includes(sessionUser?.id);
              const reposted = post.reposts?.includes(sessionUser?.id);
              const saved = sessionUser?.savedPostIds?.includes(post.id);
              return (
                <View key={post.id} style={[styles.postCard, { borderColor: colors.border }]}>
                  <View style={styles.postHeader}>
                    <View style={[styles.postIcon, { backgroundColor: post.type === "wanted" ? themeColor : colors.secondary }]}>
                      <MaterialCommunityIcons
                        name={post.type === "wanted" ? "magnify" : "post-outline"}
                        size={20}
                        color={post.type === "wanted" ? colors.onPrimary : colors.accent}
                      />
                    </View>
                    <View style={styles.postHeaderText}>
                      <Text style={[styles.postType, { color: colors.text }]}>
                        {post.type === "wanted" ? "Procurando carta" : "Post"}
                      </Text>
                      <Text style={[styles.postTime, { color: colors.mutedText }]}>
                        {formatPostTime(post.createdAt)}
                      </Text>
                    </View>
                    {post.userId === sessionUser?.id && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => removePost(post.id)}
                        style={styles.postIconButton}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>

                  {post.type === "wanted" && (
                    <View style={[styles.wantedCard, { backgroundColor: colors.surfaceVariant }]}>
                      <Text style={[styles.wantedLabel, { color: colors.mutedText }]}>Procura</Text>
                      <Text style={[styles.wantedName, { color: colors.text }]}>{post.cardName}</Text>
                      {!!post.offer && (
                        <Text style={[styles.wantedOffer, { color: themeColor }]}>Preco: {post.offer}</Text>
                      )}
                      <View style={styles.wantedMetaRow}>
                        {!!post.minQuality && (
                          <Text style={[styles.wantedMeta, { color: colors.mutedText }]}>Min. {post.minQuality}</Text>
                        )}
                        {!!post.cardType && (
                          <Text style={[styles.wantedMeta, { color: colors.mutedText }]}>{post.cardType}</Text>
                        )}
                      </View>
                    </View>
                  )}

                  {!!post.text && <Text style={[styles.postText, { color: colors.text }]}>{post.text}</Text>}
                  {post.image && <Image source={{ uri: post.image }} style={styles.postImage} />}

                  <View style={styles.postActions}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => togglePostLike(post.id)}
                      style={styles.postActionButton}
                    >
                      <MaterialCommunityIcons
                        name={liked ? "heart" : "heart-outline"}
                        size={21}
                        color={liked ? colors.danger : colors.mutedText}
                      />
                      <Text style={[styles.postActionText, { color: colors.mutedText }]}>
                        {post.likes.length}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => togglePostRepost(post.id)}
                      style={styles.postActionButton}
                    >
                      <MaterialCommunityIcons
                        name={reposted ? "repeat-variant" : "repeat"}
                        size={21}
                        color={reposted ? colors.primary : colors.mutedText}
                      />
                      <Text style={[styles.postActionText, { color: reposted ? colors.primary : colors.mutedText }]}>
                        {post.reposts?.length ?? 0}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => toggleSavedPost(post.id)}
                      style={styles.postActionButton}
                    >
                      <MaterialCommunityIcons
                        name={saved ? "bookmark" : "bookmark-outline"}
                        size={21}
                        color={saved ? colors.primary : colors.mutedText}
                      />
                    </TouchableOpacity>
                    {isPublicProfile && (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={negotiateWithUser}
                        style={styles.postActionButton}
                      >
                        <MaterialCommunityIcons name="message-text-outline" size={21} color={colors.mutedText} />
                        <Text style={[styles.postActionText, { color: colors.mutedText }]}>Conversar</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>
      );
    }

    if (panelId === "contact") {
      return (
        <View key={panelId} style={[styles.section, { backgroundColor: profileSurface }]}>
          <Text style={[styles.sectionTitle, { color: profileMutedText }]}>
            {isPublicProfile ? "Contato publico" : "Contato e conta"}
          </Text>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="email-outline" size={20} color={profileMutedText} />
            <Text style={[styles.infoText, { color: profileText }]}>
              {isPublicProfile ? getPublicHandle(user) : user.email}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={profileMutedText} />
            <Text style={[styles.infoText, { color: profileText }, !user.phone && styles.emptyText]}>
              {user.phone || "Telefone nao informado"}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  };

  const showcaseEditorCards = [
    ...showcaseDraftIds
      .map((id) => profileCards.find((card) => card.id === id))
      .filter(Boolean),
    ...profileCards.filter((card) => !showcaseDraftIds.includes(card.id)),
  ];

  return (
    <>
      <View style={[styles.container, { backgroundColor: profileColors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.desktopScrollContent,
          ]}
        >
          <View style={[styles.profileCard, isDesktop && styles.desktopProfileCard, { backgroundColor: profileColors.background }]}>
            <View style={[styles.cover, { backgroundColor: themeColor }]}>
              {user.coverPhoto && (
                <Image source={{ uri: user.coverPhoto }} style={styles.coverImage} />
              )}
              <View style={[styles.coverShade, { backgroundColor: colors.overlaySoft }]} />
              {isPublicProfile && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={openOwnProfile}
                  style={styles.bannerBackButton}
                >
                  <MaterialCommunityIcons name="arrow-left" size={20} color={colors.onDark} />
                  <Text style={[styles.bannerBackText, { color: colors.onDark }]}>Voltar</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.profileBody}>
              <View style={[styles.avatar, { backgroundColor: colors.avatarBackground, borderColor: themeColor }]}>
                {user.photo ? (
                  <Image source={{ uri: user.photo }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarText}>{getInitials(user.name) || "YD"}</Text>
                )}
              </View>

              <Text style={[styles.userName, { color: profileText }]}>{user.name}</Text>
              <Text style={[styles.userHandle, { color: profileMutedText }]}>{getPublicHandle(user)}</Text>
              {!!user.profileTitle && (
                <Text style={[styles.profileTitle, { color: themeColor }]}>{user.profileTitle}</Text>
              )}

              <View style={styles.levelPanel}>
                <View style={styles.levelHeader}>
                  <Text style={[styles.levelTitle, { color: profileText }]}>LVL {levelInfo.level}</Text>
                </View>
                <View style={[styles.expFrame, { borderColor: profileText }]}>
                  <Text style={[styles.expLabel, { color: profileText }]}>EXP</Text>
                  <View style={[styles.expTrack, { borderColor: profileText }]}>
                    <View style={[styles.expFill, { width: levelProgressPercent }]}>
                      {[0, 1, 2, 3, 4, 5].map((item) => (
                        <View
                          key={item}
                          style={[
                            styles.expPixel,
                            { backgroundColor: profileText, opacity: item % 2 === 0 ? 1 : 0.82 },
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                </View>
                <Text style={[styles.levelSubtitle, { color: profileMutedText }]}>
                  {levelInfo.currentLevelXp}/{levelInfo.nextLevelXp} XP
                </Text>
              </View>

              <View style={styles.metaLine}>
                {!!user.pronouns && (
                  <Text style={[styles.metaText, { color: profileMutedText }]}>{user.pronouns}</Text>
                )}
                {!!user.location && (
                  <Text style={[styles.metaText, { color: profileMutedText }]}>{user.location}</Text>
                )}
              </View>

              {!!user.status && (
                <View style={[styles.statusPill, { borderColor: themeColor }]}>
                  <View style={[styles.statusDot, { backgroundColor: themeColor }]} />
                  <Text style={[styles.statusText, { color: profileText }]}>{user.status}</Text>
                </View>
              )}

              {!!user.bio && (
                <Text style={[styles.bio, { color: profileText }]}>{user.bio}</Text>
              )}

              {isPublicProfile && (
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={toggleFollowProfile}
                    style={[
                      styles.headerPrimaryAction,
                      { backgroundColor: isFollowing ? profileSurface : themeColor, borderColor: themeColor },
                      isFollowing && styles.outlineAction,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isFollowing ? "account-check" : "account-plus"}
                      size={19}
                      color={isFollowing ? themeColor : colors.onPrimary}
                    />
                    <Text style={[styles.primaryActionText, { color: colors.onPrimary }, isFollowing && { color: themeColor }]}>
                      {isFollowing ? "Seguindo" : "Seguir"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={negotiateWithUser}
                    style={[styles.headerPrimaryAction, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <MaterialCommunityIcons name="message-text" size={19} color={colors.onPrimary} />
                    <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>Conversar</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isPublicProfile && (
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={loading}
                    onPress={() => setEditModalVisible(true)}
                    style={[styles.headerPrimaryAction, { backgroundColor: themeColor, borderColor: themeColor }]}
                  >
                    <MaterialCommunityIcons name="account-edit" size={19} color={colors.onPrimary} />
                    <Text style={[styles.primaryActionText, { color: colors.onPrimary }]}>Personalizar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    disabled={loading}
                    onPress={handleLogout}
                    style={[styles.headerLogoutAction, { backgroundColor: profileSurface, borderColor: colors.border }]}
                  >
                    <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              )}

            </View>
          </View>

          {visibleProfilePanels.map(renderProfilePanel)}
        </ScrollView>
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={!!activeStatsModal}
        onRequestClose={() => setStatsModal(null)}
      >
        <Pressable style={[styles.profileCardOverlay, { backgroundColor: colors.overlay }]} onPress={() => setStatsModal(null)}>
          <Pressable
            style={[styles.statsModalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.statsModalHeader}>
              <View>
                <Text style={[styles.statsModalTitle, { color: colors.text }]}>
                  {activeStatsModal?.title}
                </Text>
                <Text style={[styles.statsModalSubtitle, { color: colors.mutedText }]}>
                  {activeStatsModal?.items.length ?? 0} item(ns)
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.75} onPress={() => setStatsModal(null)} style={styles.statsModalClose}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.statsModalContent}>
              {activeStatsModal?.items.length ? (
                activeStatsModal.items.map(activeStatsModal.renderItem)
              ) : (
                <View style={styles.statsModalEmpty}>
                  <MaterialCommunityIcons name="format-list-bulleted" size={34} color={colors.mutedText} />
                  <Text style={[styles.statsModalEmptyText, { color: colors.mutedText }]}>
                    {activeStatsModal?.empty}
                  </Text>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={closeShowcaseEditor}
        visible={showcaseEditorVisible}
      >
        <View style={[styles.showcaseEditorScreen, { backgroundColor: colors.background }]}>
          <View style={[styles.showcaseEditorHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <TouchableOpacity activeOpacity={0.75} onPress={closeShowcaseEditor} style={styles.showcaseEditorIconButton}>
              <MaterialCommunityIcons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.showcaseEditorTitleBlock}>
              <Text style={[styles.showcaseEditorTitle, { color: colors.text }]}>Editar vitrine</Text>
              <Text style={[styles.showcaseEditorSubtitle, { color: colors.mutedText }]}>
                {showcaseDraftIds.length} carta(s) selecionada(s)
              </Text>
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={loading}
              onPress={saveShowcase}
              style={[styles.showcaseEditorSave, { backgroundColor: themeColor }, loading && styles.disabledButton]}
            >
              <Text style={[styles.showcaseEditorSaveText, { color: colors.onPrimary }]}>Salvar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.showcaseEditorContent}>
            {showcaseEditorCards.length > 0 ? (
              showcaseEditorCards.map((card) => {
                const selected = showcaseDraftIds.includes(card.id);
                const selectedIndex = showcaseDraftIds.indexOf(card.id);
                const image = getCardImage(card);

                return (
                  <View
                    key={card.id}
                    style={[
                      styles.showcaseEditorItem,
                      { backgroundColor: colors.surface, borderColor: selected ? themeColor : colors.border },
                    ]}
                  >
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => toggleShowcaseCard(card.id)}
                      style={styles.showcaseEditorSelect}
                    >
                      <MaterialCommunityIcons
                        name={selected ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={26}
                        color={selected ? themeColor : colors.mutedText}
                      />
                    </TouchableOpacity>

                    <View style={[styles.showcaseEditorThumb, { backgroundColor: colors.surfaceVariant }]}>
                      {image ? (
                        <Image source={{ uri: image }} style={styles.showcaseEditorImage} />
                      ) : (
                        <MaterialCommunityIcons name="cards-outline" size={24} color={colors.mutedText} />
                      )}
                    </View>

                    <View style={styles.showcaseEditorInfo}>
                      <Text numberOfLines={2} style={[styles.showcaseEditorName, { color: colors.text }]}>{card.name}</Text>
                      <Text numberOfLines={1} style={[styles.showcaseEditorMeta, { color: colors.mutedText }]}>
                        {getCardCode(card)} {card.idioma ? `- ${card.idioma}` : ""} {card.qualidade ? `- ${card.qualidade}` : ""}
                      </Text>
                      {card.aVenda && (
                        <Text numberOfLines={1} style={[styles.showcaseEditorSale, { color: colors.primary }]}>
                          A venda {card.price ? `- ${card.price}` : ""}
                        </Text>
                      )}
                    </View>

                    {selected && (
                      <View style={styles.showcaseOrderControls}>
                        <Text style={[styles.showcaseOrderNumber, { color: colors.mutedText }]}>#{selectedIndex + 1}</Text>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          disabled={selectedIndex === 0}
                          onPress={() => moveShowcaseCard(card.id, -1)}
                          style={[styles.orderButton, { borderColor: colors.border }, selectedIndex === 0 && styles.disabledButton]}
                        >
                          <MaterialCommunityIcons name="arrow-up" size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          activeOpacity={0.75}
                          disabled={selectedIndex === showcaseDraftIds.length - 1}
                          onPress={() => moveShowcaseCard(card.id, 1)}
                          style={[
                            styles.orderButton,
                            { borderColor: colors.border },
                            selectedIndex === showcaseDraftIds.length - 1 && styles.disabledButton,
                          ]}
                        >
                          <MaterialCommunityIcons name="arrow-down" size={18} color={colors.text} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={[styles.showcaseEditorEmpty, { backgroundColor: colors.surface }]}>
                <MaterialCommunityIcons name="cards-outline" size={34} color={colors.mutedText} />
                <Text style={[styles.showcaseEditorEmptyTitle, { color: colors.text }]}>Sem cartas na colecao</Text>
                <Text style={[styles.showcaseEditorEmptyText, { color: colors.mutedText }]}>
                  Adicione cartas em Minhas listas para montar sua vitrine.
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
    paddingBottom: 96,
  },
  desktopScrollContent: {
    alignSelf: "center",
    maxWidth: 980,
    width: "100%",
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
  desktopProfileCard: {
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  cover: {
    height: 150,
    justifyContent: "flex-start",
  },
  bannerBackButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.28)",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    left: 12,
    minHeight: 36,
    paddingHorizontal: 10,
    position: "absolute",
    top: 12,
    zIndex: 2,
  },
  bannerBackText: {
    fontSize: 13,
    fontWeight: "900",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  coverShade: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  profileBody: {
    alignItems: "center",
    paddingBottom: 18,
    paddingHorizontal: 16,
  },
  avatar: {
    alignItems: "center",
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
  profileTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginTop: 6,
    textAlign: "center",
  },
  levelPanel: {
    marginTop: 12,
    maxWidth: 360,
    width: "100%",
  },
  levelHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 5,
  },
  levelTitle: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  expFrame: {
    alignItems: "center",
    borderRadius: 2,
    borderWidth: 2,
    flexDirection: "row",
    height: 24,
    overflow: "hidden",
    paddingHorizontal: 5,
    width: "100%",
  },
  expLabel: {
    fontSize: 11,
    fontWeight: "900",
    marginRight: 6,
  },
  expTrack: {
    borderLeftWidth: 2,
    flex: 1,
    flexDirection: "row",
    height: 12,
    overflow: "hidden",
    paddingLeft: 3,
  },
  expFill: {
    flexDirection: "row",
    gap: 2,
    height: "100%",
    overflow: "hidden",
  },
  expPixel: {
    height: "100%",
    width: 10,
  },
  levelSubtitle: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
    textAlign: "right",
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
  headerActions: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 16,
    maxWidth: 560,
    width: "100%",
  },
  headerPrimaryAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 128,
    paddingHorizontal: 12,
  },
  headerLogoutAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 48,
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
  statsModalCard: {
    borderRadius: 8,
    maxHeight: "82%",
    maxWidth: 520,
    overflow: "hidden",
    width: "100%",
  },
  statsModalHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  statsModalTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  statsModalSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  statsModalClose: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  statsModalContent: {
    gap: 10,
    padding: 16,
  },
  statsListRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 70,
    padding: 10,
  },
  statsListAvatar: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    width: 48,
  },
  statsListAvatarImage: {
    height: "100%",
    width: "100%",
  },
  statsListAvatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  statsListThumb: {
    alignItems: "center",
    borderRadius: 6,
    height: 58,
    justifyContent: "center",
    overflow: "hidden",
    width: 42,
  },
  statsListThumbImage: {
    height: "100%",
    resizeMode: "contain",
    width: "100%",
  },
  statsListInfo: {
    flex: 1,
    minWidth: 0,
  },
  statsListTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  statsListSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  statsFollowButton: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  statsFollowButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  statsWantedCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
  statsWantedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statsWantedMeta: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
  },
  statsWantedText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  statsModalEmpty: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 28,
  },
  statsModalEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
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
  showcaseRowSpaced: {
    marginTop: 14,
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
  sectionAction: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 13,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  showcaseCardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  showcaseCard: {
    width: 104,
  },
  showcaseCardImageWrap: {
    alignItems: "center",
    aspectRatio: 0.716,
    borderRadius: 6,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  showcaseCardImage: {
    height: "100%",
    width: "100%",
  },
  showcaseEmpty: {
    alignItems: "center",
    paddingVertical: 10,
  },
  showcaseEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
    maxWidth: 320,
    textAlign: "center",
  },
  showcaseEmptyButton: {
    borderRadius: 8,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  showcaseEmptyButtonText: {
    fontWeight: "900",
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
    fontStyle: "italic",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleInline: {
    marginBottom: 0,
  },
  postCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  composer: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  modeTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  modeTab: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 12,
  },
  modeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  wantedInputs: {
    gap: 8,
    marginBottom: 8,
  },
  wantedFieldLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    marginLeft: 2,
    textTransform: "uppercase",
  },
  wantedChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  wantedChoice: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  wantedChoiceText: {
    fontSize: 12,
    fontWeight: "900",
  },
  searchStatus: {
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 2,
    marginTop: 6,
  },
  searchLoadingRow: {
    alignItems: "flex-start",
    marginTop: 4,
  },
  cardResults: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    overflow: "hidden",
  },
  cardResult: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  cardResultImage: {
    borderRadius: 4,
    height: 58,
    resizeMode: "contain",
    width: 42,
  },
  cardResultText: {
    flex: 1,
    minWidth: 0,
  },
  cardResultName: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardResultMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  postInput: {
    borderRadius: 8,
    fontSize: 14,
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  postTextArea: {
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 88,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
  },
  previewImageWrap: {
    marginTop: 10,
    position: "relative",
  },
  previewImage: {
    aspectRatio: 4 / 3,
    borderRadius: 8,
    width: "100%",
  },
  removeImageButton: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 36,
  },
  composerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginTop: 10,
  },
  iconTextButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  iconTextButtonText: {
    fontWeight: "900",
  },
  publishButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 7,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  publishButtonText: {
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  emptyPosts: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  emptyPostTitle: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 8,
  },
  emptyPostText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    textAlign: "center",
  },
  postCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    padding: 12,
  },
  postHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  postIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  postHeaderText: {
    flex: 1,
  },
  postType: {
    fontSize: 15,
    fontWeight: "900",
  },
  postTime: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  postIconButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  wantedCard: {
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  wantedLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  wantedName: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },
  wantedOffer: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  wantedMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  wantedMeta: {
    fontSize: 12,
    fontWeight: "900",
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  postImage: {
    aspectRatio: 4 / 3,
    borderRadius: 8,
    marginTop: 12,
    width: "100%",
  },
  postActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  postActionButton: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
  },
  postActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  primaryActionText: {
    fontWeight: "900",
    textAlign: "center",
  },
  outlineAction: {
    backgroundColor: "transparent",
  },
  profileCardOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  showcaseEditorScreen: {
    flex: 1,
  },
  showcaseEditorHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 10,
  },
  showcaseEditorIconButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  showcaseEditorTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  showcaseEditorTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  showcaseEditorSubtitle: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  showcaseEditorSave: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
  },
  showcaseEditorSaveText: {
    fontWeight: "900",
  },
  showcaseEditorContent: {
    gap: 10,
    padding: 12,
    paddingBottom: 28,
  },
  showcaseEditorItem: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  showcaseEditorSelect: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 34,
  },
  showcaseEditorThumb: {
    alignItems: "center",
    borderRadius: 6,
    height: 76,
    justifyContent: "center",
    overflow: "hidden",
    width: 54,
  },
  showcaseEditorImage: {
    height: "100%",
    width: "100%",
  },
  showcaseEditorInfo: {
    flex: 1,
    minWidth: 0,
  },
  showcaseEditorName: {
    fontSize: 15,
    fontWeight: "900",
  },
  showcaseEditorMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  showcaseEditorSale: {
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  showcaseOrderControls: {
    alignItems: "center",
    gap: 5,
  },
  showcaseOrderNumber: {
    fontSize: 11,
    fontWeight: "900",
  },
  orderButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 30,
    justifyContent: "center",
    width: 34,
  },
  showcaseEditorEmpty: {
    alignItems: "center",
    borderRadius: 8,
    padding: 22,
  },
  showcaseEditorEmptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 10,
  },
  showcaseEditorEmptyText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
});
