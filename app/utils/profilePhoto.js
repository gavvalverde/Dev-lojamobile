const avatarOptions = [
  { id: "avatar:1", label: "Avatar 1", source: require("../../assets/images/avatar/avatar (1).webp") },
  { id: "avatar:2", label: "Avatar 2", source: require("../../assets/images/avatar/avatar (2).webp") },
  { id: "avatar:3", label: "Avatar 3", source: require("../../assets/images/avatar/avatar (3).webp") },
  { id: "avatar:4", label: "Avatar 4", source: require("../../assets/images/avatar/avatar (4).webp") },
  { id: "avatar:5", label: "Avatar 5", source: require("../../assets/images/avatar/avatar (5).webp") },
  { id: "avatar:6", label: "Avatar 6", source: require("../../assets/images/avatar/avatar (6).webp") },
  { id: "avatar:7", label: "Avatar 7", source: require("../../assets/images/avatar/avatar (7).webp") },
  { id: "avatar:8", label: "Avatar 8", source: require("../../assets/images/avatar/avatar (8).webp") },
  { id: "avatar:9", label: "Avatar 9", source: require("../../assets/images/avatar/avatar (9).webp") },
  { id: "avatar:10", label: "Avatar 10", source: require("../../assets/images/avatar/avatar (10).webp") },
  { id: "avatar:11", label: "Avatar 11", source: require("../../assets/images/avatar/avatar (11).webp") },
  { id: "avatar:12", label: "Avatar 12", source: require("../../assets/images/avatar/avatar (12).webp") },
  { id: "avatar:13", label: "Avatar 13", source: require("../../assets/images/avatar/avatar (13).webp") },
  { id: "avatar:14", label: "Avatar 14", source: require("../../assets/images/avatar/avatar (14).webp") },
  { id: "avatar:15", label: "Avatar 15", source: require("../../assets/images/avatar/avatar (15).webp") },
  { id: "avatar:16", label: "Avatar 16", source: require("../../assets/images/avatar/avatar (16).webp") },
  { id: "avatar:17", label: "Avatar 17", source: require("../../assets/images/avatar/avatar (17).webp") },
  { id: "avatar:18", label: "Avatar 18", source: require("../../assets/images/avatar/avatar (18).webp") },
];

export function getProfileAvatarOptions() {
  return avatarOptions;
}

export function getProfilePhotoSource(photo) {
  if (!photo) return null;

  if (typeof photo !== "string") {
    return photo;
  }

  const avatar = avatarOptions.find((option) => option.id === photo);
  if (avatar) {
    return avatar.source;
  }

  if (
    photo.startsWith("data:") ||
    photo.startsWith("file:") ||
    photo.startsWith("http://") ||
    photo.startsWith("https://")
  ) {
    return { uri: photo };
  }

  return { uri: photo };
}
