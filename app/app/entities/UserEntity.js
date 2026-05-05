function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default class UserEntity {
  constructor(id, name, email, password, photo = null, phone = "", bio = "") {
    this.id = id ?? newId();
    this.name = name ?? "";
    this.email = String(email ?? "").trim().toLowerCase();
    this.password = password ?? "";
    this.photo = photo ?? null;
    this.phone = phone ?? "";
    this.bio = bio ?? "";
  }

  static transforme(data) {
    return new UserEntity(
      data?.id,
      data?.name ?? data?.nome,
      data?.email,
      data?.password ?? data?.senha,
      data?.photo,
      data?.phone,
      data?.bio
    );
  }

  toSession() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      photo: this.photo,
      phone: this.phone,
      bio: this.bio,
    };
  }
}
