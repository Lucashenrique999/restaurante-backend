const knex = require("../database/knex");
const AppError = require("../utils/AppError");

class CartsController {
  async create(request, response) {
    const { cart_items } = request.body;
    const user_id = request.user.id;

    const cart_id = await this.createCart(user_id);
    await this.createCartItems(cart_id, cart_items);

    return response.json({ id: cart_id });
  }

  async show(request, response) {
    const { id } = request.params;

    const cart = await this.getCartById(id);
    const cart_items = await this.getCartItems(id);

    return response.json({
      ...cart,
      cart_items,
    });
  }

  async update(request, response) {
    const { id } = request.params;
    const { cart_items } = request.body;

    const cart = await this.getCartById(id);
    this.throwIfCartNotFound(cart);

    const cartUpdate = {
      updated_at: knex.fn.now(),
    };

    await this.updateOrCreateCartItems(id, cart_items);
    await this.updateCart(id, cartUpdate);

    return response.json();
  }

  async index(request, response) {
    const user_id = request.user.id;
    const carts = await this.getUserCarts(user_id);

    return response.json(carts);
  }

  async delete(request, response) {
    const { id } = request.params;

    await this.deleteCartItems(id);
    await this.deleteCart(id);

    return response.json();
  }

  async createCart(created_by) {
    const [cart_id] = await knex("carts").insert({ created_by });
    return cart_id;
  }

  async createCartItems(cart_id, cart_items) {
    const itemsInsert = cart_items.map(({ dish_id, name, quantity }) => {
      return { cart_id, dish_id, name, quantity };
    });

    await knex("cart_items").insert(itemsInsert);
  }

  async getCartById(id) {
    return await knex("carts").where({ id }).first();
  }

  async getCartItems(cart_id) {
    return await knex("cart_items").where({ cart_id });
  }

  throwIfCartNotFound(cart) {
    if (!cart) {
      throw new AppError("Carrinho não encontrado.", 404);
    }
  }

  async updateOrCreateCartItems(cart_id, cart_items) {
    const existingItems = await knex("cart_items")
      .where({ cart_id })
      .select("dish_id");

    const updatedItems = cart_items.map(({ dish_id, name, quantity }) => {
      if (existingItems.some((item) => item.dish_id === dish_id)) {
        return knex("cart_items")
          .where({ cart_id, dish_id })
          .update({ quantity });
      } else {
        return knex("cart_items").insert({
          cart_id,
          dish_id,
          name,
          quantity,
        });
      }
    });

    await Promise.all(updatedItems);
  }

  async updateCart(id, updateData) {
    await knex("carts").where({ id }).update(updateData);
  }

  async getUserCarts(created_by) {
    return await knex("carts")
      .select("id", "created_at")
      .where({ created_by })
      .orderBy("created_at", "desc");
  }

  async deleteCartItems(cart_id) {
    await knex("cart_items").where({ cart_id }).delete();
  }

  async deleteCart(id) {
    await knex("carts").where({ id }).delete();
  }
}

module.exports = CartsController;