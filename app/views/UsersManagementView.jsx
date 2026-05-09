import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { useAppTheme } from "../services/AppThemeContext";
import { UserService } from "../services/UserService";

const quickBadges = ["Admin", "Leilao", "Vendedor", "Colecionador", "Trocas"];

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

export default function UsersManagementView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    status: "",
    phone: "",
    badges: [],
  });

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeUsers = UserService.subscribe(setUsers);

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = normalizeSearch(search);
    if (!term) return users;

    return users.filter((user) => {
      const searchable = normalizeSearch(
        `${user.name} ${user.email} ${user.handle} ${user.status} ${(user.badges ?? []).join(" ")}`
      );
      return searchable.includes(term);
    });
  }, [search, users]);

  const stats = useMemo(() => {
    const auctionUsers = users.filter((user) => user.badges?.includes("Leilao")).length;
    const adminUsers = users.filter((user) => user.badges?.includes("Admin")).length;

    return {
      total: users.length,
      auctionUsers,
      adminUsers,
    };
  }, [users]);

  const openEdit = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email ?? "",
      status: user.status ?? "",
      phone: user.phone ?? "",
      badges: Array.isArray(user.badges) ? user.badges : [],
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
      const updatedUser = await UserService.updateUser(editingUser.id, form);

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
          pronouns: updatedUser.pronouns,
          themeColor: updatedUser.themeColor,
          badges: updatedUser.badges,
        };
        AuthService.setCurrentUser(session);
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

    return (
      <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.userHeader}>
          <View style={[styles.avatar, { backgroundColor: item.themeColor || colors.accent }]}>
            <Text style={styles.avatarText}>{String(item.name || "YD").slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.userIdentity}>
            <Text style={[styles.userName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.userMeta, { color: colors.mutedText }]}>{getPublicHandle(item)}</Text>
            <Text style={[styles.userMeta, { color: colors.mutedText }]}>{item.email}</Text>
          </View>
          {isCurrent && (
            <View style={[styles.currentPill, { backgroundColor: colors.accent }]}>
              <Text style={[styles.currentText, { color: colors.onAccent }]}>Voce</Text>
            </View>
          )}
        </View>

        {!!item.status && <Text style={[styles.status, { color: colors.text }]}>{item.status}</Text>}

        <View style={styles.badges}>
          {(item.badges?.length ? item.badges : ["Sem insignias"]).map((badge) => (
            <View
              key={badge}
              style={[styles.badge, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}
            >
              <Text style={[styles.badgeText, { color: colors.text }]}>{badge}</Text>
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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Gerenciar usuarios" />

      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUser}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={[styles.summary, { backgroundColor: colors.secondary }]}>
              <View>
                <Text style={[styles.summaryTitle, { color: colors.onPrimary }]}>Usuarios</Text>
                <Text style={[styles.summaryText, { color: colors.accent }]}>
                  {stats.total} conta(s) - {stats.auctionUsers} com Leilao - {stats.adminUsers} admin
                </Text>
              </View>
              <MaterialCommunityIcons name="account-group" size={44} color={colors.accent} />
            </View>

            <TextInput
              autoCapitalize="none"
              onChangeText={setSearch}
              placeholder="Buscar por nome, email, status ou insignia"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={search}
            />
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

      <Modal animationType="slide" onRequestClose={() => setEditingUser(null)} transparent visible={!!editingUser}>
        <Pressable style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]} onPress={() => setEditingUser(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Editar usuario</Text>
              <TouchableOpacity onPress={() => setEditingUser(null)} style={styles.iconButton}>
                <MaterialCommunityIcons name="close" size={24} color={colors.mutedText} />
              </TouchableOpacity>
            </View>

            <TextInput
              onChangeText={(value) => updateForm("name", value)}
              placeholder="Nome"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
              ]}
              value={form.name}
            />
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              onChangeText={(value) => updateForm("email", value)}
              placeholder="Email"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
              ]}
              value={form.email}
            />
            <TextInput
              onChangeText={(value) => updateForm("status", value)}
              placeholder="Status"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
              ]}
              value={form.status}
            />
            <TextInput
              keyboardType="phone-pad"
              onChangeText={(value) => updateForm("phone", value)}
              placeholder="Telefone"
              placeholderTextColor={colors.mutedText}
              style={[
                styles.input,
                { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text },
              ]}
              value={form.phone}
            />

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
                      {badge}
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
  summary: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
    padding: 18,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "900",
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    minHeight: 46,
    paddingHorizontal: 12,
  },
  userCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 12,
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
    width: 48,
  },
  avatarText: {
    color: "#06243a",
    fontSize: 16,
    fontWeight: "900",
  },
  userIdentity: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: "900",
  },
  userMeta: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  currentPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  currentText: {
    fontSize: 12,
    fontWeight: "900",
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
  input: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 10,
    minHeight: 44,
    paddingHorizontal: 12,
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
