import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
  View,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import { AuthGuard } from "../components/AuthGuard";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { AuthService } from "../services/AuthService";
import { CardListService } from "../services/CardListService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";

const filters = [
  { label: "Favoritas", value: "favorites" },
  { label: "Minhas cartas", value: "myCards" },
];

const ownershipFilters = [
  { label: "Possuo", value: "owned", icon: "cards" },
  { label: "Nao possuo", value: "missing", icon: "cards-outline" },
];

const saleOptions = [
  { label: "Sim", value: true },
  { label: "Nao", value: false },
];

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["NM", "LP", "MP", "HP", "DMG"];

const SERIES_ORDER = [
  "Mega Evolucao",
  "Escarlate e Violeta",
  "Espada e Escudo",
  "Sol e Lua",
  "XY",
  "Black & White",
  "Outras colecoes",
];

const sortOptions = [
  { label: "Numero da carta", value: "number", icon: "sort-numeric-ascending" },
  { label: "Nome", value: "name", icon: "sort-alphabetical-ascending" },
  { label: "Raridade", value: "rarity", icon: "diamond-stone" },
  { label: "Colecao", value: "set", icon: "cards-outline" },
];

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  let cents = Number(digits || "0");

  if (digits.length <= 2) {
    cents = cents * 100;
  }

  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function normalizeMoneyValue(value) {
  if (typeof value === "number") {
    return value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  if (!value || value === "" || value === "undefined") return "R$ 0,00";
  const text = String(value);
  return text.startsWith("R$") ? text : formatMoneyInput(text);
}

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCardNumber(card) {
  const rawNumber = String(card?.collectionNumber ?? "").split("/")[0];
  const number = Number(rawNumber.replace(/\D/g, ""));
  return Number.isFinite(number) && number > 0 ? number : 999999;
}

function getSetTotal(card) {
  const rawTotal = String(card?.collectionNumber ?? "").split("/")[1];
  const total = Number(rawTotal?.replace(/\D/g, ""));
  return Number.isFinite(total) && total > 0 ? total : null;
}

function getSeriesName(setName) {
  const normalized = normalizeSearchText(setName);

  if (/mega|phantas|ascendent|excel|equilibrio|caos/.test(normalized)) return "Mega Evolucao";
  if (/scarlet|violet|escarlate|violeta|paldea|journey|surging|stellar|temporal|obsidian|paradox|151/.test(normalized)) return "Escarlate e Violeta";
  if (/sword|shield|espada|escudo|brilliant|fusion|evolving|chilling|battle|crown|silver|lost|astral/.test(normalized)) return "Espada e Escudo";
  if (/sun|moon|sol|lua|cosmic|unbroken|unified|hidden|burning|guardians/.test(normalized)) return "Sol e Lua";
  if (/\bxy\b|evolutions|fates collide|breakthrough|ancient origins|roaring skies/.test(normalized)) return "XY";
  if (/black|white|plasma|boundaries|legendary treasures|dragons exalted/.test(normalized)) return "Black & White";

  return "Outras colecoes";
}

function buildSetGroups(cards) {
  const groups = new Map();

  cards.forEach((card) => {
    const setName = card?.set || "Sem colecao";
    const group = groups.get(setName) ?? {
      id: setName,
      name: setName,
      series: getSeriesName(setName),
      owned: 0,
      total: 0,
      completion: 0,
    };
    const total = getSetTotal(card);

    group.owned += 1;
    group.total = Math.max(group.total, total ?? 0);
    groups.set(setName, group);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      total: group.total || group.owned,
      completion: group.total ? group.owned / group.total : 0,
    }))
    .sort((a, b) => b.completion - a.completion || a.name.localeCompare(b.name, "pt-BR"));
}

function sortCards(cards, sortMode) {
  return [...cards].sort((a, b) => {
    if (sortMode === "name") return String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR");
    if (sortMode === "rarity") return String(a.rarity ?? "").localeCompare(String(b.rarity ?? ""), "pt-BR");
    if (sortMode === "set") return String(a.set ?? "").localeCompare(String(b.set ?? ""), "pt-BR") || getCardNumber(a) - getCardNumber(b);
    return getCardNumber(a) - getCardNumber(b) || String(a.name ?? "").localeCompare(String(b.name ?? ""), "pt-BR");
  });
}

