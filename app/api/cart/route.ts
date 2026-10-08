// GET /api/cart
import { connection } from 'next/server';
import { respond } from '@/lib/api';
import { getCart } from '@/service/cart';

export async function GET() {
  await connection();
  return respond(() => getCart());
}
