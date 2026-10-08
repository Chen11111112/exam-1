// GET /api/products/:productId
import { connection } from 'next/server';
import { respond } from '@/lib/api';
import { idSchema } from '@/lib/db/schemas';
import { getProductById } from '@/service/product';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  await connection();
  return respond(async () => getProductById(idSchema.parse((await params).productId)));
}
