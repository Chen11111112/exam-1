import 'server-only';

import { ApiError } from '@/util/errors';

/** 讀取 JSON body；格式錯誤時回 400。 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError('VALIDATION_ERROR', '請求內容必須是有效的 JSON', 400);
  }
}
