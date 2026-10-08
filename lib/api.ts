// lib/api.ts — Route Handler 共用工具
import 'server-only';
import { ZodError } from 'zod';
import { ApiError } from '@/lib/errors';

/** 讀取 JSON body；格式錯誤時回 400。 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', '請求內容必須是有效的 JSON', 400);
  }
}

/**
 * 執行 controller 邏輯並轉成 Response。
 * - 成功：回傳 JSON（預設 200）
 * - 失敗：回傳對應 HTTP status 與 { code, message }
 */
export async function respond<T>(
  fn: () => Promise<T>,
  opts: {
    status?: number;
    fallback?: { code: 'ORDER_CREATE_FAILED'; message: string };
  } = {}
): Promise<Response> {
  try {
    return Response.json(await fn(), { status: opts.status ?? 200 });
  } catch (e) {
    if (e instanceof ApiError) {
      return Response.json({ code: e.code, message: e.message }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return Response.json(
        {
          code: 'VALIDATION_ERROR',
          message: e.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
        },
        { status: 400 }
      );
    }
    console.error(e);
    return Response.json(
      opts.fallback ?? { code: 'INTERNAL_ERROR', message: '伺服器發生錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}
