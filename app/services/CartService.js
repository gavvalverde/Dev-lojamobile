import { DatabaseService } from "./DatabaseService";
import { AuthService } from "./AuthService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let cartItems = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function normalizeCartItem(item) {
  const buyerId = item.buyerId ?? item.userId ?? item.buyer?.id ?? null;
  const listingId = String(item.listingId ?? item.id ?? "");
  const cartItemId = buyerId && listingId
    ? `${buyerId}:${listingId}`
    : String(item.cartItemId ?? item.id ?? listingId);

  return {
    ...item,
    id: cartItemId,
    cartItemId,
    listingId,
    buyerId,
    userId: buyerId,
    cardId: String(item.cardId ?? item.card?.id ?? ""),
    quantity: Math.max(1, Number(item.quantity) || 1),
    unitPrice: parsePrice(item.unitPrice ?? item.price),
  };
}

function notify() {
  const userId = AuthService.getCurrentUser()?.id;
  const visibleItems = userId ? cartItems.filter((item) => item.buyerId === userId) : [];
  listeners.forEach((listener) => listener(visibleItems));
}

async function readCart() {
  try {
    return DatabaseService.getCartItems();
  } catch (error) {
    console.error("Erro ao carregar carrinho:", error);
    return [];
  }
}

async function writeCart() {
  try {
    await DatabaseService.saveCartItems(cartItems);
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
  cartItems = reconcileCollection(cartItems, nextItems.map(normalizeCartItem)).items;
  notify();
  writeCart();
}

async function refreshCart() {
  try {
    const storedItems = await readCart();
    const nextItems = storedItems.map(normalizeCartItem);
    const result = reconcileCollection(cartItems, nextItems);
    hydrated = true;
    if (!result.changed) return;

    cartItems = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar carrinho:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("cart_items", refreshCart);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const CartService = {
  async loadCart() {
    return hydrate();
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

  addItem(card, buyer) {
    if (!buyer?.id) {
      throw new Error("Entre na sua conta para adicionar ao carrinho.");
    }

    if (buyer?.id && card.sellerId === buyer.id) {
      throw new Error("Voce nao pode comprar o proprio anuncio.");
    }

    const listingId = String(card.listingId ?? card.id ?? "");
    const cartItemId = `${buyer.id}:${listingId}`;
    const existingItem = cartItems.find((item) => item.id === cartItemId);

    if (existingItem) {
      this.updateQuantity(cartItemId, existingItem.quantity + 1);
      return;
    }

    setCartItems([
      ...cartItems,
      normalizeCartItem({
        id: cartItemId,
        cartItemId,
        listingId,
        buyerId: buyer.id,
        userId: buyer.id,
        cardId: card.cardId ?? card.id,
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
    const userId = AuthService.getCurrentUser()?.id;
    setCartItems(cartItems.filter((item) => item.id !== id || item.buyerId !== userId));
  },

  updateQuantity(id, quantity) {
    if (quantity <= 0) {
      this.removeItem(id);
      return;
    }

    setCartItems(
      cartItems.map((item) =>
        item.id === id && item.buyerId === AuthService.getCurrentUser()?.id
          ? normalizeCartItem({ ...item, quantity })
          : item
      )
    );
  },

  clear() {
    const userId = AuthService.getCurrentUser()?.id;
    setCartItems(cartItems.filter((item) => item.buyerId !== userId));
  },

  getTotal(items = cartItems) {
    return items.reduce(
      (total, item) => total + parsePrice(item.unitPrice ?? item.price) * item.quantity,
      0
    );
  },
};
