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

export default class ClienteEntity {
  constructor(
    id,
    nome,
    email,
    telefone,
    endereco,
    cpf,
    dataNascimento,
    avatar,
    favorito
  ) {
    const idNorm = normalizeId(id);
    this.id = idNorm ?? newId();

    this.nome = nome ?? '';
    this.email = email ?? '';
    this.telefone = telefone ?? '';
    this.endereco = endereco ?? '';
    this.cpf = cpf ?? '';
    this.dataNascimento = dataNascimento ?? '';
    this.avatar = avatar;
    this.favorito = !!favorito;
  }

  get key() {
    return String(this.id);
  }

  static transforme(d) {
    return new ClienteEntity(
      d?.id ?? d?._id ?? d?.id?.$oid ?? d?.id?.value,
      d?.nome ?? d?.name,
      d?.email,
      d?.telefone ?? d?.phone,
      d?.endereco ?? d?.address,
      d?.cpf,
      d?.dataNascimento ?? d?.birthDate,
      d?.avatar,
      d?.favorito ?? d?.favorite
    );
  }
}
