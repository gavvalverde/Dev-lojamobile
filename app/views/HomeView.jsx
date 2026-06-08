import { useRouter } from "expo-router";
import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import { CardSearchResult } from "../components/CardSearchResult";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AnuncioService } from "../services/AnuncioService";
import { AuthService } from "../services/AuthService";
import { CartService } from "../services/CartService";
import { CarouselHighlightService } from "../services/CarouselHighlightService";
import { ChatService } from "../services/ChatService";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { PokemonService } from "../services/PokemonService";
import { ProfilePostService } from "../services/ProfilePostService";
import { StoreProductService } from "../services/StoreProductService";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";
import { getProductImage, toImageSource } from "../../utils/productImage";

function formatCurrency(value) {
  return (Number(value) || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const saleOptions = [
  { label: "Sim", value: true },
  { label: "Nao", value: false },
];

const languageOptions = ["Portugues", "Ingles", "Japones", "Espanhol", "Frances"];
const qualityOptions = ["NM", "LP", "MP", "HP", "DMG"];
const sealedSpotlightGap = 10;
const cardTypeOptions = [
  { label: "Pokemon", value: "pokemon" },
  { label: "Treinador", value: "treinador" },
  { label: "Ginasio", value: "ginasio" },
  { label: "Item", value: "item" },
  { label: "Energia", value: "energia" },
];

function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  let cents = Number(digits || "0");

  if (digits.length <= 2) {
    cents = cents * 100;
  }

  return formatCurrency(cents / 100);
}

function normalizeMoneyValue(value) {
  if (typeof value === "number") return formatCurrency(value);
  if (!value || value === "" || value === "undefined") return "R$ 0,00";

  const text = String(value);
  return text.startsWith("R$") ? text : formatMoneyInput(text);
}

function parseMoneyValue(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
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

function normalizeSearchText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getUniqueValues(values, limit = 18) {
  return [...new Set(values.filter(Boolean).map(String))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .slice(0, limit);
}

function normalizeFilterValue(value) {
  const text = String(value ?? "").trim();
  const normalized = normalizeSearchText(text);

  if (normalized === "portugues") return "Portugues";
  return text;
}

function getCardTypeCategories(card) {
  const supertype = normalizeSearchText(card?.supertype ?? card?.tipoCarta);
  const subtypes = Array.isArray(card?.subtypes) ? card.subtypes : card?.subtypes ? [card.subtypes] : [];
  const subtypeText = normalizeSearchText(subtypes.join(" "));
  const fallbackType = normalizeSearchText(`${card?.cardType ?? ""} ${card?.tipo ?? ""}`);
  const searchable = `${supertype} ${subtypeText} ${fallbackType}`;
  const categories = new Set();
  const isTrainer = searchable.includes("trainer") || searchable.includes("treinador");
  const isStadium = searchable.includes("stadium") || searchable.includes("ginasio") || searchable.includes("estadio");
  const isItem = searchable.includes("item");
  const isTool = searchable.includes("tool") || searchable.includes("ferramenta");

  if (searchable.includes("pokemon")) categories.add("pokemon");
  if (searchable.includes("energy") || searchable.includes("energia")) categories.add("energia");

  if (isTrainer && !isStadium && !isItem && !isTool) {
    categories.add("treinador");
  }

  if (isStadium) {
    categories.add("ginasio");
  }

  if (isItem) {
    categories.add("item");
  }

  return categories;
}

function isSealedProduct(item) {
  return item?.productType === "sealed" || item?.cardType === "produto-selado";
}

export default function HomeView() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const sealedCarouselRef = useRef(null);
  const requestedSealedImageIds = useRef(new Set());
  const sealedViewabilityConfig = useRef({ itemVisiblePercentThreshold: 10 });

  const spacing = 12;
  const contentMaxWidth = Math.min(width, 1180);
  const gridWidth = contentMaxWidth - spacing * 2;
  const numColumns = Math.max(2, gridWidth > 1040 ? 5 : gridWidth > 820 ? 4 : gridWidth > 560 ? 3 : 2);
  const cardWidth = (gridWidth - spacing * (numColumns - 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;
  const sealedSpotlightCardWidth = Math.max(292, gridWidth - 8);

  const [favorites, setFavorites] = useState([]);
  const [myCards, setMyCards] = useState([]);
  const [storeProducts, setStoreProducts] = useState([]);
  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [carouselHighlights, setCarouselHighlights] = useState([]);
  const [user, setUser] = useState(AuthService.getCurrentUser());
  const [homeMode, setHomeMode] = useState("anuncios");
  const [search, setSearch] = useState("");
  const [listingDetailFilters, setListingDetailFilters] = useState({
    idioma: "all",
    qualidade: "all",
    type: "all",
    set: "all",
    rarity: "all",
    maxPrice: "",
  });
  const [filterVisible, setFilterVisible] = useState(false);
  const [openFilterGroup, setOpenFilterGroup] = useState(null);
  const [apiCards, setApiCards] = useState([]);
  const [pokemonResult, setPokemonResult] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cachedCards, setCachedCards] = useState([]);
  const [cachedCardsLoaded, setCachedCardsLoaded] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [announceVisible, setAnnounceVisible] = useState(false);
  const [editingListing, setEditingListing] = useState(null);
  const [listingDraft, setListingDraft] = useState(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [matchingWantedPost, setMatchingWantedPost] = useState(null);
  const [sealedSpotlightIndex, setSealedSpotlightIndex] = useState(0);
  const favoriteCardIds = useMemo(
    () => new Set(favorites.map((item) => String(item.cardId ?? item.id))),
    [favorites]
  );
  const favoriteExtraData = useMemo(
    () => [...favoriteCardIds].sort().join("|"),
    [favoriteCardIds]
  );
  const myCardIds = useMemo(
    () => new Set(
      myCards
        .filter((item) => item.ownerId === user?.id || item.userId === user?.id)
        .map((item) => String(item.cardId ?? item.id))
    ),
    [myCards, user?.id]
  );
  const myCardsExtraData = useMemo(
    () => [...myCardIds].sort().join("|"),
    [myCardIds]
  );

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setUser);
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);
    const unsubscribeStoreProducts = StoreProductService.subscribe(setStoreProducts);
    const unsubscribePosts = ProfilePostService.subscribe(setPosts);
    const unsubscribeUsers = UserService.subscribe(setUsers);
    const unsubscribeHighlights = CarouselHighlightService.subscribe(setCarouselHighlights);

    return () => {
      unsubscribeAuth();
      unsubscribeFavorites();
      unsubscribeMyCards();
      unsubscribeStoreProducts();
      unsubscribePosts();
      unsubscribeUsers();
      unsubscribeHighlights();
    };
  }, []);

  useEffect(() => {
    if (cachedCardsLoaded) return;
    if (!filterVisible && !search.trim()) return;

    let active = true;

    PokemonService.getCachedCards().then((cards) => {
      if (!active) return;
      setCachedCards(cards);
      setCachedCardsLoaded(true);
    });

    return () => {
      active = false;
    };
  }, [cachedCardsLoaded, filterVisible, search]);

  useEffect(() => {
    const term = search.trim();

    if (homeMode === "feed") {
      setApiCards([]);
      setPokemonResult(null);
      setSearchPage(1);
      setSearchHasMore(false);
      setLoadingMore(false);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    if (!term) {
      setApiCards([]);
      setPokemonResult(null);
      setSearchPage(1);
      setSearchHasMore(false);
      setLoadingMore(false);
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);
    setSearchError("");
    setApiCards([]);
    setPokemonResult(null);
    setSearchPage(1);
    setSearchHasMore(false);
    setLoadingMore(false);

    const timeout = setTimeout(async () => {
      PokemonService.fetchPokemonProfile(term).then((pokemon) => {
        if (active) setPokemonResult(pokemon);
      });

      try {
        const cardPage = await PokemonService.searchCardsPage(term, 1);

        if (active) {
          setApiCards(cardPage.cards);
          setSearchPage(cardPage.page);
          setSearchHasMore(cardPage.hasMore);
        }
      } catch (error) {
        console.error("Erro ao buscar cartas na API:", error);
        if (active) {
          setApiCards([]);
          setSearchHasMore(false);
          setSearchError("Não foi possivel buscar cartas agora.");
        }
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [homeMode, search]);

  const isFeedMode = homeMode === "feed";
  const isSealedMode = homeMode === "selados";
  const catalogListings = useMemo(() => [...storeProducts, ...myCards], [myCards, storeProducts]);
  const catalogResults = useMemo(
    () => AnuncioService.buildCatalogResults(catalogListings),
    [catalogListings]
  );
  const sealedCatalogResults = useMemo(
    () => AnuncioService.buildCatalogResults(storeProducts),
    [storeProducts]
  );

  const cardResults = useMemo(() => {
    let results;
    const term = normalizeSearchText(search);

    if (search.trim()) {
      const apiResults = AnuncioService.buildSearchResults(apiCards, myCards);
      const localResults = catalogResults.filter((result) => {
        const searchable = normalizeSearchText(
          `${result.card?.name} ${result.card?.descricao} ${result.card?.description} ${result.card?.set} ${result.card?.rarity} ${result.card?.cardType}`
        );
        return searchable.includes(term);
      });
      const resultIds = new Set(apiResults.map((result) => String(result.card?.cardId ?? result.card?.id)));
      results = [
        ...apiResults,
        ...localResults.filter((result) => !resultIds.has(String(result.card?.cardId ?? result.card?.id))),
      ];
    } else {
      results = catalogResults;
    }

    const hasDetailFilters = Object.entries(listingDetailFilters).some(
      ([key, value]) => key === "maxPrice" ? !!value : value !== "all"
    );
    const sortSealedFirst = (items) =>
      [...items].sort((a, b) => Number(isSealedProduct(b.card)) - Number(isSealedProduct(a.card)));

    if (!hasDetailFilters) return sortSealedFirst(results);

    const maxPrice = parseMoneyValue(listingDetailFilters.maxPrice);
    const hasListingOnlyFilters =
      listingDetailFilters.idioma !== "all" ||
      listingDetailFilters.qualidade !== "all" ||
      maxPrice > 0;
    const cachedCardsById = new Map(cachedCards.map((card) => [String(card.id), card]));
    const getCardWithCache = (card) => ({
      ...card,
      ...(cachedCardsById.get(String(card?.cardId ?? card?.id)) ?? {}),
    });
    const getCardSet = (card) => getCardWithCache(card).set || "";
    const getCardRarity = (card) => getCardWithCache(card).rarity || "";
    const matchesCardType = (card) => {
      if (listingDetailFilters.type === "all") return true;
      return getCardTypeCategories(getCardWithCache(card)).has(listingDetailFilters.type);
    };

    return sortSealedFirst(results
      .map((result) => {
        if (!hasListingOnlyFilters) return result;

        const filteredListings = result.anuncios.filter((anuncio) => {
          if (listingDetailFilters.idioma !== "all" && normalizeFilterValue(anuncio.idioma) !== listingDetailFilters.idioma) return false;
          if (listingDetailFilters.qualidade !== "all" && anuncio.qualidade !== listingDetailFilters.qualidade) return false;
          if (maxPrice > 0 && anuncio.unitPrice > maxPrice) return false;
          return true;
        });

        return { ...result, anuncios: filteredListings };
      })
      .filter((result) => {
        if (hasListingOnlyFilters && result.anuncios.length === 0) return false;
        if (listingDetailFilters.set !== "all" && getCardSet(result.card) !== listingDetailFilters.set) return false;
        if (listingDetailFilters.rarity !== "all" && getCardRarity(result.card) !== listingDetailFilters.rarity) return false;
        if (!matchesCardType(result.card)) return false;
        return true;
      }));
  }, [apiCards, cachedCards, catalogResults, listingDetailFilters, myCards, search]);

  const spotlightItems = useMemo(() => {
    if (search.trim()) return [];

    const highlightedItems = carouselHighlights
      .filter((highlight) => highlight.active)
      .map((highlight) => {
        if (highlight.type === "image") {
          return {
            id: highlight.id,
            type: "image",
            title: highlight.title,
            subtitle: highlight.subtitle,
            image: highlight.image,
          };
        }

        if (highlight.type === "product") {
          const result = cardResults.find((item) => String(item.card.id) === String(highlight.productId));
          if (!result || result.anuncios.length === 0) return null;

          return {
            id: highlight.id,
            type: "product",
            result,
          };
        }

        return null;
      })
      .filter(Boolean);

    if (highlightedItems.length > 0) return highlightedItems.slice(0, 8);

    const localProductItems = cardResults
      .filter((result) => isSealedProduct(result.card) && result.anuncios.length > 0)
      .slice(0, 4)
      .map((result) => ({
        id: `local-spotlight-${result.card.id}`,
        type: "product",
        result,
      }));

    if (localProductItems.length > 0) return localProductItems;

    return [
      {
        id: "default-spotlight",
        type: "placeholder",
        title: "Yellow Duck TCG",
        subtitle: "Cartas, produtos selados e negociacoes em destaque.",
        image: null,
      },
    ];
  }, [cardResults, carouselHighlights, search]);

  useEffect(() => {
    setSealedSpotlightIndex(0);
    sealedCarouselRef.current?.scrollTo?.({ x: 0, animated: false });
  }, [sealedSpotlightCardWidth, spotlightItems.length]);

  useEffect(() => {
    if (spotlightItems.length <= 1) return undefined;

    const interval = setInterval(() => {
      setSealedSpotlightIndex((current) => {
        const next = (current + 1) % spotlightItems.length;
        sealedCarouselRef.current?.scrollTo?.({
          x: next * (sealedSpotlightCardWidth + sealedSpotlightGap),
          animated: true,
        });
        return next;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [sealedSpotlightCardWidth, spotlightItems.length]);

  const regularCardResults = useMemo(
    () => cardResults.filter((result) => !isSealedProduct(result.card)),
    [cardResults]
  );
  const sealedCardResults = useMemo(
    () => {
      const hasDetailFilters = Object.entries(listingDetailFilters).some(
        ([key, value]) => key === "maxPrice" ? !!value : value !== "all"
      );

      if (!search.trim() && !hasDetailFilters) return sealedCatalogResults;
      return cardResults.filter((result) => isSealedProduct(result.card));
    },
    [cardResults, listingDetailFilters, sealedCatalogResults, search]
  );
  useEffect(() => {
    const item = spotlightItems[sealedSpotlightIndex];
    if (item?.type !== "product") return;

    const productId = String(item.result?.card?.id ?? "");
    const image = getProductImage(item.result?.card, "large");
    if (!productId || image || requestedSealedImageIds.current.has(productId)) return;

    requestedSealedImageIds.current.add(productId);
    StoreProductService.loadProductImages([productId]).catch((error) => {
      requestedSealedImageIds.current.delete(productId);
      console.error("Erro ao carregar imagem do carrossel de selados:", error);
    });
  }, [sealedSpotlightIndex, spotlightItems]);

  useEffect(() => {
    if (!isSealedMode || sealedCardResults.length === 0) return;

    const initialCount = Math.max(1, numColumns * 3);
    const productIds = sealedCardResults
      .slice(0, initialCount)
      .map((result) => String(result.card?.id ?? ""))
      .filter((id) => id && !requestedSealedImageIds.current.has(id));

    if (productIds.length === 0) return;
    productIds.forEach((id) => requestedSealedImageIds.current.add(id));

    StoreProductService.loadProductImages(productIds).catch((error) => {
      productIds.forEach((id) => requestedSealedImageIds.current.delete(id));
      console.error("Erro ao carregar imagens iniciais dos selados:", error);
    });
  }, [isSealedMode, numColumns, sealedCardResults]);

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    const productIds = viewableItems
      .map((viewable) => viewable.item?.card)
      .filter(isSealedProduct)
      .map((card) => String(card?.id ?? ""))
      .filter((id) => id && !requestedSealedImageIds.current.has(id));

    if (productIds.length === 0) return;
    productIds.forEach((id) => requestedSealedImageIds.current.add(id));

    StoreProductService.loadProductImages(productIds).catch((error) => {
      productIds.forEach((id) => requestedSealedImageIds.current.delete(id));
      console.error("Erro ao carregar imagens visiveis dos selados:", error);
    });
  }).current;

  const listingFilterSource = useMemo(() => {
    return search.trim()
      ? AnuncioService.buildSearchResults(apiCards, myCards)
      : catalogResults;
  }, [apiCards, catalogResults, myCards, search]);

  const listingFilterChoices = useMemo(() => {
    const listings = listingFilterSource.flatMap((result) => result.anuncios);
    const cardsById = new Map(cachedCards.map((card) => [String(card.id), card]));
    const cardsForFilters = [
      ...cachedCards,
      ...apiCards,
      ...myCards.map((card) => cardsById.get(String(card.cardId ?? card.id)) ?? card),
      ...storeProducts,
      ...listingFilterSource.map((result) => result.card),
    ];

    return {
      idiomas: getUniqueValues([
        ...languageOptions,
        ...listings.map((anuncio) => normalizeFilterValue(anuncio.idioma)),
      ]),
      qualidades: getUniqueValues([
        ...qualityOptions,
        ...listings.map((anuncio) => anuncio.qualidade),
      ]),
      types: cardTypeOptions,
      sets: getUniqueValues(cardsForFilters.map((card) => card?.set)),
      rarities: getUniqueValues(cardsForFilters.map((card) => card?.rarity)),
    };
  }, [apiCards, cachedCards, listingFilterSource, myCards, storeProducts]);

  const feedPosts = useMemo(() => {
    const term = normalizeSearchText(search);

    return posts
      .filter((post) => {
        if (!term) return true;

        const searchable = normalizeSearchText(
          `${post.text} ${post.cardName} ${post.offer} ${post.minQuality} ${post.cardType} ${post.author?.name} ${post.author?.handle}`
        );
        return searchable.includes(term);
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [posts, search]);

  const userResults = useMemo(() => {
    const term = normalizeSearchText(search);
    if (!term) return [];

    return users
      .filter((item) => {
        const searchable = normalizeSearchText(
          `${item.name} ${item.handle} ${item.profileTitle} ${item.status} ${(item.badges ?? []).join(" ")}`
        );
        return searchable.includes(term);
      })
      .slice(0, 6);
  }, [search, users]);

  const matchingListings = useMemo(() => {
    if (!matchingWantedPost) return [];

    return AnuncioService.findListingsForWantedPost(myCards, matchingWantedPost);
  }, [matchingWantedPost, myCards]);

  const ownCards = useMemo(
    () => myCards.filter((item) => item.ownerId === user?.id || item.userId === user?.id),
    [myCards, user?.id]
  );
  const formatCardCode = (item) => {
    if (isSealedProduct(item)) return "Produto selado";

    return item.set || item.collectionNumber || item.id;
  };

  const openListingEditor = (anuncio) => {
    setEditingListing(anuncio);
    setListingDraft({
      aVenda: true,
      price: normalizeMoneyValue(anuncio.price),
      idioma: anuncio.idioma ?? "Portugues",
      qualidade: anuncio.qualidade ?? "NM",
    });
    setOpenDropdown(null);
  };

  const openAnnounceModal = () => {
    setAnnounceVisible(true);
    setOpenDropdown(null);
  };

  const selectAnnounceCard = (card) => {
    setAnnounceVisible(false);
    openListingEditor(card);
  };

  const closeListingEditor = () => {
    setEditingListing(null);
    setListingDraft(null);
    setOpenDropdown(null);
  };

  const saveListingEditor = () => {
    if (editingListing && listingDraft) {
      const priceText = String(listingDraft.price ?? "").replace(/\D/g, "");

      if (listingDraft.aVenda && (!priceText || priceText === "0")) {
        Alert.alert("Preco invalido", "Por favor, insira um preco valido.");
        return;
      }

      MyCardsService.updateCard(editingListing.id, listingDraft);
    }

    closeListingEditor();
  };

  const removeListing = (anuncio) => {
    const message = `Deseja remover ${anuncio.name} das cartas a venda?`;
    const deleteListing = () => {
      try {
        MyCardsService.deleteListing(anuncio.id);
      } catch (error) {
        Alert.alert("Anuncio", error.message || "Nao foi possivel remover o anuncio.");
      }
    };

    if (Platform.OS === "web") {
      const confirmed = globalThis.confirm?.(message) ?? true;
      if (confirmed) deleteListing();
      return;
    }

    Alert.alert(
      "Remover anuncio",
      message,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: deleteListing,
        },
      ]
    );
  };

  const addToCart = (anuncio) => {
    try {
      CartService.addItem(anuncio, user);
      Alert.alert("Carrinho", "Carta adicionada ao carrinho.");
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const openSellerProfile = (anuncio) => {
    if (!anuncio?.sellerId) return;

    router.push(`/views/ProfileView?userId=${encodeURIComponent(anuncio.sellerId)}`);
  };

  const openUserProfile = (profileId) => {
    if (!profileId) return;
    router.push(`/views/ProfileView?userId=${encodeURIComponent(profileId)}`);
  };

  const loadMoreSearchResults = async () => {
    const term = search.trim();
    if (!term || searchLoading || loadingMore || !searchHasMore) return;

    try {
      setLoadingMore(true);
      const nextPage = searchPage + 1;
      const cardPage = await PokemonService.searchCardsPage(term, nextPage);

      setApiCards((current) => {
        const cardsById = new Map(current.map((card) => [String(card.id), card]));
        cardPage.cards.forEach((card) => cardsById.set(String(card.id), card));
        return Array.from(cardsById.values());
      });
      setSearchPage(cardPage.page);
      setSearchHasMore(cardPage.hasMore);
    } catch (error) {
      console.error("Erro ao carregar mais cartas:", error);
      Alert.alert("Busca", "Nao foi possivel carregar mais cartas agora.");
    } finally {
      setLoadingMore(false);
    }
  };

  const openPokemonProfile = (pokemon) => {
    if (!pokemon?.apiName) return;
    router.push(`/views/PokemonDetailsView?name=${encodeURIComponent(pokemon.apiName)}`);
  };

  const negotiateListing = (anuncio) => {
    try {
      const conversation = ChatService.startConversation({
        currentUser: user,
        otherUser: anuncio.seller,
        listing: anuncio,
      });

      router.push(`/views/ChatView?conversationId=${encodeURIComponent(conversation.id)}`);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const openWantedMatches = (post) => {
    setMatchingWantedPost(post);
  };

  const syncSessionUser = (updatedUser) => {
    void AuthService.setCurrentUser(updatedUser);
    setUser(updatedUser);
  };

  const toggleSavedListing = async (anuncio) => {
    try {
      const updatedUser = await UserService.toggleSavedListing(user?.id, anuncio.listingId);
      syncSessionUser(updatedUser);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const toggleSavedPost = async (postId) => {
    try {
      const updatedUser = await UserService.toggleSavedPost(user?.id, postId);
      syncSessionUser(updatedUser);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

  const toggleRepost = (postId) => {
    try {
      ProfilePostService.toggleRepost(postId, user?.id);
    } catch (error) {
      Alert.alert("Nao permitido", error.message);
    }
  };

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
                key={option.label}
                activeOpacity={0.8}
                onPress={() => {
                  setListingDraft((current) => ({ ...current, [field]: option.value }));
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
    <CardSearchResult
      result={item}
      index={index}
      cardWidth={cardWidth}
      cardHeight={cardHeight}
      formatCardCode={formatCardCode}
      isFavorite={favoriteCardIds.has(String(item.card.id))}
      isMyCard={myCardIds.has(String(item.card.id))}
      onFavoritePress={(card) => FavoritesService.toggleFavorite(card)}
      onMyCardPress={(card) => MyCardsService.toggleCard(card)}
      onPress={(card) => router.push(`/views/CardDetailsView?id=${card.id}`)}
      onAddToCart={addToCart}
      onEditListing={openListingEditor}
      onRemoveListing={removeListing}
      onSellerPress={openSellerProfile}
      onNegotiate={negotiateListing}
      onSaveListing={toggleSavedListing}
      currentUser={user}
    />
  );

  const renderSealedSpotlight = () => {
    if (spotlightItems.length === 0) return null;

    return (
      <View style={styles.sealedSpotlight}>
        <ScrollView
          horizontal
          onMomentumScrollEnd={(event) => {
            const x = event.nativeEvent.contentOffset.x;
            const nextIndex = Math.round(x / (sealedSpotlightCardWidth + sealedSpotlightGap));
            setSealedSpotlightIndex(Math.max(0, Math.min(nextIndex, spotlightItems.length - 1)));
          }}
          ref={sealedCarouselRef}
          snapToInterval={sealedSpotlightCardWidth + sealedSpotlightGap}
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sealedSpotlightList}
        >
          {spotlightItems.map((item, index) => {
            const result = item.result;
            const listing = result?.anuncios?.[0];
            const isStaticSpotlight = item.type === "image" || item.type === "placeholder";
            const image = isStaticSpotlight ? item.image : getProductImage(result.card, "large");
            const shouldLoadImage = index === sealedSpotlightIndex;

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                key={item.id}
                onPress={() => item.type === "product" && router.push(`/views/CardDetailsView?id=${result.card.id}`)}
                style={[
                  styles.sealedSpotlightCard,
                  isStaticSpotlight && styles.imageSpotlightCard,
                  { backgroundColor: colors.surface, borderColor: colors.border, width: sealedSpotlightCardWidth },
                ]}
              >
                {isStaticSpotlight ? (
                  image && shouldLoadImage ? (
                    <Image
                      source={toImageSource(image)}
                      style={styles.imageSpotlightImage}
                    />
                  ) : (
                    <View style={[styles.imageSpotlightFallback, { backgroundColor: colors.surfaceVariant }]}>
                      <MaterialCommunityIcons name="image-outline" size={28} color={colors.primary} />
                      {!!item.title && (
                        <Text numberOfLines={2} style={[styles.imageSpotlightTitle, { color: colors.text }]}>
                          {item.title}
                        </Text>
                      )}
                      {!!item.subtitle && (
                        <Text numberOfLines={1} style={[styles.imageSpotlightSubtitle, { color: colors.mutedText }]}>
                          {item.subtitle}
                        </Text>
                      )}
                    </View>
                  )
                ) : (
                  <>
                    <View style={[styles.sealedImageWrap, { backgroundColor: colors.surfaceVariant }]}>
                      {image && shouldLoadImage ? (
                        <ExpoImage
                          cachePolicy="disk"
                          contentFit="cover"
                          recyclingKey={String(result.card.id)}
                          source={toImageSource(image)}
                          style={styles.sealedImage}
                          transition={120}
                        />
                      ) : (
                        <MaterialCommunityIcons name="package-variant-closed" size={38} color={colors.mutedText} />
                      )}
                      <View style={[styles.sealedBadge, { backgroundColor: colors.accent }]}>
                        <MaterialCommunityIcons name="shield-check" size={13} color={colors.onAccent} />
                        <Text style={[styles.sealedBadgeText, { color: colors.onAccent }]}>Lacrado</Text>
                      </View>
                    </View>
                    <View style={styles.sealedSpotlightInfo}>
                      <Text numberOfLines={2} style={[styles.sealedSpotlightName, { color: colors.text }]}>
                        {result.card.name}
                      </Text>
                      <Text style={[styles.sealedSpotlightPrice, { color: colors.primary }]}>
                        {formatCurrency(listing.unitPrice)}
                      </Text>
                      {!!listing.estoque && (
                        <Text numberOfLines={1} style={[styles.sealedSpotlightMeta, { color: colors.mutedText }]}>
                          {listing.estoque} un. disponivel
                        </Text>
                      )}
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {spotlightItems.length > 1 && (
          <View style={[styles.sealedSpotlightDots, { backgroundColor: colors.overlaySoft }]}>
            {spotlightItems.map((item, index) => (
              <View
                key={`spotlight-dot-${item.id}`}
                style={[
                  styles.sealedSpotlightDot,
                  {
                    backgroundColor: index === sealedSpotlightIndex ? colors.primary : colors.border,
                    width: index === sealedSpotlightIndex ? 18 : 6,
                  },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderFeedPost = ({ item }) => {
    const liked = item.likes?.includes(user?.id);
    const saved = user?.savedPostIds?.includes(item.id);
    const reposted = item.reposts?.includes(user?.id);
    const authorName = item.author?.name ?? "Usuario";
    const authorHandle = item.author?.handle ? `@${item.author.handle}` : "";

    return (
      <View style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => item.userId && router.push(`/views/ProfileView?userId=${encodeURIComponent(item.userId)}`)}
          style={styles.feedHeader}
        >
          <View style={[styles.feedAvatar, { backgroundColor: item.author?.themeColor || colors.accent }]}>
            {item.author?.photo ? (
              <Image source={{ uri: item.author.photo }} style={styles.feedAvatarImage} />
            ) : (
              <Text style={[styles.feedAvatarText, { color: colors.onAccent }]}>
                {String(authorName).slice(0, 2).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.feedAuthorText}>
            <Text numberOfLines={1} style={[styles.feedAuthorName, { color: colors.text }]}>{authorName}</Text>
            <Text numberOfLines={1} style={[styles.feedMeta, { color: colors.mutedText }]}>
              {[authorHandle, formatPostTime(item.createdAt)].filter(Boolean).join(" - ")}
            </Text>
          </View>
          <Text style={[styles.feedType, { color: item.type === "wanted" ? colors.primary : colors.mutedText }]}>
            {item.type === "wanted" ? "Procuro" : "Post"}
          </Text>
        </TouchableOpacity>

        {item.type === "wanted" && (
          <View style={[styles.feedWanted, { backgroundColor: colors.surfaceVariant }]}>
            <Text style={[styles.feedWantedLabel, { color: colors.mutedText }]}>Carta procurada</Text>
            <Text style={[styles.feedWantedName, { color: colors.text }]}>{item.cardName}</Text>
            {!!item.offer && <Text style={[styles.feedWantedOffer, { color: colors.primary }]}>Preco: {item.offer}</Text>}
            <View style={styles.feedWantedMetaRow}>
              {!!item.minQuality && (
                <Text style={[styles.feedWantedMeta, { color: colors.mutedText }]}>Min. {item.minQuality}</Text>
              )}
              {!!item.cardType && (
                <Text style={[styles.feedWantedMeta, { color: colors.mutedText }]}>{item.cardType}</Text>
              )}
            </View>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => openWantedMatches(item)}
              style={[styles.findMatchesButton, { borderColor: colors.border }]}
            >
              <MaterialCommunityIcons name="card-search-outline" size={18} color={colors.primary} />
              <Text style={[styles.findMatchesText, { color: colors.primary }]}>Encontrar cartas</Text>
            </TouchableOpacity>
          </View>
        )}

        {!!item.text && <Text style={[styles.feedText, { color: colors.text }]}>{item.text}</Text>}
        {item.image && <Image source={{ uri: item.image }} style={styles.feedImage} />}

        <View style={styles.feedActions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => {
              try {
                ProfilePostService.toggleLike(item.id, user?.id);
              } catch (error) {
                Alert.alert("Nao permitido", error.message);
              }
            }}
            style={styles.feedAction}
          >
            <MaterialCommunityIcons
              name={liked ? "heart" : "heart-outline"}
              size={21}
              color={liked ? colors.danger : colors.mutedText}
            />
            <Text style={[styles.feedActionText, { color: colors.mutedText }]}>
              {item.likes?.length ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => toggleRepost(item.id)}
            style={styles.feedAction}
          >
            <MaterialCommunityIcons
              name="repeat-variant"
              size={21}
              color={reposted ? colors.primary : colors.mutedText}
            />
            <Text style={[styles.feedActionText, { color: colors.mutedText }]}>
              {item.reposts?.length ?? 0}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => toggleSavedPost(item.id)}
            style={styles.feedAction}
          >
            <MaterialCommunityIcons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={21}
              color={saved ? colors.primary : colors.mutedText}
            />
          </TouchableOpacity>
          {item.userId !== user?.id && (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => item.userId && router.push(`/views/ProfileView?userId=${encodeURIComponent(item.userId)}`)}
              style={styles.feedAction}
            >
              <Text style={[styles.feedActionText, { color: colors.primary }]}>Ver perfil</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const saleLabel = listingDraft?.aVenda ? "Sim" : "Nao";
  const aVendaDropdown = listingDraft
    ? renderDropdown("aVenda", "Item a venda", saleLabel, saleOptions)
    : null;
  const idiomaDropdown = listingDraft
    ? renderDropdown("idioma", "Idioma", listingDraft.idioma, languageOptions)
    : null;
  const qualidadeDropdown = listingDraft
    ? renderDropdown("qualidade", "Qualidade", listingDraft.qualidade, qualityOptions)
    : null;
  const listData = isFeedMode ? feedPosts : isSealedMode ? sealedCardResults : regularCardResults;
  const listKey = isFeedMode ? "feed-list" : `catalog-grid-${numColumns}`;
  const hasListingDetailFilter = Object.entries(listingDetailFilters).some(
    ([key, value]) => key === "maxPrice" ? !!value : value !== "all"
  );
  const hasActiveFilter = !isFeedMode && hasListingDetailFilter;
  const setListingDetailFilter = (field, value) => {
    setListingDetailFilters((current) => ({ ...current, [field]: value }));
  };
  const clearListingDetailFilters = () => {
    setListingDetailFilters({
      idioma: "all",
      qualidade: "all",
      type: "all",
      set: "all",
      rarity: "all",
      maxPrice: "",
    });
  };
  const renderDetailFilterGroup = (label, field, options) => {
    if (options.length === 0) return null;
    const selectedValue = listingDetailFilters[field];
    const normalizedOptions = options.map((option) =>
      typeof option === "object" ? option : { label: option, value: option }
    );
    const selectedOption = normalizedOptions.find((option) => option.value === selectedValue);
    const selectedLabel = selectedValue === "all" ? "Qualquer" : selectedOption?.label ?? selectedValue;
    const isOpen = openFilterGroup === field;

    return (
      <View style={styles.detailFilterGroup}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setOpenFilterGroup(isOpen ? null : field)}
          style={[styles.detailFilterSelect, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
        >
          <View>
            <Text style={[styles.detailFilterLabel, { color: colors.mutedText }]}>{label}</Text>
            <Text numberOfLines={1} style={[styles.detailFilterSelected, { color: colors.text }]}>
              {selectedLabel}
            </Text>
          </View>
          <MaterialIcons name={isOpen ? "expand-less" : "expand-more"} size={22} color={colors.mutedText} />
        </TouchableOpacity>

        {isOpen && (
          <View style={styles.detailFilterOptions}>
            {[{ label: "Qualquer", value: "all" }, ...normalizedOptions].map((option) => {
              const selected = selectedValue === option.value;

              return (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={`${field}-${option.value}`}
                  onPress={() => {
                    setListingDetailFilter(field, option.value);
                    setOpenFilterGroup(null);
                  }}
                  style={[
                    styles.detailFilterOption,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceVariant,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.detailFilterOptionText, { color: selected ? colors.onPrimary : colors.text }]}>
                    {option.label}
                  </Text>
                  {selected && <MaterialIcons name="check" size={18} color={colors.onPrimary} />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Yellow Duck TCG" />

      <FlatList
        style={styles.list}
        key={listKey}
        data={listData}
        renderItem={isFeedMode ? renderFeedPost : renderCard}
        keyExtractor={(item) => isFeedMode ? String(item.id) : String(item.card.id)}
        extraData={isFeedMode ? undefined : `${favoriteExtraData}:${myCardsExtraData}:${theme.name}`}
        numColumns={isFeedMode ? 1 : numColumns}
        initialNumToRender={isFeedMode ? 4 : 6}
        maxToRenderPerBatch={isFeedMode ? 4 : 6}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={sealedViewabilityConfig.current}
        windowSize={5}
        contentContainerStyle={[
          styles.listContent,
          { padding: spacing },
          listData.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={isFeedMode ? undefined : { justifyContent: "space-between", marginBottom: spacing }}
        ListFooterComponent={
          !isFeedMode && search.trim() && searchHasMore && !searchLoading ? (
            <View style={styles.loadMoreWrap}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={loadingMore}
                onPress={loadMoreSearchResults}
                style={[styles.loadMoreButton, { backgroundColor: colors.primary }, loadingMore && styles.disabledButton]}
              >
                {loadingMore ? (
                  <LoadingDuck compact label="Carregando..." size={34} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.onPrimary} />
                    <Text style={[styles.loadMoreText, { color: colors.onPrimary }]}>Carregar mais</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : null
        }
        ListHeaderComponent={
          <View>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.mutedText} />
              <TextInput
                placeholder="Buscar"
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={colors.mutedText}
                style={[styles.searchInput, { color: colors.text }]}
              />
              {!!search && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSearch("")}
                  style={styles.searchIconButton}
                >
                  <MaterialIcons name="close" size={20} color={colors.mutedText} />
                </TouchableOpacity>
              )}
              {!isFeedMode && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setFilterVisible(true)}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor: hasActiveFilter ? colors.primary : "transparent",
                      borderColor: hasActiveFilter ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <MaterialIcons name="tune" size={19} color={hasActiveFilter ? colors.onPrimary : colors.text} />
                </TouchableOpacity>
              )}
            </View>

            {renderSealedSpotlight()}

            <View style={[styles.modeChips, { backgroundColor: colors.surfaceVariant }]}>
              {[
                { label: "Anuncios", value: "anuncios" },
                { label: "Selados", value: "selados" },
                { label: "Feed", value: "feed" },
              ].map((option) => {
                const selected = homeMode === option.value;

                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={option.value}
                    onPress={() => setHomeMode(option.value)}
                    style={[
                      styles.sortChip,
                      {
                        backgroundColor: selected ? colors.surface : "transparent",
                        borderColor: selected ? colors.border : "transparent",
                      },
                    ]}
                  >
                    <Text style={[styles.sortChipText, { color: selected ? colors.text : colors.mutedText }]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!isFeedMode && pokemonResult && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => openPokemonProfile(pokemonResult)}
                style={[styles.pokemonResultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <View style={[styles.pokemonResultImageWrap, { backgroundColor: colors.surfaceVariant }]}>
                  {pokemonResult.image ? (
                    <Image source={{ uri: pokemonResult.image }} style={styles.pokemonResultImage} />
                  ) : (
                    <MaterialCommunityIcons name="pokeball" size={34} color={colors.mutedText} />
                  )}
                </View>
                <View style={styles.pokemonResultInfo}>
                  <Text style={[styles.pokemonResultEyebrow, { color: colors.mutedText }]}>Pokemon encontrado</Text>
                  <Text numberOfLines={1} style={[styles.pokemonResultName, { color: colors.text }]}>
                    {pokemonResult.name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.pokemonResultMeta, { color: colors.mutedText }]}>
                    {pokemonResult.types.join(" / ") || "Ver informacoes e cartas"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            )}

            {userResults.length > 0 && (
              <View style={[styles.userResultsBlock, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.userResultsTitle, { color: colors.text }]}>Usuarios encontrados</Text>
                <View style={styles.userResultsList}>
                  {userResults.map((item) => {
                    const initials = String(item.name || "YD").slice(0, 2).toUpperCase();

                    return (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        key={item.id}
                        onPress={() => openUserProfile(item.id)}
                        style={[styles.userResultItem, { borderColor: colors.border }]}
                      >
                        <View style={[styles.userResultAvatar, { backgroundColor: item.themeColor || colors.accent }]}>
                          {item.photo ? (
                            <Image source={{ uri: item.photo }} style={styles.userResultAvatarImage} />
                          ) : (
                            <Text style={[styles.userResultAvatarText, { color: colors.onAccent }]}>{initials}</Text>
                          )}
                        </View>
                        <View style={styles.userResultInfo}>
                          <Text numberOfLines={1} style={[styles.userResultName, { color: colors.text }]}>
                            {item.name}
                          </Text>
                          <Text numberOfLines={1} style={[styles.userResultHandle, { color: colors.mutedText }]}>
                            {item.handle ? `@${item.handle}` : "Perfil Yellow Duck"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {!isFeedMode && !!searchError && (
              <Text style={[styles.searchError, { color: colors.danger }]}>{searchError}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          !isFeedMode && searchLoading ? (
            <View style={styles.searchLoadingState}>
              <LoadingDuck label="Buscando na API..." size={154} />
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {isFeedMode
                  ? search.trim() ? "Nenhum post encontrado" : "Nenhum post no feed"
                  : isSealedMode
                    ? search.trim() ? "Nenhum selado encontrado" : "Nenhum produto selado"
                    : search.trim() ? "Nenhuma carta encontrada" : "Nenhuma carta a venda"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                {isFeedMode
                  ? "Os posts criados nos perfis aparecem aqui."
                  : isSealedMode
                    ? "Produtos lacrados cadastrados aparecem nesta aba."
                    : search.trim()
                      ? "Tente buscar por outro nome de carta Pokemon TCG."
                      : "Va em Minhas listas, filtre por Minhas cartas, toque em Editar e marque uma carta como item a venda."}
              </Text>
              {!isFeedMode && !search.trim() && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={openAnnounceModal}
                  style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                >
                  <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>Anuncie</Text>
                </TouchableOpacity>
              )}
            </View>
          )
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

            <ScrollView contentContainerStyle={styles.filterScrollContent} showsVerticalScrollIndicator={false}>
              <View style={styles.detailFilters}>
                <View style={styles.detailFilterHeader}>
                  <Text style={[styles.detailFilterTitle, { color: colors.text }]}>Filtros do anuncio</Text>
                  {hasListingDetailFilter && (
                    <TouchableOpacity activeOpacity={0.75} onPress={clearListingDetailFilters}>
                      <Text style={[styles.clearFiltersText, { color: colors.primary }]}>Limpar</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {renderDetailFilterGroup("Idioma", "idioma", listingFilterChoices.idiomas)}
                {renderDetailFilterGroup("Qualidade", "qualidade", listingFilterChoices.qualidades)}
                {renderDetailFilterGroup("Tipo", "type", listingFilterChoices.types)}
                {renderDetailFilterGroup("Edicao", "set", listingFilterChoices.sets)}
                {renderDetailFilterGroup("Raridade", "rarity", listingFilterChoices.rarities)}

                <View style={styles.detailFilterGroup}>
                  <Text style={[styles.detailFilterLabel, { color: colors.mutedText }]}>Preco maximo</Text>
                  <TextInput
                    keyboardType="numeric"
                    onChangeText={(value) => setListingDetailFilter("maxPrice", formatMoneyInput(value))}
                    placeholder="Sem limite"
                    placeholderTextColor={colors.mutedText}
                    style={[
                      styles.detailFilterInput,
                      { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
                    ]}
                    value={listingDetailFilters.maxPrice}
                  />
                </View>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={announceVisible}
        onRequestClose={() => setAnnounceVisible(false)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setAnnounceVisible(false)}>
          <Pressable
            style={[styles.matchesModalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.matchesHeader}>
              <View style={styles.matchesTitleBlock}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Anuncie uma carta</Text>
                <Text style={[styles.modalSubtitle, { color: colors.mutedText }]}>
                  Selecione uma carta da sua colecao.
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setAnnounceVisible(false)}
                style={styles.closeIconButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            {ownCards.length === 0 ? (
              <View style={styles.noMatches}>
                <MaterialCommunityIcons name="cards-outline" size={32} color={colors.mutedText} />
                <Text style={[styles.noMatchesTitle, { color: colors.text }]}>Nenhuma carta na colecao</Text>
                <Text style={[styles.noMatchesText, { color: colors.mutedText }]}>
                  Adicione cartas em Minhas listas antes de criar um anuncio.
                </Text>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    setAnnounceVisible(false);
                    router.push("/views/FavoritesView");
                  }}
                  style={[styles.matchActionButton, { backgroundColor: colors.primary, marginTop: 12 }]}
                >
                  <Text style={[styles.matchActionText, { color: colors.onPrimary }]}>Ir para listas</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={ownCards}
                keyExtractor={(item) => item.collectionCardId ?? item.id}
                style={styles.matchesList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => selectAnnounceCard(item)}
                    style={[styles.matchItem, { borderColor: colors.border }]}
                  >
                    {!!item.images?.small && (
                      <Image source={{ uri: item.images.small }} style={styles.matchImage} />
                    )}
                    <View style={styles.matchInfo}>
                      <Text numberOfLines={1} style={[styles.matchName, { color: colors.text }]}>
                        {item.name}
                      </Text>
                      <Text numberOfLines={1} style={[styles.matchMeta, { color: colors.mutedText }]}>
                        {[item.set, item.collectionNumber, item.qualidade].filter(Boolean).join(" - ")}
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="tag-plus-outline" size={22} color={colors.primary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={!!matchingWantedPost}
        onRequestClose={() => setMatchingWantedPost(null)}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={() => setMatchingWantedPost(null)}>
          <Pressable
            style={[styles.matchesModalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.matchesHeader}>
              <View style={styles.matchesTitleBlock}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Cartas correspondentes</Text>
                <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
                  {matchingWantedPost?.cardName}
                </Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setMatchingWantedPost(null)}
                style={styles.closeIconButton}
              >
                <MaterialCommunityIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            {matchingListings.length === 0 ? (
              <View style={styles.noMatches}>
                <MaterialCommunityIcons name="cards-outline" size={32} color={colors.mutedText} />
                <Text style={[styles.noMatchesTitle, { color: colors.text }]}>Nenhuma carta encontrada</Text>
                <Text style={[styles.noMatchesText, { color: colors.mutedText }]}>
                  Ainda nao ha anuncio ativo que bata com esses requisitos.
                </Text>
              </View>
            ) : (
              <FlatList
                data={matchingListings}
                keyExtractor={(item) => item.listingId}
                style={styles.matchesList}
                renderItem={({ item }) => {
                  const isOwnListing = !!user?.id && item.sellerId === user.id;

                  return (
                    <View style={[styles.matchItem, { borderColor: colors.border }]}>
                      {!!item.images?.small && (
                        <Image source={{ uri: item.images.small }} style={styles.matchImage} />
                      )}
                      <View style={styles.matchInfo}>
                        <Text numberOfLines={1} style={[styles.matchName, { color: colors.text }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.matchPrice, { color: colors.primary }]}>
                          {formatCurrency(item.unitPrice)}
                        </Text>
                        <Text numberOfLines={1} style={[styles.matchMeta, { color: colors.mutedText }]}>
                          {[item.idioma, item.qualidade, item.cardType].filter(Boolean).join(" - ")}
                        </Text>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => openSellerProfile(item)}
                          style={styles.matchSellerButton}
                        >
                          <Text numberOfLines={1} style={[styles.matchSellerText, { color: colors.mutedText }]}>
                            {item.seller?.name || "Vendedor"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      {isOwnListing ? (
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => {
                            setMatchingWantedPost(null);
                            openListingEditor(item);
                          }}
                          style={[styles.matchActionButton, { backgroundColor: colors.primary }]}
                        >
                          <Text style={[styles.matchActionText, { color: colors.onPrimary }]}>Editar</Text>
                        </TouchableOpacity>
                      ) : (
                        <View style={styles.matchActions}>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => addToCart(item)}
                            style={[styles.matchIconButton, { backgroundColor: colors.primary }]}
                          >
                            <MaterialIcons name="shopping-cart" size={18} color={colors.onPrimary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
                              setMatchingWantedPost(null);
                              negotiateListing(item);
                            }}
                            style={[styles.matchIconButton, { borderColor: colors.border }]}
                          >
                            <MaterialCommunityIcons name="message-text-outline" size={18} color={colors.text} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        transparent
        visible={!!editingListing}
        onRequestClose={closeListingEditor}
      >
        <Pressable style={[styles.modalOverlay, { backgroundColor: colors.overlay }]} onPress={closeListingEditor}>
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: colors.text }]}>Editar anuncio</Text>
            <Text numberOfLines={1} style={[styles.modalSubtitle, { color: colors.mutedText }]}>
              {editingListing?.name}
            </Text>

            {aVendaDropdown}

            <View style={styles.field}>
              <Text style={[styles.inputLabel, { color: colors.mutedText }]}>Preco</Text>
              <TextInput
                keyboardType="numeric"
                onChangeText={(price) =>
                  setListingDraft((current) => ({ ...current, price: formatMoneyInput(price) }))
                }
                placeholder="R$ 0,00"
                placeholderTextColor={colors.mutedText}
                style={[
                  styles.input,
                  { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
                ]}
                value={String(listingDraft?.price ?? "")}
              />
            </View>

            {idiomaDropdown}
            {qualidadeDropdown}

            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={closeListingEditor}
                style={[styles.modalButton, { backgroundColor: colors.surfaceVariant }]}
              >
                <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={saveListingEditor}
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Salvar</Text>
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
  list: {
    width: "100%",
  },
  listContent: {
    alignSelf: "center",
    maxWidth: 1180,
    paddingBottom: 96,
    width: "100%",
  },
  modeChips: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 12,
    padding: 4,
    borderRadius: 8,
  },
  sortChip: {
    alignItems: "center",
    borderRadius: 6,
    borderWidth: 1,
    flex: 1,
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sortChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  sealedSpotlight: {
    marginBottom: 14,
    position: "relative",
  },
  sealedSpotlightList: {
    gap: sealedSpotlightGap,
    paddingBottom: 2,
  },
  sealedSpotlightCard: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    minHeight: 118,
    overflow: "hidden",
    padding: 8,
  },
  imageSpotlightCard: {
    height: 118,
    padding: 0,
  },
  imageSpotlightImage: {
    height: "100%",
    resizeMode: "cover",
    width: "100%",
  },
  imageSpotlightFallback: {
    alignItems: "center",
    gap: 5,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 18,
    width: "100%",
  },
  imageSpotlightTitle: {
    fontSize: 14,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
  },
  imageSpotlightSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  sealedImageWrap: {
    alignItems: "center",
    borderRadius: 7,
    height: 98,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 98,
  },
  sealedImage: {
    height: "100%",
    resizeMode: "contain",
    width: "100%",
  },
  sealedBadge: {
    alignItems: "center",
    borderRadius: 999,
    bottom: 6,
    flexDirection: "row",
    gap: 4,
    left: 6,
    minHeight: 22,
    paddingHorizontal: 7,
    position: "absolute",
  },
  sealedBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  sealedSpotlightInfo: {
    flex: 1,
    minHeight: 98,
    minWidth: 0,
    paddingRight: 2,
  },
  sealedSpotlightName: {
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 17,
  },
  sealedSpotlightPrice: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  sealedSpotlightMeta: {
    fontSize: 11,
    fontWeight: "700",
    marginTop: 4,
  },
  sealedSpotlightDots: {
    alignItems: "center",
    borderRadius: 999,
    bottom: 9,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    alignSelf: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    position: "absolute",
  },
  sealedSpotlightDot: {
    borderRadius: 999,
    height: 6,
  },
  pokemonResultCard: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
    minHeight: 88,
    padding: 10,
  },
  pokemonResultImageWrap: {
    alignItems: "center",
    borderRadius: 8,
    height: 64,
    justifyContent: "center",
    overflow: "hidden",
    width: 64,
  },
  pokemonResultImage: {
    height: "100%",
    resizeMode: "contain",
    width: "100%",
  },
  pokemonResultInfo: {
    flex: 1,
    minWidth: 0,
  },
  pokemonResultEyebrow: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  pokemonResultName: {
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  pokemonResultMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  userResultsBlock: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 10,
  },
  userResultsTitle: {
    fontSize: 13,
    fontWeight: "900",
    marginBottom: 8,
  },
  userResultsList: {
    gap: 8,
  },
  userResultItem: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 56,
    padding: 8,
  },
  userResultAvatar: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  userResultAvatarImage: {
    height: "100%",
    width: "100%",
  },
  userResultAvatarText: {
    fontSize: 13,
    fontWeight: "900",
  },
  userResultInfo: {
    flex: 1,
    minWidth: 0,
  },
  userResultName: {
    fontSize: 14,
    fontWeight: "900",
  },
  userResultHandle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    minHeight: 44,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "600",
  },
  searchIconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  filterButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    height: 34,
    width: 34,
  },
  searchLoadingState: {
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "center",
    minHeight: 360,
  },
  loadMoreWrap: {
    alignItems: "center",
    paddingBottom: 16,
    paddingTop: 4,
  },
  loadMoreButton: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 180,
    paddingHorizontal: 16,
  },
  loadMoreText: {
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.55,
  },
  searchError: {
    fontSize: 13,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 4,
  },
  feedCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
  },
  feedHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  feedAvatar: {
    alignItems: "center",
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    overflow: "hidden",
    width: 44,
  },
  feedAvatarImage: {
    height: "100%",
    width: "100%",
  },
  feedAvatarText: {
    fontSize: 14,
    fontWeight: "900",
  },
  feedAuthorText: {
    flex: 1,
    minWidth: 0,
  },
  feedAuthorName: {
    fontSize: 15,
    fontWeight: "900",
  },
  feedMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  feedType: {
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  feedWanted: {
    borderRadius: 8,
    marginTop: 12,
    padding: 12,
  },
  feedWantedLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  feedWantedName: {
    fontSize: 17,
    fontWeight: "900",
    marginTop: 3,
  },
  feedWantedOffer: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 5,
  },
  feedWantedMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  feedWantedMeta: {
    fontSize: 12,
    fontWeight: "900",
  },
  findMatchesButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    marginTop: 10,
    minHeight: 36,
    paddingHorizontal: 10,
  },
  findMatchesText: {
    fontSize: 12,
    fontWeight: "900",
  },
  feedText: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  feedImage: {
    aspectRatio: 4 / 3,
    borderRadius: 8,
    marginTop: 12,
    width: "100%",
  },
  feedActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  feedAction: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 34,
  },
  feedActionText: {
    fontSize: 13,
    fontWeight: "900",
  },
  emptyList: {
    flexGrow: 1,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  emptyButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  emptyButtonText: {
    fontWeight: "800",
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
    maxHeight: "86%",
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
  filterScrollContent: {
    paddingBottom: 2,
  },
  detailFilters: {
    gap: 10,
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
  detailFilterGroup: {
    gap: 7,
  },
  detailFilterLabel: {
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  detailFilterSelect: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 12,
  },
  detailFilterSelected: {
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
    maxWidth: 250,
  },
  detailFilterOptions: {
    gap: 6,
  },
  detailFilterOption: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  detailFilterOptionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  detailFilterInput: {
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  matchesModalCard: {
    borderRadius: 8,
    maxHeight: "82%",
    maxWidth: 560,
    padding: 16,
    width: "100%",
  },
  matchesHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  matchesTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  closeIconButton: {
    alignItems: "center",
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  matchesList: {
    marginTop: 4,
  },
  matchItem: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
    padding: 10,
  },
  matchImage: {
    borderRadius: 4,
    height: 68,
    resizeMode: "contain",
    width: 48,
  },
  matchInfo: {
    flex: 1,
    minWidth: 0,
  },
  matchName: {
    fontSize: 14,
    fontWeight: "900",
  },
  matchPrice: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },
  matchMeta: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  matchSellerButton: {
    alignSelf: "flex-start",
    marginTop: 4,
    maxWidth: "100%",
  },
  matchSellerText: {
    fontSize: 12,
    fontWeight: "800",
  },
  matchActions: {
    gap: 8,
  },
  matchIconButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  matchActionButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    minHeight: 38,
    paddingHorizontal: 10,
  },
  matchActionText: {
    fontSize: 12,
    fontWeight: "900",
  },
  noMatches: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 26,
  },
  noMatchesTitle: {
    fontSize: 16,
    fontWeight: "900",
    marginTop: 8,
  },
  noMatchesText: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
    textAlign: "center",
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
