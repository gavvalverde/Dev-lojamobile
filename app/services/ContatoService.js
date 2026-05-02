import AsyncStorage from "@react-native-async-storage/async-storage";
import ContatoEntity from "../entities/ContatoEntity";

const STORAGE_KEY = "@contatos";

let contatos = [
  new ContatoEntity(
    "1",
    "Maluco",
    "alice@email.com",
    "11 99999-0001",
    "https://i.pravatar.cc/150?img=1",
    true,
    "Trabalho",
    "F"
  ),
  new ContatoEntity(
    "2",
    "Bruno",
    "bruno@email.com",
    "11 99999-0002",
    "https://i.pravatar.cc/150?img=2",
    false,
    "Amigos",
    "M"
  ),
  new ContatoEntity(
    "3",
    "Carla",
    "carla@email.com",
    "11 99999-0003",
    "https://i.pravatar.cc/150?img=3",
    true,
    "Família",
    "F"
  ),
];

export default class ContatoService {

  static async findAll() {
    const json = await AsyncStorage.getItem(STORAGE_KEY);

    if (json) {
      const lista = JSON.parse(json);
      contatos = lista.map((item) => ContatoEntity.transforme(item));
      return [...contatos];
    }

    // primeira execução
    //await this.saveAll(contatos);
    //return [...contatos];
    return [];
  }

  static async findById(id) {
    const lista = await this.findAll();
    return lista.find((item) => item.id === String(id)) ?? null;
  }

  static async save(contato) {
    const lista = await this.findAll();

    const index = lista.findIndex((item) => item.id === contato.id);

    if (index >= 0) {
      lista[index] = contato;
    } else {
      lista.push(contato);
    }

    contatos = lista;

    await this.saveAll(lista);

    return contato;
  }

  static async saveAll(lista) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lista));
  }

  static async clear() {
    await AsyncStorage.removeItem(STORAGE_KEY);
    contatos = [];
  }
}