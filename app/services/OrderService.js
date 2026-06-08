import { DatabaseService } from "./DatabaseService";
import { NotificationService } from "./NotificationService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let orders = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

const statusLabels = {
  pending: "Pendente",
  accepted: "Aceito",
  paid: "Pago",
  shipped: "Enviado",
  completed: "Concluido",
  canceled: "Cancelado",
};

function newId() {
  return `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function normalizeUser(user) {
  if (!user) return null;

  return {
    id: user.id ?? null,
    name: user.name ?? "",
    handle: user.handle ?? "",
    photo: user.photo ?? null,
    themeColor: user.themeColor ?? "#ffc94a",
  };
}

function normalizeItem(item) {
  const quantity = Math.max(1, Number(item.quantity) || 1);
  const unitPrice = parsePrice(item.unitPrice ?? item.price);

  return {
    id: item.id ?? item.cartItemId ?? item.listingId,
    listingId: item.listingId ?? item.id ?? null,
    cardId: item.cardId ?? null,
    name: item.name ?? "",
    images: item.images ?? { small: "", large: "" },
    set: item.set ?? "",
    price: item.price ?? unitPrice,
    unitPrice,
    quantity,
    subtotal: unitPrice * quantity,
  };
}

function normalizeOrder(order) {
  const items = Array.isArray(order?.items) ? order.items.map(normalizeItem) : [];
  const total = Number(order?.total) || items.reduce((sum, item) => sum + item.subtotal, 0);
  const createdAt = order?.createdAt ?? new Date().toISOString();

  return {
    id: order?.id ?? newId(),
    orderId: order?.orderId ?? order?.id ?? newId(),
    buyerId: order?.buyerId ?? order?.buyer?.id ?? null,
    buyer: normalizeUser(order?.buyer),
    sellerId: order?.sellerId ?? order?.seller?.id ?? null,
    seller: normalizeUser(order?.seller),
    items,
    total,
    status: order?.status ?? "pending",
    notes: order?.notes ?? "",
    fulfillment: {
      method: order?.fulfillment?.method ?? order?.deliveryMethod ?? "combine",
      address: order?.fulfillment?.address ?? order?.address ?? "",
      notes: order?.fulfillment?.notes ?? order?.notes ?? "",
    },
    createdAt,
    updatedAt: order?.updatedAt ?? createdAt,
  };
}

function visibleForUser(order, userId) {
  return order.buyerId === userId || order.sellerId === userId;
}

function notify() {
  listeners.forEach((listener) => listener(orders));
}

async function readOrders() {
  try {
    return DatabaseService.getOrders();
  } catch (error) {
    console.error("Erro ao carregar pedidos:", error);
    return [];
  }
}

async function writeOrders() {
  await DatabaseService.saveOrders(orders);
}

async function hydrate() {
  if (hydrated) return orders;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readOrders().then((storedOrders) => {
    orders = storedOrders.map(normalizeOrder);
    hydrated = true;
    notify();
    return orders;
  });

  return hydratePromise;
}

async function persist(nextOrders) {
  orders = reconcileCollection(orders, nextOrders.map(normalizeOrder)).items;
  await writeOrders();
  notify();
  return orders;
}

async function refreshOrders() {
  try {
    const storedOrders = await readOrders();
    const nextOrders = storedOrders.map(normalizeOrder);
    const result = reconcileCollection(orders, nextOrders);
    hydrated = true;
    if (!result.changed) return;

    orders = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar pedidos:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("orders", refreshOrders);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

function groupItemsBySeller(items) {
  const groups = new Map();

  items.forEach((item) => {
    const sellerId = item.sellerId ?? item.seller?.id;
    if (!sellerId) return;

    if (!groups.has(sellerId)) {
      groups.set(sellerId, {
        sellerId,
        seller: normalizeUser(item.seller),
        items: [],
      });
    }

    groups.get(sellerId).items.push(item);
  });

  return Array.from(groups.values());
}

export const OrderService = {
  statusLabels,

  async loadOrders() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(orders);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  getForUser(userId) {
    return orders.filter((order) => visibleForUser(order, userId));
  },

  async createFromCart(items, buyer, fulfillment = {}) {
    if (!buyer?.id) throw new Error("Entre na sua conta para finalizar o pedido.");
    if (!Array.isArray(items) || items.length === 0) throw new Error("Seu carrinho esta vazio.");

    await hydrate();

    const groups = groupItemsBySeller(items);
    if (groups.length === 0) throw new Error("Nenhum vendedor encontrado para os itens.");

    const buyerSnapshot = normalizeUser(buyer);
    const createdAt = new Date().toISOString();
    const createdOrders = groups.map((group) => {
      const orderItems = group.items.map(normalizeItem);
      const total = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
      const id = newId();

      return normalizeOrder({
        id,
        orderId: id,
        buyerId: buyer.id,
        buyer: buyerSnapshot,
        sellerId: group.sellerId,
        seller: group.seller,
        items: orderItems,
        total,
        status: "pending",
        fulfillment,
        notes: fulfillment.notes ?? "",
        createdAt,
        updatedAt: createdAt,
      });
    });

    await persist([...createdOrders, ...orders]);

    for (const order of createdOrders) {
      await NotificationService.create({
        userId: order.sellerId,
        type: "order",
        title: "Novo pedido",
        body: `${buyerSnapshot.name || "Cliente"} fez um pedido de ${order.items.length} item(ns).`,
        actorUserId: buyer.id,
        orderId: order.id,
        orderRole: "seller",
        dedupeKey: `order:new:${order.id}`,
        createdAt,
      });
    }

    return createdOrders;
  },

  async updateStatus(orderId, status, actor) {
    await hydrate();

    const order = orders.find((item) => item.id === orderId || item.orderId === orderId);
    const actorId = typeof actor === "string" ? actor : actor?.id;
    const managesStoreOrder = order?.sellerId === "yellow-duck-store" && actor?.isAdmin;
    if (!order) throw new Error("Pedido nao encontrado.");
    if (actorId !== order.sellerId && actorId !== order.buyerId && !managesStoreOrder) {
      throw new Error("Voce nao pode alterar este pedido.");
    }
    if (status === "canceled" && actorId !== order.sellerId && actorId !== order.buyerId && !managesStoreOrder) {
      throw new Error("Voce nao pode cancelar este pedido.");
    }
    if (status !== "canceled" && actorId !== order.sellerId && !managesStoreOrder) {
      throw new Error("Somente o vendedor pode avancar o status.");
    }

    const updatedAt = new Date().toISOString();
    const nextOrder = normalizeOrder({ ...order, status, updatedAt });

    await persist(orders.map((item) => (item.id === order.id ? nextOrder : item)));

    const targetUserId = actorId === order.sellerId || managesStoreOrder ? order.buyerId : order.sellerId;
    const actorName = actorId === order.sellerId || managesStoreOrder
      ? order.seller?.name || "Loja"
      : order.buyer?.name || "Cliente";
    await NotificationService.create({
      userId: targetUserId,
      type: "order",
      title: "Pedido atualizado",
      body: `${actorName} marcou o pedido como ${statusLabels[status] ?? status}.`,
      actorUserId: actorId,
      orderId: order.id,
      orderRole: targetUserId === order.buyerId ? "buyer" : "seller",
      dedupeKey: `order:status:${order.id}:${status}:${updatedAt}`,
      createdAt: updatedAt,
    });

    return nextOrder;
  },
};
