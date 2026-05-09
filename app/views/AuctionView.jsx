import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuctionService } from "../services/AuctionService";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { MyCardsService } from "../services/MyCardsService";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  });
}

function normalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasAuctionTag(user) {
  return (user?.badges ?? []).some((badge) => normalizeTag(badge) === "leilao");
}

function getBidStep(auction) {
  const current = AuctionService.getHighestBid(auction);
  return Math.ceil(current + Math.max(1, current * 0.05));
}

function getCardImage(card) {
  return card?.images?.small || card?.images?.large || "";
}

function getCardCode(card) {
  return card?.collectionNumber || card?.id || "";
}

function makeCardSnapshot(card) {
  return {
    id: card.id,
    name: card.name,
    images: card.images,
    set: card.set,
    collectionNumber: card.collectionNumber,
    rarity: card.rarity,
  };
}

export default function AuctionView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [auctions, setAuctions] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [bidValues, setBidValues] = useState({});
  const [selectedCards, setSelectedCards] = useState([]);
  const [cardDrafts, setCardDrafts] = useState({});

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

  const canCreateAuction = hasAuctionTag(user);

  const stats = useMemo(() => {
    const active = auctions.filter((auction) => !AuctionService.isClosed(auction));
    const bids = auctions.reduce((total, auction) => total + auction.bids.length, 0);

    return {
      activeCount: active.length,
      bidCount: bids,
    };
  }, [auctions]);

  const selectableCards = useMemo(() => {
    const seen = new Set();
    return myCards.filter((card) => {
      if (!card?.id || seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });
  }, [myCards]);

  const updateCardDraft = (cardId, field, value) => {
    setCardDrafts((current) => ({
      ...current,
      [cardId]: {
        startPrice: "",
        durationHours: "24",
        description: "",
        ...current[cardId],
        [field]: value,
      },
    }));
  };

  const toggleCard = (card) => {
    setSelectedCards((current) => {
      const selected = current.includes(card.id);
      if (selected) return current.filter((id) => id !== card.id);

      setCardDrafts((drafts) => ({
        ...drafts,
        [card.id]: drafts[card.id] ?? {
          startPrice: "",
          durationHours: "24",
          description: "",
        },
      }));
      return [...current, card.id];
    });
  };

  const createAuctions = async () => {
    if (!canCreateAuction) {
      Alert.alert("Acesso restrito", "Apenas perfis com a insignia Leilao podem criar leilões.");
      return;
    }

    if (selectedCards.length === 0) {
      Alert.alert("Selecione cartas", "Escolha ao menos uma das suas cartas para leiloar.");
      return;
    }

    try {
      for (const cardId of selectedCards) {
        const card = selectableCards.find((item) => item.id === cardId);
        const draft = cardDrafts[cardId] ?? {};

        await AuctionService.createAuction({
          title: card.name,
          cardName: card.name,
          card: makeCardSnapshot(card),
          description: draft.description,
          startPrice: draft.startPrice,
          durationHours: draft.durationHours,
          seller: user,
        });
      }

      setSelectedCards([]);
      setCardDrafts({});
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const placeBid = async (auction) => {
    try {
      await AuctionService.placeBid(auction.id, bidValues[auction.id], user);
      setBidValues((current) => ({ ...current, [auction.id]: "" }));
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const renderSelectableCard = ({ item }) => {
    const selected = selectedCards.includes(item.id);
    const draft = cardDrafts[item.id] ?? {
      startPrice: "",
      durationHours: "24",
      description: "",
    };
    const image = getCardImage(item);

    return (
      <View
        style={[
          styles.selectorCard,
          { backgroundColor: colors.surfaceVariant, borderColor: selected ? colors.primary : colors.border },
        ]}
      >
        <TouchableOpacity activeOpacity={0.85} onPress={() => toggleCard(item)} style={styles.selectorHeader}>
          {image ? (
            <Image source={{ uri: image }} style={styles.selectorImage} />
          ) : (
            <View style={[styles.selectorImageFallback, { backgroundColor: colors.surface }]}>
              <MaterialCommunityIcons name="cards" size={28} color={colors.mutedText} />
            </View>
          )}
          <View style={styles.selectorInfo}>
            <Text numberOfLines={2} style={[styles.selectorName, { color: colors.text }]}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={[styles.selectorMeta, { color: colors.mutedText }]}>
              {item.set || "Sem coleção"} {getCardCode(item) ? `- ${getCardCode(item)}` : ""}
            </Text>
          </View>
          <MaterialCommunityIcons
            name={selected ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
            size={26}
            color={selected ? colors.primary : colors.mutedText}
          />
        </TouchableOpacity>

        {selected && (
          <View style={styles.cardSettings}>
            <View style={styles.formRow}>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={(value) => updateCardDraft(item.id, "startPrice", value)}
                placeholder="Lance minimo"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.inlineInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={draft.startPrice}
              />
              <TextInput
                keyboardType="number-pad"
                onChangeText={(value) => updateCardDraft(item.id, "durationHours", value)}
                placeholder="Duracao em horas"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  styles.inlineInput,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={draft.durationHours}
              />
            </View>
            <TextInput
              multiline
              onChangeText={(value) => updateCardDraft(item.id, "description", value)}
              placeholder="Descricao desta carta no leilao"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                styles.descriptionInput,
                { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
              ]}
              value={draft.description}
            />
          </View>
        )}
      </View>
    );
  };

  const renderAuction = ({ item }) => {
    const closed = AuctionService.isClosed(item);
    const highestBid = AuctionService.getHighestBid(item);
    const lastBid = item.bids[item.bids.length - 1];
    const isOwnAuction = item.seller?.id === user?.id;
    const image = getCardImage(item.card);

    return (
      <View style={[styles.auctionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.auctionTop}>
          {image ? (
            <Image source={{ uri: image }} style={styles.auctionImage} />
          ) : (
            <View style={[styles.auctionImageFallback, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="cards" size={32} color={colors.mutedText} />
            </View>
          )}
          <View style={styles.auctionMain}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleGroup}>
                <Text style={[styles.auctionTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.cardName, { color: colors.mutedText }]}>
                  {item.card?.set || item.cardName}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: closed ? colors.surfaceVariant : colors.accent },
                ]}
              >
                <Text style={[styles.statusText, { color: closed ? colors.mutedText : colors.onAccent }]}>
                  {closed ? "Encerrado" : "Aberto"}
                </Text>
              </View>
            </View>

            {!!item.description && (
              <Text style={[styles.description, { color: colors.text }]}>{item.description}</Text>
            )}
          </View>
        </View>

        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.mutedText }]}>Maior lance</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatCurrency(highestBid)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.mutedText }]}>Termina</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{formatDate(item.endsAt)}</Text>
          </View>
        </View>

        <View style={[styles.sellerRow, { borderTopColor: colors.border }]}>
          <MaterialCommunityIcons name="account-circle" size={20} color={colors.mutedText} />
          <Text style={[styles.sellerText, { color: colors.mutedText }]}>
            {item.seller?.name ?? "Vendedor"}{lastBid ? ` - lider: ${lastBid.bidder?.name}` : ""}
          </Text>
        </View>

        <View style={styles.bidRow}>
          <TextInput
            editable={!closed && !isOwnAuction}
            keyboardType="decimal-pad"
            onChangeText={(value) => setBidValues((current) => ({ ...current, [item.id]: value }))}
            placeholder={`Min. ${formatCurrency(getBidStep(item))}`}
            placeholderTextColor={colors.mutedText}
            style={[
              styles.bidInput,
              {
                backgroundColor: colors.surfaceVariant,
                borderColor: colors.border,
                color: colors.text,
              },
              (closed || isOwnAuction) && styles.disabledInput,
            ]}
            value={bidValues[item.id] ?? ""}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={closed || isOwnAuction}
            onPress={() => placeBid(item)}
            style={[
              styles.bidButton,
              { backgroundColor: colors.primary },
              (closed || isOwnAuction) && styles.disabledButton,
            ]}
          >
            <MaterialCommunityIcons name="gavel" size={18} color={colors.onPrimary} />
            <Text style={[styles.bidButtonText, { color: colors.onPrimary }]}>Lance</Text>
          </TouchableOpacity>
        </View>

        {isOwnAuction && (
          <Text style={[styles.helperText, { color: colors.mutedText }]}>
            Este leilao e seu; outros perfis podem dar lances nele.
          </Text>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Leilões Yellow Duck" />

      <FlatList
        data={auctions}
        keyExtractor={(item) => item.id}
        renderItem={renderAuction}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
              <View style={styles.heroText}>
                <Text style={[styles.heroTitle, { color: colors.onPrimary }]}>Leilões TCG</Text>
                <Text style={[styles.heroSubtitle, { color: colors.accent }]}>
                  {stats.activeCount} aberto(s) - {stats.bidCount} lance(s)
                </Text>
              </View>
              <MaterialCommunityIcons name="cards-playing" size={46} color={colors.accent} />
            </View>

            <View style={[styles.ruleBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons
                name={canCreateAuction ? "shield-check" : "shield-lock"}
                size={22}
                color={canCreateAuction ? colors.primary : colors.mutedText}
              />
              <Text style={[styles.ruleText, { color: colors.text }]}>
                {canCreateAuction
                  ? "Selecione uma ou mais cartas de Minhas Cartas e defina o lance minimo e a duracao de cada uma."
                  : "Somente perfis com a insignia Leilao podem criar leilões. Voce pode participar dando lances."}
              </Text>
            </View>

            {canCreateAuction && (
              <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.formHeader}>
                  <Text style={[styles.formTitle, { color: colors.text }]}>Cartas para leiloar</Text>
                  <Text style={[styles.selectedCount, { color: colors.mutedText }]}>
                    {selectedCards.length} selecionada(s)
                  </Text>
                </View>

                {selectableCards.length > 0 ? (
                  <FlatList
                    data={selectableCards}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderSelectableCard}
                    scrollEnabled={false}
                  />
                ) : (
                  <View style={[styles.noCardsBox, { backgroundColor: colors.surfaceVariant }]}>
                    <MaterialCommunityIcons name="cards-outline" size={34} color={colors.mutedText} />
                    <Text style={[styles.noCardsText, { color: colors.text }]}>
                      Adicione cartas em Minhas Cartas para poder seleciona-las aqui.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.85}
                  disabled={selectedCards.length === 0}
                  onPress={createAuctions}
                  style={[
                    styles.createButton,
                    { backgroundColor: colors.accent },
                    selectedCards.length === 0 && styles.disabledButton,
                  ]}
                >
                  <MaterialCommunityIcons name="plus-circle" size={20} color={colors.onAccent} />
                  <Text style={[styles.createButtonText, { color: colors.onAccent }]}>
                    Publicar carta(s)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Leilões ativos e recentes</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="gavel" size={42} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum leilao publicado</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Quando um perfil com a insignia Leilao publicar uma carta, ela aparece aqui.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 90,
  },
  hero: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 18,
  },
  heroText: {
    flex: 1,
    paddingRight: 12,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
  ruleBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
    padding: 12,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  form: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  formHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  selectedCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  selectorCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    overflow: "hidden",
  },
  selectorHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    padding: 10,
  },
  selectorImage: {
    borderRadius: 6,
    height: 74,
    width: 52,
  },
  selectorImageFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 74,
    justifyContent: "center",
    width: 52,
  },
  selectorInfo: {
    flex: 1,
  },
  selectorName: {
    fontSize: 15,
    fontWeight: "900",
  },
  selectorMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  cardSettings: {
    paddingHorizontal: 10,
    paddingBottom: 10,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  formRow: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  descriptionInput: {
    minHeight: 74,
    textAlignVertical: "top",
  },
  noCardsBox: {
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 12,
    padding: 18,
  },
  noCardsText: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 8,
    textAlign: "center",
  },
  createButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 14,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: "900",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
    marginLeft: 2,
  },
  auctionCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  auctionTop: {
    flexDirection: "row",
    gap: 10,
  },
  auctionImage: {
    borderRadius: 6,
    height: 112,
    width: 80,
  },
  auctionImageFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 112,
    justifyContent: "center",
    width: 80,
  },
  auctionMain: {
    flex: 1,
  },
  cardHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  cardTitleGroup: {
    flex: 1,
  },
  auctionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  cardName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "900",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  detailsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  detailItem: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  sellerRow: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
    paddingTop: 10,
  },
  sellerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  bidRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  bidInput: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  bidButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  bidButtonText: {
    fontWeight: "900",
  },
  disabledInput: {
    opacity: 0.55,
  },
  disabledButton: {
    opacity: 0.5,
  },
  helperText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
});
