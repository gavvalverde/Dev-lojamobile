import ListingEntity from "../entities/ListingEntity";

const qualityRank = {
  DMG: 0,
  HP: 1,
  MP: 2,
  LP: 3,
  NM: 4,
};

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseWantedPrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function getWantedCardName(post) {
  return normalizeText(post?.cardName).replace(/\s*\([^)]*\)\s*$/, "");
}

function getActiveListings(favorites) {
  return favorites
    .map((item) => ListingEntity.transforme(item))
    .filter((anuncio) => anuncio.ativo);
}

function buildResult(card, listings) {
  return {
    card,
    anuncios: listings.filter((anuncio) => anuncio.matchesCard(card)),
  };
}

function matchesWantedPost(anuncio, post) {
  if (!post || post.type !== "wanted") return false;

  const wantedName = getWantedCardName(post);
  const listingName = normalizeText(anuncio.name);

  if (wantedName && !listingName.includes(wantedName) && !wantedName.includes(listingName)) {
    return false;
  }

  const maxPrice = parseWantedPrice(post.offer);
  if (maxPrice > 0 && anuncio.unitPrice > maxPrice) {
    return false;
  }

  const minQuality = qualityRank[String(post.minQuality ?? "").toUpperCase()];
  const listingQuality = qualityRank[String(anuncio.qualidade ?? "").toUpperCase()];
  if (minQuality !== undefined && listingQuality !== undefined && listingQuality < minQuality) {
    return false;
  }

  const wantedType = normalizeText(post.cardType);
  const listingType = normalizeText(anuncio.cardType);
  if (wantedType && listingType && wantedType !== listingType) {
    return false;
  }

  return true;
}

export const AnuncioService = {
  getActiveListings,
  matchesWantedPost,
  findWantedMatchesForListing(posts, listing) {
    const anuncio = ListingEntity.transforme(listing);

    if (!anuncio.ativo) return [];

    return (Array.isArray(posts) ? posts : []).filter((post) =>
      matchesWantedPost(anuncio, post)
    );
  },
  findListingsForWantedPost(favorites, post) {
    return getActiveListings(favorites).filter((anuncio) =>
      matchesWantedPost(anuncio, post)
    );
  },

  getListingsForCard(favorites, card) {
    return getActiveListings(favorites).filter((anuncio) =>
      anuncio.matchesCard(card)
    );
  },

  getListingsForCardId(favorites, cardId) {
    return getActiveListings(favorites).filter(
      (anuncio) => anuncio.id === String(cardId)
    );
  },

  buildCatalogResults(favorites) {
    const listings = getActiveListings(favorites);

    return listings.map((anuncio) => ({
      card: anuncio,
      anuncios: [anuncio],
    }));
  },

  buildSearchResults(cards, favorites) {
    const listings = getActiveListings(favorites);

    return cards.map((card) => buildResult(card, listings));
  },
};
