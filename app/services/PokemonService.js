import PokemonEntity from "../entities/PokemonEntity";
import { DatabaseService } from "./DatabaseService";

const SEARCH_PAGE_SIZE = 48;
const CARD_SEARCH_TIMEOUT_MS = 8000;
const POKEMON_PROFILE_TIMEOUT_MS = 1800;

function emptyCardPage(page = 1) {
  return {
    cards: [],
    hasMore: false,
    page,
    totalCount: 0,
    timedOut: false,
  };
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

async function fetchJsonWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function cacheCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return cards;

  DatabaseService.savePokemonCards(cards).catch((error) => {
    console.error("Erro ao salvar cartas no cache local:", error);
  });

  return cards;
}

async function fetchCardsByQuery(queryText, page = 1) {
  try {
    const query = encodeURIComponent(queryText);
    const res = await fetchJsonWithTimeout(
      `https://api.pokemontcg.io/v2/cards?q=${query}&pageSize=${SEARCH_PAGE_SIZE}&page=${page}`,
      CARD_SEARCH_TIMEOUT_MS
    );

    if (!res.ok) {
      throw new Error(`Pokemon TCG API respondeu ${res.status}`);
    }

    const data = await res.json();
    const cards = cacheCards((data.data || []).map((d) => PokemonEntity.transforme(d)));

    return {
      cards,
      hasMore: Number(data.page ?? page) * Number(data.pageSize ?? SEARCH_PAGE_SIZE) < Number(data.totalCount ?? cards.length),
      page: Number(data.page ?? page),
      totalCount: Number(data.totalCount ?? cards.length),
    };
  } catch (error) {
    if (isAbortError(error)) {
      console.warn("Busca de cartas excedeu o tempo limite:", queryText);
      return { ...emptyCardPage(page), timedOut: true };
    }

    throw error;
  }
}

