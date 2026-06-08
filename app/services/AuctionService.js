import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let auctions = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAuction(data) {
  const bids = Array.isArray(data?.bids) ? data.bids : [];
  const comments = Array.isArray(data?.comments) ? data.comments : [];
  const card = data?.card
    ? {
        id: String(data.card.id ?? ""),
        name: data.card.name ?? "",
        images: data.card.images ?? { small: "", large: "" },
        set: data.card.set ?? "",
        collectionNumber: data.card.collectionNumber ?? "",
        rarity: data.card.rarity ?? "",
        idioma: data.card.idioma ?? data.card.language ?? data?.idioma ?? "Portugues",
        qualidade: data.card.qualidade ?? data.card.quality ?? data?.qualidade ?? "NM",
      }
    : null;

  return {
    id: data?.id ?? newId(),
    sessionId: data?.sessionId ?? data?.groupId ?? data?.id ?? newId(),
    mode: data?.mode === "dynamic" ? "dynamic" : "standard",
    activeAuctionId: data?.activeAuctionId ?? null,
    title: String(data?.title ?? "").trim(),
    auctionName: String(data?.auctionName ?? data?.groupTitle ?? data?.title ?? "").trim(),
    card,
    cardName: String(data?.cardName ?? card?.name ?? "").trim(),
    description: String(data?.description ?? "").trim(),
    startPrice: Number(data?.startPrice) || 0,
    idioma: data?.idioma ?? card?.idioma ?? "Portugues",
    qualidade: data?.qualidade ?? card?.qualidade ?? "NM",
    createdAt: data?.createdAt ?? new Date().toISOString(),
    endsAt: data?.endsAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    seller: data?.seller ?? null,
    bids: bids.map((bid) => ({
      id: bid?.id ?? newId(),
      amount: Number(bid?.amount) || 0,
      createdAt: bid?.createdAt ?? new Date().toISOString(),
      bidder: bid?.bidder ?? null,
    })),
    comments: comments.map((comment) => ({
      id: comment?.id ?? newId(),
      text: String(comment?.text ?? "").trim(),
      createdAt: comment?.createdAt ?? new Date().toISOString(),
      user: comment?.user ?? null,
    })).filter((comment) => comment.text),
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
  auctions = reconcileCollection(
    auctions,
    sortAuctions(nextAuctions.map(normalizeAuction))
  ).items;
  await DatabaseService.saveAuctions(auctions);
  notify();
}

async function hydrate() {
  if (hydrated) return auctions;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getAuctions().then((storedAuctions) => {
    auctions = Array.isArray(storedAuctions) ? sortAuctions(storedAuctions.map(normalizeAuction)) : [];
    hydrated = true;
    notify();
    return auctions;
  });

  return hydratePromise;
}

async function refreshAuctions() {
  try {
    const storedAuctions = await DatabaseService.getAuctions();
    const nextAuctions = Array.isArray(storedAuctions) ? sortAuctions(storedAuctions.map(normalizeAuction)) : [];
    const result = reconcileCollection(auctions, nextAuctions);
    hydrated = true;
    if (!result.changed) return;

    auctions = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar leiloes:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("auctions", refreshAuctions);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

function getHighestBid(auction) {
  const bidValues = (auction?.bids ?? []).map((bid) => Number(bid.amount) || 0);
  return Math.max(Number(auction?.startPrice) || 0, ...bidValues);
}

function parseMoney(value) {
  if (typeof value === "number") return value;

  const text = String(value ?? "").trim();
  if (!text) return 0;

  const normalized = text
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function getHighestBidder(auction) {
  const bids = Array.isArray(auction?.bids) ? auction.bids : [];
  if (bids.length === 0) return null;

  return bids.reduce((leader, bid) => {
    const leaderAmount = Number(leader?.amount) || 0;
    const bidAmount = Number(bid?.amount) || 0;

    if (bidAmount > leaderAmount) return bid;
    if (bidAmount === leaderAmount && new Date(bid.createdAt) > new Date(leader.createdAt)) return bid;
    return leader;
  }, bids[0])?.bidder ?? null;
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
    startRealtime();
    listener(sortAuctions(auctions));
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  getHighestBid,
  getHighestBidder,

  isClosed,

  async createAuction({ title, auctionName, sessionId, mode = "standard", activeAuctionId = null, comments = [], cardName, card, description, startPrice, durationHours, idioma, qualidade, seller }) {
    const normalizedCardName = String(cardName ?? card?.name ?? "").trim();
    const normalizedAuctionName = String(auctionName ?? title ?? "").trim();
    const normalizedTitle = String(title ?? normalizedAuctionName ?? normalizedCardName).trim();
    const price = parseMoney(startPrice);
    const hours = Math.max(1, Number(durationHours) || 24);

    if (!seller?.id) throw new Error("Entre na sua conta para criar um leilao.");
    if (!normalizedAuctionName) throw new Error("Informe um nome para o leilao.");
    if (!normalizedCardName) throw new Error("Informe a carta do leilao.");
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Informe um lance inicial valido.");
    }

    const auction = normalizeAuction({
      id: newId(),
      sessionId: sessionId ?? newId(),
      mode,
      activeAuctionId,
      title: normalizedTitle,
      auctionName: normalizedAuctionName,
      cardName: normalizedCardName,
      card: {
        ...card,
        idioma: idioma ?? card?.idioma ?? "Portugues",
        qualidade: qualidade ?? card?.qualidade ?? "NM",
      },
      description,
      startPrice: price,
      idioma: idioma ?? card?.idioma ?? "Portugues",
      qualidade: qualidade ?? card?.qualidade ?? "NM",
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
      comments,
    });

    const auctionWithActive = normalizeAuction({
      ...auction,
      activeAuctionId: activeAuctionId ?? auction.id,
    });

    await persist([auctionWithActive, ...auctions]);
    return auctionWithActive;
  },

  async updateAuction(auctionId, updates, seller) {
    const auction = auctions.find((item) => item.id === auctionId);
    const normalizedTitle = String(updates?.title ?? "").trim();
    const normalizedAuctionName = String(updates?.auctionName ?? auction.auctionName ?? normalizedTitle).trim();
    const normalizedDescription = String(updates?.description ?? "").trim();
    const price = parseMoney(updates?.startPrice);
    const hours = Math.max(1, Number(updates?.durationHours) || 24);

    if (!auction) throw new Error("Leilao nao encontrado.");
    if (!seller?.id) throw new Error("Entre na sua conta para editar o leilao.");
    if (auction.seller?.id !== seller.id) {
      throw new Error("Somente o dono do leilao pode editar este anuncio.");
    }
    if (!normalizedTitle) throw new Error("Informe um titulo para o leilao.");
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Informe um lance inicial valido.");
    }

    const nextAuctions = auctions.map((item) =>
      item.id === auctionId
        ? normalizeAuction({
            ...item,
            title: normalizedTitle,
            auctionName: normalizedAuctionName,
            mode: updates?.mode ?? item.mode,
            description: normalizedDescription,
            startPrice: price,
            idioma: updates?.idioma ?? item.idioma,
            qualidade: updates?.qualidade ?? item.qualidade,
            card: {
              ...item.card,
              idioma: updates?.idioma ?? item.card?.idioma,
              qualidade: updates?.qualidade ?? item.card?.qualidade,
            },
            endsAt: new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(),
          })
        : item
    );

    await persist(nextAuctions);
    return nextAuctions.find((item) => item.id === auctionId);
  },

  async removeAuction(auctionId, seller) {
    const auction = auctions.find((item) => item.id === auctionId);

    if (!auction) throw new Error("Leilao nao encontrado.");
    if (!seller?.id) throw new Error("Entre na sua conta para remover o leilao.");
    if (auction.seller?.id !== seller.id) {
      throw new Error("Somente o dono do leilao pode remover este anuncio.");
    }

    await persist(auctions.filter((item) => item.id !== auctionId));
  },

  async addCardToSession(sessionId, payload) {
    const sessionAuctions = auctions.filter((item) => item.sessionId === sessionId);
    const baseAuction = sessionAuctions[0];

    if (!baseAuction) throw new Error("Leilao nao encontrado.");
    if (baseAuction.seller?.id !== payload?.seller?.id) {
      throw new Error("Somente o dono do leilao pode adicionar cartas.");
    }

    return this.createAuction({
      ...payload,
      auctionName: baseAuction.auctionName,
      sessionId,
      mode: baseAuction.mode,
      activeAuctionId: baseAuction.activeAuctionId,
      comments: baseAuction.comments,
    });
  },

  async setActiveAuction(sessionId, auctionId, seller) {
    const sessionAuctions = auctions.filter((item) => item.sessionId === sessionId);
    const baseAuction = sessionAuctions[0];

    if (!baseAuction) throw new Error("Leilao nao encontrado.");
    if (!seller?.id || baseAuction.seller?.id !== seller.id) {
      throw new Error("Somente o dono do leilao pode trocar a carta ativa.");
    }
    if (!sessionAuctions.some((item) => item.id === auctionId)) {
      throw new Error("Carta nao encontrada neste leilao.");
    }

    await persist(
      auctions.map((item) =>
        item.sessionId === sessionId
          ? normalizeAuction({ ...item, activeAuctionId: auctionId })
          : item
      )
    );
  },

  async addComment(sessionId, user, text) {
    const cleanText = String(text ?? "").trim();
    if (!user?.id) throw new Error("Entre na sua conta para comentar.");
    if (!cleanText) return null;

    const sessionAuctions = auctions.filter((item) => item.sessionId === sessionId);
    if (sessionAuctions.length === 0) throw new Error("Leilao nao encontrado.");

    const comment = {
      id: newId(),
      text: cleanText,
      createdAt: new Date().toISOString(),
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        photo: user.photo,
        themeColor: user.themeColor,
      },
    };

    await persist(
      auctions.map((item) =>
        item.sessionId === sessionId
          ? normalizeAuction({ ...item, comments: [...item.comments, comment] })
          : item
      )
    );

    return comment;
  },

  async placeBid(auctionId, rawAmount, bidder) {
    const amount = parseMoney(rawAmount);
    const storedAuctions = await DatabaseService.getAuctions();
    auctions = Array.isArray(storedAuctions) ? sortAuctions(storedAuctions.map(normalizeAuction)) : [];
    const auction = auctions.find((item) => item.id === auctionId);

    if (!auction) throw new Error("Leilao nao encontrado.");
    if (!bidder?.id) throw new Error("Entre na sua conta para dar lance.");
    if (auction.seller?.id === bidder.id) {
      throw new Error("Voce nao pode dar lance no proprio leilao.");
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
