function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAuthorProfile(profile) {
  if (!profile?.id) return null;

  return {
    id: profile.id,
    profileId: profile.profileId ?? profile.id,
    name: profile.name ?? "",
    handle: profile.handle ?? "",
    photo: profile.photo ?? null,
    themeColor: profile.themeColor ?? "#ffc94a",
  };
}

export default class ProfilePostEntity {
  constructor(
    id,
    profileId,
    type,
    text,
    cardName,
    offer,
    minQuality,
    cardType,
    image,
    authorProfile,
    likes,
    reposts,
    createdAt,
    updatedAt
  ) {
    this.id = id ?? newId();
    this.profileId = profileId ?? authorProfile?.id ?? null;
    this.userId = this.profileId;
    this.type = type === "wanted" ? "wanted" : "post";
    this.text = String(text ?? "").trim();
    this.cardName = String(cardName ?? "").trim();
    this.offer = String(offer ?? "").trim();
    this.minQuality = String(minQuality ?? "").trim();
    this.cardType = String(cardType ?? "").trim();
    this.image = image ?? null;
    this.authorProfile = normalizeAuthorProfile(authorProfile);
    this.author = this.authorProfile;
    this.likes = Array.isArray(likes) ? likes : [];
    this.reposts = Array.isArray(reposts) ? reposts : [];
    this.createdAt = createdAt ?? new Date().toISOString();
    this.updatedAt = updatedAt ?? this.createdAt;
  }

  belongsToProfile(profileId) {
    return this.profileId === profileId || this.reposts.includes(profileId);
  }

  withUpdatedAuthorProfile(profile) {
    const authorProfile = normalizeAuthorProfile(profile);
    if (!authorProfile || this.profileId !== authorProfile.id) return this;

    return ProfilePostEntity.transforme({
      ...this,
      authorProfile,
    });
  }

  static fromProfile(profile, draft) {
    const now = new Date().toISOString();

    return ProfilePostEntity.transforme({
      ...draft,
      id: newId(),
      profileId: profile.id,
      authorProfile: normalizeAuthorProfile(profile),
      createdAt: now,
      updatedAt: now,
    });
  }

  static transforme(data) {
    return new ProfilePostEntity(
      data?.id,
      data?.profileId ?? data?.userId ?? data?.authorProfile?.id ?? data?.author?.id,
      data?.type,
      data?.text,
      data?.cardName,
      data?.offer,
      data?.minQuality,
      data?.cardType,
      data?.image,
      data?.authorProfile ?? data?.author,
      data?.likes,
      data?.reposts,
      data?.createdAt,
      data?.updatedAt ?? data?.createdAt
    );
  }
}
