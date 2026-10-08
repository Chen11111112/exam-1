// GET /api/products/:productId
import { connection } from 'next/server';
import { respond } from '@/util/respond';
import { idSchema } from '@/lib/schemas';
import { getProductById } from '@/service/product';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  await connection();
  return respond(async () => getProductById(idSchema.parse((await params).productId)));
}
