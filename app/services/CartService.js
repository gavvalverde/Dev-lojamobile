import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "yellowduck:cart";

const listeners = new Set();
let cartItems = [];
let hydrated = false;
let hydratePromise = null;

function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function normalizeCartItem(item) {
  return {
    ...item,
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: parsePrice(item.unitPrice ?? item.price),
  };
}

function notify() {
  listeners.forEach((listener) => listener(cartItems));
}

async function readCart() {
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
    console.error("Erro ao carregar carrinho:", error);
    return [];
  }
}

async function writeCart() {
  try {
    const serialized = JSON.stringify(cartItems);

    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (error) {
    console.error("Erro ao salvar carrinho:", error);
  }
}

async function hydrate() {
  if (hydrated) return cartItems;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readCart().then((storedItems) => {
    cartItems = storedItems.map(normalizeCartItem);
    hydrated = true;
    notify();
    return cartItems;
  });

  return hydratePromise;
}

function setCartItems(nextItems) {
  cartItems = nextItems.map(normalizeCartItem);
  notify();
  writeCart();
}

export const CartService = {
  async loadCart() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(cartItems);
    hydrate();

    return () => {
      listeners.delete(listener);
    };
  },

  addItem(card) {
    const cartItemId = card.listingId ?? card.id;
    const existingItem = cartItems.find((item) => item.id === cartItemId);

    if (existingItem) {
      this.updateQuantity(cartItemId, existingItem.quantity + 1);
      return;
    }

    setCartItems([
      ...cartItems,
      normalizeCartItem({
        id: cartItemId,
        cardId: card.id,
        name: card.name,
        images: card.images,
        price: card.price,
        set: card.set,
        seller: card.seller,
        sellerId: card.sellerId,
        unitPrice: parsePrice(card.price),
        quantity: 1,
      }),
    ]);
  },

  removeItem(id) {
    setCartItems(cartItems.filter((item) => item.id !== id));
  },

  updateQuantity(id, quantity) {
    if (quantity <= 0) {
      this.removeItem(id);
      return;
    }

    setCartItems(
      cartItems.map((item) =>
        item.id === id ? normalizeCartItem({ ...item, quantity }) : item
      )
    );
  },

  clear() {
    setCartItems([]);
  },

  getTotal(items = cartItems) {
    return items.reduce(
      (total, item) => total + parsePrice(item.unitPrice ?? item.price) * item.quantity,
      0
    );
  },
};
