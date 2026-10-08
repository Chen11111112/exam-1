// PATCH /api/cart/items/:itemId、DELETE /api/cart/items/:itemId
import { readJson } from '@/util/readJson';
import { respond } from '@/util/respond';
import { idSchema, updateCartItemSchema } from '@/lib/schemas';
import { removeCartItem, updateCartItem } from '@/service/cart';

type Ctx = { params: Promise<{ itemId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  return respond(async () => {
    const itemId = idSchema.parse((await params).itemId);
    const body = updateCartItemSchema.parse(await readJson(request));
    return updateCartItem(itemId, body.quantity);
  });
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return respond(async () => removeCartItem(idSchema.parse((await params).itemId)));
}
