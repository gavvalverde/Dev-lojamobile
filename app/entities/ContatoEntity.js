// app/entities/ContatoEntity.js
function normalizeId(raw) {
  if (raw == null) return null;
  const t = typeof raw;

  if (t === 'string' || t === 'number' || t === 'bigint') return String(raw);

  if (t === 'object') {
    // casos comuns vindos de API/DB
    if ('$oid' in raw) return String(raw.$oid);
    if ('value' in raw) return String(raw.value);
    if ('id' in raw) return String(raw.id);
  }
  return null; // não conseguimos extrair
}

function newId() {
  // reduz colisão no mesmo millissegundo
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default class ContatoEntity {
  constructor(
    id,
    nome,
    email,
    telefone,
    avatar,
    favorito,
    categoria,
    sexo
  ) {
    const idNorm = normalizeId(id);
    this.id = idNorm ?? newId();

    this.nome = nome ?? '';
    this.email = email ?? '';
    this.telefone = telefone ?? '';
    this.avatar = avatar;
    this.favorito = !!favorito;
    this.categoria = categoria ?? '';
    this.sexo = sexo ?? '';
  }

  // opcional: chave pronta para listas
  get key() {
    return String(this.id);
  }

  // opcional: fábrica a partir do JSON da API
  static transforme(d) {
    return new ContatoEntity(
      d?.id ?? d?._id ?? d?.id?.$oid ?? d?.id?.value,
      d?.nome ?? d?.name,
      d?.email,
      d?.telefone ?? d?.phone,
      d?.avatar,
      d?.favorito ?? d?.favorite,
      d?.categoria ?? d?.category,
      d?.sexo ?? d?.gender
    );
  }
}
