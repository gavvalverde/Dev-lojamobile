import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";

export default function AdminView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [users, setUsers] = useState([]);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeUsers = UserService.subscribe(setUsers);

    return () => {
      unsubscribeAuth();
      unsubscribeUsers();
    };
  }, []);

  const currentUserRecord = useMemo(
    () => users.find((user) => user.id === currentUser?.id) ?? currentUser,
    [currentUser, users]
  );
  const hasAdmin = users.some((user) => user.isAdmin);
  const canManageUsers = currentUser?.isAdmin || currentUserRecord?.isAdmin || !hasAdmin;
  const canManageProducts = currentUser?.isAdmin || currentUserRecord?.isAdmin || !hasAdmin;

  const items = [
    {
      description: "Cadastrar produtos lacrados para venda.",
      enabled: canManageProducts,
      icon: "package-variant-closed",
      label: "Gerenciar produtos",
      path: "/views/InsertProductView",
    },
    {
      description: "Controlar imagens e produtos em destaque na Home.",
      enabled: canManageProducts,
      icon: "view-carousel-outline",
      label: "Carrossel",
      path: "/views/CarouselManagementView",
    },
    {
      description: "Gerenciar usuarios, tags e permissoes.",
      enabled: canManageUsers,
      icon: "account-group-outline",
      label: "Usuarios",
      path: "/views/UsersManagementView",
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu showBack={false} title="Administracao" />
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Administracao</Text>
        <Text style={[styles.subtitle, { color: colors.mutedText }]}>
          Ferramentas para gerenciar produtos, destaques e usuarios.
        </Text>

        <View style={styles.grid}>
          {items.map((item) => (
            <TouchableOpacity
              activeOpacity={0.86}
              disabled={!item.enabled}
              key={item.path}
              onPress={() => router.push(`${item.path}?backTo=${encodeURIComponent("/views/AdminView")}`)}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                !item.enabled && styles.disabledCard,
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialCommunityIcons
                  name={item.icon}
                  size={27}
                  color={item.enabled ? colors.primary : colors.mutedText}
                />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>{item.label}</Text>
                <Text style={[styles.cardDescription, { color: colors.mutedText }]}>
                  {item.enabled ? item.description : "Sem permissao para acessar."}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color={colors.mutedText} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    alignSelf: "center",
    maxWidth: 760,
    padding: 14,
    paddingBottom: 96,
    width: "100%",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginTop: 4,
  },
  grid: {
    gap: 10,
    marginTop: 14,
  },
  card: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 82,
    padding: 12,
  },
  disabledCard: {
    opacity: 0.55,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 8,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  cardDescription: {
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
    marginTop: 3,
  },
});
