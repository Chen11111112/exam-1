// service/product.ts — 餐點詳細資料
import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db/mysql';
import { ApiError } from '@/lib/errors';
import type { Product, ProductOption } from '@/lib/type';

type ProductRow = RowDataPacket & {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  is_available: number;
};

type OptionRow = RowDataPacket & {
  option_id: number;
  option_name: string;
  required: number;
  multiple: number;
  choice_id: number | null;
  choice_name: string | null;
  choice_price: number | null;
};

export async function getProductById(id: number): Promise<Product> {
  const [products] = await pool.execute<ProductRow[]>(
    `SELECT id, name, description, price, stock, is_available
       FROM products WHERE id = ?`,
    [id]
  );
  const row = products[0];
  if (!row) {
    throw new ApiError('PRODUCT_NOT_FOUND', '找不到指定的餐點', 404);
  }

  const [optionRows] = await pool.execute<OptionRow[]>(
    `SELECT o.id AS option_id, o.name AS option_name, o.required, o.multiple,
            ch.id AS choice_id, ch.name AS choice_name, ch.price AS choice_price
       FROM product_options o
       LEFT JOIN option_choices ch ON ch.option_id = o.id
      WHERE o.product_id = ?
      ORDER BY o.sort_order, o.id, ch.sort_order, ch.id`,
    [id]
  );

  const options = new Map<number, ProductOption>();
  for (const r of optionRows) {
    let option = options.get(r.option_id);
    if (!option) {
      option = {
        id: r.option_id,
        name: r.option_name,
        required: Boolean(r.required),
        multiple: Boolean(r.multiple),
        choices: [],
      };
      options.set(r.option_id, option);
    }
    if (r.choice_id !== null) {
      option.choices.push({
        id: r.choice_id,
        name: r.choice_name as string,
        price: Number(r.choice_price),
      });
    }
  }

  const stock = Number(row.stock);
  return {
    id: row.id,
    name: row.name,
    price: Number(row.price),
    description: row.description,
    stock,
    isAvailable: Boolean(row.is_available) && stock > 0,
    options: [...options.values()],
  };
}
