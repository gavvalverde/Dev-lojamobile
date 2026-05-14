// app/services/ContatoService.js
import ContatoEntity from "../entities/ContatoEntity";
import { getDatabase } from "./DataBase";

export default class ContatoService {
  static toEntity(d) {
    return ContatoEntity.transforme(d);
  }

  static async inicializar() {
    const db = await getDatabase();

    const total = await db.getFirstAsync(`
      SELECT COUNT(*) AS total FROM contatos
    `);

    if (total.total === 0) {
      await db.runAsync(
        `
        INSERT INTO contatos (
          id, nome, email, telefone, avatar, favorito, categoria, sexo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        "1",
        "Maluco",
        "alice@email.com",
        "11 99999-0001",
        "https://i.pravatar.cc/150?img=1",
        1,
        "Trabalho",
        "F"
      );

      await db.runAsync(
        `
        INSERT INTO contatos (
          id, nome, email, telefone, avatar, favorito, categoria, sexo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        "2",
        "Bruno",
        "bruno@email.com",
        "11 99999-0002",
        "https://i.pravatar.cc/150?img=2",
        0,
        "Amigos",
        "M"
      );

      await db.runAsync(
        `
        INSERT INTO contatos (
          id, nome, email, telefone, avatar, favorito, categoria, sexo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        "3",
        "Carla",
        "carla@email.com",
        "11 99999-0003",
        "https://i.pravatar.cc/150?img=3",
        1,
        "Família",
        "F"
      );
    }
  }

  static async listar() {
    await this.inicializar();

    const db = await getDatabase();

    const dados = await db.getAllAsync(`
      SELECT id, nome, email, telefone, avatar, favorito, categoria, sexo
      FROM contatos
      ORDER BY nome
    `);

    return dados.map((d) => this.toEntity(d));
  }

  static async buscaPorId(id) {
    if (id == null) return null;

    await this.inicializar();

    const db = await getDatabase();

    const d = await db.getFirstAsync(
      `
      SELECT id, nome, email, telefone, avatar, favorito, categoria, sexo
      FROM contatos
      WHERE id = ?
      `,
      String(id)
    );

    return d ? this.toEntity(d) : null;
  }

  static async buscarPorId(id) {
    return this.buscaPorId(id);
  }

  static async salvar(dados) {
    const nome = (dados?.nome ?? "").trim();
    const email = (dados?.email ?? "").trim();
    const telefone = (dados?.telefone ?? "").trim();
    const avatar = dados?.avatar ?? "";
    const favorito = dados?.favorito ? 1 : 0;
    const categoria = (dados?.categoria ?? "").trim();
    const sexo = (dados?.sexo ?? "").trim();

    if (!nome) throw new Error("Nome é obrigatório");

    await this.inicializar();

    const db = await getDatabase();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db.runAsync(
      `
      INSERT INTO contatos (
        id, nome, email, telefone, avatar, favorito, categoria, sexo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      nome,
      email,
      telefone,
      avatar,
      favorito,
      categoria,
      sexo
    );

    const novo = new ContatoEntity(
      id,
      nome,
      email,
      telefone,
      avatar,
      !!favorito,
      categoria,
      sexo
    );

    return { sucesso: true, contato: novo };
  }

  static async atualizar(id, dados) {
    if (id == null) return { ok: false };

    await this.inicializar();

    const db = await getDatabase();

    const atual = await this.buscaPorId(id);

    if (!atual) return { ok: false };

    const nome = (dados?.nome ?? atual.nome).trim();
    const email = (dados?.email ?? atual.email).trim();
    const telefone = (dados?.telefone ?? atual.telefone).trim();
    const avatar = dados?.avatar ?? atual.avatar;
    const favorito = dados?.favorito ?? atual.favorito;
    const categoria = (dados?.categoria ?? atual.categoria).trim();
    const sexo = (dados?.sexo ?? atual.sexo).trim();

    if (!nome) throw new Error("Nome é obrigatório");

    await db.runAsync(
      `
      UPDATE contatos
      SET nome = ?,
          email = ?,
          telefone = ?,
          avatar = ?,
          favorito = ?,
          categoria = ?,
          sexo = ?
      WHERE id = ?
      `,
      nome,
      email,
      telefone,
      avatar,
      favorito ? 1 : 0,
      categoria,
      sexo,
      String(id)
    );

    return {
      ok: true,
      contato: new ContatoEntity(
        String(id),
        nome,
        email,
        telefone,
        avatar,
        !!favorito,
        categoria,
        sexo
      ),
    };
  }

  static async remover(id) {
    if (id == null) return false;

    await this.inicializar();

    const db = await getDatabase();

    const result = await db.runAsync(
      `
      DELETE FROM contatos
      WHERE id = ?
      `,
      String(id)
    );

    return result.changes > 0;
  }

  static async criar(dados) {
    return this.salvar(dados);
  }

  static async findAll() {
    return this.listar();
  }

  static async findById(id) {
    return this.buscaPorId(id);
  }

  static async save(dados) {
    if (dados?.id) {
      const atual = await this.buscaPorId(dados.id);

      if (atual) {
        const resultado = await this.atualizar(dados.id, dados);
        return resultado.contato;
      }
    }

    const resultado = await this.salvar(dados);
    return resultado.contato;
  }

  static async clear() {
    const db = await getDatabase();

    await db.runAsync(`
      DELETE FROM contatos
    `);
  }
}