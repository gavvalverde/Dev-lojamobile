import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import ProfileEditModal from "../components/ProfileEditModal";
import { AuthService } from "../services/AuthService";
import { UserService } from "../services/UserService";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    backgroundColor: "#007AFF",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  profilePhotoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    borderWidth: 3,
    borderColor: "#fff",
  },
  profilePhoto: {
    width: "100%",
    height: "100%",
  },
  photoPlaceholder: {
    fontSize: 50,
  },
  userName: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 14,
    color: "#e0e0e0",
  },
  contentSection: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    marginTop: 20,
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#888",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  infoRow: {
    marginBottom: 15,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  infoRowLast: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 5,
    fontWeight: "600",
  },
  infoValue: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
  },
  emptyValue: {
    color: "#bbb",
    fontStyle: "italic",
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
    backgroundColor: "#34C759",
  },
  logoutButton: {
    backgroundColor: "#ff3b30",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#999",
  },
});

export default function ProfileView() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useEffect(() => {
    const unsubscribe = AuthService.subscribe((currentUser) => {
      setUser(currentUser);
    });

    return unsubscribe;
  }, []);

  const handleEditProfile = async (updates) => {
    try {
      setLoading(true);
      const updatedUser = await UserService.updateProfile(user.id, updates);
      setUser(updatedUser);
      setEditModalVisible(false);
      Alert.alert("Sucesso", "Perfil atualizado com sucesso!");
    } catch (error) {
      Alert.alert("Erro", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sair", "Tem certeza que deseja sair?", [
      {
        text: "Cancelar",
        onPress: () => {},
        style: "cancel",
      },
      {
        text: "Sair",
        onPress: async () => {
          try {
            await AuthService.logout();
          } catch (error) {
            Alert.alert("Erro", "Falha ao sair: " + error.message);
          }
        },
        style: "destructive",
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View style={styles.profilePhotoContainer}>
            {user.photo ? (
              <Image source={{ uri: user.photo }} style={styles.profilePhoto} />
            ) : (
              <Text style={styles.photoPlaceholder}>👤</Text>
            )}
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>

        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Informações Pessoais</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Telefone</Text>
            <Text
              style={[
                styles.infoValue,
                !user.phone && styles.emptyValue,
              ]}
            >
              {user.phone || "Não informado"}
            </Text>
          </View>

          <View style={styles.infoRowLast}>
            <Text style={styles.infoLabel}>Bio</Text>
            <Text
              style={[
                styles.infoValue,
                !user.bio && styles.emptyValue,
              ]}
            >
              {user.bio || "Nenhuma bio adicionada"}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.editButton]}
            onPress={() => setEditModalVisible(true)}
            disabled={loading}
          >
            <Text style={styles.buttonText}>✏️ Editar Perfil</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.logoutButton]}
            onPress={handleLogout}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🚪 Sair</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => {
          if (!loading) {
            setEditModalVisible(false);
          }
        }}
      >
        <ProfileEditModal
          user={user}
          onSave={handleEditProfile}
          onCancel={() => setEditModalVisible(false)}
        />
      </Modal>
    </>
  );
}
