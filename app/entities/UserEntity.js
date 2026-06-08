function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProfileColors(profileColors, fallbackPrimary = "#ffc94a") {
  const source = profileColors && typeof profileColors === "object" ? profileColors : {};

  return {
    primary: source.primary || fallbackPrimary || "#ffc94a",
    theme: source.theme || "custom",
    background: source.background || "",
    surface: source.surface || "",
    text: source.text || "",
    mutedText: source.mutedText || "",
    border: source.border || "",
  };
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
    profileTitle = "",
    collectionFocus = "",
    tradePreferences = "",
    pronouns = "",
    themeColor = "#ffc94a",
    profileColors = null,
    badges = [],
    profilePanelOrder = [],
    hiddenProfilePanels = [],
    showcaseCardIds = [],
    followingIds = [],
    savedPostIds = [],
    savedListingIds = [],
    isAdmin = false,
    pushTokens = [],
    experience = 0,
    lastDailyLoginDate = "",
    dailyLoginStreak = 0,
    bestDailyLoginStreak = 0
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
    this.profileTitle = profileTitle ?? "";
    this.collectionFocus = collectionFocus ?? "";
    this.tradePreferences = tradePreferences ?? "";
    this.pronouns = pronouns ?? "";
    this.profileColors = normalizeProfileColors(profileColors, themeColor);
    this.themeColor = this.profileColors.primary;
    this.badges = Array.isArray(badges) ? badges : [];
    this.profilePanelOrder = Array.isArray(profilePanelOrder) ? profilePanelOrder : [];
    this.hiddenProfilePanels = Array.isArray(hiddenProfilePanels) ? hiddenProfilePanels : [];
    this.showcaseCardIds = Array.isArray(showcaseCardIds) ? showcaseCardIds : [];
    this.followingIds = Array.isArray(followingIds) ? followingIds : [];
    this.savedPostIds = Array.isArray(savedPostIds) ? savedPostIds : [];
    this.savedListingIds = Array.isArray(savedListingIds) ? savedListingIds : [];
    this.isAdmin = Boolean(isAdmin || this.badges.includes("Admin"));
    this.pushTokens = Array.isArray(pushTokens) ? pushTokens : [];
    this.experience = Math.max(0, Number(experience) || 0);
    this.lastDailyLoginDate = lastDailyLoginDate ?? "";
    this.dailyLoginStreak = Math.max(0, Number(dailyLoginStreak) || 0);
    this.bestDailyLoginStreak = Math.max(this.dailyLoginStreak, Number(bestDailyLoginStreak) || 0);
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
      data?.profileTitle,
      data?.collectionFocus,
      data?.tradePreferences,
      data?.pronouns,
      data?.themeColor,
      data?.profileColors,
      data?.badges,
      data?.profilePanelOrder,
      data?.hiddenProfilePanels,
      data?.showcaseCardIds,
      data?.followingIds,
      data?.savedPostIds,
      data?.savedListingIds,
      data?.isAdmin,
      data?.pushTokens,
      data?.experience,
      data?.lastDailyLoginDate,
      data?.dailyLoginStreak,
      data?.bestDailyLoginStreak
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
      profileTitle: this.profileTitle,
      collectionFocus: this.collectionFocus,
      tradePreferences: this.tradePreferences,
      pronouns: this.pronouns,
      themeColor: this.themeColor,
      profileColors: this.profileColors,
      badges: this.badges,
      profilePanelOrder: this.profilePanelOrder,
      hiddenProfilePanels: this.hiddenProfilePanels,
      showcaseCardIds: this.showcaseCardIds,
      followingIds: this.followingIds,
      savedPostIds: this.savedPostIds,
      savedListingIds: this.savedListingIds,
      isAdmin: this.isAdmin,
      experience: this.experience,
      lastDailyLoginDate: this.lastDailyLoginDate,
      dailyLoginStreak: this.dailyLoginStreak,
      bestDailyLoginStreak: this.bestDailyLoginStreak,
    };
  }
}
