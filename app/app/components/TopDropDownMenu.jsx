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
import { AuthService } from "../services/AuthService";

const menuItems = [
  { label: "Catalogo", path: "/home" },
  { label: "Favoritos", path: "/favorites" },
];

export default function TopDropDownMenu({ title = "Minha Loja Pokemon" }) {
  const [visible, setVisible] = useState(false);

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
    <View style={styles.header}>
      <TouchableOpacity
        accessibilityLabel="Abrir menu"
        accessibilityRole="button"
        activeOpacity={0.75}
        onPress={openMenu}
        style={styles.menuButton}
      >
        <MaterialIcons name="menu" size={28} color="#222" />
      </TouchableOpacity>

      <Text numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      <Modal
        animationType="fade"
        onRequestClose={closeMenu}
        transparent
        visible={visible}
      >
        <Pressable style={styles.backdrop} onPress={closeMenu}>
          <View style={styles.menu}>
            {menuItems.map((item) => (
              <TouchableOpacity
                activeOpacity={0.8}
                key={item.path}
                onPress={() => navigate(item.path)}
                style={styles.menuItem}
              >
                <Text style={styles.menuText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={logout}
              style={[styles.menuItem, styles.logoutItem]}
            >
              <Text style={styles.logoutText}>Sair</Text>
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
  menuButton: {
    alignItems: "center",
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  title: {
    color: "#222",
    flex: 1,
    fontSize: 22,
    fontWeight: "700",
  },
  backdrop: {
    flex: 1,
  },
  menu: {
    backgroundColor: "#fff",
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
    borderTopColor: "#eee",
    borderTopWidth: 1,
  },
  logoutText: {
    color: "#ef5350",
    fontSize: 16,
    fontWeight: "700",
  },
});
