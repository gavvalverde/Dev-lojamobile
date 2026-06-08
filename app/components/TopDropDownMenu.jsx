import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams, usePathname } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../services/AppThemeContext";
import { AuthService } from "../services/AuthService";
import { CartService } from "../services/CartService";
import { NotificationService } from "../services/NotificationService";
import { PushNotificationService } from "../services/PushNotificationService";
import { UserService } from "../services/UserService";

const menuItems = [
  { icon: "style", label: "Deck Builder", path: "/views/DeckBuilderView" },
  { icon: "storefront", label: "Painel vendedor", path: "/views/SellerDashboardView" },
  { icon: "admin-panel-settings", label: "Administracao", path: "/views/AdminView" },
];

const rootPages = new Set([
  "/",
  "/views/HomeView",
  "/views/FavoritesView",
  "/views/DeckBuilderView",
  "/views/AuctionView",
  "/views/ChatView",
]);

const appTitle = "Yellow Duck TCG";

function normalizeTag(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasBadge(user, badge) {
  const expectedBadge = normalizeTag(badge);
  return (user?.badges ?? []).some((item) => normalizeTag(item) === expectedBadge);
}

export default function TopDropDownMenu({ showBack = true, variant = "brand" }) {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [cartItems, setCartItems] = useState([]);
  const [users, setUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const colors = theme.colors;
  const isSurface = variant === "surface";
  const isDesktop = width >= 900;
  const topInset = isDesktop ? 0 : insets.top;

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeCart = CartService.subscribe(setCartItems);
    const unsubscribeNotifications = NotificationService.subscribe(setNotifications);
    const unsubscribeUsers = UserService.subscribe(setUsers);

    return () => {
      unsubscribeAuth();
      unsubscribeCart();
      unsubscribeNotifications();
      unsubscribeUsers();
    };
  }, []);

  useEffect(() => {
    if (!currentUser?.id) return;

    PushNotificationService.registerForUser(currentUser.id).catch((error) => {
      console.error("Erro ao registrar notificacoes push:", error);
    });
  }, [currentUser?.id]);

  useEffect(() => {
    return PushNotificationService.subscribeToResponses((data) => {
      if (data.type === "message" && data.conversationId) {
        router.push(`/views/ChatView?conversationId=${encodeURIComponent(data.conversationId)}`);
        return;
      }

      if (data.type === "order" || data.type === "review") {
        router.push(data.orderRole === "seller" ? "/views/SellerDashboardView?tab=orders" : "/views/HomeView");
        return;
      }

      if (data.type === "price_drop" && data.listingId) {
        router.push(`/views/CardDetailsView?id=${encodeURIComponent(data.listingId)}`);
        return;
      }

      router.push("/views/HomeView");
    });
  }, []);

  const userNotifications = useMemo(
    () => notifications.filter((notification) => notification.userId === currentUser?.id),
    [currentUser?.id, notifications]
  );
  const hasAdmin = users.some((user) => user.isAdmin);
  const currentUserRecord = users.find((user) => user.id === currentUser?.id) ?? currentUser;
  const visibleMenuItems = menuItems.filter((item) => {
    if (item.adminOnly && !currentUser?.isAdmin && !currentUserRecord?.isAdmin && hasAdmin) {
      return false;
    }

    if (item.requiredBadge && !hasBadge(currentUserRecord, item.requiredBadge) && !hasBadge(currentUser, item.requiredBadge)) {
      return false;
    }

    return true;
  });
  const unreadCount = userNotifications.filter((notification) => !notification.readAt).length;
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);
  const showBackButton = showBack && !rootPages.has(pathname);
  const backTo = typeof params.backTo === "string" ? params.backTo : null;
  const accountName = currentUserRecord?.name || currentUserRecord?.email || "Minha conta";
  const accountSubtitle = currentUserRecord?.isAdmin ? "Administrador" : "Yellow Duck";
  const accountInitial = accountName.trim().charAt(0).toUpperCase() || "Y";
  const accountPhoto = currentUserRecord?.photo || currentUser?.photo || null;

  const navigate = (path) => {
    closeMenu();
    router.push(path);
  };

  const logout = async () => {
    closeMenu();
    await AuthService.logout();
    router.replace("/views/LoginView");
  };

  const openNotifications = () => {
    setNotificationsVisible(true);
  };

  const openCart = () => {
    router.push("/views/CartView");
  };

  const closeNotifications = () => {
    setNotificationsVisible(false);
  };

  const markNotificationsRead = async () => {
    await NotificationService.markAllRead(currentUser?.id);
  };

  const openNotification = (notification) => {
    closeNotifications();

    if (notification.type === "message" && notification.conversationId) {
      router.push(`/views/ChatView?conversationId=${encodeURIComponent(notification.conversationId)}`);
      return;
    }

    if (notification.type === "follow" && notification.actorUserId) {
      router.push(`/views/ProfileView?userId=${encodeURIComponent(notification.actorUserId)}`);
      return;
    }

    if (notification.type === "order" || notification.type === "review") {
      router.push(notification.orderRole === "seller" ? "/views/SellerDashboardView?tab=orders" : "/views/HomeView");
      return;
    }

    if (notification.type === "price_drop" && notification.listingId) {
      router.push(`/views/CardDetailsView?id=${encodeURIComponent(notification.listingId)}`);
      return;
    }

    router.push("/views/HomeView");
  };

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: isSurface ? colors.surface : colors.secondary,
          borderBottomColor: isSurface ? colors.border : "transparent",
          paddingTop: topInset,
          shadowColor: colors.shadow,
        },
        isSurface && styles.surfaceHeader,
      ]}
    >
      <View style={[styles.headerInner, isDesktop && styles.desktopHeaderInner]}>
        <View style={styles.navigationCluster}>
          {showBackButton && (
            <TouchableOpacity
              accessibilityLabel="Voltar"
              accessibilityRole="button"
              activeOpacity={0.75}
              onPress={() => {
                if (backTo) {
                  router.replace(backTo);
                  return;
                }

                if (router.canGoBack?.()) {
                  router.back();
                  return;
                }

                router.replace("/views/HomeView");
              }}
              style={styles.headerIconButton}
            >
              <MaterialIcons name="arrow-back" size={23} color={isSurface ? colors.text : colors.accent} />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            accessibilityLabel="Abrir menu"
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={openMenu}
            style={styles.headerIconButton}
          >
            <MaterialIcons name="menu" size={25} color={isSurface ? colors.text : colors.accent} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={[styles.title, isDesktop && styles.desktopTitle, { color: isSurface ? colors.text : colors.onPrimary }]}>
            {appTitle}
          </Text>
        </View>

        <View style={styles.actionsCluster}>
          <TouchableOpacity
            accessibilityLabel="Abrir carrinho"
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={openCart}
            style={styles.headerIconButton}
          >
            <MaterialIcons
              name="shopping-cart"
              size={22}
              color={isSurface ? colors.primary : colors.accent}
            />
            {cartCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: colors.danger }]}>
                <Text style={[styles.notificationBadgeText, { color: colors.onPrimary }]}>
                  {cartCount > 9 ? "9+" : cartCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Abrir notificacoes"
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={openNotifications}
            style={styles.headerIconButton}
          >
            <MaterialIcons
              name={unreadCount > 0 ? "notifications-active" : "notifications-none"}
              size={22}
              color={isSurface ? colors.primary : colors.accent}
            />
            {unreadCount > 0 && (
              <View style={[styles.notificationBadge, { backgroundColor: colors.danger }]}>
                <Text style={[styles.notificationBadgeText, { color: colors.onPrimary }]}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
            accessibilityRole="button"
            activeOpacity={0.75}
            onPress={toggleTheme}
            style={styles.headerIconButton}
          >
            <MaterialIcons
              name={isDarkMode ? "light-mode" : "dark-mode"}
              size={22}
              color={isSurface ? colors.primary : colors.accent}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        animationType="fade"
        onRequestClose={closeMenu}
        transparent
        visible={visible}
      >
        <Pressable style={[styles.backdrop, styles.menuBackdrop]} onPress={closeMenu}>
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
                top: 54 + topInset,
              },
            ]}
          >
            <View style={[styles.menuHeader, { borderBottomColor: colors.border }]}>
              <View style={[styles.menuAvatar, { backgroundColor: colors.primary }]}>
                {accountPhoto ? (
                  <Image source={{ uri: accountPhoto }} style={styles.menuAvatarImage} />
                ) : (
                  <Text style={[styles.menuAvatarText, { color: colors.onPrimary }]}>{accountInitial}</Text>
                )}
              </View>
              <View style={styles.menuAccountText}>
                <Text numberOfLines={1} style={[styles.menuAccountName, { color: colors.text }]}>
                  {accountName}
                </Text>
                <Text numberOfLines={1} style={[styles.menuAccountSubtitle, { color: colors.mutedText }]}>
                  {accountSubtitle}
                </Text>
              </View>
            </View>

            <View style={styles.menuItems}>
              {visibleMenuItems.map((item) => {
                const isActive = pathname === item.path;

                return (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    key={item.path}
                    onPress={() => navigate(item.path)}
                    style={[
                      styles.menuItem,
                      { backgroundColor: isActive ? colors.surfaceVariant : "transparent" },
                    ]}
                  >
                    <View
                      style={[
                        styles.menuIconBadge,
                        { backgroundColor: isActive ? colors.primary : colors.surfaceVariant },
                      ]}
                    >
                      <MaterialIcons
                        name={item.icon}
                        size={18}
                        color={isActive ? colors.onPrimary : colors.primary}
                      />
                    </View>
                    <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
                    {isActive && <MaterialIcons name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={logout}
              style={[styles.menuItem, styles.logoutItem, { borderTopColor: colors.border }]}
            >
              <View style={[styles.menuIconBadge, { backgroundColor: colors.surfaceVariant }]}>
                <MaterialIcons name="logout" size={18} color={colors.danger} />
              </View>
              <Text style={[styles.logoutText, { color: colors.danger }]}>Sair</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeNotifications}
        transparent
        visible={notificationsVisible}
      >
        <Pressable style={styles.backdrop} onPress={closeNotifications}>
          <View
            style={[
              styles.notificationsPanel,
              { backgroundColor: colors.surface, shadowColor: colors.shadow, top: 56 + topInset },
            ]}
          >
            <View style={[styles.notificationsHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.notificationsTitle, { color: colors.text }]}>Notificacoes</Text>
              {unreadCount > 0 && (
                <TouchableOpacity activeOpacity={0.85} onPress={markNotificationsRead}>
                  <Text style={[styles.markReadText, { color: colors.primary }]}>Marcar lidas</Text>
                </TouchableOpacity>
              )}
            </View>

            {userNotifications.length === 0 ? (
              <View style={styles.emptyNotifications}>
                <MaterialIcons name="notifications-none" size={28} color={colors.mutedText} />
                <Text style={[styles.emptyNotificationsText, { color: colors.mutedText }]}>
                  Nada novo por enquanto.
                </Text>
              </View>
            ) : (
              userNotifications.slice(0, 12).map((notification) => (
                <TouchableOpacity
                  activeOpacity={0.85}
                  key={notification.id}
                  onPress={() => openNotification(notification)}
                  style={[styles.notificationItem, { borderBottomColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.notificationDot,
                      { backgroundColor: notification.readAt ? colors.border : colors.primary },
                    ]}
                  />
                  <View style={styles.notificationTextBlock}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>
                      {notification.title}
                    </Text>
                    <Text style={[styles.notificationBody, { color: colors.mutedText }]}>
                      {notification.body}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    borderBottomWidth: 0,
    elevation: 4,
    flexDirection: "row",
    minHeight: 56,
    paddingHorizontal: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  headerInner: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  desktopHeaderInner: {
    alignSelf: "center",
    maxWidth: 1180,
  },
  surfaceHeader: {
    borderBottomWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  navigationCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
    minWidth: 42,
  },
  actionsCluster: {
    alignItems: "center",
    flexDirection: "row",
    gap: 2,
  },
  headerIconButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 40,
    justifyContent: "center",
    width: 38,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0,
  },
  desktopTitle: {
    fontSize: 22,
    fontWeight: "900",
  },
  notificationBadge: {
    alignItems: "center",
    borderRadius: 8,
    minWidth: 16,
    paddingHorizontal: 4,
    position: "absolute",
    right: 2,
    top: 3,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: "900",
  },
  backdrop: {
    flex: 1,
  },
  menuBackdrop: {
    backgroundColor: "rgba(15, 23, 42, 0.12)",
  },
  menu: {
    borderRadius: 8,
    borderWidth: 1,
    elevation: 10,
    left: 10,
    maxWidth: 320,
    minWidth: 270,
    overflow: "hidden",
    paddingVertical: 8,
    position: "absolute",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    top: 56,
  },
  menuHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
    paddingBottom: 12,
    paddingHorizontal: 14,
    paddingTop: 6,
  },
  menuAvatar: {
    alignItems: "center",
    borderRadius: 19,
    height: 38,
    justifyContent: "center",
    overflow: "hidden",
    width: 38,
  },
  menuAvatarImage: {
    height: "100%",
    width: "100%",
  },
  menuAvatarText: {
    fontSize: 16,
    fontWeight: "900",
  },
  menuAccountText: {
    flex: 1,
    minWidth: 0,
  },
  menuAccountName: {
    fontSize: 14,
    fontWeight: "900",
  },
  menuAccountSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  menuItems: {
    gap: 2,
    paddingHorizontal: 8,
  },
  menuItem: {
    alignItems: "center",
    borderRadius: 8,
    flexDirection: "row",
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 10,
  },
  menuIconBadge: {
    alignItems: "center",
    borderRadius: 8,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  menuText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
  },
  logoutItem: {
    borderTopWidth: 1,
    marginHorizontal: 8,
    marginTop: 8,
    paddingTop: 10,
  },
  logoutText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "900",
  },
  notificationsPanel: {
    borderRadius: 8,
    elevation: 8,
    maxHeight: 420,
    overflow: "hidden",
    position: "absolute",
    right: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    width: 320,
  },
  notificationsHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notificationsTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  markReadText: {
    fontSize: 12,
    fontWeight: "900",
  },
  emptyNotifications: {
    alignItems: "center",
    gap: 8,
    padding: 24,
  },
  emptyNotificationsText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  notificationItem: {
    alignItems: "flex-start",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  notificationDot: {
    borderRadius: 5,
    height: 10,
    marginTop: 4,
    width: 10,
  },
  notificationTextBlock: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  notificationBody: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
});
