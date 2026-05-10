// Serviço simples de chats em memória
// Implementação de exemplo (nível estudante) que mantém uma lista local
// de conversas e notifica assinantes quando a lista muda.
// Em produção, trocar por backend + persistência.
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

// Notifica todos os listeners com uma cópia da lista atual.
// Mantemos cópias para evitar que consumidores modifiquem o array interno.
function notify() {
  const snapshot = chats.slice();
  listeners.forEach((cb) => cb(snapshot));
}

export const ChatService = {
  // Subscribe: registra um callback e chama imediatamente com o estado atual.
  // Retorna uma função para cancelar a inscrição.
  subscribe(cb) {
    cb(chats.slice());
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  // Retorna cópia da lista atual (não mutável pelo chamador)
  getAll() {
    return chats.slice();
  },

  // Cria um novo chat na memória. Em apps reais, o id e criação
  // viriam do servidor. Aqui usamos Date.now() para simplicidade.
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

  // Remove um chat por id e notifica assinantes.
  deleteChat(id) {
    chats = chats.filter((c) => c.id !== id);
    notify();
  },

  // Adiciona uma mensagem ao chat especificado.
  // Atualiza `lastMessage` e `updatedAt`, e move o chat para o topo
  // da lista para refletir atividade recente.
  addMessage(chatId, message) {
    const chat = chats.find((c) => c.id === String(chatId));
    if (!chat) return;
    chat.messages.push(message);
    chat.lastMessage = message.text;
    chat.updatedAt = Date.now();
    // mover para topo (chat mais recente aparece primeiro)
    chats = [chat, ...chats.filter((c) => c.id !== chat.id)];
    notify();
  },
};

export default ChatService;
