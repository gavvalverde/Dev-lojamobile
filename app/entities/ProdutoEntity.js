function normalizeId(raw) {
  if (raw == null) return null;
  const t = typeof raw;

  if (t === 'string' || t === 'number' || t === 'bigint') return String(raw);

  if (t === 'object') {
    if ('$oid' in raw) return String(raw.$oid);
    if ('value' in raw) return String(raw.value);
    if ('id' in raw) return String(raw.id);
  }
  return null;
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default class ProdutoEntity {
  constructor(
    id,
    name,
    images,
    rarity,
    set,
    price,
    favorito,
    descricao,
    estoque
  ) {
    const idNorm = normalizeId(id);
    this.id = idNorm ?? newId();

    this.name = name ?? '';
    this.images = images ?? { small: '', large: '' };
    this.rarity = rarity ?? '';
    this.set = set ?? '';
    this.price = price ?? 0;
    this.favorito = !!favorito;
    this.descricao = descricao ?? '';
    this.estoque = estoque ?? 0;
  }

  get key() {
    return String(this.id);
  }

  static transforme(d) {
    // Extrai o nome do set corretamente
    const setName = typeof d?.set === 'string' 
      ? d.set 
      : (d?.set?.name ?? d?.colecao ?? '');
    
    return new ProdutoEntity(
      d?.id ?? d?._id ?? d?.id?.$oid ?? d?.id?.value,
      d?.name ?? d?.nome,
      d?.images ?? { small: d?.imageSmall, large: d?.imageLarge },
      d?.rarity ?? d?.raridade,
      setName,
      d?.price ?? d?.preco,
      d?.favorito ?? d?.favorite,
      d?.flavorText ?? d?.descricao ?? d?.description,
      d?.estoque ?? d?.stock
    );
  }
}
