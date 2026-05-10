import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { UserService } from "../services/UserService";
import { useAppTheme } from "../services/AppThemeContext";
import { ChatService } from "../services/ChatService";

// Página mostrando todos os chats com opção de excluir (nível estudante)
export default function ChatsView() {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const router = useRouter();

  const [chats, setChats] = useState([]);
  const [search, setSearch] = useState("");
  const [userCoverPhoto, setUserCoverPhoto] = useState("");
  const [useCoverPhotoInHeader, setUseCoverPhotoInHeader] = useState(true);

  useEffect(() => {
    const fetchUserCover = async () => {
      const session = await UserService.getSession();
      if (session?.coverPhoto) {
        setUserCoverPhoto(session.coverPhoto);
      }
      if ('useCoverPhotoInHeader' in session) {
        setUseCoverPhotoInHeader(session.useCoverPhotoInHeader);
      }
    };
    fetchUserCover();
  }, []);

  useEffect(() => {
    // Subscribe ao serviço para receber atualizações
    const unsubscribe = ChatService.subscribe(setChats);
    return () => unsubscribe();
  }, []);

  function handleOpenChat(chat) {
    // Navega para uma view de detalhe do chat (pode ser criada depois)
    router.push(`/views/ChatDetailView?id=${chat.id}`);
  }

  function handleDelete(chat) {
    Alert.alert("Excluir chat", `Excluir conversa com ${chat.seller}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => ChatService.deleteChat(chat.id),
      },
    ]);
  }

  const renderItem = ({ item }) => (
    <View style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
      <View style={styles.itemLeft}>
        <Text style={[styles.seller, { color: colors.text }]}>{item.seller}</Text>
        <Text numberOfLines={1} style={[styles.lastMessage, { color: colors.mutedText }]}>
          {item.lastMessage || "Sem mensagens ainda"}
        </Text>
      </View>

      <View style={styles.itemRight}>
        <TouchableOpacity onPress={() => handleOpenChat(item)} style={[styles.openButton, { backgroundColor: colors.primary }]}> 
          <Text style={styles.openButtonText}>Abrir</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
          <Text style={[styles.deleteText, { color: colors.danger }]}>Excluir</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}> 
      <TopDropDownMenu title="Mensagens" backgroundImage={useCoverPhotoInHeader ? userCoverPhoto : null} />

      <FlatList
        data={chats}
        keyExtractor={(i) => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.listContainer, chats.length === 0 && styles.emptyList]}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma conversa</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>As conversas com vendedores aparecerão aqui.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContainer: { padding: 12 },
  emptyList: { flexGrow: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center" },
  item: {
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    marginBottom: 10,
    alignItems: "center",
  },
  itemLeft: { flex: 1, paddingRight: 8 },
  seller: { fontSize: 16, fontWeight: "800" },
  lastMessage: { fontSize: 13, marginTop: 4 },
  itemRight: { alignItems: "flex-end" },
  openButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 6 },
  openButtonText: { color: "#fff", fontWeight: "700" },
  deleteButton: { paddingVertical: 4, paddingHorizontal: 6 },
  deleteText: { fontWeight: "700" },
});
