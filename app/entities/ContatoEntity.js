export default class ContatoEntity {
  constructor(id, nome, email, telefone, avatar, favorito = false, categoria = "", sexo = "") {
    this.id = id == null ? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : String(id);
    this.nome = nome ?? "";
    this.email = String(email ?? "").trim().toLowerCase();
    this.telefone = telefone ?? "";
    this.avatar = avatar ?? "";
    this.favorito = !!favorito;
    this.categoria = categoria ?? "";
    this.sexo = sexo ?? "";
  }

  get key() {
    return String(this.id);
  }

  static transforme(d) {
    if (!d) return null;

    return new ContatoEntity(
      d?.id ?? d?._id ?? (d?.id?.$oid ?? null),
      d?.nome ?? d?.name,
      d?.email,
      d?.telefone ?? d?.phone,
      d?.avatar ?? d?.photo,
      d?.favorito ?? d?.favorite ?? 0,
      d?.categoria ?? d?.category ?? "",
      d?.sexo ?? d?.gender ?? ""
    );
  }
}
