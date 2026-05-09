import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import UserEntity from "../entities/UserEntity";

const USERS_KEY = "yellowduck:users";
const SESSION_KEY = "yellowduck:session";
const listeners = new Set();

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

async function readUsers() {
  const stored = await getItem(USERS_KEY);
  const parsed = stored ? JSON.parse(stored) : [];
  return Array.isArray(parsed) ? parsed.map(UserEntity.transforme) : [];
}

async function writeUsers(users) {
  await setItem(USERS_KEY, JSON.stringify(users));
}

async function getSession() {
  const stored = await getItem(SESSION_KEY);
  return stored ? JSON.parse(stored) : null;
}

function sanitizeUser(user) {
  const session = user.toSession();

  return {
    ...session,
    password: user.password,
  };
}

function notify(users) {
  const visibleUsers = users.map(sanitizeUser);
  listeners.forEach((listener) => listener(visibleUsers));
}

export const UserService = {
  async listUsers() {
    const users = await readUsers();
    return users.map(sanitizeUser);
  },

  subscribe(listener) {
    listeners.add(listener);
    readUsers().then((users) => notify(users));

    return () => {
      listeners.delete(listener);
    };
  },

  async updateProfile(userId, updates) {
    const users = await readUsers();
    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
      throw new Error("Usuário não encontrado.");
    }

    const user = users[userIndex];
    const updatedUser = new UserEntity(
      user.id,
      updates.name ?? user.name,
      user.email,
      user.password,
      updates.photo ?? user.photo,
      updates.phone ?? user.phone,
      updates.bio ?? user.bio,
      updates.coverPhoto ?? user.coverPhoto,
      updates.status ?? user.status,
      updates.handle ?? user.handle,
      updates.location ?? user.location,
      updates.favoritePokemon ?? user.favoritePokemon,
      updates.pronouns ?? user.pronouns,
      updates.themeColor ?? user.themeColor,
      updates.badges ?? user.badges
    );

    users[userIndex] = updatedUser;
    await writeUsers(users);
    notify(users);

    const session = updatedUser.toSession();
    await setItem(SESSION_KEY, JSON.stringify(session));

    return session;
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
    const updatedUser = new UserEntity(
      user.id,
      normalizedName,
      normalizedEmail,
      user.password,
      updates.photo ?? user.photo,
      updates.phone ?? user.phone,
      updates.bio ?? user.bio,
      updates.coverPhoto ?? user.coverPhoto,
      updates.status ?? user.status,
      updates.handle ?? user.handle,
      updates.location ?? user.location,
      updates.favoritePokemon ?? user.favoritePokemon,
      updates.pronouns ?? user.pronouns,
      updates.themeColor ?? user.themeColor,
      Array.isArray(updates.badges) ? updates.badges : user.badges
    );

    users[userIndex] = updatedUser;
    await writeUsers(users);

    const session = await getSession();
    if (session?.id === userId) {
      await setItem(SESSION_KEY, JSON.stringify(updatedUser.toSession()));
    }

    notify(users);
    return sanitizeUser(updatedUser);
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
    notify(nextUsers);
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
