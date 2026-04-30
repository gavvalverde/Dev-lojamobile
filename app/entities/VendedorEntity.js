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

export default class VendedorEntity {
  constructor(
    id,
    nome,
    email,
    telefone,
    loja,
    cnpj,
    dataCadastro,
    avatar,
    ativo
  ) {
    const idNorm = normalizeId(id);
    this.id = idNorm ?? newId();

    this.nome = nome ?? '';
    this.email = email ?? '';
    this.telefone = telefone ?? '';
    this.loja = loja ?? '';
    this.cnpj = cnpj ?? '';
    this.dataCadastro = dataCadastro ?? '';
    this.avatar = avatar;
    this.ativo = !!ativo;
  }

  get key() {
    return String(this.id);
  }

  static transforme(d) {
    return new VendedorEntity(
      d?.id ?? d?._id ?? d?.id?.$oid ?? d?.id?.value,
      d?.nome ?? d?.name,
      d?.email,
      d?.telefone ?? d?.phone,
      d?.loja ?? d?.store,
      d?.cnpj,
      d?.dataCadastro ?? d?.registrationDate,
      d?.avatar,
      d?.ativo ?? d?.active
    );
  }
}
