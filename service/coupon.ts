// service/coupon.ts — 優惠券
import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { pool } from '@/lib/db/mysql';
import type { Coupon, CouponValidation, DiscountType } from '@/lib/type';
import type { Db } from '@/service/pricing';

type CouponRow = RowDataPacket & {
  id: string;
  name: string;
  discount_type: DiscountType;
  discount: number;
  minimum_amount: number;
  expired_at: string;
  is_active: number;
  restaurant_id: number | null;
  is_expired: number;
};

const SELECT_COUPON = `SELECT id, name, discount_type, discount, minimum_amount, expired_at,
                              is_active, restaurant_id, (expired_at < CURDATE()) AS is_expired
                         FROM coupons`;

function mapCoupon(row: CouponRow): Coupon {
  return {
    id: row.id,
    name: row.name,
    discountType: row.discount_type,
    discount: Number(row.discount),
    minimumAmount: Number(row.minimum_amount),
    expiredAt: String(row.expired_at).slice(0, 10),
  };
}

export async function listAvailableCoupons(restaurantId?: number): Promise<Coupon[]> {
  const [rows] = await pool.query<CouponRow[]>(
    `${SELECT_COUPON}
      WHERE is_active = 1
        AND expired_at >= CURDATE()
        ${restaurantId === undefined ? '' : 'AND (restaurant_id IS NULL OR restaurant_id = ?)'}
      ORDER BY expired_at ASC, id ASC`,
    restaurantId === undefined ? [] : [restaurantId]
  );
  return rows.map(mapCoupon);
}

/** 依訂單小計驗證優惠券；不會丟出錯誤，結果以 valid 表示。 */
export async function evaluateCoupon(
  db: Db,
  code: string,
  restaurantId: number,
  subtotal: number
): Promise<CouponValidation> {
  const fail = (message: string): CouponValidation => ({ valid: false, discount: 0, message });

  const [rows] = await db.execute<CouponRow[]>(`${SELECT_COUPON} WHERE id = ?`, [code]);
  const coupon = rows[0];

  if (!coupon || !coupon.is_active) return fail('優惠券不存在或已停用');
  if (coupon.is_expired) return fail('優惠券已過期');
  if (coupon.restaurant_id !== null && coupon.restaurant_id !== restaurantId) {
    return fail('此優惠券不適用於所選分店');
  }
  if (subtotal < Number(coupon.minimum_amount)) return fail('訂單金額未達使用門檻');

  const raw =
    coupon.discount_type === 'PERCENT'
      ? Math.floor((subtotal * Number(coupon.discount)) / 100)
      : Number(coupon.discount);
  const discount = Math.min(raw, subtotal);

  return { valid: true, discount, message: '優惠券可以使用' };
}
