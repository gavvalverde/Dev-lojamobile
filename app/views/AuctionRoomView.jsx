import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { AuctionService } from "../services/AuctionService";
import { AuthService } from "../services/AuthService";
import { MyCardsService } from "../services/MyCardsService";

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["NM", "LP", "MP", "HP", "DMG"];

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getImage(card) {
  return card?.images?.small || card?.images?.large || "";
}

function getBidStep(auction) {
  const current = AuctionService.getHighestBid(auction);
  return Math.ceil(current + Math.max(1, current * 0.05));
}

function makeCardSnapshot(card) {
  return {
    id: card.id,
    name: card.name,
    images: card.images,
    set: card.set,
    collectionNumber: card.collectionNumber,
    rarity: card.rarity,
    idioma: card.idioma ?? "Portugues",
    qualidade: card.qualidade ?? "NM",
  };
}

function OptionChips({ options, value, onChange, colors }) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const selected = option === value;

        return (
          <TouchableOpacity
            activeOpacity={0.85}
            key={option}
            onPress={() => onChange(option)}
            style={[
              styles.optionChip,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.optionText, { color: selected ? colors.onPrimary : colors.text }]}>
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AuctionRoomView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [auctions, setAuctions] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [bidValue, setBidValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [selectedAuctionId, setSelectedAuctionId] = useState(null);
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [bidHistoryOpen, setBidHistoryOpen] = useState(false);
  const [newCardDraft, setNewCardDraft] = useState({
    startPrice: "",
    durationHours: "24",
    description: "",
    idioma: "Portugues",
    qualidade: "NM",
  });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setUser);
    const unsubscribeAuctions = AuctionService.subscribe(setAuctions);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);

    return () => {
      unsubscribeAuth();
      unsubscribeAuctions();
      unsubscribeMyCards();
    };
  }, []);

  const sessionAuctions = useMemo(() => {
    return auctions
      .filter((auction) => auction.sessionId === sessionId || auction.id === sessionId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [auctions, sessionId]);

  const baseAuction = sessionAuctions[0] ?? null;
  const activeAuction = useMemo(() => {
    if (!baseAuction) return null;
    return sessionAuctions.find((auction) => auction.id === baseAuction.activeAuctionId)
      ?? sessionAuctions.find((auction) => !AuctionService.isClosed(auction))
      ?? sessionAuctions[0]
      ?? null;
  }, [baseAuction, sessionAuctions]);
  const selectedAuction = useMemo(() => {
    return sessionAuctions.find((auction) => auction.id === selectedAuctionId)
      ?? activeAuction;
  }, [activeAuction, selectedAuctionId, sessionAuctions]);
  const comments = baseAuction?.comments ?? [];
  const isOwner = !!user?.id && baseAuction?.seller?.id === user.id;
  const isDynamic = baseAuction?.mode === "dynamic";
  const closed = selectedAuction ? AuctionService.isClosed(selectedAuction) : true;
  const highestBid = selectedAuction ? AuctionService.getHighestBid(selectedAuction) : 0;
  const highestBidder = selectedAuction ? AuctionService.getHighestBidder(selectedAuction) : null;
  const bidHistory = [...(selectedAuction?.bids ?? [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const auctionCardIds = new Set(sessionAuctions.map((auction) => auction.card?.id).filter(Boolean));
  const selectableCards = myCards.filter((card) =>
    (card.ownerId === user?.id || card.userId === user?.id) && !auctionCardIds.has(card.cardId ?? card.id)
  );
  const selectedCard = selectableCards.find((card) => card.id === selectedCardId) ?? null;

  const placeBid = async () => {
    try {
      await AuctionService.placeBid(selectedAuction.id, bidValue, user);
      setBidValue("");
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const sendComment = async () => {
    try {
      await AuctionService.addComment(baseAuction.sessionId, user, commentText);
      setCommentText("");
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const openProfile = (profileId) => {
    if (!profileId) return;
    router.push(`/views/ProfileView?userId=${encodeURIComponent(profileId)}`);
  };

  const setActiveCard = async (auctionId) => {
    try {
      await AuctionService.setActiveAuction(baseAuction.sessionId, auctionId, user);
      setSelectedAuctionId(auctionId);
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const addCardToDynamicAuction = async () => {
    if (!selectedCard) {
      Alert.alert("Selecione uma carta", "Escolha uma carta da sua colecao.");
      return;
    }

    try {
      const created = await AuctionService.addCardToSession(baseAuction.sessionId, {
        title: `${baseAuction.auctionName} - ${selectedCard.name}`,
        cardName: selectedCard.name,
        card: makeCardSnapshot(selectedCard),
        description: newCardDraft.description,
        startPrice: newCardDraft.startPrice,
        durationHours: newCardDraft.durationHours,
        idioma: newCardDraft.idioma,
        qualidade: newCardDraft.qualidade,
        seller: user,
      });
      await AuctionService.setActiveAuction(baseAuction.sessionId, created.id, user);
      setSelectedCardId(null);
      setNewCardDraft({
        startPrice: "",
        durationHours: "24",
        description: "",
        idioma: "Portugues",
        qualidade: "NM",
      });
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  if (!baseAuction || !activeAuction || !selectedAuction) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Leilao" />
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Leilao nao encontrado</Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => router.push("/views/AuctionView")}
            style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title={baseAuction.auctionName || "Leilao"} />
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/views/AuctionView")}
          style={[styles.backButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.primary} />
          <Text style={[styles.backButtonText, { color: colors.primary }]}>Voltar aos leiloes</Text>
        </TouchableOpacity>

        <View style={[styles.activeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!!getImage(selectedAuction.card) && (
            <Image source={{ uri: getImage(selectedAuction.card) }} style={styles.activeImage} />
          )}
          <View style={styles.activeInfo}>
            <View style={styles.activeHeaderLine}>
              <Text style={[styles.sectionLabel, styles.sectionLabelInline, { color: colors.mutedText }]}>
                {selectedAuction.id === activeAuction.id ? "No ar" : "Selecionada"}
              </Text>
              <Text numberOfLines={1} style={[styles.activeMeta, styles.activeMetaInline, { color: colors.mutedText }]}>
                {[selectedAuction.qualidade, selectedAuction.idioma].filter(Boolean).join(" - ")}
              </Text>
            </View>
            <Text numberOfLines={1} style={[styles.activeTitle, { color: colors.text }]}>{selectedAuction.cardName}</Text>
            {!!selectedAuction.description && (
              <Text numberOfLines={1} style={[styles.description, styles.compactDescription, { color: colors.mutedText }]}>
                {selectedAuction.description}
              </Text>
            )}
            <View style={styles.compactBidSummary}>
              <Text numberOfLines={1} style={[styles.compactBidValue, { color: colors.text }]}>
                {formatCurrency(highestBid)}
              </Text>
              <Text
                numberOfLines={1}
                onPress={() => openProfile(highestBidder?.id)}
                style={[styles.compactBidMeta, { color: colors.mutedText }]}
              >
                {highestBidder ? highestBidder.name : "Lance inicial"} - termina {formatDate(selectedAuction.endsAt)}
              </Text>
            </View>

            {isOwner ? (
              <Text style={[styles.helperText, { color: colors.mutedText }]}>
                Voce esta conduzindo este leilao.
              </Text>
            ) : (
              <View style={[styles.bidRow, styles.activeBidRow]}>
                <TextInput
                  editable={!closed}
                  keyboardType="decimal-pad"
                  onChangeText={(value) => setBidValue(formatMoneyInput(value))}
                  placeholder={`Min. ${formatCurrency(getBidStep(selectedAuction))}`}
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    styles.bidInput,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                  ]}
                  value={bidValue}
                />
                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={closed}
                  onPress={placeBid}
                  style={[styles.primaryButton, { backgroundColor: colors.primary }, closed && styles.disabled]}
                >
                  <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Lance</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setBidHistoryOpen((current) => !current)}
            style={styles.dropdownHeader}
          >
            <View>
              <Text style={[styles.panelTitle, styles.panelTitleInline, { color: colors.text }]}>
                Historico de lances
              </Text>
              <Text style={[styles.bidCountText, { color: colors.mutedText }]}>
                {bidHistory.length} lance(s)
              </Text>
            </View>
            <MaterialCommunityIcons
              name={bidHistoryOpen ? "chevron-up" : "chevron-down"}
              size={24}
              color={colors.mutedText}
            />
          </TouchableOpacity>
          {bidHistoryOpen && (
            bidHistory.length === 0 ? (
              <Text style={[styles.helperText, { color: colors.mutedText }]}>
                Ainda nao houve lances nesta carta.
              </Text>
            ) : bidHistory.map((bid, index) => {
              const bidderName = bid.bidder?.name ?? "Usuario";
              const initials = bidderName.slice(0, 2).toUpperCase();

              return (
                <TouchableOpacity
                  activeOpacity={0.78}
                  key={bid.id}
                  onPress={() => openProfile(bid.bidder?.id)}
                  style={[styles.bidHistoryRow, { borderBottomColor: colors.border }]}
                >
                  <View style={[styles.bidderAvatar, { backgroundColor: bid.bidder?.themeColor || colors.accent }]}>
                    {bid.bidder?.photo ? (
                      <Image source={{ uri: bid.bidder.photo }} style={styles.bidderAvatarImage} />
                    ) : (
                      <Text style={[styles.bidderAvatarText, { color: colors.onAccent }]}>{initials}</Text>
                    )}
                  </View>
                  <View style={styles.bidHistoryInfo}>
                    <Text numberOfLines={1} style={[styles.bidderName, { color: colors.text }]}>
                      {bidderName}
                    </Text>
                    <Text style={[styles.bidTime, { color: colors.mutedText }]}>
                      {formatDate(bid.createdAt)}
                    </Text>
                  </View>
                  <View style={styles.bidAmountBlock}>
                    {index === 0 && (
                      <Text style={[styles.leadingBidLabel, { color: colors.primary }]}>Lider</Text>
                    )}
                    <Text style={[styles.bidAmount, { color: colors.text }]}>
                      {formatCurrency(bid.amount)}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>
            Cartas do leilao
          </Text>
          {sessionAuctions.map((auction, index) => {
            const active = auction.id === activeAuction.id;
            const selected = auction.id === selectedAuction.id;
            return (
              <View
                key={auction.id}
                style={[
                  styles.cardRow,
                  { borderColor: selected ? colors.primary : colors.border },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedAuctionId(auction.id);
                    setBidValue("");
                  }}
                  style={styles.cardRowButton}
                >
                  {!!getImage(auction.card) ? (
                    <Image source={{ uri: getImage(auction.card) }} style={styles.cardThumb} />
                  ) : (
                    <View style={[styles.queueNumber, { backgroundColor: active ? colors.primary : colors.surfaceVariant }]}>
                      <Text style={[styles.queueNumberText, { color: active ? colors.onPrimary : colors.text }]}>
                        {index + 1}
                      </Text>
                    </View>
                  )}
                  <View style={styles.cardRowInfo}>
                    <Text numberOfLines={1} style={[styles.cardRowTitle, { color: colors.text }]}>
                      {auction.cardName}
                    </Text>
                    <Text style={[styles.cardRowMeta, { color: colors.mutedText }]}>
                      {formatCurrency(AuctionService.getHighestBid(auction))}
                      {AuctionService.getHighestBidder(auction)?.name ? ` por ${AuctionService.getHighestBidder(auction).name}` : ""}
                      {" - "}
                      {[auction.qualidade, auction.idioma].filter(Boolean).join(" - ")}
                    </Text>
                  </View>
                </TouchableOpacity>
                {active && <MaterialCommunityIcons name="broadcast" size={20} color={colors.primary} />}
                {isOwner && !active && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setActiveCard(auction.id)}
                    style={[styles.liveButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.liveButtonText, { color: colors.primary }]}>No ar</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {isOwner && isDynamic && (
          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.text }]}>Adicionar carta ao vivo</Text>
            <FlatList
              data={selectableCards}
              horizontal
              keyExtractor={(item) => item.id}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item.id === selectedCardId;
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSelectedCardId(item.id)}
                    style={[
                      styles.selectCard,
                      { borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    {!!getImage(item) && <Image source={{ uri: getImage(item) }} style={styles.selectImage} />}
                    <Text numberOfLines={2} style={[styles.selectName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
            <View style={styles.formRow}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => setNewCardDraft((current) => ({ ...current, startPrice: value }))}
                placeholder="Lance minimo"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, styles.flexInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                value={newCardDraft.startPrice}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => setNewCardDraft((current) => ({ ...current, durationHours: value }))}
                placeholder="Horas"
                placeholderTextColor={colors.mutedText}
                style={[styles.input, styles.flexInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                value={newCardDraft.durationHours}
              />
            </View>
            <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>Qualidade</Text>
            <OptionChips
              colors={colors}
              options={qualityOptions}
              value={newCardDraft.qualidade}
              onChange={(value) => setNewCardDraft((current) => ({ ...current, qualidade: value }))}
            />
            <Text style={[styles.sectionLabel, { color: colors.mutedText }]}>Idioma</Text>
            <OptionChips
              colors={colors}
              options={languageOptions}
              value={newCardDraft.idioma}
              onChange={(value) => setNewCardDraft((current) => ({ ...current, idioma: value }))}
            />
            <TextInput
              multiline
              onChangeText={(value) => setNewCardDraft((current) => ({ ...current, description: value }))}
              placeholder="Comentario sobre esta carta"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, styles.commentInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              value={newCardDraft.description}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={addCardToDynamicAuction}
              style={[styles.primaryButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Adicionar e colocar no ar</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Comentarios</Text>
          {comments.length === 0 ? (
            <Text style={[styles.helperText, { color: colors.mutedText }]}>
              Nenhum comentario ainda.
            </Text>
          ) : (
            comments.map((comment) => (
              <View key={comment.id} style={[styles.comment, { borderBottomColor: colors.border }]}>
                <Text
                  onPress={() => openProfile(comment.user?.id)}
                  style={[styles.commentAuthor, { color: colors.text }]}
                >
                  {comment.user?.name ?? "Usuario"}
                </Text>
                <Text style={[styles.commentText, { color: colors.mutedText }]}>{comment.text}</Text>
              </View>
            ))
          )}
          <View style={styles.commentComposer}>
            <TextInput
              onChangeText={setCommentText}
              placeholder="Comentar entre as cartas"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, styles.composerInput, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              value={commentText}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={sendComment}
              style={[styles.sendButton, { backgroundColor: colors.primary }]}
            >
              <MaterialCommunityIcons name="send" size={18} color={colors.onPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: 14,
    paddingBottom: 100,
  },
  backButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginBottom: 10,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  backButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  hero: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 16,
  },
  heroText: {
    flex: 1,
    paddingRight: 10,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: "900",
  },
  heroSubtitle: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  activeCard: {
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    padding: 10,
  },
  activeImage: {
    borderRadius: 6,
    height: 132,
    resizeMode: "contain",
    width: 94,
  },
  activeInfo: {
    flex: 1,
    minWidth: 0,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  sectionLabelInline: {
    marginBottom: 0,
  },
  activeHeaderLine: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
  },
  activeTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },
  activeMeta: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  activeMetaInline: {
    flex: 1,
    marginTop: 0,
    textAlign: "right",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  compactDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  compactBidSummary: {
    marginTop: 10,
  },
  compactBidValue: {
    fontSize: 18,
    fontWeight: "900",
  },
  compactBidMeta: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  statSubvalue: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  bidRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  activeBidRow: {
    marginLeft: -104,
    marginTop: 16,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  bidInput: {
    flex: 1,
    marginBottom: 0,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  primaryText: {
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.5,
  },
  helperText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 8,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  panelTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  dropdownHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  panelTitleInline: {
    marginBottom: 0,
  },
  bidCountText: {
    fontSize: 12,
    fontWeight: "900",
  },
  bidHistoryRow: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 58,
    paddingVertical: 9,
  },
  bidderAvatar: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  bidderAvatarImage: {
    height: "100%",
    width: "100%",
  },
  bidderAvatarText: {
    fontSize: 12,
    fontWeight: "900",
  },
  bidHistoryInfo: {
    flex: 1,
    minWidth: 0,
  },
  bidderName: {
    fontSize: 14,
    fontWeight: "900",
  },
  bidTime: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  bidAmountBlock: {
    alignItems: "flex-end",
  },
  leadingBidLabel: {
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  bidAmount: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    padding: 8,
  },
  cardRowButton: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 10,
    minWidth: 0,
  },
  cardThumb: {
    borderRadius: 4,
    height: 58,
    resizeMode: "contain",
    width: 42,
  },
  queueNumber: {
    alignItems: "center",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  queueNumberText: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardRowInfo: {
    flex: 1,
    minWidth: 0,
  },
  cardRowTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  cardRowMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  liveButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10,
  },
  liveButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  selectCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 10,
    padding: 8,
    width: 104,
  },
  selectImage: {
    alignSelf: "center",
    height: 92,
    resizeMode: "contain",
    width: 66,
  },
  selectName: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 6,
    textAlign: "center",
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  flexInput: {
    flex: 1,
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  optionChip: {
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 34,
    paddingHorizontal: 10,
  },
  optionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  commentInput: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  comment: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: "900",
  },
  commentText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 3,
  },
  commentComposer: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  composerInput: {
    flex: 1,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  empty: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 14,
  },
});
