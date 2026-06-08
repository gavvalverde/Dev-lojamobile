import { DatabaseService } from "./DatabaseService";
import { NotificationService } from "./NotificationService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let reviews = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function newId() {
  return `review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeReview(review) {
  const createdAt = review?.createdAt ?? new Date().toISOString();

  return {
    id: review?.id ?? newId(),
    orderId: review?.orderId ?? null,
    productId: review?.productId ?? null,
    productName: review?.productName ?? "",
    sellerId: review?.sellerId ?? null,
    buyerId: review?.buyerId ?? null,
    buyerName: review?.buyerName ?? "",
    rating: Math.max(1, Math.min(5, Number(review?.rating) || 5)),
    comment: String(review?.comment ?? "").trim(),
    createdAt,
    updatedAt: review?.updatedAt ?? createdAt,
  };
}

function notify() {
  listeners.forEach((listener) => listener(reviews));
}

async function hydrate() {
  if (hydrated) return reviews;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getReviews().then((storedReviews) => {
    reviews = storedReviews.map(normalizeReview);
    hydrated = true;
    notify();
    return reviews;
  });

  return hydratePromise;
}

async function persist(nextReviews) {
  reviews = reconcileCollection(reviews, nextReviews.map(normalizeReview)).items;
  await DatabaseService.saveReviews(reviews);
  notify();
  return reviews;
}

async function refreshReviews() {
  try {
    const storedReviews = await DatabaseService.getReviews();
    const nextReviews = storedReviews.map(normalizeReview);
    const result = reconcileCollection(reviews, nextReviews);
    hydrated = true;
    if (!result.changed) return;

    reviews = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar avaliacoes:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("reviews", refreshReviews);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const ReviewService = {
  async loadReviews() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(reviews);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  getSellerStats(sellerId) {
    const sellerReviews = reviews.filter((review) => review.sellerId === sellerId);
    const average = sellerReviews.length
      ? sellerReviews.reduce((sum, review) => sum + review.rating, 0) / sellerReviews.length
      : 0;

    return {
      count: sellerReviews.length,
      average,
    };
  },

  hasReviewForOrder(orderId) {
    return reviews.some((review) => review.orderId === orderId);
  },

  getProductReviews(productId) {
    return reviews.filter((review) => review.productId === String(productId));
  },

  async createForProduct(product, buyer, comment, order) {
    if (!product?.id) throw new Error("Produto nao encontrado.");
    if (!buyer?.id) throw new Error("Entre na sua conta para avaliar.");
    if (!order?.id || order.buyerId !== buyer.id || order.status !== "completed") {
      throw new Error("Voce so pode avaliar depois de concluir a compra.");
    }

    const cleanComment = String(comment ?? "").trim();
    if (!cleanComment) throw new Error("Escreva uma avaliacao antes de salvar.");

    await hydrate();

    const review = normalizeReview({
      orderId: order.id,
      productId: String(product.id),
      productName: product.name,
      buyerId: buyer.id,
      buyerName: buyer.name,
      rating: 5,
      comment: cleanComment,
    });

    await persist([review, ...reviews]);
    return review;
  },

  async createForOrder(order, buyer, rating, comment) {
    if (!order?.id) throw new Error("Pedido nao encontrado.");
    if (order.status !== "completed") throw new Error("Avalie apenas pedidos concluidos.");
    if (order.buyerId !== buyer?.id) throw new Error("Somente o comprador pode avaliar.");

    await hydrate();

    if (reviews.some((review) => review.orderId === order.id)) {
      throw new Error("Este pedido ja foi avaliado.");
    }

    const review = normalizeReview({
      orderId: order.id,
      sellerId: order.sellerId,
      buyerId: buyer.id,
      buyerName: buyer.name,
      rating,
      comment,
    });

    await persist([review, ...reviews]);
    await NotificationService.create({
      userId: order.sellerId,
      type: "review",
      title: "Nova avaliacao",
      body: `${buyer.name || "Cliente"} avaliou voce com ${review.rating} estrela(s).`,
      actorUserId: buyer.id,
      orderId: order.id,
      dedupeKey: `review:${order.id}`,
      createdAt: review.createdAt,
    });

    return review;
  },
};
