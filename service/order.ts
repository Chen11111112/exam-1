// service/order.ts — 訂單
import 'server-only';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '@/lib/mysql';
import { ApiError } from '@/util/errors';
import type {
  CreatedOrder,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  OrderType,
  SelectedOption,
} from '@/lib/type';
import { clearCart } from '@/service/cart';
import { evaluateCoupon } from '@/service/coupon';
import { calcSubtotal, outOfStock, priceItems } from '@/service/pricing';

type OrderRow = RowDataPacket & {
  id: string;
  restaurant_name: string;
  order_type: OrderType;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  total: number;
  ready_time: string | null;
  created_at: string;
};

type OrderItemRow = RowDataPacket & {
  product_name: string;
  quantity: number;
  unit_price: number;
  options_snapshot: { optionName: string; choiceName: string; price: number }[] | string | null;
};

/** MySQL DATETIME ("2026-10-07 18:30:00") → "2026-10-07T18:30:00" */
function toIsoLocal(value: string): string {
  return String(value).replace(' ', 'T');
}

export async function createOrder(
  input: {
    restaurantId: number;
    orderType: OrderType;
    items: { productId: number; quantity: number; options?: SelectedOption[] }[];
    couponCode?: string;
  }
): Promise<CreatedOrder> {
  return withTransaction(async (conn) => {
    const [restaurants] = await conn.execute<(RowDataPacket & { is_open: number })[]>(
      'SELECT is_open FROM restaurants WHERE id = ?',
      [input.restaurantId]
    );
    if (!restaurants[0]) {
      throw new ApiError('RESTAURANT_NOT_FOUND', '找不到指定的分店', 404);
    }
    if (!restaurants[0].is_open) {
      throw new ApiError('RESTAURANT_CLOSED', '此分店目前未營業，無法建立訂單', 409);
    }

    const lines = await priceItems(conn, input.items, {
      restaurantId: input.restaurantId,
      enforceRequired: true,
    });

    // 依餐點扣庫存（以 id 排序避免 deadlock；條件式 UPDATE 防止超賣）
    const qtyByProduct = new Map<number, { name: string; quantity: number }>();
    for (const line of lines) {
      const entry = qtyByProduct.get(line.productId);
      if (entry) entry.quantity += line.quantity;
      else qtyByProduct.set(line.productId, { name: line.productName, quantity: line.quantity });
    }
    for (const [productId, { name, quantity }] of [...qtyByProduct].sort((a, b) => a[0] - b[0])) {
      const [result] = await conn.execute<ResultSetHeader>(
        `UPDATE products
            SET stock = stock - ?
          WHERE id = ? AND is_available = 1 AND stock >= ?`,
        [quantity, productId, quantity]
      );
      if (result.affectedRows === 0) throw outOfStock(name);
    }

    const subtotal = calcSubtotal(lines);

    let discount = 0;
    let couponCode: string | null = null;
    if (input.couponCode) {
      const result = await evaluateCoupon(conn, input.couponCode, input.restaurantId, subtotal);
      if (!result.valid) {
        throw new ApiError('INVALID_COUPON', result.message, 400);
      }
      discount = result.discount;
      couponCode = input.couponCode;
    }
    const total = Math.max(subtotal - discount, 0);

    // 訂單編號：ORD + yyyymmdd + 4 碼流水號
    await conn.execute(
      `INSERT INTO order_counters (order_date, last_seq)
       VALUES (CURDATE(), LAST_INSERT_ID(1))
       ON DUPLICATE KEY UPDATE last_seq = LAST_INSERT_ID(last_seq + 1)`
    );
    const [seqRows] = await conn.query<(RowDataPacket & { seq: number | string; d: string })[]>(
      "SELECT LAST_INSERT_ID() AS seq, DATE_FORMAT(CURDATE(), '%Y%m%d') AS d"
    );
    const orderId = `ORD${seqRows[0].d}${String(Number(seqRows[0].seq)).padStart(4, '0')}`;

    const totalQuantity = lines.reduce((sum, l) => sum + l.quantity, 0);
    const prepMinutes = Math.min(15 + totalQuantity * 5, 60);

    await conn.execute(
      `INSERT INTO orders
         (id, restaurant_id, order_type, status, subtotal, discount, total,
          coupon_code, estimated_ready_at)
       VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [
        orderId,
        input.restaurantId,
        input.orderType,
        subtotal,
        discount,
        total,
        couponCode,
        prepMinutes,
      ]
    );

    await conn.query(
      `INSERT INTO order_items
         (order_id, product_id, product_name, quantity, unit_price, options_snapshot)
       VALUES ?`,
      [
        lines.map((l) => [
          orderId,
          l.productId,
          l.productName,
          l.quantity,
          l.unitPrice,
          JSON.stringify(
            l.choices.map((c) => ({
              optionName: c.optionName,
              choiceName: c.choiceName,
              price: c.price,
            }))
          ),
        ]),
      ]
    );

    await clearCart(conn);

    const [created] = await conn.execute<(RowDataPacket & { created_at: string })[]>(
      'SELECT created_at FROM orders WHERE id = ?',
      [orderId]
    );

    return {
      orderId,
      status: 'PENDING' as const,
      total,
      createdAt: toIsoLocal(created[0].created_at),
    };
  });
}

export async function listOrders(): Promise<OrderSummary[]> {
  const [rows] = await pool.query<OrderRow[]>(
    `SELECT o.id, r.name AS restaurant_name, o.total, o.status, o.created_at
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      ORDER BY o.created_at DESC, o.id DESC`
  );

  return rows.map((row) => ({
    orderId: row.id,
    restaurantName: row.restaurant_name,
    total: Number(row.total),
    status: row.status,
    createdAt: toIsoLocal(row.created_at),
  }));
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  const [rows] = await pool.execute<OrderRow[]>(
    `SELECT o.id, r.name AS restaurant_name, o.order_type, o.status,
            o.subtotal, o.discount, o.total,
            DATE_FORMAT(o.estimated_ready_at, '%H:%i') AS ready_time, o.created_at
       FROM orders o
       JOIN restaurants r ON r.id = o.restaurant_id
      WHERE o.id = ?`,
    [orderId]
  );
  const order = rows[0];
  if (!order) throw new ApiError('ORDER_NOT_FOUND', '找不到指定的訂單', 404);

  const [itemRows] = await pool.execute<OrderItemRow[]>(
    `SELECT product_name, quantity, unit_price, options_snapshot
       FROM order_items WHERE order_id = ? ORDER BY id ASC`,
    [orderId]
  );

  return {
    orderId: order.id,
    restaurantName: order.restaurant_name,
    orderType: order.order_type,
    items: itemRows.map((item) => {
      const snapshot =
        typeof item.options_snapshot === 'string'
          ? (JSON.parse(item.options_snapshot) as { optionName: string; choiceName: string }[])
          : (item.options_snapshot ?? []);
      return {
        productName: item.product_name,
        quantity: item.quantity,
        price: Number(item.unit_price),
        options: snapshot.map((s) => `${s.optionName}：${s.choiceName}`),
      };
    }),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    total: Number(order.total),
    status: order.status,
    estimatedReadyTime: order.status === 'CANCELLED' ? null : order.ready_time,
  };
}
