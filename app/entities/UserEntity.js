function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default class UserEntity {
  constructor(
    id,
    name,
    email,
    password,
    photo = null,
    phone = "",
    bio = "",
    coverPhoto = null,
    status = "",
    handle = "",
    location = "",
    favoritePokemon = "",
    pronouns = "",
    themeColor = "#ffc94a",
    badges = [],
    useCoverPhotoInHeader = true
  ) {
    this.id = id ?? newId();
    this.name = name ?? "";
    this.email = String(email ?? "").trim().toLowerCase();
    this.password = password ?? "";
    this.photo = photo ?? null;
    this.phone = phone ?? "";
    this.bio = bio ?? "";
    this.coverPhoto = coverPhoto ?? null;
    this.status = status ?? "";
    this.handle = handle ?? "";
    this.location = location ?? "";
    this.favoritePokemon = favoritePokemon ?? "";
    this.pronouns = pronouns ?? "";
    this.themeColor = themeColor || "#ffc94a";
    this.badges = Array.isArray(badges) ? badges : [];
    this.useCoverPhotoInHeader = useCoverPhotoInHeader ?? true;
  }

  static transforme(data) {
    return new UserEntity(
      data?.id,
      data?.name ?? data?.nome,
      data?.email,
      data?.password ?? data?.senha,
      data?.photo,
      data?.phone,
      data?.bio,
      data?.coverPhoto,
      data?.status,
      data?.handle,
      data?.location,
      data?.favoritePokemon,
      data?.pronouns,
      data?.themeColor,
      data?.badges,
      data?.useCoverPhotoInHeader
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
      coverPhoto: this.coverPhoto,
      status: this.status,
      handle: this.handle,
      location: this.location,
      favoritePokemon: this.favoritePokemon,
      pronouns: this.pronouns,
      themeColor: this.themeColor,
      badges: this.badges,
      useCoverPhotoInHeader: this.useCoverPhotoInHeader,
    };
  }
}
