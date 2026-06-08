import { AuthService } from "./AuthService";
import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";
import { createQueuedWriter } from "../../utils/queuedWriter";

const listeners = new Set();
let cardLists = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;
const listsWriter = createQueuedWriter(
  (snapshot) => DatabaseService.saveCardLists(snapshot),
  (error) => console.error("Erro ao salvar listas:", error)
);

function newId() {
  return `list-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeList(list) {
  const createdAt = list?.createdAt ?? new Date().toISOString();
  const ownerId = list?.ownerId ?? list?.userId ?? AuthService.getCurrentUser()?.id ?? null;
  const id = list?.id ?? (ownerId ? `${ownerId}:${newId()}` : newId());
  const deckCards = Array.isArray(list?.deckCards)
    ? list.deckCards
        .map((item) => ({
          cardId: String(item?.cardId ?? item?.id ?? ""),
          quantity: Math.max(1, Math.min(99, Number(item?.quantity) || 1)),
          card: item?.card ?? item?.cardSnapshot ?? null,
        }))
        .filter((item) => item.cardId)
    : [];

  return {
    id,
    listId: list?.listId ?? id,
    ownerId,
    userId: ownerId,
    name: String(list?.name ?? "Lista").trim() || "Lista",
    type: list?.type ?? "list",
    format: list?.format ?? "Padrao",
    cardIds: [...new Set((Array.isArray(list?.cardIds) ? list.cardIds : []).map(String))],
    deckCards,
    createdAt,
    updatedAt: list?.updatedAt ?? createdAt,
  };
}

function notify() {
  const userId = AuthService.getCurrentUser()?.id;
  const visibleLists = userId ? cardLists.filter((list) => list.ownerId === userId) : [];
  listeners.forEach((listener) => listener(visibleLists));
}

async function hydrate() {
  if (hydrated) return cardLists;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getCardLists().then((storedLists) => {
    cardLists = storedLists.map(normalizeList);
    hydrated = true;
    notify();
    return cardLists;
  });

  return hydratePromise;
}

function setLists(nextLists) {
  cardLists = reconcileCollection(cardLists, nextLists.map(normalizeList)).items;
  notify();
  listsWriter.write(cardLists);
}

async function refreshLists() {
  if (listsWriter.hasPendingWrites()) return;

  try {
    const storedLists = await DatabaseService.getCardLists();
    const nextLists = storedLists.map(normalizeList);
    const result = reconcileCollection(cardLists, nextLists);
    hydrated = true;
    if (!result.changed) return;

    cardLists = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar listas:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("card_lists", refreshLists);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const CardListService = {
  async loadLists() {
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

  createList(name) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para criar listas.");

    const now = new Date().toISOString();
    const list = normalizeList({
      id: `${userId}:${newId()}`,
      ownerId: userId,
      name,
      cardIds: [],
      createdAt: now,
      updatedAt: now,
    });

    setLists([list, ...cardLists]);
    return list;
  },

  updateList(listId, updates) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para editar listas.");

    setLists(
      cardLists.map((list) => {
        if (list.id !== listId || list.ownerId !== userId) return list;

        return normalizeList({
          ...list,
          ...updates,
          updatedAt: new Date().toISOString(),
        });
      })
    );
  },

  removeList(listId) {
    const userId = AuthService.getCurrentUser()?.id;
    if (!userId) throw new Error("Entre na sua conta para remover listas.");
    setLists(cardLists.filter((list) => list.id !== listId || list.ownerId !== userId));
  },
};
