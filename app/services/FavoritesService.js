import { AuthService } from "./AuthService";
import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";
import { createQueuedWriter } from "../../utils/queuedWriter";

const listeners = new Set();
let favorites = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;
const favoritesWriter = createQueuedWriter(
  (snapshot) => DatabaseService.saveFavorites(snapshot),
  (error) => console.error("Erro ao salvar favoritos:", error)
);

const defaultFavoriteFields = {
  aVenda: false,
  idioma: "Português",
  qualidade: "NM",
};

const qualityAliases = {
  "Near Mint": "NM",
  Excelente: "NM",
  "Muito boa": "LP",
  Boa: "MP",
  Regular: "HP",
  Danificada: "DMG",
};

function notify() {
  const userId = AuthService.getCurrentUser()?.id;
  const visibleFavorites = userId ? favorites.filter((item) => item.ownerId === userId) : [];
  listeners.forEach((listener) => listener(visibleFavorites));
}

function normalizeFavorite(card) {
  const owner = card.owner ?? card.user ?? null;
  const ownerId = card.ownerId ?? card.userId ?? owner?.id ?? null;
  const cardId = String(card.cardId ?? card.id ?? "");
  const qualidade =
    card.qualidade ?? card.quality ?? defaultFavoriteFields.qualidade;
  const aVenda = card.aVenda ?? card.forSale ?? defaultFavoriteFields.aVenda;

  return {
    ...defaultFavoriteFields,
    ...card,
    id: ownerId && cardId ? `${ownerId}:${cardId}` : String(card.id ?? cardId),
    cardId,
    favoriteId: ownerId && cardId ? `${ownerId}:${cardId}` : String(card.favoriteId ?? card.id ?? cardId),
    owner,
    ownerId,
    userId: ownerId,
    aVenda,
    price: card.price ?? "",
    idioma: card.idioma ?? card.language ?? defaultFavoriteFields.idioma,
    qualidade: qualityAliases[qualidade] ?? qualidade,
    seller: card.seller ?? card.vendedor ?? (aVenda ? getCurrentSellerSnapshot() : null),
    favorito: true,
  };
}

function mergeFavoritesByKey(primaryFavorites, fallbackFavorites) {
  const merged = [];
  const seen = new Set();

  [...primaryFavorites, ...fallbackFavorites].forEach((favorite) => {
    const normalized = normalizeFavorite(favorite);
    const key = normalized.favoriteId || normalized.id;
    if (!key || seen.has(key)) return;

    seen.add(key);
    merged.push(normalized);
  });

  return merged;
}

function getCurrentSellerSnapshot() {
  const user = AuthService.getCurrentUser();
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    handle: user.handle,
    photo: user.photo,
    themeColor: user.themeColor,
  };
}

async function readFavorites() {
  try {
    return DatabaseService.getFavorites();
  } catch (error) {
    console.error("Erro ao carregar favoritos:", error);
    return [];
  }
}

async function writeFavorites() {
  return favoritesWriter.write(favorites);
}

async function hydrate() {
  if (hydrated) return favorites;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readFavorites().then((storedFavorites) => {
    const normalizedStoredFavorites = storedFavorites.map(normalizeFavorite);
    const hadLocalChanges = favorites.length > 0;

    favorites = hadLocalChanges
      ? mergeFavoritesByKey(favorites, normalizedStoredFavorites)
      : normalizedStoredFavorites;
    hydrated = true;
    notify();
    if (hadLocalChanges) writeFavorites();
    return favorites;
  });

  return hydratePromise;
}

function setFavorites(nextFavorites) {
  favorites = reconcileCollection(favorites, nextFavorites.map(normalizeFavorite)).items;
  notify();
  writeFavorites();
}

async function refreshFavorites() {
  if (favoritesWriter.hasPendingWrites()) return;

  try {
    const storedFavorites = await readFavorites();
    const nextFavorites = storedFavorites.map(normalizeFavorite);
    const result = reconcileCollection(favorites, nextFavorites);
    hydrated = true;
    if (!result.changed) return;

    favorites = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar favoritos:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("favorites", refreshFavorites);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const FavoritesService = {
  async loadFavorites() {
    return hydrate();
  },

  getFavorites() {
    const userId = AuthService.getCurrentUser()?.id;
    return userId ? favorites.filter((item) => item.ownerId === userId) : [];
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    notify();
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  isFavorite(id) {
    const userId = AuthService.getCurrentUser()?.id;
    return favorites.some((item) => item.cardId === String(id) && item.ownerId === userId);
  },

  toggleFavorite(card) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para favoritar.");
    const cardId = String(card.cardId ?? card.id ?? "");
    const alreadyFavorite = favorites.some((item) => item.cardId === cardId && item.ownerId === userId);

    if (alreadyFavorite) {
      setFavorites(favorites.filter((item) => !(item.cardId === cardId && item.ownerId === userId)));
      return;
    }

    setFavorites([
      normalizeFavorite({
        ...card,
        owner: getCurrentSellerSnapshot(),
        ownerId: userId,
        userId,
      }),
      ...favorites,
    ]);
  },

  updateFavorite(id, updates) {
    const shouldAttachSeller = updates.aVenda === true;
    const seller = shouldAttachSeller ? getCurrentSellerSnapshot() : updates.seller;

    setFavorites(
      favorites.map((item) =>
        item.id === id
          ? normalizeFavorite({
              ...item,
              ...updates,
              seller: seller ?? item.seller ?? null,
            })
          : item
      )
    );
  },

  updateSellerProfile(user) {
    if (!user?.id) return;

    const seller = {
      id: user.id,
      name: user.name,
      handle: user.handle,
      photo: user.photo,
      themeColor: user.themeColor,
    };

    setFavorites(
      favorites.map((item) =>
        item.seller?.id === user.id ? normalizeFavorite({ ...item, seller }) : item
      )
    );
  },
};
