// Serviço simples de chats em memória
// Fornece subscribe/getAll/delete para uso nas views
const listeners = new Set();

let chats = [
  {
    id: "1",
    seller: "Loja Pikachu",
    lastMessage: "Oi! Ainda tenho essa carta disponível",
    updatedAt: Date.now() - 1000 * 60 * 60,
    messages: [{ from: "seller", text: "Oi! Ainda tenho essa carta disponível" }],
  },
  {
    id: "2",
    seller: "CardHouse",
    lastMessage: "Posso reservar para você",
    updatedAt: Date.now() - 1000 * 60 * 30,
    messages: [{ from: "seller", text: "Posso reservar para você" }],
  },
];

function notify() {
  const snapshot = chats.slice();
  listeners.forEach((cb) => cb(snapshot));
}

export const ChatService = {
  // Subscribe recebe um callback que será chamado sempre que a lista mudar
  subscribe(cb) {
    cb(chats.slice());
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  // Retorna cópia da lista atual
  getAll() {
    return chats.slice();
  },

  // Cria um novo chat simples
  createChat(seller) {
    const chat = {
      id: String(Date.now()),
      seller,
      lastMessage: "",
      updatedAt: Date.now(),
      messages: [],
    };
    chats = [chat, ...chats];
    notify();
    return chat;
  },

  // Remove um chat por id
  deleteChat(id) {
    chats = chats.filter((c) => c.id !== id);
    notify();
  },

  // Adiciona mensagem simples (ex.: quando enviar/receber)
  addMessage(chatId, message) {
    const chat = chats.find((c) => c.id === String(chatId));
    if (!chat) return;
    chat.messages.push(message);
    chat.lastMessage = message.text;
    chat.updatedAt = Date.now();
    // mover para topo
    chats = [chat, ...chats.filter((c) => c.id !== chat.id)];
    notify();
  },
};

export default ChatService;
