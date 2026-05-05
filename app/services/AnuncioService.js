import AnuncioEntity from "../entities/AnuncioEntity";

function getActiveListings(favorites) {
  return favorites
    .map((item) => AnuncioEntity.transforme(item))
    .filter((anuncio) => anuncio.ativo);
}

function buildResult(card, listings) {
  return {
    card,
    anuncios: listings.filter((anuncio) => anuncio.matchesCard(card)),
  };
}

export const AnuncioService = {
  getActiveListings,

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
