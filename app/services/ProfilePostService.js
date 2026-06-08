import ProfilePostEntity from "../entities/ProfilePostEntity";
import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
let posts = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function normalizePost(post) {
  return ProfilePostEntity.transforme(post);
}

function notify() {
  listeners.forEach((listener) => listener(posts));
}

async function readPosts() {
  try {
    const storedPosts = await DatabaseService.getProfilePosts();
    return storedPosts.map(normalizePost);
  } catch (error) {
    console.error("Erro ao carregar posts:", error);
    return [];
  }
}

async function writePosts() {
  try {
    await DatabaseService.saveProfilePosts(posts);
  } catch (error) {
    console.error("Erro ao salvar posts:", error);
  }
}

async function hydrate() {
  if (hydrated) return posts;
  if (hydratePromise) return hydratePromise;

  hydratePromise = readPosts().then((storedPosts) => {
    posts = storedPosts;
    hydrated = true;
    notify();
    return posts;
  });

  return hydratePromise;
}

function setPosts(nextPosts) {
  posts = reconcileCollection(posts, nextPosts.map(normalizePost)).items;
  notify();
  writePosts();
}

async function refreshPosts() {
  try {
    const nextPosts = await readPosts();
    const result = reconcileCollection(posts, nextPosts);
    hydrated = true;
    if (!result.changed) return;

    posts = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar posts:", error);
  }
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("profile_posts", refreshPosts);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const ProfilePostService = {
  async loadPosts() {
    return hydrate();
  },

  getPosts() {
    return posts;
  },

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(posts);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  createPost(user, draft) {
    if (!user?.id) throw new Error("Entre na sua conta para postar.");

    const post = ProfilePostEntity.fromProfile(user, draft);

    if (post.type === "wanted" && !post.cardName) {
      throw new Error("Informe a carta que voce esta procurando.");
    }

    if (post.type === "post" && !post.text && !post.image) {
      throw new Error("Escreva algo ou adicione uma imagem.");
    }

    setPosts([post, ...posts]);
    return post;
  },

  deletePost(postId, userId) {
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    if (post.userId !== userId) throw new Error("Voce so pode remover seus posts.");

    setPosts(posts.filter((item) => item.id !== postId));
  },

  toggleLike(postId, userId) {
    if (!userId) throw new Error("Entre na sua conta para curtir.");

    setPosts(
      posts.map((post) => {
        if (post.id !== postId) return post;
        const liked = post.likes.includes(userId);

        return {
          ...post,
          likes: liked
            ? post.likes.filter((id) => id !== userId)
            : [...post.likes, userId],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  },

  toggleRepost(postId, userId) {
    if (!userId) throw new Error("Entre na sua conta para republicar.");

    setPosts(
      posts.map((post) => {
        if (post.id !== postId) return post;
        const reposted = post.reposts.includes(userId);

        return {
          ...post,
          reposts: reposted
            ? post.reposts.filter((id) => id !== userId)
            : [...post.reposts, userId],
          updatedAt: new Date().toISOString(),
        };
      })
    );
  },

  updateAuthorProfile(user) {
    if (!user?.id) return;

    setPosts(
      posts.map((post) =>
        post.profileId === user.id ? post.withUpdatedAuthorProfile(user) : post
      )
    );
  },
};
