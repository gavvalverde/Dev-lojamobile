import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, useRef, useEffect } from "react";
import {
  ImageBackground,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  Animated,
  View,
} from "react-native";
import { useAppTheme } from "../services/AppThemeContext";
import { AuthService } from "../services/AuthService";

const menuItems = [
  { label: "Catálogo TCG", path: "/views/HomeView" },
  { label: "Favoritos", path: "/views/FavoritesView" },
  { label: "Minhas Cartas", path: "/views/MyCardsView" },
  { label: "Mensagens", path: "/views/ChatsView" },
  { label: "Leilões", path: "/views/AuctionView" },
  { label: "Usuários", path: "/views/UsersManagementView" },
];

export default function TopDropDownMenu({ title = "Yellow Duck TCG", backgroundImage = null }) {
  const [visible, setVisible] = useState(false);
  const menuAnim = useRef(new Animated.Value(-20)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;

  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const colors = theme.colors;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(menuAnim, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(menuOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      menuAnim.setValue(-20);
      menuOpacity.setValue(0);
    }
  }, [visible]);

  const openMenu = () => setVisible(true);
  const closeMenu = () => setVisible(false);

  const navigate = (path) => {
    closeMenu();
    router.push(path);
  };

  const logout = async () => {
    closeMenu();
    await AuthService.logout();
    router.replace("/views/LoginView");
  };

  const headerContent = (
    <>
      {backgroundImage && <View style={styles.headerOverlay} />}
      <TouchableOpacity
        accessibilityLabel="Abrir menu"
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={openMenu}
        style={styles.menuButton}
      >
        <MaterialIcons name="menu" size={28} color={colors.accent} />
      </TouchableOpacity>

      <Text numberOfLines={1} style={[styles.title, { color: colors.onPrimary }]}>
        {title}
      </Text>

      <TouchableOpacity
        accessibilityLabel={isDarkMode ? "Ativar modo claro" : "Ativar modo escuro"}
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={toggleTheme}
        style={styles.themeButton}
      >
        <MaterialIcons
          name={isDarkMode ? "light-mode" : "dark-mode"}
          size={24}
          color={colors.accent}
        />
      </TouchableOpacity>
    </>
  );

  return (
    <>
      {backgroundImage ? (
        <ImageBackground
          source={{ uri: backgroundImage }}
          style={[styles.header, { backgroundColor: colors.secondary }]}
          imageStyle={styles.headerImage}
        >
          {headerContent}
        </ImageBackground>
      ) : (
        <View style={[styles.header, { backgroundColor: colors.secondary }]}>
          {headerContent}
        </View>
      )}

      <Modal
        animationType="fade"
        onRequestClose={closeMenu}
        transparent
        visible={visible}
      >
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <Animated.View style={[
            styles.menu, 
            { backgroundColor: colors.surface, opacity: menuOpacity, transform: [{ translateY: menuAnim }] }
          ]}>
            {menuItems.map((item) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={item.path}
                onPress={() => navigate(item.path)}
                style={styles.menuItem}
              >
                <Text style={[styles.menuText, { color: colors.text }]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={logout}
              style={[styles.menuItem, styles.logoutItem, { borderTopColor: colors.border }]}
            >
              <Text style={[styles.logoutText, { color: colors.danger }]}>Sair</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    backgroundColor: "#fff",
    elevation: 4,
    flexDirection: "row",
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  headerImage: {
    resizeMode: "cover",
  },
  menuButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
    zIndex: 1,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
    zIndex: 1,
  },
  themeButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
    zIndex: 1,
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    borderRadius: 6,
    elevation: 6,
    left: 8,
    minWidth: 190,
    overflow: "hidden",
    paddingVertical: 6,
    position: "absolute",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    top: 56,
  },
  menuItem: {
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  menuText: {
    color: "#222",
    fontSize: 16,
    fontWeight: "600",
  },
  logoutItem: {
    borderTopWidth: 1,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
