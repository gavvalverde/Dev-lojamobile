import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import UserEntity from "../entities/UserEntity";

const USERS_KEY = "yellowduck:users";
const SESSION_KEY = "yellowduck:session";

const listeners = new Set();
let currentUser = null;
let hydrated = false;
let hydratePromise = null;

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
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

async function removeItem(key) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }

  await AsyncStorage.removeItem(key);
}

async function readUsers() {
  const stored = await getItem(USERS_KEY);
  const parsed = stored ? JSON.parse(stored) : [];
  return Array.isArray(parsed) ? parsed.map(UserEntity.transforme) : [];
}

async function writeUsers(users) {
  await setItem(USERS_KEY, JSON.stringify(users));
}

function notify() {
  listeners.forEach((listener) => listener(currentUser));
}

async function hydrate() {
  if (hydrated) return currentUser;
  if (hydratePromise) return hydratePromise;

  hydratePromise = getItem(SESSION_KEY).then((stored) => {
    currentUser = stored ? JSON.parse(stored) : null;
    hydrated = true;
    notify();
    return currentUser;
  });

  return hydratePromise;
}

export const AuthService = {
  async loadSession() {
    return hydrate();
  },

  getCurrentUser() {
    return currentUser;
  },

  subscribe(listener) {
    listeners.add(listener);
    listener(currentUser);
    hydrate();

    return () => {
      listeners.delete(listener);
    };
  },

  async register({ name, email, password, confirmPassword }) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const normalizedName = String(name ?? "").trim();

    if (!normalizedName) throw new Error("Informe seu nome.");
    if (!validateEmail(normalizedEmail)) throw new Error("Informe um email valido.");
    if (String(password ?? "").length < 6) {
      throw new Error("A senha precisa ter pelo menos 6 caracteres.");
    }
    if (password !== confirmPassword) throw new Error("As senhas nao conferem.");

    const users = await readUsers();
    const exists = users.some((user) => user.email === normalizedEmail);
    if (exists) throw new Error("Ja existe uma conta com este email.");

    const user = new UserEntity(null, normalizedName, normalizedEmail, password);
    const nextUsers = [...users, user];
    await writeUsers(nextUsers);

    currentUser = user.toSession();
    await setItem(SESSION_KEY, JSON.stringify(currentUser));
    notify();

    return currentUser;
  },

  async login({ email, password }) {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();

    if (!validateEmail(normalizedEmail)) throw new Error("Informe um email valido.");
    if (!password) throw new Error("Informe sua senha.");

    const users = await readUsers();
    const user = users.find(
      (item) => item.email === normalizedEmail && item.password === password
    );

    if (!user) throw new Error("Email ou senha invalidos.");

    currentUser = user.toSession();
    await setItem(SESSION_KEY, JSON.stringify(currentUser));
    notify();

    return currentUser;
  },

  async logout() {
    currentUser = null;
    await removeItem(SESSION_KEY);
    notify();
  },
};
