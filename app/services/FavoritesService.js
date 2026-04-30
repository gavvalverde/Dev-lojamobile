import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const STORAGE_KEY = "yellowduck:favorites";
const STORAGE_FILE = `${FileSystem.documentDirectory || ""}favorites.json`;

const listeners = new Set();
let favorites = [];
let hydrated = false;
let hydratePromise = null;

const defaultFavoriteFields = {
  aVenda: false,
  idioma: "Portugues",
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

  return {
    ...defaultFavoriteFields,
    ...card,
    aVenda: card.aVenda ?? card.forSale ?? defaultFavoriteFields.aVenda,
    price: card.price ?? "",
    idioma: card.idioma ?? card.language ?? defaultFavoriteFields.idioma,
    qualidade: qualityAliases[qualidade] ?? qualidade,
    favorito: true,
  };
}

async function readFavorites() {
  try {
    if (Platform.OS === "web") {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    }

    if (!FileSystem.documentDirectory) return [];

    const file = await FileSystem.getInfoAsync(STORAGE_FILE);
    if (!file.exists) return [];

    const stored = await FileSystem.readAsStringAsync(STORAGE_FILE);
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

    if (FileSystem.documentDirectory) {
      await FileSystem.writeAsStringAsync(STORAGE_FILE, serialized);
    }
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
    setFavorites(
      favorites.map((item) =>
        item.id === id ? normalizeFavorite({ ...item, ...updates }) : item
      )
    );
  },
};
