import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let highlights = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;
let delayedHydrateTimeout = null;

function newId() {
  return `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeHighlight(highlight) {
  const createdAt = highlight?.createdAt ?? new Date().toISOString();

  return {
    id: highlight?.id ?? newId(),
    type: highlight?.type === "product" ? "product" : "image",
    title: String(highlight?.title ?? "").trim(),
    subtitle: String(highlight?.subtitle ?? "").trim(),
    image: highlight?.image ?? null,
    productId: highlight?.productId ?? null,
    active: highlight?.active !== false,
    createdAt,
    updatedAt: highlight?.updatedAt ?? createdAt,
  };
}

function notify() {
  listeners.forEach((listener) => listener(highlights));
}

async function hydrate() {
  if (hydrated) return highlights;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getCarouselHighlights().then((storedHighlights) => {
    highlights = storedHighlights.map(normalizeHighlight);
    hydrated = true;
    notify();
    return highlights;
  });

  return hydratePromise;
}

async function persist(nextHighlights) {
  highlights = reconcileCollection(highlights, nextHighlights.map(normalizeHighlight)).items;
  await DatabaseService.saveCarouselHighlights(highlights);
  notify();
  return highlights;
}

async function refreshHighlights() {
  try {
    const storedHighlights = await DatabaseService.getCarouselHighlights();
    const nextHighlights = storedHighlights.map(normalizeHighlight);
    const result = reconcileCollection(highlights, nextHighlights);
    hydrated = true;
    if (!result.changed) return;

    highlights = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar destaques:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("carousel_highlights", refreshHighlights);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

function scheduleHydrate() {
  if (hydrated || hydratePromise || delayedHydrateTimeout) return;

  delayedHydrateTimeout = setTimeout(() => {
    delayedHydrateTimeout = null;
    hydrate();
  }, 350);
}

export const CarouselHighlightService = {
  async loadHighlights() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(highlights);
    scheduleHydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
      if (listeners.size === 0 && delayedHydrateTimeout) {
        clearTimeout(delayedHydrateTimeout);
        delayedHydrateTimeout = null;
      }
    };
  },

  async createImageHighlight({ title, subtitle, image }) {
    if (!image) throw new Error("Adicione uma imagem para o destaque.");

    await hydrate();

    const highlight = normalizeHighlight({
      type: "image",
      title,
      subtitle,
      image,
    });

    await persist([highlight, ...highlights]);
    return highlight;
  },

  async createProductHighlight(product) {
    const productId = String(product?.card?.id ?? product?.cardId ?? product?.id ?? "");
    if (!productId) throw new Error("Selecione um produto valido.");

    await hydrate();

    if (highlights.some((highlight) => highlight.type === "product" && String(highlight.productId) === productId)) {
      throw new Error("Este produto ja esta no carrossel.");
    }

    const highlight = normalizeHighlight({
      type: "product",
      title: product?.card?.name ?? product?.name ?? "",
      productId,
    });

    await persist([highlight, ...highlights]);
    return highlight;
  },

  async updateHighlight(id, updates) {
    await hydrate();

    const updatedAt = new Date().toISOString();
    await persist(
      highlights.map((highlight) =>
        highlight.id === id ? normalizeHighlight({ ...highlight, ...updates, updatedAt }) : highlight
      )
    );
  },

  async removeHighlight(id) {
    await hydrate();
    await persist(highlights.filter((highlight) => highlight.id !== id));
  },
};
