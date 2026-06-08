import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
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

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  return (Number(digits) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatRemaining(value) {
  const remainingMs = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "Encerrado";

  const totalMinutes = Math.ceil(remainingMs / (60 * 1000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function normalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function canCreateAuctionForUser(user) {
  if (user?.isAdmin) return true;
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
    idioma: card.idioma ?? "Portugues",
    qualidade: card.qualidade ?? "NM",
  };
}

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["NM", "LP", "MP", "HP", "DMG"];

function getRemainingHours(auction) {
  const remainingMs = new Date(auction?.endsAt).getTime() - Date.now();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "1";

  return String(Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000))));
}

function OptionChips({ options, value, onChange, colors }) {
  return (
    <View style={styles.optionRow}>
      {options.map((option) => {
        const optionValue = typeof option === "string" ? option : option.value;
        const optionLabel = typeof option === "string" ? option : option.label;
        const selected = optionValue === value;

        return (
          <TouchableOpacity
            activeOpacity={0.85}
            key={optionValue}
            onPress={() => onChange(optionValue)}
            style={[
              styles.optionChip,
              {
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
              },
            ]}
          >
            <Text style={[styles.optionChipText, { color: selected ? colors.onPrimary : colors.text }]}>
              {optionLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function AuctionView() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [auctions, setAuctions] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [bidValues, setBidValues] = useState({});
  const [auctionName, setAuctionName] = useState("");
  const [auctionMode, setAuctionMode] = useState("standard");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [cardDrafts, setCardDrafts] = useState({});
  const [editingAuctionId, setEditingAuctionId] = useState(null);
  const [auctionDrafts, setAuctionDrafts] = useState({});
  const [auctionFilter, setAuctionFilter] = useState("open");
  const [search, setSearch] = useState("");

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

  const canCreateAuction = canCreateAuctionForUser(user);

  const auctionSessions = useMemo(() => {
    const sessions = new Map();

    auctions.forEach((auction) => {
      const sessionId = auction.sessionId ?? auction.id;
      const current = sessions.get(sessionId) ?? [];
      sessions.set(sessionId, [...current, auction]);
    });

    return Array.from(sessions.entries())
      .map(([sessionId, items]) => {
        const sortedItems = [...items].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const base = sortedItems[0];
        const activeAuction = sortedItems.find((auction) => auction.id === base.activeAuctionId)
          ?? sortedItems.find((auction) => !AuctionService.isClosed(auction))
          ?? base;

        return {
          ...activeAuction,
          sessionId,
          sessionAuctions: sortedItems,
          totalCards: sortedItems.length,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [auctions]);

  const selectableCards = useMemo(() => {
    const seen = new Set();
    return myCards.filter((card) => {
      if (!card?.id || seen.has(card.id)) return false;
      seen.add(card.id);
      return true;
    });
  }, [myCards]);

  const filteredAuctionSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return auctionSessions.filter((auction) => {
      const closed = AuctionService.isClosed(auction);
      const mine = auction.seller?.id === user?.id;

      if (auctionFilter === "open" && closed) return false;
      if (auctionFilter === "closed" && !closed) return false;
      if (auctionFilter === "mine" && !mine) return false;

      if (!term) return true;

      const searchable = [
        auction.auctionName,
        auction.title,
        auction.cardName,
        auction.seller?.name,
        auction.seller?.handle,
        auction.qualidade,
        auction.idioma,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [auctionFilter, auctionSessions, search, user?.id]);

  const updateCardDraft = (cardId, field, value) => {
    setCardDrafts((current) => ({
      ...current,
      [cardId]: {
        startPrice: "",
        durationHours: "24",
        description: "",
        idioma: "Portugues",
        qualidade: "NM",
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
          idioma: card.idioma ?? "Portugues",
          qualidade: card.qualidade ?? "NM",
        },
      }));
      return [...current, card.id];
    });
  };

  const createAuctions = async () => {
    if (!canCreateAuction) {
      Alert.alert("Acesso restrito", "Apenas Administradores e Leiloeiros podem criar leiloes.");
      return;
    }

    if (selectedCards.length === 0) {
      Alert.alert("Selecione cartas", "Escolha ao menos uma das suas cartas para leiloar.");
      return;
    }

    const normalizedAuctionName = auctionName.trim();
    if (!normalizedAuctionName) {
      Alert.alert("Nome do leilao", "Digite um nome para este leilao.");
      return;
    }

    try {
      const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      let firstAuction = null;

      for (const cardId of selectedCards) {
        const card = selectableCards.find((item) => item.id === cardId);
        const draft = cardDrafts[cardId] ?? {};

        const createdAuction = await AuctionService.createAuction({
          title: `${normalizedAuctionName} - ${card.name}`,
          auctionName: normalizedAuctionName,
          sessionId,
          mode: auctionMode,
          cardName: card.name,
          card: makeCardSnapshot(card),
          description: draft.description,
          startPrice: draft.startPrice,
          durationHours: draft.durationHours,
          idioma: draft.idioma,
          qualidade: draft.qualidade,
          seller: user,
        });

        firstAuction = firstAuction ?? createdAuction;
      }

      setAuctionName("");
      setAuctionMode("standard");
      setSelectedCards([]);
      setCardDrafts({});
      setCreateModalVisible(false);

      if (firstAuction) {
        router.push(`/views/AuctionRoomView?sessionId=${encodeURIComponent(firstAuction.sessionId)}`);
      }
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

  const openProfile = (profileId) => {
    if (!profileId) return;
    router.push(`/views/ProfileView?userId=${encodeURIComponent(profileId)}`);
  };

  const startEditingAuction = (auction) => {
    setEditingAuctionId(auction.id);
    setAuctionDrafts((current) => ({
      ...current,
      [auction.id]: {
        title: auction.title,
        auctionName: auction.auctionName,
        startPrice: String(auction.startPrice),
        durationHours: getRemainingHours(auction),
        description: auction.description,
        idioma: auction.idioma ?? "Portugues",
        qualidade: auction.qualidade ?? "NM",
      },
    }));
  };

  const updateAuctionDraft = (auctionId, field, value) => {
    setAuctionDrafts((current) => ({
      ...current,
      [auctionId]: {
        title: "",
        auctionName: "",
        startPrice: "",
        durationHours: "24",
        description: "",
        idioma: "Portugues",
        qualidade: "NM",
        ...current[auctionId],
        [field]: value,
      },
    }));
  };

  const saveAuction = async (auction) => {
    try {
      const draft = auctionDrafts[auction.id] ?? {};
      await AuctionService.updateAuction(auction.id, {
        ...draft,
        title: `${draft.auctionName || auction.auctionName || auction.title} - ${auction.cardName}`,
      }, user);
      setEditingAuctionId(null);
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const removeAuction = (auction) => {
    Alert.alert(
      "Remover anuncio",
      `Deseja remover o leilao de ${auction.cardName || auction.title}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await AuctionService.removeAuction(auction.id, user);
              setEditingAuctionId((current) => (current === auction.id ? null : current));
            } catch (error) {
              Alert.alert("Erro", error.message);
            }
          },
        },
      ]
    );
  };

  const openAuctionRoom = (auction) => {
    router.push(`/views/AuctionRoomView?sessionId=${encodeURIComponent(auction.sessionId ?? auction.id)}`);
  };

  const renderSelectableCard = ({ item }) => {
    const selected = selectedCards.includes(item.id);
    const draft = cardDrafts[item.id] ?? {
      startPrice: "",
      durationHours: "24",
      description: "",
      idioma: item.idioma ?? "Portugues",
      qualidade: item.qualidade ?? "NM",
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
              {item.set || "Sem colecao"} {getCardCode(item) ? `- ${getCardCode(item)}` : ""}
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
            <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Qualidade</Text>
            <OptionChips
              colors={colors}
              options={qualityOptions}
              value={draft.qualidade}
              onChange={(value) => updateCardDraft(item.id, "qualidade", value)}
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Idioma</Text>
            <OptionChips
              colors={colors}
              options={languageOptions}
              value={draft.idioma}
              onChange={(value) => updateCardDraft(item.id, "idioma", value)}
            />
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
    const highestBidder = AuctionService.getHighestBidder(item);
    const isOwnAuction = item.seller?.id === user?.id;
    const isEditing = editingAuctionId === item.id;
    const auctionDraft = auctionDrafts[item.id] ?? {
      title: item.title,
      auctionName: item.auctionName,
      startPrice: String(item.startPrice),
      durationHours: getRemainingHours(item),
      description: item.description,
      idioma: item.idioma ?? "Portugues",
      qualidade: item.qualidade ?? "NM",
    };
    const image = getCardImage(item.card);
    const totalCards = item.totalCards ?? item.sessionAuctions?.length ?? 1;
    const sellerName = item.seller?.name ?? "Vendedor";
    const sellerInitials = sellerName.slice(0, 2).toUpperCase();
    const bidCount = item.bids?.length ?? 0;

    return (
      <View style={[styles.auctionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.auctionHeader}>
          <TouchableOpacity
            activeOpacity={0.78}
            onPress={() => openProfile(item.seller?.id)}
            style={styles.sellerIdentity}
          >
            <View style={[styles.sellerAvatar, { backgroundColor: item.seller?.themeColor || colors.accent }]}>
              {item.seller?.photo ? (
                <Image source={{ uri: item.seller.photo }} style={styles.sellerAvatarImage} />
              ) : (
                <Text style={[styles.sellerAvatarText, { color: colors.onAccent }]}>
                  {sellerInitials}
                </Text>
              )}
            </View>
            <View style={styles.auctionNameBlock}>
              <Text numberOfLines={1} style={[styles.auctionName, { color: colors.text }]}>
                {item.auctionName || item.title}
              </Text>
              <Text numberOfLines={1} style={[styles.sellerName, { color: colors.mutedText }]}>
                {sellerName}
              </Text>
            </View>
          </TouchableOpacity>
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

        <View style={styles.liveSummary}>
          {image ? (
            <Image source={{ uri: image }} style={styles.auctionImage} />
          ) : (
            <View style={[styles.auctionImageFallback, { backgroundColor: colors.surfaceVariant }]}>
              <MaterialCommunityIcons name="cards" size={32} color={colors.mutedText} />
            </View>
          )}
          <View style={styles.liveInfo}>
            <Text numberOfLines={1} style={[styles.liveCardName, { color: colors.text }]}>
              {item.cardName}
            </Text>
            <Text numberOfLines={1} style={[styles.liveCardMeta, { color: colors.mutedText }]}>
              {[item.qualidade, item.idioma].filter(Boolean).join(" - ")}
            </Text>
            <View style={[styles.bidSummaryStrip, { backgroundColor: colors.surfaceVariant }]}>
              <View style={styles.bidSummaryMain}>
                <Text style={[styles.bidSummaryLabel, { color: colors.mutedText }]}>Maior lance</Text>
                <Text numberOfLines={1} style={[styles.bidSummaryValue, { color: colors.text }]}>
                  {formatCurrency(highestBid)}
                </Text>
                <Text numberOfLines={1} style={[styles.bidSummaryLeader, { color: colors.mutedText }]}>
                  {highestBidder ? highestBidder.name : "Lance inicial"}
                </Text>
              </View>
              <View style={styles.bidSummaryMeta}>
                <Text style={[styles.bidSummaryMetaText, { color: colors.primary }]}>
                  {bidCount} lance(s)
                </Text>
                <Text style={[styles.bidSummaryMetaText, { color: colors.mutedText }]}>
                  {totalCards} carta(s)
                </Text>
                <Text style={[styles.bidSummaryMetaText, { color: colors.mutedText }]}>
                  {formatRemaining(item.endsAt)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {isOwnAuction ? (
          <View style={styles.ownerPanel}>
            {isEditing && (
              <View style={styles.editForm}>
                <TextInput
                  onChangeText={(value) => updateAuctionDraft(item.id, "auctionName", value)}
                  placeholder="Nome do leilao"
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                  ]}
                  value={auctionDraft.auctionName}
                />
                <View style={styles.formRow}>
                  <TextInput
                    keyboardType="decimal-pad"
                    onChangeText={(value) => updateAuctionDraft(item.id, "startPrice", value)}
                    placeholder="Lance inicial"
                    placeholderTextColor={colors.mutedText}
                    style={[
                      styles.input,
                      styles.inlineInput,
                      { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                    ]}
                    value={auctionDraft.startPrice}
                  />
                  <TextInput
                    keyboardType="number-pad"
                    onChangeText={(value) => updateAuctionDraft(item.id, "durationHours", value)}
                    placeholder="Horas restantes"
                    placeholderTextColor={colors.mutedText}
                    style={[
                      styles.input,
                      styles.inlineInput,
                      { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                    ]}
                    value={auctionDraft.durationHours}
                  />
                </View>
                <TextInput
                  multiline
                  onChangeText={(value) => updateAuctionDraft(item.id, "description", value)}
                  placeholder="Descricao do anuncio"
                  placeholderTextColor={colors.mutedText}
                  style={[
                    styles.input,
                    styles.descriptionInput,
                    { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                  ]}
                  value={auctionDraft.description}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Qualidade</Text>
                <OptionChips
                  colors={colors}
                  options={qualityOptions}
                  value={auctionDraft.qualidade}
                  onChange={(value) => updateAuctionDraft(item.id, "qualidade", value)}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Idioma</Text>
                <OptionChips
                  colors={colors}
                  options={languageOptions}
                  value={auctionDraft.idioma}
                  onChange={(value) => updateAuctionDraft(item.id, "idioma", value)}
                />
              </View>
            )}

            <View style={styles.ownerActions}>
              {isEditing ? (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => saveAuction(item)}
                    style={[styles.ownerButton, { backgroundColor: colors.primary }]}
                  >
                    <MaterialCommunityIcons name="content-save" size={18} color={colors.onPrimary} />
                    <Text style={[styles.ownerButtonText, { color: colors.onPrimary }]}>Salvar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setEditingAuctionId(null)}
                    style={[
                      styles.ownerButton,
                      styles.secondaryOwnerButton,
                      { borderColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons name="close" size={18} color={colors.text} />
                    <Text style={[styles.ownerButtonText, { color: colors.text }]}>Cancelar</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => startEditingAuction(item)}
                    style={[styles.ownerButton, { backgroundColor: colors.primary }]}
                  >
                    <MaterialCommunityIcons name="pencil" size={18} color={colors.onPrimary} />
                    <Text style={[styles.ownerButtonText, { color: colors.onPrimary }]}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => removeAuction(item)}
                    style={[
                      styles.ownerButton,
                      styles.secondaryOwnerButton,
                      { borderColor: colors.border },
                    ]}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.text} />
                    <Text style={[styles.ownerButtonText, { color: colors.text }]}>Remover</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
            <Text style={[styles.helperText, { color: colors.mutedText }]}>
              Este anuncio e seu. Voce pode edita-lo ou remove-lo, mas nao pode dar lance nele.
            </Text>
          </View>
        ) : (
          <View style={styles.bidRow}>
            <TextInput
              editable={!closed}
              keyboardType="decimal-pad"
              onChangeText={(value) => setBidValues((current) => ({ ...current, [item.id]: formatMoneyInput(value) }))}
              placeholder={`Min. ${formatCurrency(getBidStep(item))}`}
              placeholderTextColor={colors.mutedText}
              style={[
                styles.bidInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  borderColor: colors.border,
                  color: colors.text,
                },
                closed && styles.disabledInput,
              ]}
              value={bidValues[item.id] ?? ""}
            />
            <TouchableOpacity
              activeOpacity={0.85}
              disabled={closed}
              onPress={() => placeBid(item)}
              style={[
                styles.bidButton,
                { backgroundColor: colors.primary },
                closed && styles.disabledButton,
              ]}
            >
              <MaterialCommunityIcons name="gavel" size={18} color={colors.onPrimary} />
              <Text style={[styles.bidButtonText, { color: colors.onPrimary }]}>Lance</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openAuctionRoom(item)}
          style={[styles.watchButton, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="eye-outline" size={18} color={colors.primary} />
          <Text style={[styles.watchButtonText, { color: colors.primary }]}>Acompanhar leilao</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const closeCreateModal = () => {
    setCreateModalVisible(false);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Leiloes Yellow Duck" />

      <FlatList
        data={filteredAuctionSessions}
        keyExtractor={(item) => item.sessionId}
        renderItem={renderAuction}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={styles.toolbar}>
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
                <TextInput
                  onChangeText={setSearch}
                  placeholder="Buscar leilao, carta ou vendedor"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={search}
                />
                {!!search && (
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setSearch("")}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedText} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.filterRow, { backgroundColor: colors.surfaceVariant }]}>
                {[
                  { label: "Abertos", value: "open" },
                  { label: "Todos", value: "all" },
                  { label: "Meus", value: "mine" },
                  { label: "Encerrados", value: "closed" },
                ].map((option) => {
                  const selected = auctionFilter === option.value;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      key={option.value}
                      onPress={() => setAuctionFilter(option.value)}
                      style={[
                        styles.filterChip,
                        {
                          backgroundColor: selected ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      <Text style={[styles.filterChipText, { color: selected ? colors.onPrimary : colors.mutedText }]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {canCreateAuction ? (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => setCreateModalVisible(true)}
                  style={[styles.createButton, { backgroundColor: colors.accent }]}
                >
                  <MaterialCommunityIcons name="plus-circle" size={20} color={colors.onAccent} />
                  <Text style={[styles.createButtonText, { color: colors.onAccent }]}>Criar leilao</Text>
                </TouchableOpacity>
              ) : (
                <View style={[styles.permissionNote, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="shield-lock" size={18} color={colors.mutedText} />
                  <Text style={[styles.permissionText, { color: colors.mutedText }]}>
                    Administradores e Leiloeiros podem publicar. Todos podem participar.
                  </Text>
                </View>
              )}
            </View>

          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="gavel" size={42} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum leilao publicado</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Quando um Administrador ou Leiloeiro publicar uma carta, ela aparece aqui.
            </Text>
          </View>
        }
      />

      <Modal
        animationType="fade"
        onRequestClose={closeCreateModal}
        transparent
        visible={createModalVisible}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={closeCreateModal}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
          >
            <View style={styles.formHeader}>
              <View>
                <Text style={[styles.formTitle, { color: colors.text }]}>Criar leilao</Text>
                <Text style={[styles.selectedCount, { color: colors.mutedText }]}>
                  {selectedCards.length} carta(s) selecionada(s)
                </Text>
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={closeCreateModal} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <TextInput
                onChangeText={setAuctionName}
                placeholder="Nome do leilao"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                ]}
                value={auctionName}
              />

              <Text style={[styles.fieldLabel, { color: colors.mutedText }]}>Tipo de leilao</Text>
              <OptionChips
                colors={colors}
                options={[
                  { label: "Padrao", value: "standard" },
                  { label: "Dinamico", value: "dynamic" },
                ]}
                value={auctionMode}
                onChange={setAuctionMode}
              />
              <Text style={[styles.helperText, { color: colors.mutedText }]}>
                Dinamico permite adicionar cartas e conversar entre as cartas durante o leilao.
              </Text>

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
                    Adicione cartas em Minhas listas para poder seleciona-las aqui.
                  </Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeCreateModal}
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={selectedCards.length === 0}
                onPress={createAuctions}
                style={[
                  styles.modalButton,
                  { backgroundColor: colors.accent },
                  selectedCards.length === 0 && styles.disabledButton,
                ]}
              >
                <Text style={[styles.createButtonText, { color: colors.onAccent }]}>Publicar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  toolbar: {
    gap: 10,
    marginBottom: 14,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 0,
    paddingVertical: 8,
  },
  filterRow: {
    borderRadius: 8,
    flexDirection: "row",
    gap: 4,
    padding: 4,
  },
  filterChip: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 0,
    paddingHorizontal: 8,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  permissionNote: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 10,
  },
  permissionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
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
  fieldLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    marginTop: 2,
    textTransform: "uppercase",
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
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  optionChipText: {
    fontSize: 12,
    fontWeight: "900",
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
  auctionCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 14,
    padding: 10,
  },
  auctionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sellerIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: 8,
    minWidth: 0,
  },
  sellerAvatar: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    overflow: "hidden",
    width: 36,
  },
  sellerAvatarImage: {
    height: "100%",
    width: "100%",
  },
  sellerAvatarText: {
    fontSize: 12,
    fontWeight: "900",
  },
  auctionNameBlock: {
    flex: 1,
    minWidth: 0,
  },
  auctionName: {
    fontSize: 17,
    fontWeight: "900",
  },
  sellerName: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
  },
  liveSummary: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 12,
  },
  auctionImage: {
    borderRadius: 6,
    height: 104,
    resizeMode: "contain",
    width: 74,
  },
  auctionImageFallback: {
    alignItems: "center",
    borderRadius: 6,
    height: 104,
    justifyContent: "center",
    width: 74,
  },
  liveInfo: {
    flex: 1,
    minWidth: 0,
  },
  liveCardName: {
    fontSize: 17,
    fontWeight: "900",
  },
  liveCardMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  bidSummaryStrip: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bidSummaryMain: {
    flex: 1,
    minWidth: 0,
  },
  bidSummaryLabel: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  bidSummaryValue: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 2,
  },
  bidSummaryLeader: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },
  bidSummaryMeta: {
    alignItems: "flex-end",
    gap: 3,
  },
  bidSummaryMetaText: {
    fontSize: 11,
    fontWeight: "800",
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
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
  watchButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  watchButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
  ownerPanel: {
    marginTop: 12,
  },
  editForm: {
    marginBottom: 2,
  },
  ownerActions: {
    flexDirection: "row",
    gap: 8,
  },
  ownerButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  secondaryOwnerButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  ownerButtonText: {
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
  modalOverlay: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderRadius: 8,
    maxHeight: "88%",
    maxWidth: 620,
    padding: 14,
    width: "100%",
  },
  modalScroll: {
    maxHeight: 560,
  },
  closeButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 12,
  },
  modalButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 42,
    minWidth: 110,
    paddingHorizontal: 14,
  },
  cancelText: {
    fontWeight: "900",
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
