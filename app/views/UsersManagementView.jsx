import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import LoadingDuck from "../components/LoadingDuck";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { UserService } from "../services/UserService";

const auctionBadge = "Leilao";
const quickBadges = ["Duck", "Vendedor", "Colecionador", "Trocas"];
const filterBadges = ["Duck", auctionBadge, "Vendedor", "Colecionador", "Trocas"];
const userFilters = [
  { label: "Todos", value: "all" },
  { label: "Administradores", value: "admin" },
  ...filterBadges.map((badge) => ({ label: badge === auctionBadge ? "Leiloeiro" : badge, value: `badge:${badge}` })),
];

function normalizeSearch(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPublicHandle(user) {
  if (user?.handle) return `@${user.handle}`;
  return user?.email ?? "";
}

function getBadgeLabel(badge) {
  return badge === auctionBadge ? "Leiloeiro" : badge;
}

export default function UsersManagementView() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 920;
  const listColumns = isDesktop ? 2 : 1;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [users, setUsers] = useState([]);
  const [usersLoaded, setUsersLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
  const [userFilter, setUserFilter] = useState("all");
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    status: "",
    phone: "",
    badges: [],
    isAdmin: false,
  });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeUsers = UserService.subscribe((nextUsers) => {
      setUsers(nextUsers);
      setUsersLoaded(true);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const currentUserRecord = users.find((user) => user.id === currentUser?.id);
  const hasAdmin = users.some((user) => user.isAdmin);
  const canManageUsers = Boolean(currentUserRecord?.isAdmin || currentUser?.isAdmin);
  const canAccess = usersLoaded && (canManageUsers || !hasAdmin);

  const filteredUsers = useMemo(() => {
    const term = normalizeSearch(search);
    return users.filter((user) => {
      if (userFilter === "admin" && !user.isAdmin) return false;
      if (userFilter.startsWith("badge:")) {
        const badge = userFilter.slice("badge:".length);
        if (!(user.badges ?? []).includes(badge)) return false;
      }
      if (!term) return true;

      const searchable = normalizeSearch(
        `${user.name} ${user.email} ${user.handle} ${user.status} ${user.isAdmin ? "admin administrador" : ""} ${(user.badges ?? []).join(" ")}`
      );
      return searchable.includes(term);
    });
  }, [search, userFilter, users]);
  const activeFilterLabel = userFilters.find((filter) => filter.value === userFilter)?.label ?? "Todos";

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      status: user.status ?? "",
      phone: user.phone ?? "",
      badges: Array.isArray(user.badges) ? user.badges.filter((badge) => badge !== "Admin") : [],
      isAdmin: !!user.isAdmin,
    });
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const toggleBadge = (badge) => {
    setForm((current) => {
      const selected = current.badges.includes(badge);
      return {
        ...current,
        badges: selected
          ? current.badges.filter((item) => item !== badge)
          : [...current.badges, badge],
      };
    });
  };

  const saveUser = async () => {
    try {
      const updatedUser = await UserService.updateUser(editingUser.id, {
        ...form,
        badges: form.badges.filter((badge) => badge !== "Admin"),
      });

      if (updatedUser.id === currentUser?.id) {
        const session = {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          photo: updatedUser.photo,
          phone: updatedUser.phone,
          bio: updatedUser.bio,
          coverPhoto: updatedUser.coverPhoto,
          status: updatedUser.status,
          handle: updatedUser.handle,
          location: updatedUser.location,
          favoritePokemon: updatedUser.favoritePokemon,
          profileTitle: updatedUser.profileTitle,
          collectionFocus: updatedUser.collectionFocus,
          tradePreferences: updatedUser.tradePreferences,
          pronouns: updatedUser.pronouns,
          themeColor: updatedUser.themeColor,
          profileColors: updatedUser.profileColors,
          badges: updatedUser.badges,
          profilePanelOrder: updatedUser.profilePanelOrder,
          hiddenProfilePanels: updatedUser.hiddenProfilePanels,
          followingIds: updatedUser.followingIds,
          savedPostIds: updatedUser.savedPostIds,
          savedListingIds: updatedUser.savedListingIds,
          isAdmin: updatedUser.isAdmin,
        };
        void AuthService.setCurrentUser(session);
      }

      setEditingUser(null);
    } catch (error) {
      Alert.alert("Erro", error.message);
    }
  };

  const confirmDelete = (user) => {
    Alert.alert(
      "Remover usuario",
      `Deseja remover ${user.name}? Esta acao nao remove leiloes ou favoritos ja salvos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            try {
              await UserService.deleteUser(user.id);
            } catch (error) {
              Alert.alert("Erro", error.message);
            }
          },
        },
      ]
    );
  };

  const renderUser = ({ item }) => {
    const isCurrent = item.id === currentUser?.id;
    const visibleBadges = (item.badges ?? []).filter((badge) => badge !== "Admin");
    const initials = String(item.name || item.handle || "YD").slice(0, 2).toUpperCase();

    return (
      <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TouchableOpacity
          activeOpacity={0.78}
          onPress={() => router.push(`/views/ProfileView?userId=${encodeURIComponent(item.id)}`)}
          style={styles.userHeader}
        >
          <View style={[styles.avatar, { backgroundColor: item.themeColor || colors.accent }]}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.avatarImage} />
            ) : (
              <Text style={[styles.avatarText, { color: colors.onAccent }]}>{initials}</Text>
            )}
          </View>
          <View style={styles.userIdentity}>
            <Text numberOfLines={1} style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
            {item.isAdmin && (
              <View style={styles.userRoles}>
                <Text style={[styles.userRoleText, { color: colors.primary }]}>Administrador</Text>
              </View>
            )}
            <Text style={[styles.userMeta, { color: colors.mutedText }]}>{getPublicHandle(item)}</Text>
            <View style={styles.userInfoRow}>
              <MaterialCommunityIcons name="email-outline" size={14} color={colors.mutedText} />
              <Text numberOfLines={1} style={[styles.userMeta, styles.userInfoText, { color: colors.mutedText }]}>{item.email}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {!!item.status && <Text style={[styles.status, { color: colors.text }]}>{item.status}</Text>}

        <View style={styles.badges}>
          {(visibleBadges.length ? visibleBadges : ["Sem insignias"]).map((badge) => (
            <View
              key={badge}
              style={[styles.badge, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Text style={[styles.badgeText, { color: colors.text }]}>{getBadgeLabel(badge)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => openEdit(item)}
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="account-edit" size={18} color={colors.onPrimary} />
            <Text style={[styles.actionText, { color: colors.onPrimary }]}>Editar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={isCurrent}
            onPress={() => confirmDelete(item)}
            style={[
              styles.actionButton,
              styles.deleteButton,
              { borderColor: colors.danger },
              isCurrent && styles.disabledButton,
            ]}
          >
            <MaterialCommunityIcons name="trash-can" size={18} color={colors.danger} />
            <Text style={[styles.deleteText, { color: colors.danger }]}>Remover</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (!usersLoaded) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Gerenciar usuarios" />
        <View style={styles.centerState}>
          <LoadingDuck label="Carregando permissoes..." />
        </View>
      </View>
    );
  }

  if (!canAccess) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <TopDropDownMenu title="Acesso restrito" />
        <View style={styles.centerState}>
          <MaterialCommunityIcons name="shield-lock" size={44} color={colors.mutedText} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Somente administradores</Text>
          <Text style={[styles.emptyText, { color: colors.mutedText }]}>
            Entre com uma conta administradora para gerenciar usuarios.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Gerenciar usuarios" />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        key={`users-${listColumns}`}
        numColumns={listColumns}
        columnWrapperStyle={isDesktop ? styles.userGridRow : undefined}
        renderItem={renderUser}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="search" size={20} color={colors.mutedText} />
              <TextInput
                autoCapitalize="none"
                onChangeText={setSearch}
                placeholder="Buscar"
                placeholderTextColor={colors.mutedText}
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
              />
              {!!search && (
                <TouchableOpacity
                  activeOpacity={0.75}
                  onPress={() => setSearch("")}
                  style={styles.searchIconButton}
                >
                  <MaterialIcons name="close" size={20} color={colors.mutedText} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setFilterVisible(true)}
                style={[
                  styles.filterToggle,
                  {
                    backgroundColor: userFilter === "all" ? "transparent" : colors.primary,
                    borderColor: userFilter === "all" ? colors.border : colors.primary,
                  },
                ]}
              >
                <MaterialIcons
                  name="tune"
                  size={19}
                  color={userFilter === "all" ? colors.text : colors.onPrimary}
                />
              </TouchableOpacity>
            </View>

            {(userFilter !== "all" || !!search) && (
              <View style={styles.activeFilters}>
                {userFilter !== "all" && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setUserFilter("all")}
                    style={[styles.activeFilterChip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  >
                    <Text style={[styles.activeFilterText, { color: colors.onPrimary }]}>{activeFilterLabel}</Text>
                    <MaterialIcons name="close" size={16} color={colors.onPrimary} />
                  </TouchableOpacity>
                )}
                {!!search && (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() => setSearch("")}
                    style={[styles.activeFilterChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.activeFilterText, { color: colors.text }]}>{search}</Text>
                    <MaterialIcons name="close" size={16} color={colors.mutedText} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="account-search" size={42} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhum usuario encontrado</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Ajuste a busca ou crie uma nova conta pelo cadastro.
            </Text>
          </View>
        }
      />

      <Modal
        animationType="fade"
        onRequestClose={() => {
          setFilterDropdownVisible(false);
          setFilterVisible(false);
        }}
        transparent
        visible={filterVisible}
      >
        <Pressable
          style={[styles.filterBackdrop, { backgroundColor: colors.overlay }]}
          onPress={() => {
            setFilterDropdownVisible(false);
            setFilterVisible(false);
          }}
        >
          <Pressable style={[styles.filterModal, { backgroundColor: colors.surface }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.filterHeader}>
              <Text style={[styles.filterTitle, { color: colors.text }]}>Filtrar usuarios</Text>
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  setFilterDropdownVisible(false);
                  setFilterVisible(false);
                }}
                style={styles.iconButton}
              >
                <MaterialIcons name="close" size={22} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.filterLabel, { color: colors.mutedText }]}>Tipo de usuario</Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => setFilterDropdownVisible((current) => !current)}
              style={[styles.dropdownButton, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Text style={[styles.dropdownText, { color: colors.text }]}>
                {userFilters.find((filter) => filter.value === userFilter)?.label ?? "Todos"}
              </Text>
              <MaterialIcons name={filterDropdownVisible ? "expand-less" : "expand-more"} size={22} color={colors.mutedText} />
            </TouchableOpacity>

            {filterDropdownVisible && (
              <View style={styles.filterOptions}>
                {userFilters.map((filter) => {
                  const selected = userFilter === filter.value;

                  return (
                    <TouchableOpacity
                      activeOpacity={0.85}
                      key={filter.value}
                      onPress={() => {
                        setUserFilter(filter.value);
                        setFilterDropdownVisible(false);
                      }}
                      style={[
                        styles.filterOption,
                        {
                          backgroundColor: selected ? colors.primary : colors.surfaceVariant,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.filterText, { color: selected ? colors.onPrimary : colors.text }]}>
                        {filter.label}
                      </Text>
                      {selected && <MaterialIcons name="check" size={18} color={colors.onPrimary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => {
                setFilterDropdownVisible(false);
                setFilterVisible(false);
              }}
              style={[styles.filterApplyButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.filterApplyText, { color: colors.onPrimary }]}>Aplicar filtro</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setEditingUser(null)} transparent visible={!!editingUser}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setEditingUser(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar usuario</Text>
              <TouchableOpacity onPress={() => setEditingUser(null)} style={styles.iconButton}>
                <MaterialCommunityIcons name="close" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              disabled={editingUser?.isAdmin && form.isAdmin && users.filter((user) => user.isAdmin).length <= 1}
              onPress={() => updateForm("isAdmin", !form.isAdmin)}
              style={[
                styles.permissionRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceVariant },
                form.isAdmin && { borderColor: colors.primary },
                editingUser?.isAdmin && form.isAdmin && users.filter((user) => user.isAdmin).length <= 1 && styles.disabledButton,
              ]}
            >
              <View style={styles.permissionTextBlock}>
                <Text style={[styles.permissionTitle, { color: colors.text }]}>Administrador</Text>
                <Text style={[styles.permissionText, { color: colors.mutedText }]}>
                  Pode acessar todas as funcoes do app.
                </Text>
              </View>
              <MaterialCommunityIcons
                name={form.isAdmin ? "toggle-switch" : "toggle-switch-off-outline"}
                size={34}
                color={form.isAdmin ? colors.primary : colors.mutedText}
              />
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => toggleBadge(auctionBadge)}
              style={[
                styles.permissionRow,
                { borderColor: colors.border, backgroundColor: colors.surfaceVariant },
                form.badges.includes(auctionBadge) && { borderColor: colors.primary },
              ]}
            >
              <View style={styles.permissionTextBlock}>
                <Text style={[styles.permissionTitle, { color: colors.text }]}>Leiloeiro</Text>
                <Text style={[styles.permissionText, { color: colors.mutedText }]}>
                  Permite ao usuario criar e conduzir leiloes.
                </Text>
              </View>
              <MaterialCommunityIcons
                name={form.badges.includes(auctionBadge) ? "toggle-switch" : "toggle-switch-off-outline"}
                size={34}
                color={form.badges.includes(auctionBadge) ? colors.primary : colors.mutedText}
              />
            </TouchableOpacity>

            <Text style={[styles.modalLabel, { color: colors.mutedText }]}>Insignias</Text>
            <View style={styles.quickBadges}>
              {quickBadges.map((badge) => {
                const selected = form.badges.includes(badge);
                return (
                  <TouchableOpacity
                    activeOpacity={0.85}
                    key={badge}
                    onPress={() => toggleBadge(badge)}
                    style={[
                      styles.quickBadge,
                      { borderColor: colors.border },
                      selected && { backgroundColor: colors.accent, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.quickBadgeText, { color: selected ? colors.onAccent : colors.text }]}>
                      {getBadgeLabel(badge)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.85}
              onPress={saveUser}
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>Salvar alteracoes</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 14,
    paddingBottom: 90,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    minHeight: 44,
    paddingVertical: 10,
  },
  searchIconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  activeFilters: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  activeFilterChip: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 10,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: "900",
  },
  filterToggle: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  filterBackdrop: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  filterModal: {
    borderRadius: 8,
    maxWidth: 420,
    padding: 14,
    width: "100%",
  },
  filterHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 10,
  },
  filterTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "900",
  },
  filterOptions: {
    gap: 8,
    marginTop: 8,
  },
  filterOption: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 12,
  },
  filterText: {
    fontSize: 13,
    fontWeight: "900",
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  dropdownButton: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 46,
    paddingHorizontal: 12,
  },
  dropdownText: {
    fontSize: 14,
    fontWeight: "800",
  },
  filterApplyButton: {
    alignItems: "center",
    borderRadius: 8,
    justifyContent: "center",
    marginTop: 12,
    minHeight: 44,
  },
  filterApplyText: {
    fontSize: 14,
    fontWeight: "900",
  },
  userCard: {
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginBottom: 12,
    padding: 12,
  },
  userGridRow: {
    gap: 12,
  },
  userHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  avatar: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    overflow: "hidden",
    width: 48,
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarText: {
    fontSize: 16,
    fontWeight: "900",
  },
  userIdentity: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    flex: 1,
    fontSize: 17,
    fontWeight: "900",
    minWidth: 0,
  },
  userRoles: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  userRoleText: {
    fontSize: 11,
    fontWeight: "900",
  },
  userMeta: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  userInfoRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  userInfoText: {
    flex: 1,
    minWidth: 0,
  },
  status: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "800",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    alignItems: "center",
    borderRadius: 8,
    flex: 1,
    flexDirection: "row",
    gap: 7,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 10,
  },
  actionText: {
    fontWeight: "900",
  },
  deleteButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  deleteText: {
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    padding: 16,
  },
  modalHeader: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "900",
  },
  iconButton: {
    alignItems: "center",
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  permissionRow: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    minHeight: 62,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  permissionTextBlock: {
    flex: 1,
  },
  permissionTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  permissionText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  quickBadges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  quickBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickBadgeText: {
    fontSize: 13,
    fontWeight: "900",
  },
  saveButton: {
    alignItems: "center",
    borderRadius: 8,
    minHeight: 46,
    justifyContent: "center",
  },
  saveText: {
    fontSize: 15,
    fontWeight: "900",
  },
});
