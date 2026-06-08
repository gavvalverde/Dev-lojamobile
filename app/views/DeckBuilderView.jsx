import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  useWindowDimensions,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { CardListService } from "../services/CardListService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";

const energyNames = new Set(["Grass Energy", "Fire Energy", "Water Energy", "Lightning Energy", "Psychic Energy", "Fighting Energy", "Darkness Energy", "Metal Energy", "Fairy Energy"]);

function getCardId(card) {
  return String(card?.cardId ?? card?.id ?? "");
}

function makeCardSnapshot(card) {
  return {
    id: getCardId(card),
    cardId: getCardId(card),
    name: card?.name ?? "Carta",
    images: card?.images ?? null,
    image: card?.image ?? null,
    imageUrl: card?.imageUrl ?? null,
    set: card?.set ?? null,
    number: card?.number ?? null,
    collectionNumber: card?.collectionNumber ?? null,
    supertype: card?.supertype ?? null,
    tipoCarta: card?.tipoCarta ?? null,
    cardType: card?.cardType ?? null,
    subtypes: Array.isArray(card?.subtypes) ? card.subtypes : [],
    subtipos: Array.isArray(card?.subtipos) ? card.subtipos : [],
  };
}

function getCardImage(card) {
  const image = card?.images?.small ?? card?.images?.large ?? card?.image ?? card?.imageUrl;
  return image ? { uri: image } : null;
}

function getCardCode(card) {
  return [card?.set, card?.number ?? card?.collectionNumber].filter(Boolean).join(" - ");
}

