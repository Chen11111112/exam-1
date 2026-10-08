// GET /api/restaurants
import { connection } from 'next/server';
import { respond } from '@/util/respond';
import { listRestaurants } from '@/service/restaurant';

export async function GET() {
  await connection();
  // lazy evaluation: https://ithelp.ithome.com.tw/articles/10422279
  return respond(() => listRestaurants());
}
