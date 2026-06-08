import { DatabaseService } from "./DatabaseService";
import { PushNotificationService } from "./PushNotificationService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let notifications = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeNotification(notification) {
  return {
    id: notification?.id ?? newId(),
    userId: notification?.userId ?? notification?.profileId ?? null,
    type: notification?.type ?? "info",
    title: notification?.title ?? "",
    body: notification?.body ?? "",
    actorUserId: notification?.actorUserId ?? null,
    conversationId: notification?.conversationId ?? null,
    listingId: notification?.listingId ?? null,
    orderId: notification?.orderId ?? null,
    orderRole: notification?.orderRole ?? null,
    postId: notification?.postId ?? null,
    readAt: notification?.readAt ?? null,
    dedupeKey: notification?.dedupeKey ?? null,
    createdAt: notification?.createdAt ?? new Date().toISOString(),
  };
}

function sortNotifications(items) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function notify() {
  const sorted = sortNotifications(notifications);
  listeners.forEach((listener) => listener(sorted));
}

async function hydrate() {
  if (hydrated) return notifications;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getNotifications().then((storedNotifications) => {
    notifications = sortNotifications(storedNotifications.map(normalizeNotification));
    hydrated = true;
    notify();
    return notifications;
  });

  return hydratePromise;
}

async function persist(nextNotifications) {
  notifications = reconcileCollection(
    notifications,
    sortNotifications(nextNotifications.map(normalizeNotification))
  ).items;
  await DatabaseService.saveNotifications(notifications);
  notify();
}

async function refreshNotifications() {
  try {
    const storedNotifications = await DatabaseService.getNotifications();
    const nextNotifications = sortNotifications(storedNotifications.map(normalizeNotification));
    const result = reconcileCollection(notifications, nextNotifications);
    hydrated = true;
    if (!result.changed) return;

    notifications = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar notificacoes:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("notifications", refreshNotifications);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const NotificationService = {
  async load() {
    return hydrate();
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(sortNotifications(notifications));
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  getForUser(userId) {
    return sortNotifications(notifications).filter((notification) => notification.userId === userId);
  },

  async create(notification) {
    if (!notification?.userId) return null;
    await hydrate();

    const nextNotification = normalizeNotification(notification);
    const duplicate = nextNotification.dedupeKey
      ? notifications.some((item) => item.dedupeKey === nextNotification.dedupeKey)
      : false;

    if (duplicate) return null;

    await persist([nextNotification, ...notifications]);
    void PushNotificationService.sendToUser(nextNotification.userId, nextNotification);
    return nextNotification;
  },

  async markAllRead(userId) {
    if (!userId) return;
    await hydrate();

    const now = new Date().toISOString();
    await persist(
      notifications.map((notification) =>
        notification.userId === userId && !notification.readAt
          ? { ...notification, readAt: now }
          : notification
      )
    );
  },
};
