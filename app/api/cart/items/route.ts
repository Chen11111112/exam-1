// POST /api/cart/items
import { readJson, respond } from '@/lib/api';
import { addCartItemSchema } from '@/lib/db/schemas';
import { addCartItem } from '@/service/cart';

export async function POST(request: Request) {
  return respond(async () => addCartItem(addCartItemSchema.parse(await readJson(request))), {
    status: 201,
  });
}
