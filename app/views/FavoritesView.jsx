import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  Modal,
  TextInput,
  ScrollView,
} from "react-native";
import { AnimatedCard } from "../components/AnimatedCard";
import { AuthGuard } from "../components/AuthGuard";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { FavoritesService } from "../services/FavoritesService";
import { MyCardsService } from "../services/MyCardsService";
import { ListsService } from "../services/ListsService";

function FavoritesViewContent() {
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [favorites, setFavorites] = useState([]);
  const [, setMyCards] = useState([]);
  const [lists, setLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showAddToListModal, setShowAddToListModal] = useState(false);
  const [cardToAdd, setCardToAdd] = useState(null);

  const numColumns = Math.max(2, width > 900 ? 4 : width > 600 ? 3 : 2);
  const spacing = 12;
  const cardWidth = (width - spacing * (numColumns + 1)) / numColumns;
  const cardHeight = cardWidth / 0.716;

  useEffect(() => {
    const unsubscribeFavorites = FavoritesService.subscribe(setFavorites);
    const unsubscribeMyCards = MyCardsService.subscribe(setMyCards);
    const unsubscribeLists = ListsService.subscribe(setLists);

    return () => {
      unsubscribeFavorites();
      unsubscribeMyCards();
      unsubscribeLists();
    };
  }, []);

  const formatCardCode = (item) => {
    return item.collectionNumber || item.id;
  };

  const renderCard = ({ item, index }) => (
    <View style={[styles.favoriteItem, { width: cardWidth }]}>
      <AnimatedCard
        item={item}
        index={index}
        cardWidth={cardWidth}
        cardHeight={cardHeight}
        formatCardCode={formatCardCode}
        isFavorite={FavoritesService.isFavorite(item.id)}
        isMyCard={MyCardsService.isMyCard(item.id)}
        myCardQuantity={MyCardsService.getQuantity(item.id)}
        onFavoritePress={() => FavoritesService.toggleFavorite(item)}
        onMyCardPress={() => MyCardsService.toggleCard(item)}
        onPress={() => router.push(`/views/CardDetailsView?id=${item.id}`)}
      />
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => { setCardToAdd(item); setShowAddToListModal(true); }} style={[styles.smallButton, { borderColor: colors.primary }]}>
          <Text style={[styles.smallButtonText, { color: colors.primary }]}>Adicionar à lista</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Favoritos" />

      <View style={styles.listsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          <TouchableOpacity onPress={() => setSelectedListId(null)} style={[styles.listChip, selectedListId === null && { borderColor: colors.primary }]}>
            <Text style={{ color: colors.text }}>Todas</Text>
          </TouchableOpacity>

          {lists.map((l) => (
            <TouchableOpacity key={l.id} onPress={() => setSelectedListId(l.id)} style={[styles.listChip, selectedListId === l.id && { borderColor: colors.primary }]}>
              <Text style={{ color: colors.text }}>{l.name} ({(l.cards || []).length})</Text>
            </TouchableOpacity>
          ))}

          <TouchableOpacity onPress={() => setShowCreateModal(true)} style={[styles.createListButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.createListText}>+ Criar lista</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <FlatList
        key={numColumns}
        data={selectedListId ? (ListsService.getById(selectedListId)?.cards || []) : favorites}
        renderItem={renderCard}
        keyExtractor={(item) => String(item.id)}
        numColumns={numColumns}
        contentContainerStyle={[
          { padding: spacing },
          favorites.length === 0 && styles.emptyList,
        ]}
        columnWrapperStyle={{ justifyContent: "space-between", marginBottom: spacing }}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nenhuma carta favorita</Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              Toque em Favorito nas cartas do catálogo para montar sua lista.
            </Text>
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => router.push("/views/HomeView")}
              style={[styles.catalogButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.catalogButtonText}>Ver catálogo</Text>
            </TouchableOpacity>
          </View>
        }
      />

      {/* Create list modal */}
      <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Criar nova lista</Text>
            <TextInput value={newListName} onChangeText={setNewListName} placeholder="Nome da lista" placeholderTextColor={colors.mutedText} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowCreateModal(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { if (newListName.trim()) { ListsService.createList(newListName.trim()); setNewListName(""); setShowCreateModal(false); } }} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff' }}>Criar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add to list modal */}
      <Modal visible={showAddToListModal} transparent animationType="fade" onRequestClose={() => setShowAddToListModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Adicionar à lista</Text>
            <ScrollView style={{ maxHeight: 220 }}>
              {lists.map((l) => (
                <TouchableOpacity key={l.id} onPress={() => { ListsService.addCardToList(l.id, cardToAdd); setShowAddToListModal(false); }} style={[styles.listRow, { borderColor: colors.border }]}> 
                  <Text style={{ color: colors.text }}>{l.name} ({(l.cards||[]).length})</Text>
                </TouchableOpacity>
              ))}
              {lists.length === 0 && <Text style={{ color: colors.mutedText }}>Nenhuma lista. Crie uma nova lista primeiro.</Text>}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowAddToListModal(false)} style={[styles.modalBtn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.text }}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function FavoritesView() {
  return (
    <AuthGuard>
      <FavoritesViewContent />
    </AuthGuard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: "center",
  },
  catalogButton: {
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  catalogButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  favoriteItem: {
    marginBottom: 12,
  },
  listsBar: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  listChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  createListButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 6,
  },
  createListText: { color: "#fff", fontWeight: "700" },
  cardActions: { marginTop: 8, alignItems: "flex-end" },
  smallButton: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  smallButtonText: { fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", padding: 18 },
  modalContent: { width: "100%", maxWidth: 520, borderRadius: 12, padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  modalBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  listRow: { padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
});
