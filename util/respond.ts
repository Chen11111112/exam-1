import { ApiError } from '@/util/errors';
import { ZodError } from 'zod';
import 'server-only';

/**
 * 執行 controller 邏輯並轉成 Response。
 * - 成功：回傳 JSON（預設 200）
 * - 失敗：回傳對應 HTTP status 與 { code, message }
 */
export async function respond<T, FCode extends string = 'INTERNAL_ERROR'>(
    fn: () => Promise<T>, // service function
    opts: { // throw error's feedback: { code, message }
        status?: number;
        fallback?: { code: FCode; message: string };
    } = {} // default empty value {}
): Promise<Response> {
    // about Response Class: https://developer.mozilla.org/zh-TW/docs/Web/API/Response
    try {
        return Response.json(await fn(), { status: opts.status ?? 200 });
    } catch (e) {
        // intercept the API error
        if (e instanceof ApiError) {
            return Response.json({ code: e.code, message: e.message }, { status: e.status });
        }

        // intercept the Zod error
        if (e instanceof ZodError) {
            return Response.json(
                {
                    code: 'VALIDATION_ERROR',
                    message: e.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`).join('; '),
                },
                { status: 400 }
            );
        }

        // unexpected error
        console.error(e);
        return Response.json(
            opts.fallback ?? { code: 'INTERNAL_ERROR', message: '伺服器發生錯誤，請稍後再試' },
            { status: 500 }
        );
    }
}