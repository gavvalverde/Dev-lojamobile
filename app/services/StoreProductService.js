import { DatabaseService } from "./DatabaseService";
import { reconcileCollection } from "../../utils/stableCollection";

const listeners = new Set();
const storeSeller = {
  id: "yellow-duck-store",
  name: "Yellow Duck",
  handle: "@yellowduck",
  photo: null,
  themeColor: "#ffc94a",
};
let products = [];
let hydrated = false;
let hydratePromise = null;
let realtimeUnsubscribe = null;

function normalizeProduct(product) {
  const cardId = String(product?.cardId ?? product?.id ?? "");
  const id = String(product?.id ?? cardId);

  return {
    ...product,
    id,
    cardId,
    listingId: product?.listingId ?? `${cardId}:yellow-duck-store`,
    aVenda: product?.aVenda !== false,
    productType: "sealed",
    cardType: "produto-selado",
    owner: storeSeller,
    ownerId: storeSeller.id,
    userId: storeSeller.id,
    seller: storeSeller,
    sellerId: storeSeller.id,
  };
}

function notify() {
  listeners.forEach((listener) => listener(products));
}

async function persist(nextProducts) {
  products = reconcileCollection(products, nextProducts.map(normalizeProduct)).items;
  await Promise.all(products.flatMap((product) => [
    DatabaseService.saveStoreProductCachedImages(product.id, product.images),
    DatabaseService.saveStoreProductCachedImages(product.cardId, product.images),
  ]));
  await DatabaseService.saveStoreProducts(products);
  notify();
  return products;
}

async function hydrate() {
  if (hydrated) return products;
  if (hydratePromise) return hydratePromise;

  hydratePromise = DatabaseService.getStoreProducts().then((storedProducts) => {
    products = storedProducts.map(normalizeProduct);
    hydrated = true;
    notify();
    return products;
  });

  return hydratePromise;
}

async function refreshProducts() {
  try {
    const nextProducts = (await DatabaseService.getStoreProductsFresh()).map(normalizeProduct);
    const result = reconcileCollection(products, nextProducts);
    hydrated = true;
    if (!result.changed) return;

    products = result.items;
    notify();
  } catch (error) {
    console.error("Erro ao sincronizar produtos da loja:", error);
  }
}

async function loadProductImages(productIds) {
  await hydrate();
  const requestedIds = [...new Set(
    (Array.isArray(productIds) ? productIds : [])
      .map((id) => String(id ?? ""))
      .filter(Boolean)
  )];
  if (requestedIds.length === 0) return products;

  const cachedImages = await Promise.all(requestedIds.map(async (id) => ({
    id,
    images: await DatabaseService.getStoreProductCachedImages(id),
  })));
  const cachedById = new Map(
    cachedImages.filter((item) => item.images?.small).map((item) => [item.id, item.images])
  );

  if (cachedById.size > 0) {
    const nextProducts = products.map((product) => (
      cachedById.has(product.id) || cachedById.has(product.cardId)
        ? normalizeProduct({
            ...product,
            images: cachedById.get(product.id) ?? cachedById.get(product.cardId),
            imageDeferred: false,
          })
        : product
    ));
    const result = reconcileCollection(products, nextProducts);
    if (result.changed) {
      products = result.items;
      notify();
    }
  }

  const missingIds = requestedIds.filter((id) => !cachedById.has(id));
  if (missingIds.length === 0) return products;

  const remoteProducts = (await DatabaseService.getStoreProductsByIdsFresh(missingIds))
    .map(normalizeProduct);
  if (remoteProducts.length === 0) return products;

  const remoteById = new Map(remoteProducts.flatMap((product) => [
    [product.id, product],
    [product.cardId, product],
  ]));
  const nextProducts = products.map((product) => {
    const remoteProduct = remoteById.get(product.id) ?? remoteById.get(product.cardId);
    if (!remoteProduct) return product;

    return normalizeProduct({
      ...product,
      images: remoteProduct.images,
      imageDeferred: false,
    });
  });
  const result = reconcileCollection(products, nextProducts);
  if (!result.changed) return products;

  products = result.items;
  notify();
  void Promise.all(remoteProducts.flatMap((product) => [
    DatabaseService.saveStoreProductCachedImages(product.id, product.images),
    DatabaseService.saveStoreProductCachedImages(product.cardId, product.images),
  ]));
  return products;
}

function startRealtime() {
  if (realtimeUnsubscribe) return;
  realtimeUnsubscribe = DatabaseService.subscribeCollection("store_products", refreshProducts);
}

function stopRealtimeIfIdle() {
  if (listeners.size > 0 || !realtimeUnsubscribe) return;
  realtimeUnsubscribe();
  realtimeUnsubscribe = null;
}

export const StoreProductService = {
  async loadProducts() {
    return hydrate();
  },

  getProducts() {
    return products;
  },

  loadProductImages,

  subscribe(listener) {
    listeners.add(listener);
    startRealtime();
    listener(products);
    hydrate();

    return () => {
      listeners.delete(listener);
      stopRealtimeIfIdle();
    };
  },

  async createProduct(product) {
    await hydrate();
    const nextProduct = normalizeProduct(product);
    if (!nextProduct.cardId) throw new Error("Informe um produto valido.");

    await persist([nextProduct, ...products]);
    return nextProduct;
  },

  async updateProduct(id, updates) {
    await hydrate();
    await persist(products.map((product) => (
      product.id === id ? normalizeProduct({ ...product, ...updates }) : product
    )));
  },

  async removeProduct(id) {
    await hydrate();
    const product = products.find((item) => item.id === id);
    if (!product) throw new Error("Produto nao encontrado.");

    await persist(products.filter((item) => item.id !== id));
    await DatabaseService.removeStoreProductCachedImages(id);
    await DatabaseService.removeStoreProductCachedImages(product.cardId);
  },
};
