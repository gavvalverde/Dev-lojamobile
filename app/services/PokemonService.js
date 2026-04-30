import ProdutoEntity from '../entities/ProdutoEntity';

export const PokemonService = {
  fetchCards: async (pageSize = 30, page = 1) => {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?pageSize=${pageSize}&page=${page}`
      );
      const data = await res.json();
      return data.data.map(d => ProdutoEntity.transforme(d));
    } catch (e) {
      console.error('Erro ao buscar cartas:', e);
      throw e;
    }
  },

  searchCardsByName: async (name) => {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:${name}`
      );
      const data = await res.json();
      return (data.data || []).map(d => ProdutoEntity.transforme(d));
    } catch (e) {
      console.error('Erro ao buscar cartas por nome:', e);
      throw e;
    }
  },

  fetchCardById: async (id) => {
    try {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards/${id}`);
      const data = await res.json();
      return ProdutoEntity.transforme(data.data);
    } catch (e) {
      console.error('Erro ao buscar detalhes da carta:', e);
      throw e;
    }
  },
};
