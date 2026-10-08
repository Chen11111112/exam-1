// POST /api/cart/items
import { readJson } from '@/util/readJson';
import { respond } from '@/util/respond';
import { addCartItemSchema } from '@/lib/schemas';
import { addCartItem } from '@/service/cart';

export async function POST(request: Request) {
  return respond(async () => addCartItem(addCartItemSchema.parse(await readJson(request))), {
    status: 201,
  });
}
