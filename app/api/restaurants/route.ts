// GET /api/restaurants
import { connection } from 'next/server';
import { respond } from '@/lib/api';
import { listRestaurants } from '@/service/restaurant';

export async function GET() {
  await connection();
  return respond(() => listRestaurants());
}
