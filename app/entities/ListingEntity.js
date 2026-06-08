function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

function normalizeSeller(seller) {
  if (!seller) return null;

  return {
    id: seller.id ?? null,
    name: seller.name ?? "",
    handle: seller.handle ?? "",
    photo: seller.photo ?? null,
    themeColor: seller.themeColor ?? "#ffc94a",
  };
}

export default class ListingEntity {
  constructor(card) {
    this.id = String(card.cardId ?? card.id);
    this.name = card.name ?? "";
    this.images = card.images ?? { small: "", large: "" };
    this.set = card.set ?? "";
    this.price = card.price ?? "";
    this.unitPrice = parsePrice(card.price);
    this.idioma = card.idioma ?? "Portugues";
    this.qualidade = card.qualidade ?? "NM";
    this.cardType = card.cardType ?? card.tipo ?? card.finish ?? "";
    this.supertype = card.supertype ?? "";
    this.subtypes = Array.isArray(card.subtypes) ? card.subtypes : [];
    this.rarity = card.rarity ?? "";
    this.descricao = card.descricao ?? card.description ?? "";
    this.description = this.descricao;
    this.estoque = card.estoque ?? card.stock ?? 1;
    this.productType = card.productType ?? "";
    this.aVenda = !!card.aVenda;
    this.seller = normalizeSeller(card.seller ?? card.vendedor);
    this.sellerId = card.sellerId ?? this.seller?.id ?? card.ownerId ?? null;
    this.listingId = card.listingId ?? `${this.id}:${this.sellerId ?? "sem-vendedor"}`;
  }

  get ativo() {
    return this.aVenda && this.unitPrice > 0;
  }

  matchesCard(card) {
    return String(card?.id) === this.id;
  }

  static transforme(card) {
    return new ListingEntity(card);
  }
}
