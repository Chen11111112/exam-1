// GET /api/restaurants/:restaurantId/menu
import { connection } from 'next/server';
import { respond } from '@/util/respond';
import { idSchema } from '@/lib/schemas';
import { getMenu } from '@/service/restaurant';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ restaurantId: string }> }
) {
  await connection();
  return respond(async () => getMenu(idSchema.parse((await params).restaurantId)));
}
