// service/restaurant.ts — 分店與菜單
import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/mysql';
import { ApiError } from '@/util/errors';
import type { Menu, MenuCategory, Restaurant } from '@/lib/type';

type RestaurantRow = RowDataPacket & {
  id: number;
  name: string;
  address: string;
  is_open: number;
};

type MenuRow = RowDataPacket & {
  category_id: number;
  category_name: string;
  product_id: number | null;
  product_name: string | null;
  price: number | null;
  stock: number | null;
  is_available: number | null;
};

function mapRestaurant(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    isOpen: Boolean(row.is_open),
  };
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const [rows] = await pool.query<RestaurantRow[]>(
    'SELECT id, name, address, is_open FROM restaurants ORDER BY id ASC'
  );
  return rows.map(mapRestaurant);
}

export async function getRestaurantById(id: number): Promise<Restaurant> {
  const [rows] = await pool.execute<RestaurantRow[]>(
    'SELECT id, name, address, is_open FROM restaurants WHERE id = ?',
    [id]
  );
  if (!rows[0]) {
    throw new ApiError('RESTAURANT_NOT_FOUND', '找不到指定的分店', 404);
  }
  return mapRestaurant(rows[0]);
}

export async function getMenu(restaurantId: number): Promise<Menu> {
  await getRestaurantById(restaurantId);

  const [rows] = await pool.execute<MenuRow[]>(
    `SELECT c.id AS category_id, c.name AS category_name,
            p.id AS product_id, p.name AS product_name,
            p.price, p.stock, p.is_available
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
      WHERE c.restaurant_id = ?
      ORDER BY c.sort_order, c.id, p.sort_order, p.id`,
    [restaurantId]
  );

  const categories = new Map<number, MenuCategory>();
  for (const row of rows) {
    let category = categories.get(row.category_id);
    if (!category) {
      category = { id: row.category_id, name: row.category_name, items: [] };
      categories.set(row.category_id, category);
    }
    if (row.product_id !== null) {
      const stock = Number(row.stock);
      category.items.push({
        id: row.product_id,
        name: row.product_name as string,
        price: Number(row.price),
        stock,
        isAvailable: Boolean(row.is_available) && stock > 0,
      });
    }
  }

  return { restaurantId, categories: [...categories.values()] };
}
