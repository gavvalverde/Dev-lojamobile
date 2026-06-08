import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { DatabaseService } from "./DatabaseService";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getProjectId() {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId ||
    Constants.manifest2?.extra?.eas?.projectId
  );
}

async function saveTokenForUser(userId, token) {
  const users = await DatabaseService.getUsers();
  const nextUsers = users.map((user) => {
    if (user.id !== userId) return user;

    const pushTokens = Array.isArray(user.pushTokens) ? user.pushTokens : [];
    if (pushTokens.includes(token)) return user;

    return { ...user, pushTokens: [...pushTokens, token] };
  });

  await DatabaseService.saveUsers(nextUsers);

  const session = await DatabaseService.getSession();
  if (session?.id === userId) {
    const updatedUser = nextUsers.find((user) => user.id === userId);
    if (updatedUser) await DatabaseService.saveSession(session);
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#039be5",
  });
}

function isExpoPushToken(token) {
  return typeof token === "string" && /^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/.test(token);
}

export const PushNotificationService = {
  async registerForUser(userId) {
    if (!userId || Platform.OS === "web" || !Device.isDevice) return null;

    await ensureAndroidChannel();

    const currentPermissions = await Notifications.getPermissionsAsync();
    let finalStatus = currentPermissions.status;

    if (finalStatus !== "granted") {
      const requestedPermissions = await Notifications.requestPermissionsAsync();
      finalStatus = requestedPermissions.status;
    }

    if (finalStatus !== "granted") return null;

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;

    await saveTokenForUser(userId, token);
    return token;
  },

  async sendToUser(userId, notification) {
    if (!userId) return;

    const users = await DatabaseService.getUsers();
    const targetUser = users.find((user) => user.id === userId);
    const pushTokens = Array.isArray(targetUser?.pushTokens) ? targetUser.pushTokens : [];
    const expoTokens = pushTokens.filter((token) => isExpoPushToken(token));

    if (expoTokens.length === 0) return;

    const messages = expoTokens.map((token) => ({
      to: token,
      sound: "default",
      title: notification.title || "Yellow Duck TCG",
      body: notification.body || "",
      data: {
        notificationId: notification.id,
        type: notification.type,
        conversationId: notification.conversationId,
        listingId: notification.listingId,
        orderId: notification.orderId,
        orderRole: notification.orderRole,
        postId: notification.postId,
      },
    }));

    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
    } catch (error) {
      console.error("Erro ao enviar push notification:", error);
    }
  },

  subscribeToResponses(listener) {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      listener(response.notification.request.content.data ?? {});
    });

    return () => subscription.remove();
  },
};