function FavoritesViewContent() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [activeFilter, setActiveFilter] = useState("favorites");
  const [favorites, setFavorites] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [editingItem, setEditingItem] = useState(null);
  const [draft, setDraft] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [search, setSearch] = useState("");
  const [cardLists, setCardLists] = useState([]);
  const [activeListId, setActiveListId] = useState(null);
  const [isEditingList, setIsEditingList] = useState(false);
  const [createListVisible, setCreateListVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [filterVisible, setFilterVisible] = useState(false);
  const [activeSeries, setActiveSeries] = useState("all");
  const [activeSet, setActiveSet] = useState("all");
  const [sortMode, setSortMode] = useState("number");
  const [sortOpen, setSortOpen] = useState(false);

  const spacing = 12;
  const contentMaxWidth = Math.min(width, 1180);
  const gridWidth = contentMaxWidth - spacing * 2;
  const numColumns = Math.max(2, gridWidth > 1040 ? 5 : gridWidth > 820 ? 4 : gridWidth > 560 ? 3 : 2);
  const cardWidth = (gridWidth - spacing * (numColumns - 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;
  const saleLabel = draft?.aVenda ? "Sim" : "Nao";
  const showingMyCards = activeFilter === "myCards";
  const visibleMyCards = useMemo(
    () => myCards.filter((item) => item.ownerId === currentUser?.id || item.userId === currentUser?.id),
    [currentUser?.id, myCards]
  );
  const setGroups = useMemo(() => buildSetGroups(visibleMyCards), [visibleMyCards]);
  const seriesStats = useMemo(() => {
    const totalKnownCards = setGroups.reduce((sum, group) => sum + group.total, 0);
    const stats = SERIES_ORDER.map((series) => {
      const groups = setGroups.filter((group) => group.series === series);
      const owned = groups.reduce((sum, group) => sum + group.owned, 0);
      const total = groups.reduce((sum, group) => sum + group.total, 0);

      return {
        id: series,
        name: series,
        owned,
        total,
        completion: total ? owned / total : 0,
      };
    });

    return [
      {
        id: "all",
        name: "Todas",
        owned: visibleMyCards.length,
        total: totalKnownCards || visibleMyCards.length,
        completion: totalKnownCards ? visibleMyCards.length / totalKnownCards : 0,
      },
      ...stats.filter((item) => item.owned > 0),
    ];
  }, [setGroups, visibleMyCards.length]);
  const visibleSets = useMemo(
    () => activeSeries === "all" ? setGroups : setGroups.filter((group) => group.series === activeSeries),
    [activeSeries, setGroups]
  );
  const favoriteCardIds = useMemo(
    () => new Set(favorites.map((item) => String(item.cardId ?? item.id))),
    [favorites]
  );
  const myCardIds = useMemo(
    () => new Set(visibleMyCards.map((item) => String(item.cardId ?? item.id))),
    [visibleMyCards]
  );
  const favoriteExtraData = useMemo(
    () => [...favoriteCardIds].sort().join("|"),
    [favoriteCardIds]
  );
  const myCardsExtraData = useMemo(
    () => [...myCardIds].sort().join("|"),
    [myCardIds]
  );
  const sourceData = showingMyCards ? visibleMyCards : favorites;
  const activeList = cardLists.find((list) => list.id === activeListId);
  const activeListCardIds = useMemo(
    () => new Set(activeList?.cardIds ?? []),
    [activeList?.cardIds]
  );
  const listSourceData = activeList && !isEditingList
    ? sourceData.filter((item) => activeListCardIds.has(String(item.cardId ?? item.id)))
    : sourceData;
  const ownershipCounts = useMemo(() => {
    const owned = listSourceData.filter((item) => myCardIds.has(String(item.cardId ?? item.id))).length;

    return {
      all: listSourceData.length,
      owned,
      missing: Math.max(listSourceData.length - owned, 0),
    };
  }, [listSourceData, myCardIds]);
  const data = useMemo(() => {
    const term = normalizeSearchText(search);
    const ownershipData =
      showingMyCards || ownershipFilter === "all"
        ? listSourceData
        : listSourceData.filter((item) => {
            const ownsCard = myCardIds.has(String(item.cardId ?? item.id));
            return ownershipFilter === "owned" ? ownsCard : !ownsCard;
          });

    const collectionData = showingMyCards
      ? ownershipData.filter((item) => {
          const matchesSeries = activeSeries === "all" || getSeriesName(item.set) === activeSeries;
          const matchesSet = activeSet === "all" || item.set === activeSet;
          return matchesSeries && matchesSet;
        })
      : ownershipData;

    const searchedData = term
      ? collectionData.filter((item) => {
          const searchable = normalizeSearchText(
            `${item.name} ${item.set} ${item.rarity} ${item.supertype} ${item.subtypes?.join(" ")} ${item.collectionNumber}`
          );

          return searchable.includes(term);
        })
      : collectionData;

    return showingMyCards ? sortCards(searchedData, sortMode) : searchedData;
  }, [activeSeries, activeSet, search, listSourceData, myCardIds, ownershipFilter, showingMyCards, sortMode]);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);
    const unsubscribeLists = CardListService.subscribe(setCardLists);

    return () => {
      unsubscribeAuth();
      unsubscribeFavorites();
      unsubscribeMyCards();
      unsubscribeLists();
    };
  }, []);

  const counts = useMemo(
    () => ({
      favorites: favorites.length,
      myCards: visibleMyCards.length,
    }),
    [favorites.length, visibleMyCards.length]
  );

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
  };

  const openEditor = (item) => {
    setEditingItem(item);
    setDraft({
      aVenda: item.aVenda ?? false,
      price: normalizeMoneyValue(item.price),
      idioma: item.idioma ?? "Portugues",
      qualidade: item.qualidade ?? "NM",
    });
    setOpenDropdown(null);
  };

  const closeEditor = () => {
    setEditingItem(null);
    setDraft(null);
    setOpenDropdown(null);
  };

  const saveEditor = () => {
    if (editingItem && draft) {
      const priceText = String(draft.price ?? "").replace(/\D/g, "");

      if (draft.aVenda && (!priceText || priceText === "0")) {
        Alert.alert("Preco invalido", "Por favor, insira um preco valido.");
        return;
      }

      MyCardsService.updateCard(editingItem.id, draft);
    }

    closeEditor();
  };

  const createList = () => {
    const name = newListName.trim();

    if (!name) {
      Alert.alert("Nome da lista", "Digite um nome para criar a lista.");
      return;
    }

    try {
      const nextList = CardListService.createList(name);
      setActiveListId(nextList.id);
      setIsEditingList(true);
      setNewListName("");
      setCreateListVisible(false);
    } catch (error) {
      Alert.alert("Lista", error.message);
    }
  };

  const toggleCardInList = (cardId) => {
    if (!activeListId) return;

    const list = cardLists.find((item) => item.id === activeListId);
    if (!list) return;

    const cardKey = String(cardId);
    const selected = list.cardIds.includes(cardKey);
    const cardIds = selected
      ? list.cardIds.filter((id) => id !== cardKey)
      : [cardKey, ...list.cardIds];

    CardListService.updateList(activeListId, { cardIds });
  };

  const removeActiveList = () => {
    if (!activeList) return;

    Alert.alert("Remover lista", `Deseja remover ${activeList.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          CardListService.removeList(activeList.id);
          setActiveListId(null);
          setIsEditingList(false);
        },
      },
    ]);
  };

  const selectSeries = (seriesId) => {
    setActiveSeries(seriesId);
    setActiveSet("all");
  };

  const renderProgressBar = (value, height = 7) => (
    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceVariant, height }]}>
      <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${Math.min(value * 100, 100)}%` }]} />
    </View>
  );

  const renderDropdown = (field, label, selectedLabel, options) => {
    const isOpen = openDropdown === field;
    const normalizedOptions = options.map((option) => {
      if (typeof option === "string") return { label: option, value: option };
      return { label: option.label, value: option.value };
    });

    return (
      <View style={styles.field}>
        <Text style={[styles.inputLabel, { color: colors.mutedText }]}>{label}</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpenDropdown(isOpen ? null : field)}
          style={[styles.selectButton, { borderColor: colors.border }]}
        >
          <Text style={[styles.selectButtonText, { color: colors.text }]}>{selectedLabel}</Text>
          <Text style={[styles.selectArrow, { color: colors.mutedText }]}>{isOpen ? "^" : "v"}</Text>
        </TouchableOpacity>

        {isOpen && (
          <View style={[styles.dropdownList, { borderColor: colors.border }]}>
            {normalizedOptions.map((option) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={option.label}
                onPress={() => {
                  setDraft((current) => ({ ...current, [field]: option.value }));
                  setOpenDropdown(null);
                }}
                style={[
                  styles.dropdownOption,
                  { backgroundColor: colors.surface, borderBottomColor: colors.border },
                ]}
              >
                <Text style={[styles.dropdownOptionText, { color: colors.text }]}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderCard = ({ item, index }) => (
    <View style={[styles.cardItem, { width: cardWidth }]}>
      {showingMyCards && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openEditor(item)}
          style={[styles.cardMenuButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
        </TouchableOpacity>
      )}
      {!showingMyCards && (
        <View
          style={[
            styles.ownershipBadge,
            {
              backgroundColor: myCardIds.has(String(item.cardId ?? item.id)) ? colors.accent : colors.surface,
              borderColor: myCardIds.has(String(item.cardId ?? item.id)) ? colors.accent : colors.border,
            },
          ]}
        >
          <MaterialIcons
            name={myCardIds.has(String(item.cardId ?? item.id)) ? "inventory-2" : "add-shopping-cart"}
            size={14}
            color={myCardIds.has(String(item.cardId ?? item.id)) ? colors.onAccent : colors.mutedText}
          />
          <Text
            style={[
              styles.ownershipBadgeText,
              { color: myCardIds.has(String(item.cardId ?? item.id)) ? colors.onAccent : colors.mutedText },
            ]}
          >
            {myCardIds.has(String(item.cardId ?? item.id)) ? "Possuo" : "Nao possuo"}
          </Text>
        </View>
      )}
      {!!activeList && isEditingList && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => toggleCardInList(String(item.cardId ?? item.id))}
          style={[styles.checkboxButton, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}
        >
          <MaterialIcons
            name={activeList.cardIds.includes(String(item.cardId ?? item.id)) ? "check-box" : "check-box-outline-blank"}
            size={24}
            color={activeList.cardIds.includes(String(item.cardId ?? item.id)) ? colors.primary : colors.mutedText}
          />
        </TouchableOpacity>
      )}
      <AnimatedCard
        item={item}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={favoriteCardIds.has(String(item.cardId ?? item.id))}
        isMyCard={myCardIds.has(String(item.cardId ?? item.id))}
        onFavoritePress={() => {
          if (activeList && isEditingList) {
            toggleCardInList(String(item.cardId ?? item.id));
            return;
          }

          FavoritesService.toggleFavorite(item);
        }}
        onMyCardPress={() => MyCardsService.toggleCard(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.cardId ?? item.id}`)}
      />
    </View>
  );

  const aVendaDropdown = draft ? renderDropdown("aVenda", "Item a venda", saleLabel, saleOptions) : null;
  const idiomaDropdown = draft ? renderDropdown("idioma", "Idioma", draft.idioma, languageOptions) : null;
  const qualidadeDropdown = draft ? renderDropdown("qualidade", "Qualidade", draft.qualidade, qualityOptions) : null;
  const selectedSort = sortOptions.find((option) => option.value === sortMode) ?? sortOptions[0];

  const emptyTitle = showingMyCards ? "Nenhuma carta na sua colecao" : "Nenhuma carta favorita";
  const emptyText = showingMyCards
    ? "Toque em Minhas nas cartas do catalogo para montar sua colecao."
    : "Toque em Favorito nas cartas do catalogo para montar sua lista.";
  const hasOwnershipFilter = !showingMyCards && ownershipFilter !== "all";
  const topControls = (
    <View style={[styles.headerBlock, { paddingHorizontal: spacing }]}>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={20} color={colors.mutedText} />
        <TextInput
          onChangeText={setSearch}
          placeholder="Buscar cartas Pokemon TCG"
          placeholderTextColor={colors.mutedText}
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
        />
        {!showingMyCards && (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setFilterVisible(true)}
            style={[
              styles.filterButton,
              {
                backgroundColor: hasOwnershipFilter ? colors.primary : "transparent",
                borderColor: hasOwnershipFilter ? colors.primary : colors.border,
              },
            ]}
          >
            <MaterialIcons name="tune" size={19} color={hasOwnershipFilter ? colors.onPrimary : colors.text} />
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.filterChips, { backgroundColor: colors.surfaceVariant }]}>
        {filters.map((filter) => {
          const selected = filter.value === activeFilter;
          const count = counts[filter.value];

          return (
            <TouchableOpacity
              activeOpacity={0.85}
              key={filter.value}
              onPress={() => {
                setActiveFilter(filter.value);
                setActiveListId(null);
                setIsEditingList(false);
              }}
              style={[
                styles.filterChip,
                {
                  backgroundColor: selected ? colors.surface : "transparent",
                  borderColor: selected ? colors.border : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: selected ? colors.text : colors.mutedText },
                ]}
              >
                {filter.label} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showingMyCards && (
        <View style={styles.collectionPanel}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.seriesChips}
          >
            {seriesStats.map((series) => {
              const selected = activeSeries === series.id;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={series.id}
                  onPress={() => selectSeries(series.id)}
                  style={[
                    styles.seriesCard,
                    {
                      backgroundColor: selected ? colors.surface : colors.surfaceVariant,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <View style={styles.seriesCardHeader}>
                    <Text numberOfLines={1} style={[styles.seriesCardTitle, { color: colors.text }]}>
                      {series.name}
                    </Text>
                    {selected && <MaterialIcons name="radio-button-checked" size={16} color={colors.primary} />}
                  </View>
                  <Text style={[styles.seriesCardCount, { color: colors.mutedText }]}>
                    {series.owned}/{series.total}
                  </Text>
                  {renderProgressBar(series.completion)}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.setChips}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setActiveSet("all")}
              style={[
                styles.setChip,
                {
                  backgroundColor: activeSet === "all" ? colors.primary : colors.surface,
                  borderColor: activeSet === "all" ? colors.primary : colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name="cards-outline"
                size={19}
                color={activeSet === "all" ? colors.onPrimary : colors.primary}
              />
              <Text
                numberOfLines={1}
                style={[styles.setChipText, { color: activeSet === "all" ? colors.onPrimary : colors.text }]}
              >
                Todas
              </Text>
            </TouchableOpacity>
            {visibleSets.map((set) => {
              const selected = activeSet === set.id;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={set.id}
                  onPress={() => setActiveSet(set.id)}
                  style={[
                    styles.setChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name="cards-playing-outline"
                    size={19}
                    color={selected ? colors.onPrimary : colors.primary}
                  />
                  <Text numberOfLines={1} style={[styles.setChipText, { color: selected ? colors.onPrimary : colors.text }]}>
                    {set.name}
                  </Text>
                  <Text style={[styles.setChipCount, { color: selected ? colors.onPrimary : colors.mutedText }]}>
                    {set.owned}/{set.total}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.sortWrap}>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setSortOpen((current) => !current)}
              style={[styles.sortButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name={selectedSort.icon} size={19} color={colors.primary} />
              <Text numberOfLines={1} style={[styles.sortButtonText, { color: colors.text }]}>
                Ordenar: {selectedSort.label}
              </Text>
              <MaterialIcons name={sortOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"} size={22} color={colors.mutedText} />
            </TouchableOpacity>
            {sortOpen && (
              <View style={[styles.sortMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {sortOptions.map((option) => (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    key={option.value}
                    onPress={() => {
                      setSortMode(option.value);
                      setSortOpen(false);
                    }}
                    style={styles.sortOption}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={18}
                      color={sortMode === option.value ? colors.primary : colors.mutedText}
                    />
                    <Text style={[styles.sortOptionText, { color: colors.text }]}>{option.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      <View style={styles.listBar}>
        <View style={styles.listChips}>
          {cardLists.map((list) => {
            const selected = activeListId === list.id;

            return (
              <TouchableOpacity
                activeOpacity={0.85}
                key={list.id}
                onPress={() => {
                  setActiveListId(selected ? null : list.id);
                  setIsEditingList(false);
                }}
                style={[
                  styles.listChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.listChipText, { color: selected ? colors.onPrimary : colors.text }]}>
                  {list.name}
                </Text>
                <Text style={[styles.listChipCount, { color: selected ? colors.onPrimary : colors.mutedText }]}>
                  {list.cardIds.length}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCreateListVisible(true)}
            style={[styles.createListButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialIcons name="add" size={18} color={colors.primary} />
            <Text style={[styles.createListText, { color: colors.primary }]}>Lista</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!activeList && (
        <View style={[styles.listModeRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.listHint, { color: colors.mutedText }]}>
            {isEditingList
              ? `Marque as cartas que pertencem a ${activeList.name}.`
              : `${activeList.name}: ${activeList.cardIds.length} carta(s).`}
          </Text>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setIsEditingList((current) => !current)}
            style={[styles.listModeButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <MaterialIcons
              name={isEditingList ? "visibility" : "edit"}
              size={17}
              color={colors.primary}
            />
            <Text style={[styles.listModeButtonText, { color: colors.primary }]}>
              {isEditingList ? "Ver lista" : "Editar lista"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={removeActiveList}
            style={[styles.listIconButton, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Minhas listas" />
      {topControls}

      <FlatList
        style={styles.list}
        key={`${activeFilter}-${numColumns}`}
        data={data}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        extraData={`${favoriteExtraData}:${myCardsExtraData}:${activeListId ?? ""}:${isEditingList}:${activeSeries}:${activeSet}:${sortMode}`}
        numColumns={numColumns}
        contentContainerStyle={[
          styles.listContent,
          { padding: spacing },
          data.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeList && !isEditingList ? "Lista vazia" : emptyTitle}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              {activeList && !isEditingList
                ? "Toque em Editar lista para marcar as cartas que entram aqui."
                : emptyText}
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/views/HomeView")}
              style={[styles.catalogButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.catalogButtonText, { color: colors.onPrimary }]}>Ver catalogo</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal
        animationType="fade"
        onRequestClose={() => setFilterVisible(false)}
        transparent
        visible={filterVisible}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setFilterVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.filterModal, { backgroundColor: colors.surface }]}
          >
            <View style={styles.filterModalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Filtrar</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => setFilterVisible(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <View style={styles.detailFilters}>
              <View style={styles.detailFilterHeader}>
                <Text style={[styles.detailFilterTitle, { color: colors.text }]}>Minhas cartas</Text>
                {hasOwnershipFilter && (
                  <TouchableOpacity activeOpacity={0.75} onPress={() => setOwnershipFilter("all")}>
                    <Text style={[styles.clearFiltersText, { color: colors.primary }]}>Limpar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {ownershipFilters.map((filter) => {
                const selected = ownershipFilter === filter.value;
                const count = ownershipCounts[filter.value];

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={filter.value}
                    onPress={() => setOwnershipFilter((current) => current === filter.value ? "all" : filter.value)}
                    style={[
                      styles.detailFilterOption,
                      {
                        backgroundColor: colors.surfaceVariant,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.detailFilterOptionLeft}>
                      <MaterialIcons
                        name={selected ? "check-box" : "check-box-outline-blank"}
                        size={22}
                        color={selected ? colors.primary : colors.mutedText}
                      />
                      <View style={styles.ownershipIconWrap}>
                        <MaterialCommunityIcons
                          name={filter.icon}
                          size={21}
                          color={selected ? colors.primary : colors.mutedText}
                        />
                        {filter.value === "missing" && (
                          <View style={[styles.ownershipIconSlash, { backgroundColor: selected ? colors.primary : colors.mutedText }]} />
                        )}
                      </View>
                      <Text style={[styles.detailFilterOptionText, { color: colors.text }]}>
                        {filter.label} ({count})
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeEditor}
        transparent
        visible={!!editingItem}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={closeEditor}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar carta</Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              {editingItem?.name}
            </Text>

            {aVendaDropdown}

            <View style={styles.field}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preco</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={(price) =>
                  setDraft((current) => ({ ...current, price: formatMoneyInput(price) }))
                }
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={String(draft?.price ?? "")}
              />
            </View>

            {idiomaDropdown}
            {qualidadeDropdown}

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeEditor}
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={saveEditor}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={() => setCreateListVisible(false)}
        transparent
        visible={createListVisible}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setCreateListVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Criar lista</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              Crie uma lista e marque as cartas com checkbox.
            </Text>
            <View style={styles.field}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Nome da lista</Text>
              <TextInput
                autoFocus
                onChangeText={setNewListName}
                placeholder="Ex: Trocas, Deck, Desejadas"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={newListName}
              />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setCreateListVisible(false)}
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={createList}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Criar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default function FavoritesView() {
  return (
    <AuthGuard>
      <FavoritesViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  list: {
    width: "100%",
  },
  listContent: {
    alignSelf: "center",
    maxWidth: 1180,
    paddingBottom: 96,
    width: "100%",
  },
  headerBlock: {
    alignSelf: "center",
    maxWidth: 1180,
    paddingBottom: 4,
    paddingTop: 12,
    width: "100%",
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
  },
  filterButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  filterChips: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 10,
    padding: 4,
    borderRadius: 8,
  },
  filterChip: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "900",
    textAlign: "center",
  },
  collectionPanel: {
    gap: 10,
    marginBottom: 12,
    zIndex: 5,
  },
  seriesChips: {
    gap: 10,
  },
  seriesCard: {
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    minHeight: 84,
    padding: 10,
    width: 210,
  },
  seriesCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  seriesCardTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: "900",
  },
  seriesCardCount: {
    fontSize: 12,
    fontWeight: "800",
  },
  progressTrack: {
    borderRadius: 999,
    overflow: "hidden",
    width: "100%",
  },
  progressFill: {
    borderRadius: 999,
    height: "100%",
  },
  setChips: {
    gap: 8,
  },
  setChip: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 10,
  },
  setChipText: {
    fontSize: 12,
    fontWeight: "900",
    maxWidth: 180,
  },
  setChipCount: {
    fontSize: 11,
    fontWeight: "900",
  },
  sortWrap: {
    maxWidth: 340,
    minWidth: 240,
    position: "relative",
    zIndex: 8,
  },
  sortButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  sortButtonText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900",
  },
  sortMenu: {
    borderRadius: 8,
    borderWidth: 1,
    left: 0,
    overflow: "hidden",
    position: "absolute",
    right: 0,
    top: 48,
    zIndex: 20,
  },
  sortOption: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  sortOptionText: {
    fontSize: 13,
    fontWeight: "800",
  },
  createListButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    justifyContent: "center",
    height: 34,
    paddingHorizontal: 10,
  },
  createListText: {
    fontSize: 12,
    fontWeight: "900",
  },
  listChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 12,
  },
  listBar: {
    minHeight: 34,
  },
  listChip: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 36,
    paddingHorizontal: 12,
  },
  listChipText: {
    fontSize: 12,
    fontWeight: "900",
  },
  listChipCount: {
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
  },
  listHint: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  listModeRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
    minHeight: 48,
    padding: 8,
  },
  listModeButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  listModeButtonText: {
    fontSize: 12,
    fontWeight: "900",
  },
  listIconButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 36,
  },
  ownershipFilterPanel: {
    borderBottomWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
    paddingBottom: 10,
  },
  ownershipCheckboxRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingRight: 8,
  },
  ownershipIconWrap: {
    alignItems: "center",
    height: 22,
    justifyContent: "center",
    position: "relative",
    width: 22,
  },
  ownershipIconSlash: {
    borderRadius: 1,
    height: 2,
    position: "absolute",
    transform: [{ rotate: "-38deg" }],
    width: 24,
  },
  ownershipCheckboxText: {
    fontSize: 13,
    fontWeight: "800",
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  catalogButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catalogButtonText: {
    fontWeight: "700",
  },
  cardItem: {
    marginBottom: 12,
    position: "relative",
  },
  ownershipBadge: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    left: 8,
    minHeight: 28,
    paddingHorizontal: 8,
    position: "absolute",
    top: 8,
    zIndex: 2,
  },
  ownershipBadgeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  checkboxButton: {
    alignItems: "center",
    borderRadius: 8,
    elevation: 3,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    top: 8,
    width: 36,
    zIndex: 2,
  },
  cardMenuButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    position: "absolute",
    right: 8,
    top: 8,
    width: 34,
    zIndex: 2,
  },
  modalOverlay: {
    alignItems: "center",
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
  filterModal: {
    borderRadius: 8,
    maxWidth: 360,
    padding: 16,
    width: "100%",
  },
  filterModalHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  closeButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 14,
    marginTop: 4,
  },
  detailFilters: {
    gap: 10,
    marginTop: 8,
  },
  detailFilterHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailFilterTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  clearFiltersText: {
    fontSize: 12,
    fontWeight: "900",
  },
  detailFilterOption: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  detailFilterOptionLeft: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  detailFilterOptionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  field: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  input: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selectButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 42,
    paddingHorizontal: 10,
  },
  selectButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectArrow: {
    fontSize: 12,
    marginLeft: 8,
  },
  dropdownList: {
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 6,
    overflow: "hidden",
  },
  dropdownOption: {
    borderBottomWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  dropdownOptionText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  modalButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  cancelButtonText: {
    fontWeight: "700",
  },
  saveButtonText: {
    fontWeight: "700",
  },
});
