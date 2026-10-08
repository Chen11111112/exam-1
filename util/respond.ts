/**
 * 執行 controller 邏輯並轉成 Response。
 * - 成功：回傳 JSON（預設 200）
 * - 失敗：回傳對應 HTTP status 與 { code, message }
 */
export async function respond<T>(
    
)