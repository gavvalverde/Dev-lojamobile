import UserEntity from "../entities/UserEntity";
import { DatabaseService } from "./DatabaseService";
import { UserService } from "./UserService";

const listeners = new Set();
let currentUser = null;
let hydrated = false;
let hydratePromise = null;

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? "").trim());
}

async function readUsers() {
  const storedUsers = await DatabaseService.getUsers();
  return storedUsers.map(UserEntity.transforme);
}

async function writeUsers(users) {
  await DatabaseService.saveUsers(users);
}

function notify() {
  listeners.forEach((listener) => listener(currentUser));
}

function toSessionUser(user) {
  if (!user) return user;
  const { password, ...session } = user;
  return session;
}

async function claimDailyLoginForCurrentUser(userId) {
  const result = await UserService.claimDailyLogin(userId);
  if (!result?.user) return null;

  currentUser = toSessionUser(result.user);
  await DatabaseService.saveSession(currentUser);
  notify();
  return result.reward;
}

async function hydrate() {
  if (hydrated) return currentUser;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getSession().then(async (storedSession) => {
    if (storedSession?.id) {
      currentUser = storedSession;
      hydrated = true;
      notify();

      readUsers()
        .then(async (users) => {
          const storedUser = users.find((user) => user.id === storedSession.id);
          if (!storedUser) return;

          currentUser = storedUser.toSession();
          await DatabaseService.saveSession(currentUser);
          notify();
          await claimDailyLoginForCurrentUser(storedUser.id);
        })
        .catch((error) => {
          console.error("Erro ao atualizar sessao do usuario:", error);
        });
    } else {
      currentUser = storedSession;
      hydrated = true;
      notify();
    }

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

  async setCurrentUser(nextUser) {
    currentUser = nextUser;
    if (nextUser?.id) {
      await DatabaseService.saveSession(nextUser);
    }
    notify();
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
    if (password !== confirmPassword) throw new Error("As senhas não conferem.");

    const users = await readUsers();
    const exists = users.some((user) => user.email === normalizedEmail);
    if (exists) throw new Error("Ja existe uma conta com este email.");

    const user = new UserEntity(null, normalizedName, normalizedEmail, password);
    user.isAdmin = users.length === 0;
    const nextUsers = [...users, user];
    await writeUsers(nextUsers);

    currentUser = user.toSession();
    await DatabaseService.saveSession(currentUser);
    await claimDailyLoginForCurrentUser(user.id);
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

    if (!user) throw new Error("Email ou senha inválidos.");

    currentUser = user.toSession();
    await DatabaseService.saveSession(currentUser);
    await claimDailyLoginForCurrentUser(user.id);
    notify();

    return currentUser;
  },

  async logout() {
    currentUser = null;
    await DatabaseService.clearSession();
    notify();
  },
};
