const knex = require("../database/knex");

class OrdersController {
  async create(request, response) {
    const { status, price, payment_method, order_items } = request.body;
    const user_id = request.user.id;

    const order_id = await this.createOrder({
      status,
      price,
      payment_method,
      created_by: user_id,
    });

    await this.createOrderItems(order_id, order_items);

    return response.json();
  }

  async show(request, response) {
    const { id } = request.params;

    const order = await this.getOrderById(id);
    const order_items = await this.getOrderItems(id);

    return response.json({
      ...order,
      order_items,
    });
  }

  async update(request, response) {
    const { id } = request.params;
    const { status, price, payment_method } = request.body;

    const order = await this.getOrderById(id);
    this.throwIfOrderNotFound(order);

    const orderUpdate = this.buildOrderUpdate(order, { status, price, payment_method });

    await this.updateOrder(id, orderUpdate);

    return response.json();
  }

  async delete(request, response) {
    const { id } = request.params;

    await this.deleteOrder(id);

    return response.json();
  }

  async index(request, response) {
    const user_id = request.user.id;
    const user = await this.getUserById(user_id);

    let orders;

    if (user.is_admin) {
      orders = await this.getAllOrders();
    } else {
      orders = await this.getUserOrders(user_id);
    }

    const ordersWithDishes = await this.getOrdersWithDishes(orders, user.is_admin);

    return response.json(ordersWithDishes);
  }

  // Métodos auxiliares

  async createOrder(data) {
    const [order_id] = await knex("orders").insert(data);
    return order_id;
  }

  async createOrderItems(order_id, order_items) {
    const itemsInsert = order_items.map(async ({ dish_id, quantity }) => {
      const { name } = await knex("dishes").select("name").where({ id: dish_id }).first();
      return { order_id, dish_id, name, quantity };
    });

    await knex("order_items").insert(await Promise.all(itemsInsert));
  }

  async getOrderById(id) {
    return await knex("orders").where({ id }).first();
  }

  async getOrderItems(order_id) {
    return await knex("order_items").where({ order_id });
  }

  throwIfOrderNotFound(order) {
    if (!order) {
      throw new AppError("Pedido não encontrado.", 404);
    }
  }

  buildOrderUpdate(order, { status, price, payment_method }) {
    return {
      status: status ?? order.status,
      price: price ?? order.price,
      payment_method: payment_method ?? order.payment_method,
    };
  }

  async updateOrder(id, updateData) {
    await knex("orders").where({ id }).update(updateData);
  }

  async deleteOrder(id) {
    await knex("order_items").where({ order_id: id }).delete();
    await knex("orders").where({ id }).delete();
  }

  async getUserById(user_id) {
    return await knex("users").where({ id: user_id }).first();
  }

  async getAllOrders() {
    return await knex("orders")
      .select([
        "orders.id",
        "orders.status",
        "orders.price",
        "orders.payment_method",
        "users.name as created_by",
        "orders.created_at",
      ])
      .innerJoin("users", "users.id", "orders.created_by")
      .orderBy("orders.created_at", "desc");
  }

  async getUserOrders(user_id) {
    return await knex("orders")
      .select([
        "orders.id",
        "orders.status",
        "orders.price",
        "orders.payment_method",
        "orders.created_at",
      ])
      .where({ created_by: user_id })
      .orderBy("orders.created_at", "desc");
  }

  async getOrdersWithDishes(orders, isAdmin) {
    const orderItems = await knex("order_items");
    const ordersWithDishes = orders.map((order) => {
      const orderDishes = orderItems.filter((item) => item.order_id === order.id);
      const filteredDishes = isAdmin
        ? orderDishes
        : orderDishes.map(({ name, quantity }) => ({ name, quantity }));

      return {
        ...order,
        dishes: filteredDishes,
      };
    });

    return ordersWithDishes;
  }
}

module.exports = OrdersController;