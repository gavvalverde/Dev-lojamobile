import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import UserEntity from "../entities/UserEntity";

const USERS_KEY = "yellowduck:users";
const SESSION_KEY = "yellowduck:session";

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

export const UserService = {
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

    const session = updatedUser.toSession();
    await setItem(SESSION_KEY, JSON.stringify(session));

    return session;
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
