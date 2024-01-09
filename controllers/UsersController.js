const { hash, compare } = require("bcryptjs");
const AppError = require("../utils/AppError");
const sqliteConnection = require("../database/sqlite");

class UsersController {
  async create(request, response) {
    const { name, email, password, is_admin = false } = request.body;

    await this.checkUserExists(email);

    const hashedPassword = await hash(password, 8);

    await this.insertUser(name, email, hashedPassword, is_admin);

    return response.status(201).json();
  }

  async update(request, response) {
    const { name, email, password, old_password, is_admin } = request.body;
    const user_id = request.user.id;

    const user = await this.getUserById(user_id);
    this.throwIfUserNotFound(user);

    await this.checkEmailAvailability(email, user.id);

    this.updateUserFields(user, { name, email });

    if (password) {
      this.updateUserPassword(user, password, old_password);
    }

    if (is_admin !== undefined) {
      this.validateAdminUpdate(user, is_admin, request.userId);
      user.is_admin = is_admin;
    }

    await this.updateUser(user);

    return response.status(200).json();
  }

  // Métodos auxiliares

  async checkUserExists(email) {
    const database = await sqliteConnection();
    const checkUserExists = await database.get(
      "SELECT * FROM users WHERE email = (?)",
      [email]
    );

    if (checkUserExists) {
      throw new AppError("Este e-mail já está em uso.");
    }
  }

  async insertUser(name, email, password, is_admin) {
    const database = await sqliteConnection();
    await database.run(
      "INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)",
      [name, email, password, is_admin]
    );
  }

  async getUserById(user_id) {
    const database = await sqliteConnection();
    return await database.get("SELECT * FROM users WHERE id = (?)", [user_id]);
  }

  throwIfUserNotFound(user) {
    if (!user) {
      throw new AppError("Usuário não encontrado.");
    }
  }

  async checkEmailAvailability(email, userId) {
    const database = await sqliteConnection();
    const userWithUpdatedEmail = await database.get(
      "SELECT * FROM users WHERE email = (?)",
      [email]
    );

    if (userWithUpdatedEmail && userWithUpdatedEmail.id !== userId) {
      throw new AppError("Este e-mail já está em uso.");
    }
  }

  updateUserFields(user, { name, email }) {
    user.name = name ?? user.name;
    user.email = email ?? user.email;
  }

  async updateUserPassword(user, password, old_password) {
    if (!old_password) {
      throw new AppError("Você precisa informar a senha antiga para definir a nova senha.");
    }

    const checkOldPassword = await compare(old_password, user.password);

    if (!checkOldPassword) {
      throw new AppError("A senha antiga não confere.");
    }

    user.password = await hash(password, 8);
  }

  validateAdminUpdate(user, is_admin, requestUserId) {
    if (user.id !== requestUserId && !user.is_admin) {
      throw new AppError("Você não tem permissão para atualizar o campo 'is_admin'.", 403);
    }
  }

  async updateUser(user) {
    const database = await sqliteConnection();
    await database.run(
      `
      UPDATE users SET
      name = ?,
      email = ?,
      password = ?,
      is_admin = ?,
      updated_at = DATETIME('now')
      WHERE id = ?`,
      [user.name, user.email, user.password, user.is_admin, user.id]
    );
  }
}

module.exports = UsersController;