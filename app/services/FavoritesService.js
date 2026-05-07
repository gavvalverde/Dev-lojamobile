import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { AuthService } from "./AuthService";

const STORAGE_KEY = "yellowduck:favorites";

const listeners = new Set();
let favorites = [];
let hydrated = false;
let hydratePromise = null;

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
  listeners.forEach((listener) => listener(favorites));
}

function normalizeFavorite(card) {
  const qualidade =
    card.qualidade ?? card.quality ?? defaultFavoriteFields.qualidade;
  const aVenda = card.aVenda ?? card.forSale ?? defaultFavoriteFields.aVenda;

  return {
    ...defaultFavoriteFields,
    ...card,
    aVenda,
    price: card.price ?? "",
    idioma: card.idioma ?? card.language ?? defaultFavoriteFields.idioma,
    qualidade: qualityAliases[qualidade] ?? qualidade,
    seller: card.seller ?? card.vendedor ?? (aVenda ? getCurrentSellerSnapshot() : null),
    favorito: true,
  };
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
    if (Platform.OS === "web") {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    }

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao carregar favoritos:", error);
    return [];
  }
}

async function writeFavorites() {
  try {
    const serialized = JSON.stringify(favorites);

    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Erro ao salvar favoritos:", error);
  }
}

async function hydrate() {
  if (hydrated) return favorites;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readFavorites().then((storedFavorites) => {
    favorites = storedFavorites.map(normalizeFavorite);
    hydrated = true;
    notify();
    return favorites;
  });

  return hydratePromise;
}

function setFavorites(nextFavorites) {
  favorites = nextFavorites.map(normalizeFavorite);
  notify();
  writeFavorites();
}

export const FavoritesService = {
  async loadFavorites() {
    return hydrate();
  },

  getFavorites() {
    return favorites;
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(favorites);
    hydrate();

    return () => {
      listeners.delete(listener);
    };
  },

  isFavorite(id) {
    return favorites.some((item) => item.id === id);
  },

  toggleFavorite(card) {
    const alreadyFavorite = favorites.some((item) => item.id === card.id);

    if (alreadyFavorite) {
      setFavorites(favorites.filter((item) => item.id !== card.id));
      return;
    }

    setFavorites([normalizeFavorite(card), ...favorites]);
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
