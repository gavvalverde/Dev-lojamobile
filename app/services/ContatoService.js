import ContatoEntity from "../entities/ContatoEntity";

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
  static findAll() {
    return Promise.resolve([...contatos]);
  }

  static findById(id) {
    const contato = contatos.find((item) => item.id === String(id));
    return Promise.resolve(contato ?? null);
  }

  static save(contato) {
    const index = contatos.findIndex((item) => item.id === contato.id);

    if (index >= 0) {
      contatos[index] = contato;
    } else {
      contatos.push(contato);
    }

    return Promise.resolve(contato);
  }
}