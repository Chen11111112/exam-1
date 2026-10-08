// POST /api/coupons/validate
import { readJson } from '@/util/readJson';
import { respond } from '@/util/respond';
import { pool } from '@/lib/mysql';
import { validateCouponSchema } from '@/lib/schemas';
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
