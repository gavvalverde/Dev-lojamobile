function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeProfileSnapshot(profile) {
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

function normalizeListingSnapshot(listing) {
  if (!listing?.id) return null;

  return {
    id: listing.id,
    listingId: listing.listingId ?? `${listing.id}:${listing.sellerId ?? "sem-vendedor"}`,
    name: listing.name ?? "",
    images: listing.images ?? null,
    price: listing.price ?? "",
    idioma: listing.idioma ?? "",
    qualidade: listing.qualidade ?? "",
    sellerId: listing.sellerId ?? listing.seller?.id ?? null,
  };
}

export class ChatMessageEntity {
  constructor(id, conversationId, senderProfileId, text, createdAt) {
    this.id = id ?? newId();
    this.conversationId = conversationId ?? null;
    this.senderProfileId = senderProfileId ?? null;
    this.senderId = this.senderProfileId;
    this.text = String(text ?? "");
    this.createdAt = createdAt ?? new Date().toISOString();
  }

  static transforme(data, conversationId = null) {
    return new ChatMessageEntity(
      data?.id,
      data?.conversationId ?? conversationId,
      data?.senderProfileId ?? data?.senderId,
      data?.text,
      data?.createdAt
    );
  }
}

export default class ChatEntity {
  constructor(
    id,
    participantProfileIds,
    participantProfiles,
    listing,
    createdAt,
    updatedAt,
    messages
  ) {
    this.id = id ?? newId();
    this.participantProfileIds = Array.isArray(participantProfileIds)
      ? participantProfileIds.filter(Boolean)
      : [];
    this.participantIds = this.participantProfileIds;
    this.participantProfiles = Array.isArray(participantProfiles)
      ? participantProfiles.map(normalizeProfileSnapshot).filter(Boolean)
      : [];
    this.participants = this.participantProfiles;
    this.listing = normalizeListingSnapshot(listing);
    this.createdAt = createdAt ?? new Date().toISOString();
    this.updatedAt = updatedAt ?? this.createdAt;
    this.messages = Array.isArray(messages)
      ? messages.map((message) => ChatMessageEntity.transforme(message, this.id))
      : [];
  }

  belongsToProfile(profileId) {
    return this.participantProfileIds.includes(profileId);
  }

  withMessage(senderProfile, text) {
    const now = new Date().toISOString();
    const message = new ChatMessageEntity(newId(), this.id, senderProfile?.id, text, now);

    return ChatEntity.transforme({
      ...this,
      updatedAt: now,
      messages: [...this.messages, message],
    });
  }

  withUpdatedProfile(profile) {
    const nextProfile = normalizeProfileSnapshot(profile);
    if (!nextProfile || !this.belongsToProfile(nextProfile.id)) return this;

    return ChatEntity.transforme({
      ...this,
      participantProfiles: this.participantProfiles.map((participant) =>
        participant.id === nextProfile.id ? nextProfile : participant
      ),
    });
  }

  static fromProfiles({ id, currentProfile, otherProfile, listing = null }) {
    const now = new Date().toISOString();
    const conversationId = id ?? newId();
    const participantProfileIds = [currentProfile?.id, otherProfile?.id].filter(Boolean).sort();

    return ChatEntity.transforme({
      id: conversationId,
      participantProfileIds,
      participantProfiles: [
        normalizeProfileSnapshot(currentProfile),
        normalizeProfileSnapshot(otherProfile),
      ].filter(Boolean),
      listing: normalizeListingSnapshot(listing),
      createdAt: now,
      updatedAt: now,
      messages: [],
    });
  }

  static transforme(data) {
    const participants = Array.isArray(data?.participantProfiles)
      ? data.participantProfiles
      : Array.isArray(data?.participants)
        ? data.participants
        : [];
    const participantProfileIds = Array.isArray(data?.participantProfileIds)
      ? data.participantProfileIds
      : Array.isArray(data?.participantIds)
        ? data.participantIds
        : participants.map((participant) => participant?.id);

    return new ChatEntity(
      data?.id,
      participantProfileIds,
      participants,
      data?.listing,
      data?.createdAt,
      data?.updatedAt ?? data?.createdAt,
      data?.messages
    );
  }
}
