import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { getProductImage, toImageSource } from "../../utils/productImage";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { AuthService } from "../services/AuthService";
import { ChatService } from "../services/ChatService";
import { useAppTheme } from "../services/AppThemeContext";

function formatTime(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getInitials(name) {
  return String(name ?? "YD")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function getOtherParticipant(conversation, currentUserId) {
  return conversation?.participants?.find((participant) => participant.id !== currentUserId) ?? null;
}

function Avatar({ user, size = 44, onPress }) {
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const backgroundColor = user?.themeColor || colors.accent;
  const Container = onPress ? TouchableOpacity : View;
  const containerProps = onPress ? { activeOpacity: 0.78, onPress } : {};

  return (
    <Container
      {...containerProps}
      style={[styles.avatar, { backgroundColor, height: size, width: size, borderRadius: size / 2 }]}
    >
      {user?.photo ? (
        <Image source={{ uri: user.photo }} style={styles.avatarImage} />
      ) : (
        <Text style={[styles.avatarText, { color: colors.onAccent }]}>{getInitials(user?.name)}</Text>
      )}
    </Container>
  );
}

export default function ChatView() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const conversationId = Array.isArray(params.conversationId)
    ? params.conversationId[0]
    : params.conversationId;
  const { theme } = useAppTheme();
  const colors = theme.colors;
  const [currentUser, setCurrentUser] = useState(AuthService.getCurrentUser());
  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsubscribeAuth = AuthService.subscribe(setCurrentUser);
    const unsubscribeChat = ChatService.subscribe(setConversations);

    return () => {
      unsubscribeAuth();
      unsubscribeChat();
    };
  }, []);

  const userConversations = useMemo(() => {
    if (!currentUser?.id) return [];
    return conversations
      .filter((conversation) => conversation.participantIds.includes(currentUser.id))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [conversations, currentUser?.id]);

  const visibleConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return userConversations;

    return userConversations.filter((conversation) => {
      const otherUser = getOtherParticipant(conversation, currentUser?.id);
      const lastMessage = conversation.messages[conversation.messages.length - 1];
      const searchable = [
        otherUser?.name,
        otherUser?.handle,
        conversation.listing?.name,
        conversation.listing?.price,
        lastMessage?.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(term);
    });
  }, [currentUser?.id, search, userConversations]);

  const activeConversation = useMemo(() => {
    if (!conversationId) return null;
    return conversations.find((conversation) => conversation.id === conversationId) ?? null;
  }, [conversationId, conversations]);

  const otherParticipant = getOtherParticipant(activeConversation, currentUser?.id);

  const openConversation = (conversation) => {
    router.push(`/views/ChatView?conversationId=${encodeURIComponent(conversation.id)}`);
  };

  const openProfile = (profileId) => {
    if (!profileId) return;
    router.push(`/views/ProfileView?userId=${encodeURIComponent(profileId)}`);
  };

  const sendMessage = () => {
    if (!activeConversation || !currentUser) return;

    ChatService.sendMessage(activeConversation.id, currentUser, message);
    setMessage("");
  };

  const renderConversation = ({ item }) => {
    const otherUser = getOtherParticipant(item, currentUser?.id);
    const lastMessage = item.messages[item.messages.length - 1];
    const listingImage = getProductImage(item.listing);
    const lastMessageMine = lastMessage?.senderId === currentUser?.id;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openConversation(item)}
        style={[styles.conversationCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <Avatar
          user={otherUser}
          size={50}
          onPress={(event) => {
            event?.stopPropagation?.();
            openProfile(otherUser?.id);
          }}
        />
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <Text
              numberOfLines={1}
              onPress={(event) => {
                event?.stopPropagation?.();
                openProfile(otherUser?.id);
              }}
              style={[styles.conversationName, { color: colors.text }]}
            >
              {otherUser?.name ?? "Usuario"}
            </Text>
            <Text style={[styles.conversationTime, { color: colors.mutedText }]}>
              {formatTime(item.updatedAt)}
            </Text>
          </View>
          {!!item.listing?.name && (
            <View style={[styles.listingPill, { backgroundColor: colors.surfaceVariant }]}>
              {listingImage ? (
                <Image source={toImageSource(listingImage)} style={styles.listingThumb} />
              ) : (
                <MaterialCommunityIcons name="cards-outline" size={16} color={colors.primary} />
              )}
              <Text numberOfLines={1} style={[styles.listingLine, { color: colors.primary }]}>
                {item.listing.name} {item.listing.price ? `- ${item.listing.price}` : ""}
              </Text>
            </View>
          )}
          <Text numberOfLines={1} style={[styles.lastMessage, { color: colors.mutedText }]}>
            {lastMessageMine ? "Voce: " : ""}
            {lastMessage?.text ?? "Conversa iniciada."}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.mutedText} />
      </TouchableOpacity>
    );
  };

  const renderMessage = ({ item }) => {
    const mine = item.senderId === currentUser?.id;

    return (
      <View style={[styles.messageRow, mine && styles.myMessageRow]}>
        <View
          style={[
            styles.messageBubble,
            {
              backgroundColor: mine ? colors.primary : colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.messageText, { color: mine ? colors.onPrimary : colors.text }]}>
            {item.text}
          </Text>
          <Text style={[styles.messageTime, { color: mine ? colors.onPrimary : colors.mutedText }]}>
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (activeConversation) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={[styles.screen, { backgroundColor: colors.background }]}
      >
        <TopDropDownMenu title={otherParticipant?.name ?? "Conversa"} />
        <View style={[styles.chatHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity activeOpacity={0.75} onPress={() => router.push("/views/ChatView")} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Avatar user={otherParticipant} size={38} onPress={() => openProfile(otherParticipant?.id)} />
          <View style={styles.chatHeaderText}>
            <Text
              numberOfLines={1}
              onPress={() => openProfile(otherParticipant?.id)}
              style={[styles.chatName, { color: colors.text }]}
            >
              {otherParticipant?.name ?? "Usuario"}
            </Text>
            <Text numberOfLines={1} style={[styles.chatSubtitle, { color: colors.mutedText }]}>
              {activeConversation.listing?.name ?? "Conversa sobre carta"}
            </Text>
          </View>
        </View>

        <FlatList
          data={activeConversation.messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="message-text-outline" size={42} color={colors.mutedText} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Comece a conversa</Text>
              <Text style={[styles.emptyText, { color: colors.mutedText }]}>
                Combine preco, estado da carta, entrega ou troca diretamente com o outro usuario.
              </Text>
            </View>
          }
        />

        <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            multiline
            onChangeText={setMessage}
            placeholder="Digite sua mensagem"
            placeholderTextColor={colors.mutedText}
            style={[
              styles.messageInput,
              { backgroundColor: colors.surfaceVariant, color: colors.text },
            ]}
            value={message}
          />
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!message.trim()}
            onPress={sendMessage}
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              !message.trim() && styles.disabledButton,
            ]}
          >
            <MaterialCommunityIcons name="send" size={20} color={colors.onPrimary} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <TopDropDownMenu title="Chat" />
      <FlatList
        data={visibleConversations}
        keyExtractor={(item) => item.id}
        renderItem={renderConversation}
        contentContainerStyle={[
          styles.conversationsContent,
          visibleConversations.length === 0 && styles.emptyList,
        ]}
        ListHeaderComponent={
          <View>
            <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedText} />
              <TextInput
                onChangeText={setSearch}
                placeholder="Buscar conversa"
                placeholderTextColor={colors.mutedText}
                style={[styles.searchInput, { color: colors.text }]}
                value={search}
              />
              {!!search && (
                <TouchableOpacity activeOpacity={0.75} onPress={() => setSearch("")}>
                  <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedText} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="chat-outline" size={48} color={colors.mutedText} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {search ? "Nenhum resultado" : "Nenhuma conversa ainda"}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedText }]}>
              {search ? "Tente outro nome, anuncio ou mensagem." : "As conversas iniciadas em anuncios aparecem aqui."}
            </Text>
          </View>
        }
      />
      {visibleConversations.length > 0 && (
        <View style={styles.footerWrap}>
          <View style={[styles.footerPanel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color={colors.primary} />
            <Text style={[styles.footerText, { color: colors.mutedText }]}>Mensagens sincronizadas</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  conversationsContent: {
    padding: 14,
    paddingBottom: 12,
  },
  emptyList: {
    flexGrow: 1,
  },
  searchBox: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    minWidth: 0,
    paddingVertical: 8,
  },
  conversationCard: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginBottom: 9,
    minHeight: 86,
    padding: 12,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    height: "100%",
    width: "100%",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "900",
  },
  conversationInfo: {
    flex: 1,
    minWidth: 0,
  },
  conversationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  conversationName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
  },
  conversationTime: {
    fontSize: 11,
    fontWeight: "700",
  },
  listingLine: {
    flex: 1,
    fontSize: 13,
    fontWeight: "800",
  },
  listingPill: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 7,
    flexDirection: "row",
    gap: 6,
    marginTop: 5,
    maxWidth: "100%",
    minHeight: 28,
    paddingHorizontal: 8,
  },
  listingThumb: {
    borderRadius: 4,
    height: 20,
    width: 20,
  },
  lastMessage: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 5,
  },
  chatHeader: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  chatHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "900",
  },
  chatSubtitle: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  messagesContent: {
    padding: 14,
    paddingBottom: 20,
  },
  messageRow: {
    alignItems: "flex-start",
    marginBottom: 10,
  },
  myMessageRow: {
    alignItems: "flex-end",
  },
  messageBubble: {
    borderRadius: 8,
    borderWidth: 1,
    maxWidth: "82%",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600",
  },
  messageTime: {
    alignSelf: "flex-end",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 5,
    opacity: 0.78,
  },
  composer: {
    alignItems: "flex-end",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 8,
    padding: 10,
  },
  messageInput: {
    borderRadius: 8,
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 8,
    height: 44,
    justifyContent: "center",
    width: 48,
  },
  disabledButton: {
    opacity: 0.45,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
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
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 6,
    textAlign: "center",
  },
  footerPanel: {
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    minHeight: 48,
  },
  footerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
  },
  footerText: {
    fontSize: 12,
    fontWeight: "800",
  },
});
