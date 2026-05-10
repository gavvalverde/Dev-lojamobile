import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const STORAGE_KEY = "yellowduck:lists";

const listeners = new Set();
let lists = [];
let hydrated = false;
let hydratePromise = null;

function notify() {
  listeners.forEach((cb) => cb(lists.slice()));
}

async function readLists() {
  try {
    if (Platform.OS === "web") {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    }

    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Erro ao ler listas:", e);
    return [];
  }
}

async function writeLists() {
  try {
    const serialized = JSON.stringify(lists);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(STORAGE_KEY, serialized);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, serialized);
  } catch (e) {
    console.error("Erro ao salvar listas:", e);
  }
}

async function hydrate() {
  if (hydrated) return lists;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readLists().then((stored) => {
    lists = Array.isArray(stored) ? stored : [];
    hydrated = true;
    notify();
    return lists;
  });

  return hydratePromise;
}

function setLists(next) {
  lists = next.slice();
  notify();
  writeLists();
}

export const ListsService = {
  subscribe(cb) {
    listeners.add(cb);
    cb(lists.slice());
    hydrate();
    return () => listeners.delete(cb);
  },

  getAll() {
    return lists.slice();
  },

  getById(id) {
    return lists.find((l) => String(l.id) === String(id)) || null;
  },

  createList(name) {
    const id = String(Date.now());
    const list = { id, name: name || `Lista ${lists.length + 1}`, cards: [] };
    setLists([list, ...lists]);
    return list;
  },

  deleteList(id) {
    setLists(lists.filter((l) => String(l.id) !== String(id)));
  },

  addCardToList(listId, card) {
    setLists(
      lists.map((l) =>
        String(l.id) === String(listId)
          ? { ...l, cards: Array.isArray(l.cards) ? [card, ...l.cards.filter((c) => c.id !== card.id)] : [card] }
          : l
      )
    );
  },

  removeCardFromList(listId, cardId) {
    setLists(
      lists.map((l) =>
        String(l.id) === String(listId) ? { ...l, cards: (l.cards || []).filter((c) => String(c.id) !== String(cardId)) } : l
      )
    );
  },
};

export default ListsService;
