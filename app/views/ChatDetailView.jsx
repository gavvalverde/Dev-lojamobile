import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import TopDropDownMenu from "../components/TopDropDownMenu";
import { useAppTheme } from "../services/AppThemeContext";
import { ChatService } from "../services/ChatService";

// View de detalhe do chat: lista de mensagens e envio simples
export default function ChatDetailView() {
  // useLocalSearchParams funciona com a versão do projeto (consistente com outras views)
  const { id } = useLocalSearchParams();
  // alguns routers retornam array para parâmetros, então normalizamos
  const chatId = Array.isArray(id) ? id[0] : id;
  const router = useRouter();
  const { theme } = useAppTheme();
  const colors = theme.colors;

  const [chat, setChat] = useState(null);
  const [text, setText] = useState("");
  const flatRef = useRef(null);

  useEffect(() => {
    // Subscrição ao serviço de chats.
    // Sempre que a lista de chats mudar (ChatService.notify), este callback
    // é chamado com a lista atualizada. Procuramos o chat pelo `id`
    // (vindo dos parâmetros da rota) e atualizamos o estado local.
    const unsubscribe = ChatService.subscribe((list) => {
      const found = list.find((c) => String(c.id) === String(chatId));
      setChat(found || null);
    });

    // Ao desmontar, removemos a subscrição para evitar vazamentos.
    return () => unsubscribe();
  }, [id]);

  function sendMessage() {
    const trimmed = (text || "").trim();
    if (!trimmed || !chat) return;
    // Usamos o ChatService para persistir a mensagem na lista em memória.
    // O serviço atualiza `lastMessage` e reordena a lista (coloca o chat no topo).
    ChatService.addMessage(chat.id, { from: "user", text: trimmed });
    // Limpa o campo de entrada após enviar
    setText("");

    // Pequeno timeout para garantir que a lista foi atualizada antes de rolar.
    // Em apps reais, usar refs + event callbacks é preferível.
    setTimeout(() => {
      try {
        flatRef.current?.scrollToEnd?.({ animated: true });
      } catch (e) {
        // Algumas plataformas podem não suportar scrollToEnd exatamente.
      }
    }, 120);
  }

  const renderMessage = ({ item, index }) => {
    const isUser = item.from === "user";
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowSeller]}>
        {/* Bolha de mensagem: muda cor se for do usuário */}
        <View style={[styles.bubble, { backgroundColor: isUser ? colors.primary : colors.surface }]}> 
          <Text style={{ color: isUser ? "#fff" : colors.text }}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}> 
      <TopDropDownMenu title={chat ? chat.seller : "Conversa"} onBack={() => router.back()} />

      {/* KeyboardAvoidingView ajuda a manter o campo de entrada visível quando o teclado abre */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={80}
      >
        <FlatList
          ref={flatRef}
          data={chat?.messages || []}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={{ color: colors.mutedText }}>Nenhuma mensagem ainda. Envie a primeira!</Text>
            </View>
          }
        />

        {/* Linha de entrada: TextInput + botão de enviar */}
        <View style={[styles.inputRow, { borderTopColor: colors.border, backgroundColor: colors.surface }]}> 
          <TextInput
            placeholder="Digite sua mensagem"
            placeholderTextColor={colors.mutedText}
            value={text}
            onChangeText={setText}
            style={[styles.input, { color: colors.text }]}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={[styles.sendButton, { backgroundColor: colors.primary }]}> 
            <Text style={styles.sendText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  messagesList: { padding: 12, paddingBottom: 8 },
  emptyState: { alignItems: "center", padding: 20 },
  msgRow: { marginBottom: 8, flexDirection: "row" },
  msgRowUser: { justifyContent: "flex-end" },
  msgRowSeller: { justifyContent: "flex-start" },
  bubble: { padding: 10, borderRadius: 12, maxWidth: "80%" },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "transparent",
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
  },
  sendText: { color: "#fff", fontWeight: "700" },
});
