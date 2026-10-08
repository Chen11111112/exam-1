// POST /api/coupons/validate
import { readJson, respond } from '@/lib/api';
import { pool } from '@/lib/db/mysql';
import { validateCouponSchema } from '@/lib/db/schemas';
import { evaluateCoupon } from '@/service/coupon';
import { calcSubtotal, priceItems } from '@/service/pricing';

export async function POST(request: Request) {
  return respond(async () => {
    const body = validateCouponSchema.parse(await readJson(request));
    const lines = await priceItems(pool, body.items, {
      restaurantId: body.restaurantId,
      enforceRequired: false,
    });
    return evaluateCoupon(pool, body.code, body.restaurantId, calcSubtotal(lines));
  });
}
