import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const AUCTIONS_KEY = "yellowduck:auctions";
const listeners = new Set();
let auctions = [];
let hydrated = false;
let hydratePromise = null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getItem(key) {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }

  return AsyncStorage.getItem(key);
}

async function setItem(key, value) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }

  await AsyncStorage.setItem(key, value);
}

function normalizeAuction(data) {
  const bids = Array.isArray(data?.bids) ? data.bids : [];
  const card = data?.card
    ? {
        id: String(data.card.id ?? ""),
        name: data.card.name ?? "",
        images: data.card.images ?? { small: "", large: "" },
        set: data.card.set ?? "",
        collectionNumber: data.card.collectionNumber ?? "",
        rarity: data.card.rarity ?? "",
      }
    : null;

  return {
    id: data?.id ?? newId(),
    title: String(data?.title ?? "").trim(),
    card,
    cardName: String(data?.cardName ?? card?.name ?? "").trim(),
    description: String(data?.description ?? "").trim(),
    startPrice: Number(data?.startPrice) || 0,
    createdAt: data?.createdAt ?? new Date().toISOString(),
    endsAt: data?.endsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seller: data?.seller ?? null,
    bids: bids.map((bid) => ({
      id: bid?.id ?? newId(),
      amount: Number(bid?.amount) || 0,
      createdAt: bid?.createdAt ?? new Date().toISOString(),
      bidder: bid?.bidder ?? null,
    })),
  };
}

function sortAuctions(items) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function notify() {
  const sorted = sortAuctions(auctions);
  listeners.forEach((listener) => listener(sorted));
}

async function persist(nextAuctions) {
  auctions = sortAuctions(nextAuctions.map(normalizeAuction));
  await setItem(AUCTIONS_KEY, JSON.stringify(auctions));
  notify();
}

async function hydrate() {
  if (hydrated) return auctions;
  if (hydratePromise) return hydratePromise;

  hydratePromise = getItem(AUCTIONS_KEY).then((stored) => {
    const parsed = stored ? JSON.parse(stored) : [];
    auctions = Array.isArray(parsed) ? sortAuctions(parsed.map(normalizeAuction)) : [];
    hydrated = true;
    notify();
    return auctions;
  });

  return hydratePromise;
}

function getHighestBid(auction) {
  const bidValues = (auction?.bids ?? []).map((bid) => Number(bid.amount) || 0);
  return Math.max(Number(auction?.startPrice) || 0, ...bidValues);
}

function isClosed(auction) {
  return new Date(auction?.endsAt).getTime() <= Date.now();
}

export const AuctionService = {
  async load() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(sortAuctions(auctions));
    hydrate();

    return () => {
      listeners.delete(listener);
    };
  },

  getHighestBid,

  isClosed,

  async createAuction({ title, cardName, card, description, startPrice, durationHours, seller }) {
    const normalizedCardName = String(cardName ?? card?.name ?? "").trim();
    const normalizedTitle = String(title ?? normalizedCardName).trim();
    const price = Number(String(startPrice ?? "").replace(",", "."));
    const hours = Math.max(1, Number(durationHours) || 24);

    if (!seller?.id) throw new Error("Entre na sua conta para criar um leilao.");
    if (!normalizedTitle) throw new Error("Informe um titulo para o leilao.");
    if (!normalizedCardName) throw new Error("Informe a carta do leilao.");
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Informe um lance inicial valido.");
    }

    const auction = normalizeAuction({
      id: newId(),
      title: normalizedTitle,
      cardName: normalizedCardName,
      card,
      description,
      startPrice: price,
      createdAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
      seller: {
        id: seller.id,
        name: seller.name,
        handle: seller.handle,
        photo: seller.photo,
        themeColor: seller.themeColor,
      },
      bids: [],
    });

    await persist([auction, ...auctions]);
    return auction;
  },

  async placeBid(auctionId, rawAmount, bidder) {
    const amount = Number(String(rawAmount ?? "").replace(",", "."));
    const auction = auctions.find((item) => item.id === auctionId);

    if (!auction) throw new Error("Leilao não encontrado.");
    if (!bidder?.id) throw new Error("Entre na sua conta para dar lance.");
    if (auction.seller?.id === bidder.id) {
      throw new Error("Voce não pode dar lance no proprio leilao.");
    }
    if (isClosed(auction)) throw new Error("Este leilao ja foi encerrado.");

    const currentValue = getHighestBid(auction);
    if (!Number.isFinite(amount) || amount <= currentValue) {
      throw new Error(`O lance precisa ser maior que R$ ${currentValue.toFixed(2)}.`);
    }

    const bid = {
      id: newId(),
      amount,
      createdAt: new Date().toISOString(),
      bidder: {
        id: bidder.id,
        name: bidder.name,
        handle: bidder.handle,
        photo: bidder.photo,
        themeColor: bidder.themeColor,
      },
    };

    const nextAuctions = auctions.map((item) =>
      item.id === auctionId ? normalizeAuction({ ...item, bids: [...item.bids, bid] }) : item
    );

    await persist(nextAuctions);
    return bid;
  },
};
