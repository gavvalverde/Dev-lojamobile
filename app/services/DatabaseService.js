import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "../../utils/supabase";

const SUPABASE_TABLE = process.env.EXPO_PUBLIC_SUPABASE_TABLE || "yellowduck_records";
const STORAGE_PREFIX = "yellowduck:";
const STORE_PRODUCT_IMAGE_PREFIX = "yellowduck:store-product-image:";
const REALTIME_DEBOUNCE_MS = 300;
const REMOTE_REFRESH_THROTTLE_MS = 2000;

const collectionListeners = new Map();
const remoteRefreshPromises = new Map();
const lastRemoteRefreshAt = new Map();
const collectionMutationVersions = new Map();

const COLLECTIONS = {
  users: {
    legacyKey: "yellowduck:users",
    cacheLocal: false,
    orderBy: (a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    sortValue: (item) => item.name ?? "",
  },
  pokemon_cards: {
    legacyKey: "yellowduck:pokemon-cards",
    orderBy: (a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    sortValue: (item) => item.name ?? "",
  },
  listings: {
    legacyKey: "yellowduck:listings",
    orderBy: (a, b) => String(b?.updatedAt ?? "").localeCompare(String(a?.updatedAt ?? "")),
    sortValue: (item) => item.updatedAt ?? "",
  },
  profile_posts: {
    legacyKey: "yellowduck:profile-posts",
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
  chats: {
    legacyKey: "yellowduck:chats",
    orderBy: (a, b) => String(b?.updatedAt ?? b?.createdAt ?? "").localeCompare(String(a?.updatedAt ?? a?.createdAt ?? "")),
    sortValue: (item) => item.updatedAt ?? item.createdAt ?? "",
  },
  my_cards: {
    legacyKey: "yellowduck:my-cards",
    orderBy: (a, b) => String(b?.updatedAt ?? "").localeCompare(String(a?.updatedAt ?? "")),
    sortValue: (item) => item.updatedAt ?? "",
  },
  favorites: {
    legacyKey: "yellowduck:favorites",
    orderBy: (a, b) => String(b?.updatedAt ?? "").localeCompare(String(a?.updatedAt ?? "")),
    sortValue: (item) => item.updatedAt ?? "",
  },
  card_lists: {
    legacyKey: "yellowduck:card-lists",
    orderBy: (a, b) => String(b?.updatedAt ?? b?.createdAt ?? "").localeCompare(String(a?.updatedAt ?? a?.createdAt ?? "")),
    sortValue: (item) => item.updatedAt ?? item.createdAt ?? "",
  },
  cart_items: {
    legacyKey: "yellowduck:cart",
    orderBy: (a, b) => String(b?.updatedAt ?? "").localeCompare(String(a?.updatedAt ?? "")),
    sortValue: (item) => item.updatedAt ?? "",
  },
  orders: {
    legacyKey: "yellowduck:orders",
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
  reviews: {
    legacyKey: "yellowduck:reviews",
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
  carousel_highlights: {
    legacyKey: "yellowduck:carousel-highlights",
    toLocalCache: (item) => {
      const image = typeof item?.image === "string" ? item.image : null;
      const shouldKeepImage = image && (!image.startsWith("data:") || image.length < 180000);

      return {
        ...item,
        image: shouldKeepImage ? image : null,
        imageDeferred: Boolean(image && !shouldKeepImage),
      };
    },
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
  store_products: {
    legacyKey: "yellowduck:store-products",
    readLegacyCache: false,
    storageKey: "yellowduck:store-products-lite-v1",
    toLocalCache: (item) => {
      const smallImage = typeof item?.images?.small === "string" ? item.images.small : null;
      const largeImage = typeof item?.images?.large === "string" ? item.images.large : null;
      const keepSmallImage = smallImage && !smallImage.startsWith("data:");
      const keepLargeImage = largeImage && !largeImage.startsWith("data:");

      return {
        ...item,
        images: {
          small: keepSmallImage ? smallImage : null,
          large: keepLargeImage ? largeImage : null,
        },
        imageDeferred: Boolean(
          (smallImage && !keepSmallImage) ||
          (largeImage && !keepLargeImage)
        ),
      };
    },
    orderBy: (a, b) => String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "pt-BR"),
    sortValue: (item) => item.name ?? "",
  },
  auctions: {
    legacyKey: "yellowduck:auctions",
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
  notifications: {
    legacyKey: "yellowduck:notifications",
    orderBy: (a, b) => String(b?.createdAt ?? "").localeCompare(String(a?.createdAt ?? "")),
    sortValue: (item) => item.createdAt ?? "",
  },
};

function storageKey(collection) {
  return getCollectionConfig(collection).storageKey ?? `${STORAGE_PREFIX}${collection}`;
}

async function getLocalItem(key) {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  return AsyncStorage.getItem(key);
}

async function setLocalItem(key, value) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

async function removeLocalItem(key) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

function parseJsonArray(value) {
  try {
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function normalizeRecordData(value) {
  if (!value) return null;
  if (typeof value === "string") return parseJsonObject(value);
  return value;
}

function getItemKey(item) {
  return String(item?.recordKey ?? item?.favoriteId ?? item?.cartItemId ?? item?.collectionCardId ?? item?.listingId ?? item?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

function getCollectionConfig(collection) {
  const config = COLLECTIONS[collection];
  if (!config) throw new Error(`Colecao sem configuracao: ${collection}`);
  return config;
}

function sortItems(collection, items) {
  const orderBy = getCollectionConfig(collection).orderBy;
  return [...items].sort(orderBy);
}

function toLocalCacheItems(collection, items) {
  const config = getCollectionConfig(collection);
  const safeItems = Array.isArray(items) ? items : [];

  if (!config.toLocalCache) return safeItems;
  return safeItems.map(config.toLocalCache).filter(Boolean);
}

function getCollectionListeners(collection) {
  if (!collectionListeners.has(collection)) {
    collectionListeners.set(collection, new Set());
  }

  return collectionListeners.get(collection);
}

function emitCollectionChange(collection) {
  const listeners = collectionListeners.get(collection);
  if (!listeners) return;

  listeners.forEach((listener) => listener());
}

function getCollectionMutationVersion(collection) {
  return collectionMutationVersions.get(collection) ?? 0;
}

function bumpCollectionMutationVersion(collection) {
  collectionMutationVersions.set(collection, getCollectionMutationVersion(collection) + 1);
}

async function readLocalCollection(collection) {
  const config = getCollectionConfig(collection);
  if (config.cacheLocal === false) {
    await removeLocalItem(storageKey(collection));
    await removeLocalItem(config.legacyKey);
    return [];
  }

  const value = await getLocalItem(storageKey(collection));
  const legacyValue = value ?? (
    config.readLegacyCache === false ? null : await getLocalItem(config.legacyKey)
  );
  return sortItems(collection, parseJsonArray(legacyValue));
}

async function writeLocalCollection(collection, items) {
  const config = getCollectionConfig(collection);
  if (config.cacheLocal === false) {
    await removeLocalItem(storageKey(collection));
    await removeLocalItem(config.legacyKey);
    return;
  }

  try {
    await setLocalItem(storageKey(collection), JSON.stringify(toLocalCacheItems(collection, items)));
  } catch (error) {
    console.warn(`Nao foi possivel salvar cache local de ${collection}:`, error);
  }
}

async function readSupabaseCollection(collection) {
  if (!supabase) throw new Error("Supabase nao configurado.");

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select("record_key,data_json,sort_value,updated_at")
    .eq("collection", collection)
    .order("sort_value", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const items = Array.isArray(data)
    ? data.map((row) => normalizeRecordData(row.data_json)).filter(Boolean)
    : [];

  return sortItems(collection, items);
}

async function readStoreProductSummaries() {
  if (!supabase) throw new Error("Supabase nao configurado.");

  const { data, error } = await supabase
    .from(SUPABASE_TABLE)
    .select(`
      record_key,
      id:data_json->>id,
      card_id:data_json->>cardId,
      name:data_json->>name,
      listing_id:data_json->>listingId,
      set_name:data_json->>set,
      rarity:data_json->>rarity,
      collection_number:data_json->>collectionNumber,
      descricao:data_json->>descricao,
      description:data_json->>description,
      estoque:data_json->>estoque,
      supertype:data_json->>supertype,
      card_type:data_json->>cardType,
      subtypes:data_json->subtypes,
      product_type:data_json->>productType,
      price:data_json->>price,
      idioma:data_json->>idioma,
      qualidade:data_json->>qualidade,
      a_venda:data_json->>aVenda
    `)
    .eq("collection", "store_products")
    .order("sort_value", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  const products = Array.isArray(data)
    ? data.map((row) => ({
        id: row.id ?? row.record_key,
        cardId: row.card_id ?? row.record_key,
        listingId: row.listing_id ?? null,
        name: row.name ?? "",
        set: row.set_name ?? "",
        rarity: row.rarity ?? "",
        collectionNumber: row.collection_number ?? "",
        descricao: row.descricao ?? "",
        description: row.description ?? "",
        estoque: Number(row.estoque) || 0,
        supertype: row.supertype ?? "",
        cardType: row.card_type ?? "produto-selado",
        subtypes: Array.isArray(row.subtypes) ? row.subtypes : [],
        productType: row.product_type ?? "sealed",
        price: row.price ?? "",
        idioma: row.idioma ?? "",
        qualidade: row.qualidade ?? "",
        aVenda: row.a_venda !== "false",
        images: { small: null, large: null },
        imageDeferred: true,
      }))
    : [];

  return sortItems("store_products", products);
}

function refreshSupabaseCollection(collection) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve([]);

  const now = Date.now();
  const lastRefresh = lastRemoteRefreshAt.get(collection) ?? 0;
  if (now - lastRefresh < REMOTE_REFRESH_THROTTLE_MS) {
    return remoteRefreshPromises.get(collection) ?? Promise.resolve([]);
  }

  const pendingRefresh = remoteRefreshPromises.get(collection);
  if (pendingRefresh) return pendingRefresh;

  const mutationVersion = getCollectionMutationVersion(collection);
  const refreshPromise = readSupabaseCollection(collection)
    .then(async (remoteItems) => {
      if (mutationVersion !== getCollectionMutationVersion(collection)) {
        return remoteItems;
      }

      await writeLocalCollection(collection, remoteItems);
      lastRemoteRefreshAt.set(collection, Date.now());
      emitCollectionChange(collection);
      return remoteItems;
    })
    .catch((error) => {
      console.error(`Erro ao sincronizar ${collection} no Supabase:`, error);
      return [];
    })
    .finally(() => {
      remoteRefreshPromises.delete(collection);
    });

  remoteRefreshPromises.set(collection, refreshPromise);
  return refreshPromise;
}

async function writeSupabaseCollection(collection, items) {
  if (!supabase) throw new Error("Supabase nao configurado.");

  const config = getCollectionConfig(collection);
  const safeItems = Array.isArray(items) ? items : [];

  if (safeItems.length === 0) {
    const { error: deleteError } = await supabase
      .from(SUPABASE_TABLE)
      .delete()
      .eq("collection", collection);

    if (deleteError) throw deleteError;
    return;
  }

  const recordKeys = safeItems.map(getItemKey);
  const timestamp = new Date().toISOString();
  const { data: existingRows, error: selectError } = await supabase
    .from(SUPABASE_TABLE)
    .select("record_key")
    .eq("collection", collection);

  if (selectError) throw selectError;

  const rows = safeItems.map((item) => ({
    collection,
    record_key: getItemKey(item),
    sort_value: String(config.sortValue(item) ?? ""),
    data_json: item,
    updated_at: timestamp,
  }));

  const { error: upsertError } = await supabase
    .from(SUPABASE_TABLE)
    .upsert(rows, { onConflict: "collection,record_key" });

  if (upsertError) throw upsertError;

  const nextKeySet = new Set(recordKeys);
  const staleKeys = (existingRows ?? [])
    .map((row) => row.record_key)
    .filter((key) => !nextKeySet.has(key));

  if (staleKeys.length === 0) return;

  const { error: deleteError } = await supabase
    .from(SUPABASE_TABLE)
    .delete()
    .eq("collection", collection)
    .in("record_key", staleKeys);

  if (deleteError) throw deleteError;
}

async function listCollection(collection, fallbackItems = []) {
  const config = getCollectionConfig(collection);

  if (!isSupabaseConfigured) {
    const localItems = await readLocalCollection(collection);
    return localItems.length > 0 ? localItems : fallbackItems;
  }

  if (config.cacheLocal !== false) {
    const localItems = await readLocalCollection(collection);
    if (localItems.length > 0) {
      refreshSupabaseCollection(collection);
      return localItems;
    }

    if (fallbackItems.length > 0) {
      refreshSupabaseCollection(collection);
      return fallbackItems;
    }
  }

  try {
    const remoteItems = await readSupabaseCollection(collection);
    await writeLocalCollection(collection, remoteItems);
    lastRemoteRefreshAt.set(collection, Date.now());
    return remoteItems;
  } catch (error) {
    console.error(`Erro ao ler ${collection} no Supabase:`, error);
    const localItems = await readLocalCollection(collection);
    return localItems.length > 0 ? localItems : fallbackItems;
  }
}

async function saveCollection(collection, items) {
  const safeItems = Array.isArray(items) ? items : [];
  bumpCollectionMutationVersion(collection);
  await writeLocalCollection(collection, safeItems);
  emitCollectionChange(collection);

  if (!isSupabaseConfigured) return;

  try {
    await writeSupabaseCollection(collection, safeItems);
  } catch (error) {
    console.error(`Erro ao salvar ${collection} no Supabase:`, error);
    throw error;
  }
}

async function syncListingsFromCards(cards) {
  const listings = cards.filter((item) => item?.aVenda);
  await saveCollection("listings", listings.map((item) => ({
    ...item,
    listingId: item.listingId ?? `${item.id}:${item.seller?.id ?? "sem-vendedor"}`,
    sellerId: item.sellerId ?? item.seller?.id ?? null,
  })));
}

function subscribeCollection(collection, onChange) {
  const localListeners = getCollectionListeners(collection);
  localListeners.add(onChange);

  if (!isSupabaseConfigured || !supabase) {
    return () => {
      localListeners.delete(onChange);
    };
  }

  let timeoutId = null;
  const channel = supabase
    .channel(`yellowduck:${collection}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: SUPABASE_TABLE,
        filter: `collection=eq.${collection}`,
      },
      () => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(onChange, REALTIME_DEBOUNCE_MS);
      }
    )
    .subscribe((status, error) => {
      if (error) {
        console.error(`Erro no realtime de ${collection}:`, error);
      }
    });

  return () => {
    localListeners.delete(onChange);
    if (timeoutId) clearTimeout(timeoutId);
    supabase.removeChannel(channel);
  };
}

export const DatabaseService = {
  subscribeCollection,

  async getUsers() {
    return listCollection("users");
  },

  async saveUsers(users) {
    await saveCollection("users", users);
  },

  async getPokemonCards() {
    return readLocalCollection("pokemon_cards");
  },

  async savePokemonCards(cards) {
    const currentCards = await readLocalCollection("pokemon_cards");
    const cardsById = new Map(currentCards.map((card) => [getItemKey(card), card]));
    cards.forEach((card) => cardsById.set(getItemKey(card), card));
    await writeLocalCollection("pokemon_cards", Array.from(cardsById.values()));
  },

  async getSession() {
    return parseJsonObject(await getLocalItem("yellowduck:session"));
  },

  async saveSession(session) {
    await setLocalItem("yellowduck:session", JSON.stringify(session));
  },

  async clearSession() {
    await removeLocalItem("yellowduck:session");
  },

  async getProfilePosts() {
    return listCollection("profile_posts");
  },

  async saveProfilePosts(posts) {
    await saveCollection("profile_posts", posts);
  },

  async getConversations() {
    return listCollection("chats");
  },

  async saveConversations(conversations) {
    await saveCollection("chats", conversations);
  },

  async getMyCards() {
    const legacySaleCards = parseJsonArray(await getLocalItem("yellowduck:favorites"))
      .filter((item) => item?.aVenda);
    return listCollection("my_cards", legacySaleCards);
  },

  async saveMyCards(cards) {
    await saveCollection("my_cards", cards);
    await syncListingsFromCards(cards);
  },

  async getFavorites() {
    return listCollection("favorites");
  },

  async saveFavorites(favorites) {
    await saveCollection("favorites", favorites);
  },

  async getCardLists() {
    return listCollection("card_lists");
  },

  async saveCardLists(lists) {
    await saveCollection("card_lists", lists);
  },

  async getCartItems() {
    return listCollection("cart_items");
  },

  async saveCartItems(items) {
    await saveCollection("cart_items", items);
  },

  async getOrders() {
    return listCollection("orders");
  },

  async saveOrders(orders) {
    await saveCollection("orders", orders);
  },

  async getReviews() {
    return listCollection("reviews");
  },

  async saveReviews(reviews) {
    await saveCollection("reviews", reviews);
  },

  async getCarouselHighlights() {
    return listCollection("carousel_highlights");
  },

  async saveCarouselHighlights(highlights) {
    await saveCollection("carousel_highlights", highlights);
  },

  async getStoreProducts() {
    const localProducts = await readLocalCollection("store_products");
    if (localProducts.length > 0) return localProducts;
    if (!isSupabaseConfigured) return [];

    const remoteProducts = await readStoreProductSummaries();
    await writeLocalCollection("store_products", remoteProducts);
    lastRemoteRefreshAt.set("store_products", Date.now());
    return remoteProducts;
  },

  async getStoreProductsFresh() {
    if (!isSupabaseConfigured) {
      return listCollection("store_products");
    }

    const remoteProducts = await readSupabaseCollection("store_products");
    await writeLocalCollection("store_products", remoteProducts);
    lastRemoteRefreshAt.set("store_products", Date.now());
    return remoteProducts;
  },

  async getStoreProductsByIdsFresh(productIds) {
    const ids = [...new Set(
      (Array.isArray(productIds) ? productIds : [])
        .map((id) => String(id ?? ""))
        .filter(Boolean)
    )];

    if (ids.length === 0) return [];
    if (!isSupabaseConfigured || !supabase) {
      const localProducts = await listCollection("store_products");
      return localProducts.filter((product) => ids.includes(getItemKey(product)));
    }

    const { data, error } = await supabase
      .from(SUPABASE_TABLE)
      .select("record_key,card_id:data_json->>cardId,small_image:data_json->images->>small")
      .eq("collection", "store_products")
      .or(`record_key.in.(${ids.join(",")}),data_json->>cardId.in.(${ids.join(",")})`);

    if (error) throw error;

    return Array.isArray(data)
      ? data.map((row) => ({
          id: row.record_key,
          cardId: row.card_id ?? row.record_key,
          images: {
            small: row.small_image ?? null,
            large: row.small_image ?? null,
          },
        }))
      : [];
  },

  async getStoreProductCachedImages(productId) {
    const id = String(productId ?? "");
    if (!id) return null;
    return parseJsonObject(await getLocalItem(`${STORE_PRODUCT_IMAGE_PREFIX}${id}`));
  },

  async saveStoreProductCachedImages(productId, images) {
    const id = String(productId ?? "");
    if (!id || !images?.small) return;
    try {
      await setLocalItem(`${STORE_PRODUCT_IMAGE_PREFIX}${id}`, JSON.stringify(images));
    } catch (error) {
      console.warn(`Nao foi possivel salvar cache da imagem do produto ${id}:`, error);
    }
  },

  async removeStoreProductCachedImages(productId) {
    const id = String(productId ?? "");
    if (!id) return;
    await removeLocalItem(`${STORE_PRODUCT_IMAGE_PREFIX}${id}`);
  },

  async saveStoreProducts(products) {
    await saveCollection("store_products", products);
  },

  async getAuctions() {
    if (isSupabaseConfigured) {
      try {
        const remoteAuctions = await readSupabaseCollection("auctions");
        await writeLocalCollection("auctions", remoteAuctions);
        return remoteAuctions;
      } catch (error) {
        console.error("Erro ao ler auctions no Supabase:", error);
      }
    }

    return listCollection("auctions");
  },

  async saveAuctions(auctions) {
    await saveCollection("auctions", auctions);
  },

  async getNotifications() {
    return listCollection("notifications");
  },

  async saveNotifications(notifications) {
    await saveCollection("notifications", notifications);
  },
};
