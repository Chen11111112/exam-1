// GET /api/orders/:orderId
import { connection } from 'next/server';
import { respond } from '@/lib/api';
import { orderIdSchema } from '@/lib/db/schemas';
import { getOrder } from '@/service/order';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  await connection();
  return respond(async () => getOrder(orderIdSchema.parse((await params).orderId)));
}
