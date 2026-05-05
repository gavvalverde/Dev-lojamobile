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

  searchCardsByNumber: async (number) => {
    try {
      const term = String(number ?? "").trim();
      // Extract the card number (before the "/" if present)
      const cardNumber = term.split('/')[0];
      
      if (!cardNumber) {
        return [];
      }

      const numberQuery = `number:${cardNumber}`;
      const query = encodeURIComponent(numberQuery);
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${query}&pageSize=250`
      );
      const data = await res.json();
      return (data.data || []).map(d => ProdutoEntity.transforme(d));
    } catch (e) {
      console.error('Erro ao buscar cartas por número:', e);
      throw e;
    }
  },

  searchCardsByName: async (name) => {
    try {
      const term = String(name ?? "").trim().replace(/"/g, "");
      const nameQuery = term.includes(" ") ? `name:"${term}"` : `name:${term}`;
      const query = encodeURIComponent(nameQuery);
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${query}&pageSize=250`
      );
      const data = await res.json();
      return (data.data || []).map(d => ProdutoEntity.transforme(d));
    } catch (e) {
      console.error('Erro ao buscar cartas por nome:', e);
      throw e;
    }
  },

  searchCards: async (term) => {
    try {
      const searchTerm = String(term ?? "").trim();
      
      // Check if the search term is a card number format (e.g., "02/100" or "02")
      const isCardNumber = /^\d+(?:\/\d+)?$/.test(searchTerm);
      
      if (isCardNumber) {
        return await PokemonService.searchCardsByNumber(searchTerm);
      } else {
        return await PokemonService.searchCardsByName(searchTerm);
      }
    } catch (e) {
      console.error('Erro ao buscar cartas:', e);
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
