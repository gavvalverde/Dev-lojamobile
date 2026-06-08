import UserEntity from "../entities/UserEntity";
import { DatabaseService } from "./DatabaseService";
import { NotificationService } from "./NotificationService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let realtimeUnsubscribe = null;
let usersCache = [];
const DAILY_LOGIN_BASE_XP = 25;
const DAILY_LOGIN_STREAK_XP = 5;
const DAILY_LOGIN_MAX_STREAK_BONUS = 35;
const LEVEL_BASE_XP = 100;
const LEVEL_GROWTH_XP = 45;

async function readUsers() {
  const storedUsers = await DatabaseService.getUsers();
  return storedUsers.map(UserEntity.transforme);
}

async function writeUsers(users) {
  await DatabaseService.saveUsers(users);
}

async function getSession() {
  return DatabaseService.getSession();
}

function sanitizeUser(user) {
  return user.toSession();
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayDateKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return getLocalDateKey(date);
}

function getLevelInfo(experience = 0) {
  const xp = Math.max(0, Number(experience) || 0);
  let level = 1;
  let spent = 0;
  let nextLevelXp = LEVEL_BASE_XP;

  while (xp >= spent + nextLevelXp) {
    spent += nextLevelXp;
    level += 1;
    nextLevelXp = LEVEL_BASE_XP + (level - 1) * LEVEL_GROWTH_XP;
  }

  const currentLevelXp = xp - spent;
  const progress = nextLevelXp > 0 ? currentLevelXp / nextLevelXp : 1;

  return {
    level,
    experience: xp,
    currentLevelXp,
    nextLevelXp,
    progress: Math.min(1, Math.max(0, progress)),
  };
}

function notify(users) {
  const visibleUsers = users.map(sanitizeUser);
  listeners.forEach((listener) => listener(visibleUsers));
}

