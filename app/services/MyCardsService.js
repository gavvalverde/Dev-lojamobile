import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { AuthService } from "./AuthService";

const STORAGE_KEY = "yellowduck:my-cards";
const LEGACY_FAVORITES_KEY = "yellowduck:favorites";

const listeners = new Set();
let myCards = [];
let hydrated = false;
let hydratePromise = null;

function normalizeQuantity(value) {
  return Math.max(1, Number(value) || 1);
}

const defaultCardFields = {
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

function normalizeCard(card) {
  const qualidade = card.qualidade ?? card.quality ?? defaultCardFields.qualidade;
  const aVenda = card.aVenda ?? card.forSale ?? defaultCardFields.aVenda;

  return {
    ...defaultCardFields,
    ...card,
    aVenda,
    price: card.price ?? "",
    idioma: card.idioma ?? card.language ?? defaultCardFields.idioma,
    qualidade: qualityAliases[qualidade] ?? qualidade,
    seller: card.seller ?? card.vendedor ?? (aVenda ? getCurrentSellerSnapshot() : null),
    minhaCarta: true,
    quantity: normalizeQuantity(card.quantity),
  };
}

function notify() {
  listeners.forEach((listener) => listener(myCards));
}

async function readCards() {
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
    console.error("Erro ao carregar minhas cartas:", error);
    return [];
  }
}

async function readLegacySaleCards() {
  try {
    if (Platform.OS === "web") {
      const stored = globalThis.localStorage?.getItem(LEGACY_FAVORITES_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed.filter((item) => item.aVenda) : [];
    }

    const stored = await AsyncStorage.getItem(LEGACY_FAVORITES_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item.aVenda) : [];
  } catch (error) {
    console.error("Erro ao migrar cartas antigas:", error);
    return [];
  }
}

async function writeCards() {
  try {
    const serialized = JSON.stringify(myCards);

    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Erro ao salvar minhas cartas:", error);
  }
}

async function hydrate() {
  if (hydrated) return myCards;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readCards().then(async (storedCards) => {
    const legacySaleCards = storedCards.length === 0 ? await readLegacySaleCards() : [];
    myCards = (storedCards.length > 0 ? storedCards : legacySaleCards).map(normalizeCard);
    hydrated = true;
    notify();
    if (storedCards.length === 0 && legacySaleCards.length > 0) writeCards();
    return myCards;
  });

  return hydratePromise;
}

function setCards(nextCards) {
  myCards = nextCards.map(normalizeCard);
  notify();
  writeCards();
}

export const MyCardsService = {
  async loadCards() {
    return hydrate();
  },

  getCards() {
    return myCards;
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(myCards);
    hydrate();

    return () => {
      listeners.delete(listener);
    };
  },

  isMyCard(id) {
    return myCards.some((item) => item.id === id);
  },

  getQuantity(id) {
    return myCards.find((item) => item.id === id)?.quantity ?? 0;
  },

  addCopies(card, quantity = 1) {
    const amount = normalizeQuantity(quantity);
    const existingItem = myCards.find((item) => item.id === card.id);

    if (existingItem) {
      setCards(
        myCards.map((item) =>
          item.id === card.id
            ? normalizeCard({ ...item, quantity: item.quantity + amount })
            : item
        )
      );
      return;
    }

    setCards([normalizeCard({ ...card, quantity: amount }), ...myCards]);
  },

  toggleCard(card) {
    const alreadyAdded = myCards.some((item) => item.id === card.id);

    if (alreadyAdded) {
      setCards(myCards.filter((item) => item.id !== card.id));
      return;
    }

    setCards([normalizeCard(card), ...myCards]);
  },

  updateCard(id, updates) {
    const shouldAttachSeller = updates.aVenda === true;
    const seller = shouldAttachSeller ? getCurrentSellerSnapshot() : updates.seller;

    setCards(
      myCards.map((item) =>
        item.id === id
          ? normalizeCard({
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

    setCards(
      myCards.map((item) =>
        item.seller?.id === user.id ? normalizeCard({ ...item, seller }) : item
      )
    );
  },
};
