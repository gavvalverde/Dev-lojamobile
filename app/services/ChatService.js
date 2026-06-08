import ChatEntity from "../entities/ChatEntity";
import { DatabaseService } from "./DatabaseService";
import { NotificationService } from "./NotificationService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let conversations = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getListingSnapshot(listing) {
  if (!listing?.id) return null;

  return {
    id: listing.id,
    listingId: listing.listingId ?? `${listing.id}:${listing.sellerId ?? "sem-vendedor"}`,
    name: listing.name ?? "",
    images: listing.images ?? null,
    price: listing.price ?? "",
    idioma: listing.idioma ?? "",
    qualidade: listing.qualidade ?? "",
    sellerId: listing.sellerId ?? listing.seller?.id ?? null,
  };
}

function normalizeConversation(conversation) {
  return ChatEntity.transforme(conversation);
}

function notify() {
  listeners.forEach((listener) => listener(conversations));
}

async function readConversations() {
  try {
    const storedConversations = await DatabaseService.getConversations();
    return storedConversations.map(normalizeConversation);
  } catch (error) {
    console.error("Erro ao carregar conversas:", error);
    return [];
  }
}

async function writeConversations() {
  try {
    await DatabaseService.saveConversations(conversations);
  } catch (error) {
    console.error("Erro ao salvar conversas:", error);
  }
}

async function hydrate() {
  if (hydrated) return conversations;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readConversations().then((storedConversations) => {
    conversations = storedConversations;
    hydrated = true;
    notify();
    return conversations;
  });

  return hydratePromise;
}

function setConversations(nextConversations) {
  conversations = reconcileCollection(conversations, nextConversations.map(normalizeConversation)).items;
  notify();
  writeConversations();
}

async function refreshConversations() {
  try {
    const nextConversations = await readConversations();
    const result = reconcileCollection(conversations, nextConversations);
    hydrated = true;
    if (!result.changed) return;

    conversations = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar conversas:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("chats", refreshConversations);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

function sortParticipantIds(firstUserId, secondUserId) {
  return [firstUserId, secondUserId].filter(Boolean).sort();
}

function buildConversationKey(participantIds, listing) {
  return `${participantIds.join(":")}:${listing?.listingId ?? "geral"}`;
}

export const ChatService = {
  async loadConversations() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(conversations);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  getConversationsForUser(userId) {
    return conversations
      .filter((conversation) => conversation.belongsToProfile(userId))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  getConversation(conversationId) {
    return conversations.find((conversation) => conversation.id === conversationId) ?? null;
  },

  startConversation({ currentUser, otherUser, listing = null }) {
    if (!currentUser?.id) throw new Error("Entre na sua conta para conversar.");
    if (!otherUser?.id) throw new Error("Usuario nao encontrado para conversar.");
    if (currentUser.id === otherUser.id) {
      throw new Error("Voce nao pode abrir conversa com voce mesmo.");
    }

    const participantIds = sortParticipantIds(currentUser.id, otherUser.id);
    const listingSnapshot = getListingSnapshot(listing);
    const key = buildConversationKey(participantIds, listingSnapshot);
    const existing = conversations.find((conversation) => {
      const existingKey = buildConversationKey(conversation.participantIds, conversation.listing);
      return existingKey === key;
    });

    if (existing) return existing;

    const nextConversation = ChatEntity.fromProfiles({
      id: newId(),
      currentProfile: currentUser,
      otherProfile: otherUser,
      listing: listingSnapshot,
    });

    setConversations([nextConversation, ...conversations]);
    return nextConversation;
  },

  sendMessage(conversationId, sender, text) {
    const cleanText = String(text ?? "").trim();
    if (!cleanText) return null;
    if (!sender?.id) throw new Error("Entre na sua conta para enviar mensagens.");

    let message = null;

    setConversations(
      conversations.map((conversation) => {
        if (conversation.id !== conversationId) return conversation;
        const updatedConversation = conversation.withMessage(sender, cleanText);
        message = updatedConversation.messages[updatedConversation.messages.length - 1];
        return updatedConversation;
      })
    );

    const conversation = conversations.find((item) => item.id === conversationId);
    const recipients = conversation?.participantIds?.filter((id) => id && id !== sender.id) ?? [];
    const preview = cleanText.length > 90 ? `${cleanText.slice(0, 87)}...` : cleanText;

    recipients.forEach((userId) => {
      void NotificationService.create({
        userId,
        type: "message",
        title: "Nova mensagem",
        body: `${sender.name ?? "Usuario"}: ${preview}`,
        actorUserId: sender.id,
        conversationId,
        dedupeKey: `message:${message?.id}:${userId}`,
        createdAt: message?.createdAt ?? new Date().toISOString(),
      }).catch((error) => console.error("Erro ao notificar mensagem:", error));
    });

    return message;
  },

  async updateParticipantProfile(profile) {
    if (!profile?.id) return;
    await hydrate();

    setConversations(
      conversations.map((conversation) => conversation.withUpdatedProfile(profile))
    );
  },
};
