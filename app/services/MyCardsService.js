import { AuthService } from "./AuthService";
import { DatabaseService } from "./DatabaseService";
import { AnuncioService } from "./AnuncioService";
import { NotificationService } from "./NotificationService";
import { ProfilePostService } from "./ProfilePostService";
import { reconcileCollection } from "../../utils/stableCollection";
import { createQueuedWriter } from "../../utils/queuedWriter";

const listeners = new Set();
let myCards = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;
const cardsWriter = createQueuedWriter(
  (snapshot) => DatabaseService.saveMyCards(snapshot),
  (error) => console.error("Erro ao salvar minhas cartas:", error)
);

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

function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function isSealedProduct(card) {
  return card?.productType === "sealed" || card?.cardType === "produto-selado";
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

function normalizeCard(card) {
  const owner = card.owner ?? card.dono ?? null;
  const ownerId = card.ownerId ?? card.userId ?? owner?.id ?? null;
  const cardId = String(card.cardId ?? card.id ?? "");
  const qualidade = card.qualidade ?? card.quality ?? defaultCardFields.qualidade;
  const aVenda = card.aVenda ?? card.forSale ?? defaultCardFields.aVenda;
  const collectionCardId = ownerId && cardId ? `${ownerId}:${cardId}` : String(card.collectionCardId ?? card.id ?? cardId);
  const listingId = ownerId && cardId ? `${cardId}:${ownerId}` : card.listingId ?? `${cardId}:sem-vendedor`;

  return {
    ...defaultCardFields,
    ...card,
    id: collectionCardId,
    cardId,
    collectionCardId,
    ownerId,
    userId: ownerId,
    listingId,
    aVenda,
    price: card.price ?? "",
    idioma: card.idioma ?? card.language ?? defaultCardFields.idioma,
    qualidade: qualityAliases[qualidade] ?? qualidade,
    owner,
    seller: aVenda ? card.seller ?? card.vendedor ?? owner : null,
    minhaCarta: true,
  };
}

function mergeCardsByKey(primaryCards, fallbackCards) {
  const merged = [];
  const seen = new Set();

  [...primaryCards, ...fallbackCards].filter((card) => !isSealedProduct(card)).forEach((card) => {
    const normalized = normalizeCard(card);
    const key = normalized.collectionCardId || normalized.id;
    if (!key || seen.has(key)) return;

    seen.add(key);
    merged.push(normalized);
  });

  return merged;
}

function notify() {
  listeners.forEach((listener) => listener(myCards));
}

async function readCards() {
  try {
    return DatabaseService.getMyCards();
  } catch (error) {
    console.error("Erro ao carregar minhas cartas:", error);
    return [];
  }
}

async function writeCards() {
  return cardsWriter.write(myCards.filter((card) => !isSealedProduct(card)));
}

async function hydrate() {
  if (hydrated) return myCards;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readCards().then(async (storedCards) => {
    const normalizedStoredCards = storedCards.filter((card) => !isSealedProduct(card)).map(normalizeCard);
    const hadLocalChanges = myCards.length > 0;

    myCards = hadLocalChanges
      ? mergeCardsByKey(myCards, normalizedStoredCards)
      : normalizedStoredCards;
    hydrated = true;
    notify();
    if (hadLocalChanges) writeCards();
    return myCards;
  });

  return hydratePromise;
}

function setCards(nextCards) {
  myCards = reconcileCollection(
    myCards,
    nextCards.filter((card) => !isSealedProduct(card)).map(normalizeCard)
  ).items;
  notify();
  writeCards();
}

async function refreshCards() {
  if (cardsWriter.hasPendingWrites()) return;

  try {
    const storedCards = await readCards();
    const nextCards = storedCards.filter((card) => !isSealedProduct(card)).map(normalizeCard);
    const result = reconcileCollection(myCards, nextCards);
    hydrated = true;
    if (!result.changed) return;

    myCards = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar minhas cartas:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("my_cards", refreshCards);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

async function notifyWantedMatches(listing) {
  if (!listing?.aVenda) return;

  await ProfilePostService.loadPosts();

  const sellerId = listing.seller?.id ?? listing.sellerId ?? null;
  const wantedMatches = AnuncioService.findWantedMatchesForListing(
    ProfilePostService.getPosts(),
    listing
  );

  for (const post of wantedMatches) {
    const targetUserId = post.profileId ?? post.userId;
    if (!targetUserId || targetUserId === sellerId) continue;

    await NotificationService.create({
      userId: targetUserId,
      type: "wanted_match",
      title: "Carta encontrada",
      body: `${listing.name} foi anunciada e combina com sua procura.`,
      actorUserId: sellerId,
      listingId: listing.listingId ?? `${listing.id}:${sellerId ?? "sem-vendedor"}`,
      postId: post.id,
      dedupeKey: `wanted_match:${post.id}:${listing.listingId ?? listing.id}`,
      createdAt: new Date().toISOString(),
    });
  }
}

async function notifySavedListingPriceDrop(previousListing, nextListing) {
  if (!nextListing?.aVenda) return;

  const previousPrice = parsePrice(previousListing?.price);
  const nextPrice = parsePrice(nextListing?.price);
  if (!previousPrice || !nextPrice || nextPrice >= previousPrice) return;

  try {
    const users = await DatabaseService.getUsers();
    const sellerId = nextListing.seller?.id ?? nextListing.sellerId ?? nextListing.ownerId;

    for (const user of users) {
      if (!user?.id || user.id === sellerId) continue;
      if (!Array.isArray(user.savedListingIds) || !user.savedListingIds.includes(nextListing.listingId)) continue;

      await NotificationService.create({
        userId: user.id,
        type: "price_drop",
        title: "Preco baixou",
        body: `${nextListing.name} teve o preco reduzido.`,
        actorUserId: sellerId,
        listingId: nextListing.listingId,
        dedupeKey: `price_drop:${nextListing.listingId}:${nextPrice}`,
        createdAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Erro ao notificar queda de preco:", error);
  }
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
    startRealtime();
    listener(myCards);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  isMyCard(id) {
    const userId = AuthService.getCurrentUser()?.id;
    return myCards.some((item) => item.cardId === String(id) && item.ownerId === userId);
  },

  toggleCard(card) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para adicionar cartas.");
    const cardId = String(card.cardId ?? card.id ?? "");
    const alreadyAdded = myCards.some((item) => item.cardId === cardId && item.ownerId === userId);

    if (alreadyAdded) {
      setCards(myCards.filter((item) => !(item.cardId === cardId && item.ownerId === userId)));
      return;
    }

    setCards([
      normalizeCard({
        ...card,
        owner: getCurrentSellerSnapshot(),
        ownerId: userId,
        userId,
      }),
      ...myCards,
    ]);
  },

  updateCard(id, updates) {
    const userId = AuthService.getCurrentUser()?.id;
    const shouldAttachSeller = updates.aVenda === true;
    const seller = shouldAttachSeller ? getCurrentSellerSnapshot() : updates.seller;
    let updatedListing = null;

    setCards(
      myCards.map((item) => {
        const matchesItem = item.id === id || item.cardId === String(id);
        if (!matchesItem || item.ownerId !== userId) return item;

        const nextItem = normalizeCard({
          ...item,
          ...updates,
          seller: seller ?? item.seller ?? null,
        });

        if (!item.aVenda && nextItem.aVenda) {
          updatedListing = nextItem;
        }

        notifySavedListingPriceDrop(item, nextItem);

        return nextItem;
      })
    );

    if (updatedListing) {
      notifyWantedMatches(updatedListing);
    }
  },

  deleteListing(id) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para excluir anuncios.");

    const listing = myCards.find((item) => (
      (item.id === id || item.cardId === String(id)) && item.ownerId === userId
    ));
    if (!listing) throw new Error("Anuncio nao encontrado.");

    setCards(
      myCards.map((item) =>
        item.id === listing.id
          ? normalizeCard({ ...item, aVenda: false, price: "", seller: null })
          : item
      )
    );
  },

  upsertListing(card, updates = {}) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para inserir produtos.");

    const cardId = String(card?.cardId ?? card?.id ?? "");
    if (!cardId) throw new Error("Selecione uma carta valida.");

    const seller = getCurrentSellerSnapshot();
    const existing = myCards.find((item) => item.cardId === cardId && item.ownerId === userId);
    const listing = normalizeCard({
      ...card,
      ...updates,
      owner: seller,
      ownerId: userId,
      userId,
      seller,
      aVenda: true,
    });

    setCards(
      existing
        ? myCards.map((item) => (item.id === existing.id ? listing : item))
        : [listing, ...myCards]
    );

    if (!existing?.aVenda) {
      notifyWantedMatches(listing);
    }

    return listing;
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
        item.seller?.id === user.id || item.owner?.id === user.id
          ? normalizeCard({ ...item, owner: seller, seller: item.aVenda ? seller : null })
          : item
      )
    );
  },
};
