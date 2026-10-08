// POST /api/orders、GET /api/orders
import { connection } from 'next/server';
import { readJson } from '@/util/readJson';
import { respond } from '@/util/respond';
import { createOrderSchema } from '@/lib/schemas';
import { createOrder, listOrders } from '@/service/order';

export async function POST(request: Request) {
  return respond(async () => createOrder(createOrderSchema.parse(await readJson(request))), {
    status: 201,
    fallback: { code: 'ORDER_CREATE_FAILED', message: '目前無法建立訂單，請稍後再試' },
  });
}

export async function GET() {
  await connection();
  return respond(() => listOrders());
}