function normalizeCardType(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getDeckCardType(card) {
  const type = normalizeCardType(card?.supertype ?? card?.tipoCarta ?? card?.cardType ?? card?.tipo);

  if (type.includes("pokemon")) return "pokemon";
  if (type.includes("trainer") || type.includes("treinador")) return "trainer";
  if (type.includes("energy") || type.includes("energia")) return "energy";

  const subtypes = [
    ...(Array.isArray(card?.subtypes) ? card.subtypes : []),
    ...(Array.isArray(card?.subtipos) ? card.subtipos : []),
  ].map(normalizeCardType).join(" ");

  if (subtypes.includes("energy") || subtypes.includes("energia")) return "energy";
  if (subtypes.includes("supporter") || subtypes.includes("item") || subtypes.includes("stadium") || subtypes.includes("tool")) return "trainer";
  if (subtypes.includes("basic") || subtypes.includes("stage") || subtypes.includes("mega") || subtypes.includes("vmax") || subtypes.includes("vstar") || subtypes.includes("ex")) return "pokemon";

  const name = normalizeCardType(card?.name);
  if (name.includes("energy") || name.includes("energia")) return "energy";
  if (
    name.includes("professor") ||
    name.includes("boss") ||
    name.includes("switch") ||
    name.includes("ball") ||
    name.includes("rod") ||
    name.includes("stadium") ||
    name.includes("potion") ||
    name.includes("trainer")
  ) return "trainer";

  if (card?.name && (card?.set || card?.collectionNumber || card?.number || card?.images)) return "pokemon";

  return "other";
}

function hasCardTypeData(card) {
  if (!card) return false;
  return Boolean(
    card.supertype ||
    card.tipoCarta ||
    card.cardType ||
    card.tipo ||
    (Array.isArray(card.subtypes) && card.subtypes.length > 0) ||
    (Array.isArray(card.subtipos) && card.subtipos.length > 0)
  );
}

function isBasicEnergy(card) {
  const subtypes = (card?.subtypes ?? []).map(normalizeCardType);
  return getDeckCardType(card) === "energy" && subtypes.includes("basic")
    || energyNames.has(card?.name);
}

function normalizeDeckCards(deck) {
  return Array.isArray(deck?.deckCards) ? deck.deckCards : [];
}

export default function DeckBuilderView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 920;
  const [lists, setLists] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [activeDeckId, setActiveDeckId] = useState(null);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [newDeckName, setNewDeckName] = useState("");
  const [deckSearch, setDeckSearch] = useState("");
  const [deckModalVisible, setDeckModalVisible] = useState(false);
  const [deleteDeckModalVisible, setDeleteDeckModalVisible] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState(null);
  const [deckDropdownOpen, setDeckDropdownOpen] = useState(false);

  const closeDeckDropdown = useCallback(() => {
    setDeckDropdownOpen(false);
    setDeckSearch("");
  }, []);

  const toggleDeckDropdown = useCallback(() => {
    if (deckDropdownOpen) {
      closeDeckDropdown();
      return;
    }

    setDeckDropdownOpen(true);
  }, [closeDeckDropdown, deckDropdownOpen]);

  useFocusEffect(
    useCallback(() => {
      closeDeckDropdown();
    }, [closeDeckDropdown])
  );

  useEffect(() => {
    const unsubscribeLists = CardListService.subscribe(setLists);
    const unsubscribeCards = MyCardsService.subscribe(setMyCards);

    return () => {
      unsubscribeLists();
      unsubscribeCards();
    };
  }, []);

  const decks = useMemo(() => lists.filter((list) => list.type === "deck"), [lists]);
  const filteredDecks = useMemo(() => {
    const term = deckSearch.trim().toLowerCase();
    if (!term) return decks;
    return decks.filter((deck) => String(deck.name ?? "").toLowerCase().includes(term));
  }, [deckSearch, decks]);
  const activeDeck = decks.find((deck) => deck.id === activeDeckId) ?? decks[0] ?? null;
  const ownedCounts = useMemo(() => {
    const countsById = new Map();
    myCards.forEach((card) => {
      const cardId = getCardId(card);
      if (!cardId) return;
      countsById.set(cardId, (countsById.get(cardId) ?? 0) + (Number(card.quantity ?? card.quantidade) || 1));
    });
    return countsById;
  }, [myCards]);
  const cardsById = useMemo(() => new Map(myCards.map((card) => [getCardId(card), card])), [myCards]);
  const deckCards = normalizeDeckCards(activeDeck);
  const deckTotal = deckCards.reduce((total, item) => total + item.quantity, 0);
  const deckRows = deckCards
    .map((item) => {
      const ownedCard = cardsById.get(item.cardId);
      const savedCard = item.card ?? item.cardSnapshot ?? null;
      const card = ownedCard && savedCard ? { ...savedCard, ...ownedCard } : ownedCard ?? savedCard;
      return { ...item, card };
    })
    .filter((item) => item.card)
    .sort((a, b) => String(a.card.name).localeCompare(String(b.card.name)));
  const missingCards = deckRows
    .map((item) => ({
      ...item,
      ownedQuantity: ownedCounts.get(item.cardId) ?? 0,
      missingQuantity: Math.max(0, item.quantity - (ownedCounts.get(item.cardId) ?? 0)),
    }))
    .filter((item) => item.missingQuantity > 0);

  const counts = deckRows.reduce(
    (summary, item) => {
      const type = getDeckCardType(item.card);
      if (type === "pokemon") summary.pokemon += item.quantity;
      else if (type === "trainer") summary.trainer += item.quantity;
      else if (type === "energy") summary.energy += item.quantity;
      else summary.other += item.quantity;
      return summary;
    },
    { pokemon: 0, trainer: 0, energy: 0, other: 0 }
  );

  const invalidCopies = deckRows.filter((item) => item.quantity > 4 && !isBasicEnergy(item.card));
  const completionPercent = Math.max(0, Math.min(100, (deckTotal / 60) * 100));
  const missingTotal = missingCards.reduce((total, item) => total + item.missingQuantity, 0);
  const deckIsReady = deckTotal === 60 && invalidCopies.length === 0;
  const deckStatusText = deckIsReady
    ? "Deck pronto"
    : deckTotal > 60
      ? `${deckTotal - 60} carta(s) acima`
      : `${60 - deckTotal} carta(s) restantes`;
  const validationText = deckTotal === 60 && invalidCopies.length === 0
    ? "Deck pronto"
    : `${deckTotal}/60 cartas${invalidCopies.length ? " - limite de copias excedido" : ""}`;

  useEffect(() => {
    const term = search.trim();
    let active = true;

    if (term.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    const timeoutId = setTimeout(() => {
      PokemonService.searchCards(term)
        .then((cards) => {
          if (active) setSearchResults(cards);
        })
        .catch((error) => {
          console.error("Erro ao buscar cartas para deck:", error);
          if (active) setSearchResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 320);

    return () => {
      active = false;
      clearTimeout(timeoutId);
    };
  }, [search]);

  useEffect(() => {
    const currentDeckId = activeDeck?.id;
    if (!currentDeckId) return;

    const cardsToEnrich = deckCards.filter((item) => item.cardId && !hasCardTypeData(item.card ?? item.cardSnapshot));
    if (cardsToEnrich.length === 0) return;

    let active = true;

    Promise.allSettled(cardsToEnrich.map((item) => PokemonService.fetchCardById(item.cardId))).then((results) => {
      if (!active) return;

      const cardsByDeckId = new Map();
      results.forEach((result, index) => {
        if (result.status === "fulfilled" && result.value) {
          cardsByDeckId.set(cardsToEnrich[index].cardId, makeCardSnapshot(result.value));
        }
      });

      if (cardsByDeckId.size === 0) return;

      const nextDeckCards = deckCards.map((item) => (
          cardsByDeckId.has(item.cardId)
            ? { ...item, card: { ...(item.card ?? {}), ...cardsByDeckId.get(item.cardId) } }
            : item
        ));

      CardListService.updateList(currentDeckId, {
        deckCards: nextDeckCards,
        cardIds: nextDeckCards.map((item) => item.cardId),
      });
    });

    return () => {
      active = false;
    };
  }, [activeDeck?.id, deckCards]);

  const availableCards = useMemo(() => {
    const term = search.trim().toLowerCase();
    const unique = [];
    const seen = new Set();
    const sourceCards = term.length >= 2 ? [...searchResults, ...myCards] : myCards;

    sourceCards.forEach((card) => {
      const cardId = getCardId(card);
      if (!cardId || seen.has(cardId)) return;
      seen.add(cardId);
      unique.push(card);
    });

    if (!term) return unique;

    return unique.filter((card) =>
      [card.name, card.set, card.number, card.collectionNumber, card.supertype]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [myCards, search, searchResults]);

  const createDeck = () => {
    const name = newDeckName.trim();
    if (!name) {
      Alert.alert("Deck", "Informe um nome para o deck.");
      return;
    }

    const deck = CardListService.createList(name);
    CardListService.updateList(deck.id, { type: "deck", format: "Padrao", deckCards: [], cardIds: [] });
    setActiveDeckId(deck.id);
    closeDeckDropdown();
    setNewDeckName("");
    setDeckModalVisible(false);
  };

  const updateDeckCards = (nextDeckCards) => {
    if (!activeDeck) return;
    CardListService.updateList(activeDeck.id, {
      deckCards: nextDeckCards,
      cardIds: nextDeckCards.map((item) => item.cardId),
    });
  };

  const addCard = (card) => {
    if (!activeDeck) {
      openDeckModal();
      return;
    }

    const cardId = getCardId(card);
    const current = deckCards.find((item) => item.cardId === cardId);

    if (current) {
      updateQuantity(cardId, current.quantity + 1);
      return;
    }

    updateDeckCards([...deckCards, { cardId, quantity: 1, card: makeCardSnapshot(card) }]);
  };

  const updateQuantity = (cardId, quantity) => {
    const nextQuantity = Math.max(0, Math.min(99, quantity));
    const nextDeckCards = deckCards
      .map((item) => (item.cardId === cardId ? { ...item, quantity: nextQuantity } : item))
      .filter((item) => item.quantity > 0);

    updateDeckCards(nextDeckCards);
  };

  const removeDeck = () => {
    if (!activeDeck) return;
    setDeckToDelete(activeDeck);
    setDeleteDeckModalVisible(true);
  };

  const confirmRemoveDeck = () => {
    if (!deckToDelete) return;
    CardListService.removeList(deckToDelete.id);
    setActiveDeckId((currentId) => (currentId === deckToDelete.id ? null : currentId));
    closeDeckDropdown();
    setDeckToDelete(null);
    setDeleteDeckModalVisible(false);
  };

  const selectDeck = (deckId) => {
    setActiveDeckId(deckId);
    closeDeckDropdown();
  };

  const openDeckModal = () => {
    closeDeckDropdown();
    setDeckModalVisible(true);
  };

  const renderCollectionCard = ({ item }) => {
    const cardId = getCardId(item);
    const inDeck = deckCards.find((deckCard) => deckCard.cardId === cardId);
    const image = getCardImage(item);

    return (
      <TouchableOpacity
        activeOpacity={0.86}
        onPress={() => addCard(item)}
        style={[styles.collectionItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {image ? (
          <Image source={image} style={styles.cardThumb} />
        ) : (
          <View style={[styles.cardThumb, styles.cardThumbEmpty, { backgroundColor: colors.surfaceVariant }]}>
            <MaterialCommunityIcons name="cards-outline" size={20} color={colors.mutedText} />
          </View>
        )}
        <View style={styles.cardText}>
          <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.mutedText }]}>
            {ownedCounts.has(cardId) ? "Na colecao" : "Falta na colecao"} - {getCardCode(item) || item.supertype || "Carta"}
          </Text>
        </View>
        <View style={[styles.addBadge, { backgroundColor: inDeck ? colors.accent : colors.surfaceVariant }]}>
          <Text style={[styles.addBadgeText, { color: inDeck ? colors.onAccent : colors.mutedText }]}>
            {inDeck ? inDeck.quantity : "+"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu showBack={false} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerPanel}>
          {decks.length > 0 && (
            <View style={styles.deckToolbar}>
              <View style={styles.deckDropdownWrap}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={toggleDeckDropdown}
                style={[
                  styles.deckDropdownButton,
                  { backgroundColor: colors.surfaceVariant, borderColor: colors.border },
                ]}
              >
                <View style={[styles.deckDropdownIcon, { backgroundColor: colors.surface }]}>
                  <MaterialCommunityIcons name="cards-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.deckDropdownText}>
                  <View style={styles.deckDropdownTitleRow}>
                    <Text numberOfLines={1} style={[styles.deckDropdownLabel, { color: colors.text }]}>
                      {activeDeck?.name ?? "Selecionar deck"}
                    </Text>
                    <View style={[styles.deckDropdownCount, { backgroundColor: colors.surface }]}>
                      <Text style={[styles.deckDropdownCountText, { color: deckIsReady ? colors.primary : colors.mutedText }]}>
                        {deckTotal}/60
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.deckDropdownProgressTrack, { backgroundColor: colors.surface }]}>
                    <View style={[styles.deckDropdownProgressFill, { backgroundColor: deckTotal > 60 ? colors.danger : colors.primary, width: `${completionPercent}%` }]} />
                  </View>
                  <Text style={[styles.deckDropdownMeta, { color: colors.mutedText }]}>
                    {invalidCopies.length ? "Limite de copias excedido" : deckStatusText}
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={deckDropdownOpen ? "chevron-up" : "chevron-down"}
                  size={24}
                  color={colors.mutedText}
                />
              </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {deckDropdownOpen && decks.length > 0 ? (
          <View style={[styles.deckPickerPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.deckPickerActions}>
              <View style={[styles.deckSearchBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
                <TextInput
                  onChangeText={setDeckSearch}
                  placeholder="Buscar deck"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={deckSearch}
                />
                {!!deckSearch && (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setDeckSearch("")} style={styles.smallIconButton}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedText} />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity activeOpacity={0.85} onPress={openDeckModal} style={[styles.iconButton, styles.deckAddButton, { backgroundColor: colors.primary }]}>
                <MaterialCommunityIcons name="plus" size={22} color={colors.onPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.deckPickerList}>
              {filteredDecks.length === 0 ? (
                <View style={[styles.emptyPanel, styles.compactEmptyPanel, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum deck encontrado</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedText }]}>Tente outro nome ou crie um deck novo.</Text>
                </View>
              ) : (
                filteredDecks.map((deck) => {
                  const selected = activeDeck?.id === deck.id;
                  const size = normalizeDeckCards(deck).reduce((total, item) => total + item.quantity, 0);
                  const percent = Math.max(0, Math.min(100, (size / 60) * 100));
                  return (
                    <TouchableOpacity
                      activeOpacity={0.86}
                      key={deck.id}
                      onPress={() => selectDeck(deck.id)}
                      style={[
                        styles.deckPickerItem,
                        { backgroundColor: selected ? colors.accent : colors.surfaceVariant, borderColor: selected ? colors.accent : colors.border },
                      ]}
                    >
                      <View style={[styles.deckPickerIcon, { backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.surface }]}>
                        <MaterialCommunityIcons name="cards-outline" size={20} color={selected ? colors.onAccent : colors.primary} />
                      </View>
                      <View style={styles.deckDropdownText}>
                        <View style={styles.deckDropdownTitleRow}>
                          <Text numberOfLines={1} style={[styles.deckDropdownItemName, { color: selected ? colors.onAccent : colors.text }]}>
                            {deck.name}
                          </Text>
                          <Text style={[styles.deckDropdownItemMeta, { color: selected ? colors.onAccent : colors.mutedText }]}>
                            {size}/60
                          </Text>
                        </View>
                        <View style={[styles.deckDropdownProgressTrack, { backgroundColor: selected ? "rgba(255,255,255,0.28)" : colors.surface }]}>
                          <View style={[styles.deckDropdownProgressFill, { backgroundColor: selected ? colors.onAccent : size > 60 ? colors.danger : colors.primary, width: `${percent}%` }]} />
                        </View>
                      </View>
                      <MaterialCommunityIcons name={selected ? "check-circle" : "chevron-right"} size={21} color={selected ? colors.onAccent : colors.mutedText} />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </View>
        ) : !activeDeck ? (
          <View style={[styles.emptyPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="cards-outline" size={42} color={colors.primary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum deck criado</Text>
            <TouchableOpacity activeOpacity={0.85} onPress={openDeckModal} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="plus" size={19} color={colors.onPrimary} />
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Criar deck</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.workspace, isDesktop && styles.desktopWorkspace]}>
            <View style={[
              styles.summaryPanel,
              isDesktop && styles.desktopSummaryPanel,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
              <View style={styles.summaryHeader}>
                <View style={styles.titleBlock}>
                  <Text numberOfLines={1} style={[styles.deckName, { color: colors.text }]}>{activeDeck.name}</Text>
                  <Text style={[styles.validationText, { color: deckTotal === 60 && invalidCopies.length === 0 ? colors.primary : colors.mutedText }]}>{validationText}</Text>
                </View>
                <TouchableOpacity activeOpacity={0.85} onPress={removeDeck} style={styles.iconButtonGhost}>
                  <MaterialCommunityIcons name="trash-can-outline" size={21} color={colors.danger} />
                </TouchableOpacity>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${completionPercent}%` }]} />
              </View>
              <View style={styles.statsRow}>
                <View style={[styles.statPill, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="pokeball" size={18} color={colors.primary} />
                  <View>
                    <Text style={[styles.statValue, { color: colors.text }]}>{counts.pokemon}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedText }]}>Pokemon</Text>
                  </View>
                </View>
                <View style={[styles.statPill, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="account-star-outline" size={18} color={colors.primary} />
                  <View>
                    <Text style={[styles.statValue, { color: colors.text }]}>{counts.trainer}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedText }]}>Trainer</Text>
                  </View>
                </View>
                <View style={[styles.statPill, { backgroundColor: colors.surfaceVariant }]}>
                  <MaterialCommunityIcons name="lightning-bolt-outline" size={18} color={colors.primary} />
                  <View>
                    <Text style={[styles.statValue, { color: colors.text }]}>{counts.energy}</Text>
                    <Text style={[styles.statLabel, { color: colors.mutedText }]}>Energy</Text>
                  </View>
                </View>
              </View>
              {missingCards.length > 0 && (
                <View style={[styles.missingBox, { backgroundColor: colors.surfaceVariant }]}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.missingTitle, { color: colors.text }]}>Faltam para completar</Text>
                    <Text style={[styles.sectionCount, { color: colors.danger }]}>{missingTotal} carta(s)</Text>
                  </View>
                  {missingCards.slice(0, 5).map((item) => (
                    <View key={`missing-${item.cardId}`} style={styles.missingRow}>
                      <Text numberOfLines={1} style={[styles.missingName, { color: colors.text }]}>
                        {item.card.name}
                      </Text>
                      <Text style={[styles.missingQty, { color: colors.danger }]}>
                        {item.missingQuantity}x
                      </Text>
                    </View>
                  ))}
                  {missingCards.length > 5 && (
                    <Text style={[styles.moreText, { color: colors.mutedText }]}>+{missingCards.length - 5} carta(s)</Text>
                  )}
                </View>
              )}

              {deckRows.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.mutedText }]}>Busque qualquer carta ou adicione cartas da sua colecao.</Text>
              ) : (
                <View style={styles.deckList}>
                  <View style={styles.sectionHeader}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Cartas do deck</Text>
                    <Text style={[styles.sectionCount, { color: colors.mutedText }]}>{deckRows.length} unica(s)</Text>
                  </View>
                  {deckRows.map((item) => {
                    const image = getCardImage(item.card);
                    const owned = ownedCounts.get(item.cardId) ?? 0;
                    return (
                  <View key={item.cardId} style={[styles.deckCardRow, { backgroundColor: colors.surfaceVariant }]}>
                    {image ? (
                      <Image source={image} style={styles.deckCardThumb} />
                    ) : (
                      <View style={[styles.deckCardThumb, styles.cardThumbEmpty, { backgroundColor: colors.surface }]}>
                        <MaterialCommunityIcons name="cards-outline" size={18} color={colors.mutedText} />
                      </View>
                    )}
                    <View style={styles.cardText}>
                      <Text numberOfLines={1} style={[styles.cardName, { color: colors.text }]}>{item.card.name}</Text>
                      <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.mutedText }]}>
                        {owned}/{item.quantity} na colecao - {getCardCode(item.card) || item.card.supertype || "Carta"}
                      </Text>
                    </View>
                    <View style={[styles.quantityControl, { backgroundColor: colors.surface }]}>
                      <TouchableOpacity activeOpacity={0.85} onPress={() => updateQuantity(item.cardId, item.quantity - 1)} style={styles.quantityButton}>
                      <MaterialCommunityIcons name="minus" size={18} color={colors.mutedText} />
                      </TouchableOpacity>
                      <Text style={[styles.quantityValue, { color: colors.text }]}>{item.quantity}</Text>
                      <TouchableOpacity activeOpacity={0.85} onPress={() => updateQuantity(item.cardId, item.quantity + 1)} style={styles.quantityButton}>
                      <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[
              styles.libraryPanel,
              isDesktop && styles.desktopLibraryPanel,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Adicionar cartas</Text>
                  <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>
                    {search.trim().length >= 2 ? "Resultados do catalogo" : "Sua colecao aparece primeiro"}
                  </Text>
                </View>
                {searching && <MaterialCommunityIcons name="loading" size={20} color={colors.primary} />}
              </View>
              <View style={[styles.searchBox, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
                <TextInput
                  onChangeText={setSearch}
                  placeholder="Buscar qualquer carta"
                  placeholderTextColor={colors.mutedText}
                  style={[styles.searchInput, { color: colors.text }]}
                  value={search}
                />
                {!!search && (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setSearch("")} style={styles.smallIconButton}>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedText} />
                  </TouchableOpacity>
                )}
              </View>

              <FlatList
                data={availableCards}
                keyExtractor={(item) => getCardId(item)}
                renderItem={renderCollectionCard}
                scrollEnabled={false}
                contentContainerStyle={styles.collectionList}
                ListEmptyComponent={
                  <View style={[styles.emptyPanel, styles.compactEmptyPanel, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>{searching ? "Buscando cartas" : "Nenhum resultado"}</Text>
                    <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                      {searching ? "Aguarde um instante." : "Digite pelo menos 2 caracteres para buscar no catalogo."}
                    </Text>
                  </View>
                }
              />
            </View>
          </View>
        )}
      </ScrollView>

      <Modal animationType="fade" onRequestClose={() => setDeckModalVisible(false)} transparent visible={deckModalVisible}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeckModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Novo deck</Text>
            <TextInput
              autoFocus
              onChangeText={setNewDeckName}
              placeholder="Nome do deck"
              placeholderTextColor={colors.mutedText}
              style={[styles.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
              value={newDeckName}
            />
            <TouchableOpacity activeOpacity={0.85} onPress={createDeck} style={[styles.primaryButton, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="content-save" size={19} color={colors.onPrimary} />
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Criar deck</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="fade" onRequestClose={() => setDeleteDeckModalVisible(false)} transparent visible={deleteDeckModalVisible}>
        <Pressable style={styles.modalBackdrop} onPress={() => setDeleteDeckModalVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Excluir deck</Text>
            <Text style={[styles.modalText, { color: colors.mutedText }]}>
              Excluir {deckToDelete?.name ?? "este deck"}?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity activeOpacity={0.85} onPress={() => setDeleteDeckModalVisible(false)} style={[styles.secondaryButton, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Voltar</Text>
              </TouchableOpacity>
              <TouchableOpacity activeOpacity={0.85} onPress={confirmRemoveDeck} style={[styles.dangerButton, { backgroundColor: colors.danger }]}>
                <MaterialCommunityIcons name="trash-can-outline" size={19} color={colors.onPrimary} />
                <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Excluir</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    alignSelf: "center",
    maxWidth: 1180,
    padding: 10,
    paddingBottom: 110,
    width: "100%",
  },
  headerPanel: {
    marginBottom: 8,
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 19,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    marginTop: 1,
  },
  iconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  deckAddButton: {
    height: 42,
    width: 42,
  },
  iconButtonGhost: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  deckDropdownWrap: {
    flex: 1,
    width: "100%",
  },
  deckToolbar: {
    alignItems: "center",
    flexDirection: "row",
    gap: 7,
  },
  deckDropdownButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 9,
    minHeight: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  deckDropdownIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  deckDropdownText: {
    flex: 1,
    minWidth: 0,
  },
  deckDropdownTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  deckDropdownLabel: {
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
    minWidth: 0,
  },
  deckDropdownMeta: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  deckDropdownCount: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 22,
    minWidth: 46,
    paddingHorizontal: 7,
  },
  deckDropdownCountText: {
    fontSize: 11,
    fontWeight: "900",
  },
  deckDropdownProgressTrack: {
    borderRadius: 8,
    height: 4,
    marginTop: 5,
    overflow: "hidden",
  },
  deckDropdownProgressFill: {
    borderRadius: 8,
    height: "100%",
  },
  deckDropdownMenu: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  deckDropdownItem: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  deckDropdownItemName: {
    fontSize: 13,
    fontWeight: "900",
  },
  deckDropdownItemMeta: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  deckPickerPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    width: "100%",
  },
  deckPickerActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  deckSearchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  deckPickerList: {
    gap: 8,
    marginTop: 10,
  },
  deckPickerItem: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 64,
    padding: 10,
  },
  deckPickerIcon: {
    alignItems: "center",
    borderRadius: 8,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  workspace: {
    gap: 12,
  },
  desktopWorkspace: {
    alignItems: "flex-start",
    flexDirection: "row",
  },
  emptyPanel: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 22,
  },
  compactEmptyPanel: {
    marginTop: 10,
    paddingVertical: 18,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "900",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    paddingVertical: 14,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: "900",
  },
  dangerButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 14,
  },
  summaryPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    width: "100%",
  },
  desktopSummaryPanel: {
    flex: 1.05,
  },
  summaryHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  deckName: {
    fontSize: 16,
    fontWeight: "900",
  },
  validationText: {
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  progressTrack: {
    borderRadius: 8,
    height: 6,
    marginTop: 8,
    overflow: "hidden",
  },
  progressFill: {
    borderRadius: 8,
    height: "100%",
  },
  statsRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
  },
  statPill: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "900",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "900",
  },
  missingBox: {
    borderRadius: 8,
    gap: 5,
    marginTop: 8,
    padding: 8,
  },
  missingTitle: {
    fontSize: 12,
    fontWeight: "900",
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "900",
  },
  missingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  missingName: {
    flex: 1,
    fontSize: 11,
    fontWeight: "800",
  },
  missingQty: {
    fontSize: 11,
    fontWeight: "900",
  },
  moreText: {
    fontSize: 11,
    fontWeight: "800",
  },
  deckList: {
    gap: 6,
    marginTop: 10,
  },
  deckCardRow: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 7,
    minHeight: 48,
    padding: 6,
  },
  deckCardThumb: {
    borderRadius: 5,
    height: 38,
    width: 28,
  },
  smallIconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  collectionList: {
    gap: 8,
    paddingTop: 10,
  },
  libraryPanel: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    width: "100%",
  },
  desktopLibraryPanel: {
    flex: 0.95,
  },
  collectionItem: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 70,
    padding: 10,
  },
  cardThumb: {
    borderRadius: 6,
    height: 50,
    width: 36,
  },
  cardThumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: 12,
    fontWeight: "900",
  },
  cardMeta: {
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  addBadge: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 34,
    paddingHorizontal: 8,
  },
  addBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  quantityControl: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    minHeight: 32,
    overflow: "hidden",
  },
  quantityButton: {
    alignItems: "center",
    height: 32,
    justifyContent: "center",
    width: 30,
  },
  quantityValue: {
    fontSize: 13,
    fontWeight: "900",
    minWidth: 24,
    textAlign: "center",
  },
  modalBackdrop: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.42)",
    flex: 1,
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    borderRadius: 8,
    maxWidth: 420,
    padding: 16,
    width: "100%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  modalText: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
    marginBottom: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
  },
});
