function parsePrice(value) {
  if (typeof value === "number") return value;

  const normalized = String(value ?? "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  return Number(normalized) || 0;
}

export default class AnuncioEntity {
  constructor(card) {
    this.id = String(card.id);
    this.name = card.name ?? "";
    this.images = card.images ?? { small: "", large: "" };
    this.set = card.set ?? "";
    this.price = card.price ?? "";
    this.unitPrice = parsePrice(card.price);
    this.idioma = card.idioma ?? "Portugues";
    this.qualidade = card.qualidade ?? "NM";
    this.aVenda = !!card.aVenda;
  }

  get ativo() {
    return this.aVenda && this.unitPrice > 0;
  }

  matchesCard(card) {
    return String(card?.id) === this.id;
  }

  static transforme(card) {
    return new AnuncioEntity(card);
  }
}
