// 對應 swagger.md 的 API 型別（server / client 皆可 import）

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  isOpen: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

export interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

export interface Menu {
  restaurantId: number;
  categories: MenuCategory[];
}

export interface ProductChoice {
  id: number;
  name: string;
  price: number;
}

export interface ProductOption {
  id: number;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: ProductChoice[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  stock: number;
  isAvailable: boolean;
  options: ProductOption[];
}

export interface SelectedOption {
  optionId: number;
  choiceIds: number[];
}

export interface CartLineOption {
  optionId: number;
  optionName: string;
  choices: ProductChoice[];
}

export interface CartItem {
  id: number;
  productId: number;
  restaurantId: number;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  stock: number;
  isAvailable: boolean;
  options: CartLineOption[];
}

export interface Cart {
  restaurantId: number | null;
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
}

export type DiscountType = 'FIXED' | 'PERCENT';

export interface Coupon {
  id: string;
  name: string;
  discountType: DiscountType;
  discount: number;
  minimumAmount: number;
  expiredAt: string;
}

export interface CouponValidation {
  valid: boolean;
  discount: number;
  message: string;
}

export type OrderType = 'TAKEOUT' | 'DINE_IN';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreatedOrder {
  orderId: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
}

export interface OrderSummary {
  orderId: string;
  restaurantName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
}

export interface OrderDetailItem {
  productName: string;
  quantity: number;
  price: number;
  options: string[];
}

export interface OrderDetail {
  orderId: string;
  restaurantName: string;
  orderType: OrderType;
  items: OrderDetailItem[];
  subtotal: number;
  discount: number;
  total: number;
  status: OrderStatus;
  estimatedReadyTime: string | null;
}