async function refreshUsers() {
  try {
    const users = await readUsers();
    const result = reconcileCollection(usersCache, users);
    if (!result.changed) return;

    usersCache = result.items;
    notify(usersCache);
  } catch (error) {
    console.error("Erro ao sincronizar usuarios:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("users", refreshUsers);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

function buildUpdatedUser(user, updates) {
  return new UserEntity(
    user.id,
    updates.name ?? user.name,
    updates.email ?? user.email,
    user.password,
    updates.photo ?? user.photo,
    updates.phone ?? user.phone,
    updates.bio ?? user.bio,
    updates.coverPhoto ?? user.coverPhoto,
    updates.status ?? user.status,
    updates.handle ?? user.handle,
    updates.location ?? user.location,
    updates.favoritePokemon ?? user.favoritePokemon,
    updates.profileTitle ?? user.profileTitle,
    updates.collectionFocus ?? user.collectionFocus,
    updates.tradePreferences ?? user.tradePreferences,
    updates.pronouns ?? user.pronouns,
    updates.themeColor ?? user.themeColor,
    updates.profileColors ?? user.profileColors,
    Array.isArray(updates.badges) ? updates.badges : user.badges,
    Array.isArray(updates.profilePanelOrder) ? updates.profilePanelOrder : user.profilePanelOrder,
    Array.isArray(updates.hiddenProfilePanels) ? updates.hiddenProfilePanels : user.hiddenProfilePanels,
    Array.isArray(updates.showcaseCardIds) ? updates.showcaseCardIds : user.showcaseCardIds,
    Array.isArray(updates.followingIds) ? updates.followingIds : user.followingIds,
    Array.isArray(updates.savedPostIds) ? updates.savedPostIds : user.savedPostIds,
    Array.isArray(updates.savedListingIds) ? updates.savedListingIds : user.savedListingIds,
    updates.isAdmin === undefined ? user.isAdmin : updates.isAdmin,
    Array.isArray(updates.pushTokens) ? updates.pushTokens : user.pushTokens,
    updates.experience ?? user.experience,
    updates.lastDailyLoginDate ?? user.lastDailyLoginDate,
    updates.dailyLoginStreak ?? user.dailyLoginStreak,
    updates.bestDailyLoginStreak ?? user.bestDailyLoginStreak
  );
}

async function persistUserUpdate(users, userIndex, updatedUser) {
  users[userIndex] = updatedUser;
  await writeUsers(users);

  const session = await getSession();
  if (session?.id === updatedUser.id) {
    await DatabaseService.saveSession(updatedUser.toSession());
  }

  usersCache = reconcileCollection(usersCache, users).items;
  notify(usersCache);
  return sanitizeUser(updatedUser);
}

async function updateUserById(userId, updater) {
  const users = await readUsers();
  const userIndex = users.findIndex((u) => u.id === userId);

  if (userIndex === -1) {
    throw new Error("Usuario nao encontrado.");
  }

  const updatedUser = updater(users[userIndex]);
  return persistUserUpdate(users, userIndex, updatedUser);
}

function toggleValue(list, value) {
  const safeList = Array.isArray(list) ? list : [];
  return safeList.includes(value)
    ? safeList.filter((item) => item !== value)
    : [...safeList, value];
}

export const UserService = {
  async listUsers() {
    const users = await readUsers();
    return users.map(sanitizeUser);
  },

  getLevelInfo,

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    readUsers().then((users) => {
      usersCache = reconcileCollection(usersCache, users).items;
      notify(usersCache);
    });

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  async updateProfile(userId, updates) {
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error("Usuário não encontrado.");
    }

    const user = users[userIndex];
    const updatedUser = buildUpdatedUser(user, updates);
    await persistUserUpdate(users, userIndex, updatedUser);
    return updatedUser.toSession();
  },

  async claimDailyLogin(userId) {
    if (!userId) return { user: null, reward: null };

    const today = getLocalDateKey();
    const yesterday = getYesterdayDateKey();
    let reward = null;

    const user = await updateUserById(userId, (user) => {
      if (user.lastDailyLoginDate === today) return user;

      const streak = user.lastDailyLoginDate === yesterday ? user.dailyLoginStreak + 1 : 1;
      const streakBonus = Math.min(streak * DAILY_LOGIN_STREAK_XP, DAILY_LOGIN_MAX_STREAK_BONUS);
      const rewardXp = DAILY_LOGIN_BASE_XP + streakBonus;
      reward = {
        experience: rewardXp,
        streak,
      };

      return buildUpdatedUser(user, {
        experience: user.experience + rewardXp,
        lastDailyLoginDate: today,
        dailyLoginStreak: streak,
        bestDailyLoginStreak: Math.max(user.bestDailyLoginStreak, streak),
      });
    });

    return { user, reward };
  },

  async awardExperience(userId, amount) {
    const experience = Math.max(0, Number(amount) || 0);
    if (!userId || experience <= 0) return null;

    return updateUserById(userId, (user) =>
      buildUpdatedUser(user, { experience: user.experience + experience })
    );
  },

  async addPushToken(userId, token) {
    if (!userId || !token) return null;

    return updateUserById(userId, (user) => {
      const pushTokens = Array.isArray(user.pushTokens) ? user.pushTokens : [];
      if (pushTokens.includes(token)) return user;

      return buildUpdatedUser(user, { pushTokens: [...pushTokens, token] });
    });
  },

  async updateUser(userId, updates) {
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error("Usuario nao encontrado.");
    }

    const normalizedEmail = String(updates.email ?? "").trim().toLowerCase();
    const normalizedName = String(updates.name ?? "").trim();

    if (!normalizedName) throw new Error("Informe o nome do usuario.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Informe um email valido.");
    }

    const emailInUse = users.some(
      (user) => user.id !== userId && user.email === normalizedEmail
    );
    if (emailInUse) throw new Error("Ja existe outro usuario com este email.");

    const user = users[userIndex];
    const removesLastAdmin = user.isAdmin
      && updates.isAdmin === false
      && users.filter((item) => item.isAdmin).length <= 1;

    if (removesLastAdmin) {
      throw new Error("Mantenha pelo menos um administrador ativo.");
    }

    const updatedUser = buildUpdatedUser(user, {
      ...updates,
      name: normalizedName,
      email: normalizedEmail,
    });

    return persistUserUpdate(users, userIndex, updatedUser);
  },

  async toggleFollow(userId, targetUserId) {
    if (!userId) throw new Error("Entre na sua conta para seguir perfis.");
    if (!targetUserId) throw new Error("Perfil nao encontrado.");
    if (userId === targetUserId) throw new Error("Voce nao pode seguir seu proprio perfil.");

    const users = await readUsers();
    const userIndex = users.findIndex((user) => user.id === userId);
    const targetUser = users.find((user) => user.id === targetUserId);

    if (userIndex === -1) throw new Error("Usuario nao encontrado.");
    if (!targetUser) throw new Error("Perfil nao encontrado.");

    const user = users[userIndex];
    const wasFollowing = user.followingIds.includes(targetUserId);
    const updatedUser = buildUpdatedUser(user, {
      followingIds: toggleValue(user.followingIds, targetUserId),
    });
    const persistedUser = await persistUserUpdate(users, userIndex, updatedUser);

    if (!wasFollowing) {
      await NotificationService.create({
        userId: targetUserId,
        type: "follow",
        title: "Novo seguidor",
        body: `${updatedUser.name} comecou a seguir voce.`,
        actorUserId: updatedUser.id,
        dedupeKey: `follow:${updatedUser.id}:${targetUserId}`,
        createdAt: new Date().toISOString(),
      });
    }

    return persistedUser;
  },

  async toggleSavedPost(userId, postId) {
    if (!userId) throw new Error("Entre na sua conta para salvar posts.");
    if (!postId) throw new Error("Post nao encontrado.");

    return updateUserById(userId, (user) =>
      buildUpdatedUser(user, { savedPostIds: toggleValue(user.savedPostIds, postId) })
    );
  },

  async toggleSavedListing(userId, listingId) {
    if (!userId) throw new Error("Entre na sua conta para salvar anuncios.");
    if (!listingId) throw new Error("Anuncio nao encontrado.");

    return updateUserById(userId, (user) =>
      buildUpdatedUser(user, { savedListingIds: toggleValue(user.savedListingIds, listingId) })
    );
  },

  async deleteUser(userId) {
    const session = await getSession();
    if (session?.id === userId) {
      throw new Error("Voce nao pode remover o usuario da sessao atual.");
    }

    const users = await readUsers();
    const nextUsers = users.filter((user) => user.id !== userId);

    if (nextUsers.length === users.length) {
      throw new Error("Usuario nao encontrado.");
    }

    await writeUsers(nextUsers);
    usersCache = reconcileCollection(usersCache, nextUsers).items;
    notify(usersCache);
    return true;
  },

  async convertImageToBase64(uri) {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      throw new Error("Erro ao converter imagem: " + error.message);
    }
  },
};
