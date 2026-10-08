// service/cart.ts — 購物車（不區分使用者，全站共用）
import 'server-only';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '@/lib/mysql';
import { ApiError } from '@/util/errors';
import type { Cart, CartItem, CartLineOption, SelectedOption } from '@/lib/type';
import { assertStock, priceItems, type Db } from '@/service/pricing';

type CartRow = RowDataPacket & {
  id: number;
  product_id: number;
  quantity: number;
  name: string;
  price: number;
  stock: number;
  is_available: number;
  restaurant_id: number;
};

type ChoiceRow = RowDataPacket & {
  cart_item_id: number;
  option_id: number;
  option_name: string;
  choice_id: number;
  choice_name: string;
  choice_price: number;
};

export async function getCart(): Promise<Cart> {
  const [rows] = await pool.query<CartRow[]>(
    `SELECT ci.id, ci.product_id, ci.quantity, p.name, p.price, p.stock, p.is_available,
            c.restaurant_id
       FROM cart_items ci
       JOIN products p ON p.id = ci.product_id
       JOIN categories c ON c.id = p.category_id
      ORDER BY ci.id ASC`
  );

  const choicesByItem = new Map<number, Map<number, CartLineOption>>();
  if (rows.length > 0) {
    const [choiceRows] = await pool.query<ChoiceRow[]>(
      `SELECT cc.cart_item_id, cc.option_id, o.name AS option_name,
              ch.id AS choice_id, ch.name AS choice_name, ch.price AS choice_price
         FROM cart_item_choices cc
         JOIN product_options o ON o.id = cc.option_id
         JOIN option_choices ch ON ch.id = cc.choice_id
        WHERE cc.cart_item_id IN (?)
        ORDER BY o.sort_order, o.id, ch.sort_order, ch.id`,
      [rows.map((r) => r.id)]
    );
    for (const r of choiceRows) {
      let options = choicesByItem.get(r.cart_item_id);
      if (!options) {
        options = new Map();
        choicesByItem.set(r.cart_item_id, options);
      }
      let option = options.get(r.option_id);
      if (!option) {
        option = { optionId: r.option_id, optionName: r.option_name, choices: [] };
        options.set(r.option_id, option);
      }
      option.choices.push({
        id: r.choice_id,
        name: r.choice_name,
        price: Number(r.choice_price),
      });
    }
  }

  const items: CartItem[] = rows.map((row) => {
    const options = [...(choicesByItem.get(row.id)?.values() ?? [])];
    const extra = options.reduce(
      (sum, o) => sum + o.choices.reduce((s, c) => s + c.price, 0),
      0
    );
    const unitPrice = Number(row.price) + extra;
    const stock = Number(row.stock);
    return {
      id: row.id,
      productId: row.product_id,
      restaurantId: row.restaurant_id,
      name: row.name,
      unitPrice,
      quantity: row.quantity,
      lineTotal: unitPrice * row.quantity,
      stock,
      isAvailable: Boolean(row.is_available) && stock > 0,
      options,
    };
  });

  return {
    restaurantId: items[0]?.restaurantId ?? null,
    items,
    totalQuantity: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: items.reduce((sum, i) => sum + i.lineTotal, 0),
  };
}

/** 鎖定餐點資料列，序列化同一餐點的併發加購（避免快速連點超賣）。 */
async function lockProductStock(db: Db, productId: number): Promise<void> {
  await db.execute('SELECT id FROM products WHERE id = ? FOR UPDATE', [productId]);
}

async function cartQuantityOfProduct(
  db: Db,
  productId: number,
  excludeItemId?: number
): Promise<number> {
  const [rows] = await db.execute<(RowDataPacket & { qty: string | number })[]>(
    `SELECT COALESCE(SUM(quantity), 0) AS qty
       FROM cart_items
      WHERE product_id = ? AND id <> ?`,
    [productId, excludeItemId ?? 0]
  );
  return Number(rows[0]?.qty ?? 0);
}

export async function addCartItem(
  input: { productId: number; quantity: number; options?: SelectedOption[] }
): Promise<Cart> {
  await withTransaction(async (conn) => {
    await lockProductStock(conn, input.productId);
    // 鎖定後再讀取庫存與價格
    const [fresh] = await priceItems(conn, [input], { enforceRequired: true });

    const [existing] = await conn.query<(RowDataPacket & { restaurant_id: number })[]>(
      `SELECT c.restaurant_id
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
         JOIN categories c ON c.id = p.category_id
        LIMIT 1`
    );
    if (existing[0] && existing[0].restaurant_id !== fresh.restaurantId) {
      throw new ApiError(
        'CART_RESTAURANT_MISMATCH',
        '購物車內已有其他分店的餐點，請先清空購物車或完成結帳',
        409
      );
    }

    const inCart = await cartQuantityOfProduct(conn, fresh.productId);
    assertStock(fresh, inCart + fresh.quantity);

    const [result] = await conn.execute<ResultSetHeader>(
      `INSERT INTO cart_items (product_id, quantity, options_signature)
       VALUES (?, ?, ?) AS new_item
       ON DUPLICATE KEY UPDATE quantity = cart_items.quantity + new_item.quantity`,
      [fresh.productId, fresh.quantity, fresh.signature]
    );

    // affectedRows = 1 代表新增；2 代表合併到既有品項
    if (result.affectedRows === 1 && fresh.choices.length > 0) {
      await conn.query(
        'INSERT INTO cart_item_choices (cart_item_id, option_id, choice_id) VALUES ?',
        [fresh.choices.map((c) => [result.insertId, c.optionId, c.choiceId])]
      );
    }
  });

  return getCart();
}

export async function updateCartItem(itemId: number, quantity: number): Promise<Cart> {
  await withTransaction(async (conn) => {
    const [rows] = await conn.execute<
      (RowDataPacket & { product_id: number; name: string; stock: number; is_available: number })[]
    >(
      `SELECT ci.product_id, p.name, p.stock, p.is_available
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.id = ?`,
      [itemId]
    );
    const row = rows[0];
    if (!row) throw new ApiError('CART_ITEM_NOT_FOUND', '購物車中找不到此品項', 404);

    await lockProductStock(conn, row.product_id);
    const [fresh] = await conn.execute<
      (RowDataPacket & { stock: number; is_available: number })[]
    >('SELECT stock, is_available FROM products WHERE id = ?', [row.product_id]);

    const others = await cartQuantityOfProduct(conn, row.product_id, itemId);
    assertStock(
      {
        productName: row.name,
        stock: Number(fresh[0].stock),
        isAvailable: Boolean(fresh[0].is_available),
      },
      others + quantity
    );

    await conn.execute('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, itemId]);
  });

  return getCart();
}

export async function removeCartItem(itemId: number): Promise<Cart> {
  const [result] = await pool.execute<ResultSetHeader>('DELETE FROM cart_items WHERE id = ?', [
    itemId,
  ]);
  if (result.affectedRows === 0) {
    throw new ApiError('CART_ITEM_NOT_FOUND', '購物車中找不到此品項', 404);
  }
  return getCart();
}

export async function clearCart(db: Db): Promise<void> {
  await db.query('DELETE FROM cart_items');
}
