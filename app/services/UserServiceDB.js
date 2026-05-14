import UserEntity from "../entities/UserEntity";
import { getDatabase } from "./DataBase";

export default class UserServiceDB {
  static toEntity(d) {
    if (!d) return null;
    const parsed = {
      ...d,
      badges: typeof d.badges === "string" ? JSON.parse(d.badges || "[]") : d.badges,
      useCoverPhotoInHeader: d.useCoverPhotoInHeader === 1 || d.useCoverPhotoInHeader === true,
    };
    return UserEntity.transforme(parsed);
  }

  static async inicializar() {
    const db = await getDatabase();

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT,
        email TEXT,
        password TEXT,
        photo TEXT,
        phone TEXT,
        bio TEXT,
        coverPhoto TEXT,
        status TEXT,
        handle TEXT,
        location TEXT,
        favoritePokemon TEXT,
        pronouns TEXT,
        themeColor TEXT,
        badges TEXT,
        useCoverPhotoInHeader INTEGER
      );
    `);
  }

  static async listar() {
    await this.inicializar();
    const db = await getDatabase();

    const dados = await db.getAllAsync(`
      SELECT id, name, email, password, photo, phone, bio, coverPhoto, status, handle, location, favoritePokemon, pronouns, themeColor, badges, useCoverPhotoInHeader
      FROM users
      ORDER BY name
    `);

    return dados.map((d) => this.toEntity(d));
  }

  static async buscaPorId(id) {
    if (id == null) return null;
    await this.inicializar();
    const db = await getDatabase();

    const d = await db.getFirstAsync(
      `
      SELECT id, name, email, password, photo, phone, bio, coverPhoto, status, handle, location, favoritePokemon, pronouns, themeColor, badges, useCoverPhotoInHeader
      FROM users
      WHERE id = ?
      `,
      String(id)
    );

    return d ? this.toEntity(d) : null;
  }

  static async salvar(dados) {
    const name = (dados?.name ?? "").trim();
    const email = String(dados?.email ?? "").trim().toLowerCase();
    const password = dados?.password ?? "";
    const photo = dados?.photo ?? null;
    const phone = dados?.phone ?? "";
    const bio = dados?.bio ?? "";
    const coverPhoto = dados?.coverPhoto ?? null;
    const status = dados?.status ?? "";
    const handle = dados?.handle ?? "";
    const location = dados?.location ?? "";
    const favoritePokemon = dados?.favoritePokemon ?? "";
    const pronouns = dados?.pronouns ?? "";
    const themeColor = dados?.themeColor ?? "#ffc94a";
    const badges = Array.isArray(dados?.badges) ? dados.badges : [];
    const useCoverPhotoInHeader = dados?.useCoverPhotoInHeader ? 1 : 0;

    if (!name) throw new Error("Nome é obrigatório");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido");

    await this.inicializar();
    const db = await getDatabase();

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db.runAsync(
      `
      INSERT INTO users (
        id, name, email, password, photo, phone, bio, coverPhoto, status, handle, location, favoritePokemon, pronouns, themeColor, badges, useCoverPhotoInHeader
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      id,
      name,
      email,
      password,
      photo,
      phone,
      bio,
      coverPhoto,
      status,
      handle,
      location,
      favoritePokemon,
      pronouns,
      themeColor,
      JSON.stringify(badges),
      useCoverPhotoInHeader
    );

    return new UserEntity(
      id,
      name,
      email,
      password,
      photo,
      phone,
      bio,
      coverPhoto,
      status,
      handle,
      location,
      favoritePokemon,
      pronouns,
      themeColor,
      badges,
      !!useCoverPhotoInHeader
    );
  }

  static async atualizar(id, dados) {
    if (id == null) return { ok: false };
    await this.inicializar();
    const db = await getDatabase();

    const atual = await this.buscaPorId(id);
    if (!atual) return { ok: false };

    const name = (dados?.name ?? atual.name).trim();
    const email = String(dados?.email ?? atual.email).trim().toLowerCase();
    const password = dados?.password ?? atual.password;
    const photo = 'photo' in dados ? dados.photo : atual.photo;
    const phone = 'phone' in dados ? dados.phone : atual.phone;
    const bio = 'bio' in dados ? dados.bio : atual.bio;
    const coverPhoto = 'coverPhoto' in dados ? dados.coverPhoto : atual.coverPhoto;
    const status = 'status' in dados ? dados.status : atual.status;
    const handle = 'handle' in dados ? dados.handle : atual.handle;
    const location = 'location' in dados ? dados.location : atual.location;
    const favoritePokemon = 'favoritePokemon' in dados ? dados.favoritePokemon : atual.favoritePokemon;
    const pronouns = 'pronouns' in dados ? dados.pronouns : atual.pronouns;
    const themeColor = 'themeColor' in dados ? dados.themeColor : atual.themeColor;
    const badges = Array.isArray(dados?.badges) ? dados.badges : atual.badges;
    const useCover = 'useCoverPhotoInHeader' in dados ? (dados.useCoverPhotoInHeader ? 1 : 0) : (atual.useCoverPhotoInHeader ? 1 : 0);

    if (!name) throw new Error("Nome é obrigatório");

    await db.runAsync(
      `
      UPDATE users
      SET name = ?, email = ?, password = ?, photo = ?, phone = ?, bio = ?, coverPhoto = ?, status = ?, handle = ?, location = ?, favoritePokemon = ?, pronouns = ?, themeColor = ?, badges = ?, useCoverPhotoInHeader = ?
      WHERE id = ?
      `,
      name,
      email,
      password,
      photo,
      phone,
      bio,
      coverPhoto,
      status,
      handle,
      location,
      favoritePokemon,
      pronouns,
      themeColor,
      JSON.stringify(badges),
      useCover,
      String(id)
    );

    return {
      ok: true,
      user: new UserEntity(
        String(id),
        name,
        email,
        password,
        photo,
        phone,
        bio,
        coverPhoto,
        status,
        handle,
        location,
        favoritePokemon,
        pronouns,
        themeColor,
        badges,
        !!useCover
      ),
    };
  }

  static async remover(id) {
    if (id == null) return false;
    await this.inicializar();
    const db = await getDatabase();

    const result = await db.runAsync(
      `
      DELETE FROM users
      WHERE id = ?
      `,
      String(id)
    );

    return result.changes > 0;
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
        return resultado.user;
      }
    }

    const user = await this.salvar(dados);
    return user;
  }

  static async clear() {
    const db = await getDatabase();
    await db.runAsync(`
      DELETE FROM users
    `);
  }
}