function uniqueCards(cards) {
  const seen = new Set();

  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function numberVariants(value) {
  const raw = String(value ?? "").trim();
  const normalized = String(Number(raw || "0"));
  const variants = [raw, normalized];

  if (normalized !== "0") {
    variants.push(normalized.padStart(2, "0"), normalized.padStart(3, "0"));
  }

  return [...new Set(variants.filter(Boolean))];
}

const cardTypeSearchTerms = {
  treinador: "supertype:Trainer",
  trainer: "supertype:Trainer",
  apoiador: "supertype:Trainer",
  supporter: "supertype:Trainer",
  item: "supertype:Trainer subtypes:Item",
  ginasio: "supertype:Trainer subtypes:Stadium",
  estadio: "supertype:Trainer subtypes:Stadium",
  stadium: "supertype:Trainer subtypes:Stadium",
  energia: "supertype:Energy",
  energy: "supertype:Energy",
  pokemon: "supertype:Pok\u00e9mon",
};

const portugueseCardSearchTerms = {
  "aroma de grama": "Grass Aroma",
  "bola ninho": "Nest Ball",
  "bola ultra": "Ultra Ball",
  "balao de ar": "Air Balloon",
  "balao": "Air Balloon",
  "boss orders": "Boss's Orders",
  "cinto de escolha": "Choice Belt",
  "corda de fuga": "Escape Rope",
  "cristal de nevoa": "Fog Crystal",
  "doce raro": "Rare Candy",
  "energia basica": "Basic Energy",
  "energia de fogo": "Fire Energy",
  "energia de grama": "Grass Energy",
  "energia de agua": "Water Energy",
  "energia eletrica": "Lightning Energy",
  "energia lutador": "Fighting Energy",
  "energia metalica": "Metal Energy",
  "energia psíquica": "Psychic Energy",
  "energia psiquica": "Psychic Energy",
  "energia sombria": "Darkness Energy",
  "energia dupla": "Double Colorless Energy",
  "energia incolor dupla": "Double Colorless Energy",
  "estadio em ruinas": "Collapsed Stadium",
  "faixa de escolha": "Choice Band",
  "ferramenta": "Tool",
  "ferramenta pokemon": "Pokemon Tool",
  "ferramenta pokémon": "Pokemon Tool",
  "incenso de evolucao": "Evolution Incense",
  "incenso de evolução": "Evolution Incense",
  "juiz": "Judge",
  "laboratorio perdido": "Lost City",
  "laboratório perdido": "Lost City",
  "maca suculenta": "Sweet Honey",
  "maça suculenta": "Sweet Honey",
  "martelo esmagador": "Crushing Hammer",
  "mochila de emergencia": "Emergency Jelly",
  "mochila de emergência": "Emergency Jelly",
  "ordens da chefia": "Boss's Orders",
  "ordens do chefe": "Boss's Orders",
  "pesquisa academica": "Professor's Research",
  "pesquisa acadêmica": "Professor's Research",
  "pesquisa de professores": "Professor's Research",
  "pesquisa do professor": "Professor's Research",
  "poção": "Potion",
  "pocao": "Potion",
  "recuperacao de energia": "Energy Retrieval",
  "recuperação de energia": "Energy Retrieval",
  "rede de recolhida": "Scoop Up Net",
  "resgate amigo": "Buddy-Buddy Poffin",
  "super vara": "Super Rod",
  "troca": "Switch",
  "vara comum": "Ordinary Rod",
  "vitalidade da professora turo": "Professor Turo's Scenario",
};

function normalizeQueryWord(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizeSearchKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function translatePortugueseSearchTerm(term) {
  const searchKey = normalizeSearchKey(term);
  if (!searchKey) return String(term ?? "").trim();

  return portugueseCardSearchTerms[searchKey] ?? String(term ?? "").trim();
}

function parseCardSearchTerm(term) {
  const textWords = [];
  const constraints = [];

  String(term ?? "")
    .trim()
    .replace(/"/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .forEach((word) => {
      const typeConstraint = cardTypeSearchTerms[normalizeQueryWord(word)];

      if (typeConstraint) {
        constraints.push(typeConstraint);
        return;
      }

      textWords.push(word);
    });

  return {
    text: textWords.join(" "),
    constraints: [...new Set(constraints)].join(" "),
  };
}

function combineQueryParts(...parts) {
  return parts.filter(Boolean).join(" ");
}

function buildTextFieldQuery(field, term) {
  const words = String(term ?? "")
    .trim()
    .replace(/"/g, "")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1 && words[0].length === 1) {
    return `${field}:"${words[0]}"`;
  }

  return words
    .map((word) => `${field}:*${word}*`)
    .join(" ");
}

function buildNameQuery(term) {
  return buildTextFieldQuery("name", term);
}

function buildArtistQuery(term) {
  return buildTextFieldQuery("artist", term);
}

function normalizePokemonLookup(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function formatPokemonName(value) {
  return String(value ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export const PokemonService = {
  getCachedCards: async () => {
    try {
      const cards = await DatabaseService.getPokemonCards();
      return cards.map((card) => PokemonEntity.transforme(card));
    } catch (e) {
      console.error("Erro ao carregar cartas em cache:", e);
      return [];
    }
  },

  fetchCards: async (pageSize = 30, page = 1) => {
    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?pageSize=${pageSize}&page=${page}`
      );
      const data = await res.json();
      return cacheCards(data.data.map((d) => PokemonEntity.transforme(d)));
    } catch (e) {
      console.error('Erro ao buscar cartas:', e);
      throw e;
    }
  },

  searchCardsByNumber: async (number) => {
    try {
      const term = String(number ?? "").trim();
      const [rawCardNumber, rawSetTotal] = term.split('/');
      const cardNumber = rawCardNumber?.trim();
      const setTotal = rawSetTotal?.trim();
      
      if (!cardNumber) {
        return [];
      }

      const queries = numberVariants(cardNumber).flatMap((variant) => {
        if (!setTotal) return [`number:${variant}`];

        return [
          `number:${variant} set.printedTotal:${setTotal}`,
          `number:${variant} set.total:${setTotal}`,
        ];
      });

      const results = await Promise.allSettled(queries.map((query) => fetchCardsByQuery(query)));
      return uniqueCards(
        results
          .filter((result) => result.status === "fulfilled")
          .flatMap((result) => result.value.cards)
      );
    } catch (e) {
      console.error('Erro ao buscar cartas por número:', e);
      throw e;
    }
  },

  searchCardsByName: async (name) => {
    try {
      const searchParts = parseCardSearchTerm(translatePortugueseSearchTerm(name));
      const nameQuery = combineQueryParts(searchParts.constraints, buildNameQuery(searchParts.text));
      if (!nameQuery) return [];

      return (await fetchCardsByQuery(nameQuery)).cards;
    } catch (e) {
      console.error('Erro ao buscar cartas por nome:', e);
      throw e;
    }
  },

  searchCardsByArtist: async (artist) => {
    try {
      const searchParts = parseCardSearchTerm(translatePortugueseSearchTerm(artist));
      const artistQuery = combineQueryParts(searchParts.constraints, buildArtistQuery(searchParts.text));
      if (!artistQuery) return [];

      return (await fetchCardsByQuery(artistQuery)).cards;
    } catch (e) {
      console.error('Erro ao buscar cartas por artista:', e);
      throw e;
    }
  },

  searchCards: async (term) => {
    try {
      const searchTerm = String(term ?? "").trim();
      if (!searchTerm) return [];

      const isCardNumber = /^\d+(?:\/\d+)?$/.test(searchTerm);
      
      if (isCardNumber) {
        return await PokemonService.searchCardsByNumber(searchTerm);
      } else {
        const results = await Promise.allSettled([
          PokemonService.searchCardsByName(searchTerm),
          PokemonService.searchCardsByArtist(searchTerm),
        ]);

        return uniqueCards(
          results
            .filter((result) => result.status === "fulfilled")
            .flatMap((result) => result.value)
        );
      }
    } catch (e) {
      console.error('Erro ao buscar cartas:', e);
      throw e;
    }
  },

  searchCardsPage: async (term, page = 1) => {
    try {
      const searchTerm = String(term ?? "").trim();
      if (!searchTerm) return { cards: [], hasMore: false, page, totalCount: 0 };

      const isCardNumber = /^\d+(?:\/\d+)?$/.test(searchTerm);
      if (isCardNumber) {
        const cards = await PokemonService.searchCardsByNumber(searchTerm);
        return { cards, hasMore: false, page: 1, totalCount: cards.length };
      }

      const searchParts = parseCardSearchTerm(translatePortugueseSearchTerm(searchTerm));
      const queries = [
        combineQueryParts(searchParts.constraints, buildNameQuery(searchParts.text)),
        searchParts.text ? combineQueryParts(searchParts.constraints, buildArtistQuery(searchParts.text)) : "",
      ].filter(Boolean);
      const results = await Promise.allSettled(queries.map((query) => fetchCardsByQuery(query, page)));
      const resolvedResults = results.map((result) =>
        result.status === "fulfilled" ? result.value : emptyCardPage(page)
      );
      const nameResult = resolvedResults[0] ?? emptyCardPage(page);
      const artistResult = resolvedResults[1] ?? emptyCardPage(page);

      if (page > 1 && nameResult.timedOut && artistResult.timedOut) {
        throw new Error("Tempo limite excedido ao carregar mais cartas.");
      }

      const cards = uniqueCards([...nameResult.cards, ...artistResult.cards]);

      return {
        cards,
        hasMore: nameResult.hasMore || artistResult.hasMore,
        page,
        totalCount: Math.max(nameResult.totalCount, artistResult.totalCount),
      };
    } catch (e) {
      console.error("Erro ao buscar pagina de cartas:", e);
      throw e;
    }
  },

  fetchPokemonProfile: async (term) => {
    try {
      const pokemonId = normalizePokemonLookup(term);
      if (!pokemonId) return null;

      const [pokemonRes, speciesRes] = await Promise.all([
        fetchJsonWithTimeout(
          `https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(pokemonId)}`,
          POKEMON_PROFILE_TIMEOUT_MS
        ),
        fetchJsonWithTimeout(
          `https://pokeapi.co/api/v2/pokemon-species/${encodeURIComponent(pokemonId)}`,
          POKEMON_PROFILE_TIMEOUT_MS
        ),
      ]);

      if (!pokemonRes.ok) return null;

      const pokemon = await pokemonRes.json();
      const species = speciesRes.ok ? await speciesRes.json() : null;
      const flavor =
        species?.flavor_text_entries
          ?.find((entry) => entry.language?.name === "pt-BR")
          ?.flavor_text ||
        species?.flavor_text_entries
          ?.find((entry) => entry.language?.name === "en")
          ?.flavor_text ||
        "";

      return {
        id: pokemon.id,
        name: formatPokemonName(pokemon.name),
        apiName: pokemon.name,
        image:
          pokemon.sprites?.other?.["official-artwork"]?.front_default ||
          pokemon.sprites?.other?.home?.front_default ||
          pokemon.sprites?.front_default ||
          null,
        types: pokemon.types?.map((item) => item.type?.name).filter(Boolean) ?? [],
        abilities: pokemon.abilities?.map((item) => formatPokemonName(item.ability?.name)).filter(Boolean) ?? [],
        height: pokemon.height ? pokemon.height / 10 : null,
        weight: pokemon.weight ? pokemon.weight / 10 : null,
        stats: pokemon.stats?.map((item) => ({
          name: formatPokemonName(item.stat?.name),
          value: item.base_stat,
        })) ?? [],
        description: String(flavor).replace(/\s+/g, " ").trim(),
      };
    } catch (e) {
      if (!isAbortError(e)) {
        console.error("Erro ao buscar Pokemon:", e);
      }
      return null;
    }
  },

  fetchCardById: async (id) => {
    try {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards/${id}`);
      const data = await res.json();
      const card = PokemonEntity.transforme(data.data);
      await cacheCards([card]);
      return card;
    } catch (e) {
      console.error('Erro ao buscar detalhes da carta:', e);
      throw e;
    }
  },
};
