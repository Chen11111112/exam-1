// GET /api/cart
import { connection } from 'next/server';
import { respond } from '@/util/respond';
import { getCart } from '@/service/cart';

export async function GET() {
  await connection();
  return respond(() => getCart());
}
