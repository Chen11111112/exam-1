import 'server-only';

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESTAURANT_NOT_FOUND'
  | 'RESTAURANT_CLOSED'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_OUT_OF_STOCK'
  | 'INVALID_OPTION'
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_RESTAURANT_MISMATCH'
  | 'INVALID_COUPON'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_CREATE_FAILED'
  | 'INTERNAL_ERROR';

/** API 錯誤回應 body（HTTP status 放在 response status） */
export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
