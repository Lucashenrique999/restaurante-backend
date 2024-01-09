const knex = require("../database/knex");
const DiskStorage = require("../providers/DiskStorage");
const AppError = require("../utils/AppError");

class DishesController {
  async create(request, response) {
    const { name, description, category, price, ingredients } = request.body;
    const image = request.file.filename;
    const user_id = request.user.id;

    const filename = await this.saveImage(image);

    const ingredientsArray = JSON.parse(ingredients || '[]');

    const dish_id = await this.createDish({
      name,
      description,
      category,
      price,
      image: filename,
      created_by: user_id,
      updated_by: user_id,
    });

    await this.createIngredients(dish_id, ingredientsArray);

    return response.json();
  }

  async show(request, response) {
    const { id } = request.params;

    const dish = await this.getDishById(id);
    const ingredients = await this.getDishIngredients(id);

    return response.json({
      ...dish,
      ingredients,
    });
  }

  async delete(request, response) {
    const { id } = request.params;

    await this.deleteDish(id);

    return response.json();
  }

  async update(request, response) {
    const { id } = request.params;
    const { name, description, category, price, ingredients } = request.body;
    const imageFilename = request.file?.filename;

    const dish = await this.getDishById(id);
    this.throwIfDishNotFound(dish);

    const dishUpdate = this.buildDishUpdate(dish, { name, description, category, price });

    if (imageFilename) {
      await this.updateDishImage(dish, imageFilename);
    }

    if (ingredients) {
      await this.updateDishIngredients(id, ingredients);
    }

    await this.updateDish(id, dishUpdate);

    return response.json();
  }

  async index(request, response) {
    const { search } = request.query;

    const dishes = await this.searchDishes(search);

    const dishesWithIngredients = await this.getDishesWithIngredients(dishes);

    return response.json(dishesWithIngredients);
  }

  // Métodos auxiliares

  async saveImage(imageFilename) {
    const diskStorage = new DiskStorage();
    return await diskStorage.saveFile(imageFilename);
  }

  async createDish(data) {
    const [dish_id] = await knex("dishes").insert(data);
    return dish_id;
  }

  async createIngredients(dish_id, ingredientsArray) {
    const ingredientsInsert = ingredientsArray.map((name) => {
      return {
        dish_id,
        name,
        created_by: dish.created_by,
      };
    });

    await knex("ingredients").insert(ingredientsInsert);
  }

  async getDishById(id) {
    return await knex("dishes").where({ id }).first();
  }

  async getDishIngredients(dish_id) {
    return await knex("ingredients").where({ dish_id });
  }

  throwIfDishNotFound(dish) {
    if (!dish) {
      throw new AppError("Prato não encontrado.", 404);
    }
  }

  buildDishUpdate(dish, { name, description, category, price }) {
    return {
      name: name ?? dish.name,
      description: description ?? dish.description,
      category: category ?? dish.category,
      price: price ?? dish.price,
      updated_by: request.user.id,
      updated_at: knex.fn.now(),
    };
  }

  async updateDishImage(dish, imageFilename) {
    const diskStorage = new DiskStorage();

    if (dish.image) {
      await diskStorage.deleteFile(dish.image);
    }

    const filename = await diskStorage.saveFile(imageFilename);
    dishUpdate.image = filename;
  }

  async updateDishIngredients(dish_id, ingredients) {
    await knex("ingredients").where({ dish_id }).delete();

    const ingredientsInsert = ingredients.map((name) => {
      return {
        dish_id,
        name,
        created_by: dish.created_by,
      };
    });

    await knex("ingredients").insert(ingredientsInsert);
  }

  async updateDish(id, updateData) {
    await knex("dishes").where({ id }).update(updateData);
  }

  async deleteDish(id) {
    const dish = await this.getDishById(id);
    this.throwIfDishNotFound(dish);

    if (dish.image) {
      const diskStorage = new DiskStorage();
      await diskStorage.deleteFile(dish.image);
    }

    await knex("ingredients").where({ dish_id: id }).delete();
    await knex("dishes").where({ id }).delete();
  }

  async searchDishes(search) {
    let query = knex("dishes")
      .select([
        "dishes.id",
        "dishes.name",
        "dishes.description",
        "dishes.category",
        "dishes.price",
        "dishes.image",
      ])
      .orderBy("dishes.name");

    if (search) {
      const keywords = search.split(" ").map((keyword) => `%${keyword}%`);

      query = query
        .leftJoin("ingredients", "dishes.id", "ingredients.dish_id")
        .where((builder) => {
          builder.where((builder2) => {
            keywords.forEach((keyword) => {
              builder2.orWhere("dishes.name", "like", keyword);
              builder2.orWhere("dishes.description", "like", keyword);
            });
          });
          keywords.forEach((keyword) => {
            builder.orWhere("ingredients.name", "like", keyword);
          });
        })
        .groupBy("dishes.id");
    }

    return await query;
  }

  async getDishesWithIngredients(dishes) {
    const dishesIngredients = await knex("ingredients");
    return dishes.map((dish) => {
      const dishIngredients = dishesIngredients.filter((ingredient) => ingredient.dish_id === dish.id);

      return {
        ...dish,
        ingredients: dishIngredients,
      };
    });
  }
}

module.exports = DishesController;