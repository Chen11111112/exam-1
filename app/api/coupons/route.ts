// GET /api/coupons[?restaurantId=1]
import { connection, type NextRequest } from 'next/server';
import { respond } from '@/lib/api';
import { idSchema } from '@/lib/db/schemas';
import { listAvailableCoupons } from '@/service/coupon';

export async function GET(request: NextRequest) {
  await connection();
  return respond(async () => {
    const restaurantId = request.nextUrl.searchParams.get('restaurantId');
    return listAvailableCoupons(restaurantId === null ? undefined : idSchema.parse(restaurantId));
  });
}
