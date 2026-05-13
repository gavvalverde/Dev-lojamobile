import { MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAppTheme } from "../services/AppThemeContext";
import { AuthService } from "../services/AuthService";

const menuItems = [
  { label: "Usuarios", path: "/views/UsersManagementView" }
];

export default function TopDropDownMenu({ title = "Yellow Duck TCG", variant = "brand" }) {
  const [visible, setVisible] = useState(false);
  const { isDarkMode, theme, toggleTheme } = useAppTheme();
  const colors = theme.colors;
  const isSurface = variant === "surface";

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

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: isSurface ? colors.surface : colors.secondary,
          borderBottomColor: isSurface ? colors.border : "transparent",
        },
        isSurface && styles.surfaceHeader,
      ]}
    >
      <TouchableOpacity
        accessibilityLabel="Abrir menu"
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={openMenu}
        style={styles.menuButton}
      >
        <MaterialIcons name="menu" size={28} color={isSurface ? colors.text : colors.accent} />
      </TouchableOpacity>

      <Text numberOfLines={1} style={[styles.title, { color: isSurface ? colors.text : colors.onPrimary }]}>
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
          color={isSurface ? colors.primary : colors.accent}
        />
      </TouchableOpacity>

      <Modal
        animationType="fade"
        onRequestClose={closeMenu}
        transparent
        visible={visible}
      >
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <View style={[styles.menu, { backgroundColor: colors.surface }]}>
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
    gap: 8,
    minHeight: 64,
    paddingHorizontal: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  surfaceHeader: {
    borderBottomWidth: 1,
    elevation: 0,
    shadowOpacity: 0,
  },
  menuButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
  },
  themeButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
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
