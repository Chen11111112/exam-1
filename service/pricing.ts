// service/pricing.ts — 餐點 / 客製化選項驗證與計價（購物車、優惠券、訂單共用）
import 'server-only';
import { createHash } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { ApiError } from '@/lib/errors';
import type { SelectedOption } from '@/lib/type';

export type Db = Pool | PoolConnection;

export interface ItemInput {
  productId: number;
  quantity: number;
  options?: SelectedOption[];
}

export interface PricedChoice {
  optionId: number;
  optionName: string;
  choiceId: number;
  choiceName: string;
  price: number;
}

export interface PricedLine {
  productId: number;
  productName: string;
  restaurantId: number;
  quantity: number;
  unitPrice: number;
  stock: number;
  isAvailable: boolean;
  choices: PricedChoice[];
  signature: string;
}

type ProductRow = RowDataPacket & {
  id: number;
  name: string;
  price: number;
  stock: number;
  is_available: number;
  restaurant_id: number;
};

type OptionRow = RowDataPacket & {
  product_id: number;
  option_id: number;
  option_name: string;
  required: number;
  multiple: number;
  choice_id: number | null;
  choice_name: string | null;
  choice_price: number | null;
};

interface OptionDef {
  id: number;
  name: string;
  required: boolean;
  multiple: boolean;
  choices: Map<number, { id: number; name: string; price: number }>;
}

export function outOfStock(name: string, stock?: number): ApiError {
  const message =
    stock && stock > 0 ? `${name}庫存不足，目前僅剩 ${stock} 份` : `${name}目前已售罄`;
  return new ApiError('PRODUCT_OUT_OF_STOCK', message, 409);
}

export function assertStock(
  line: { productName: string; stock: number; isAvailable: boolean },
  quantity: number
): void {
  if (!line.isAvailable || line.stock <= 0) throw outOfStock(line.productName);
  if (line.stock < quantity) throw outOfStock(line.productName, line.stock);
}

/**
 * 驗證並計算每個品項的單價。
 * - restaurantId：若提供，餐點必須屬於該分店
 * - enforceRequired：是否強制檢查必選選項（優惠券試算可關閉）
 */
export async function priceItems(
  db: Db,
  items: ItemInput[],
  opts: { restaurantId?: number; enforceRequired: boolean }
): Promise<PricedLine[]> {
  if (items.length === 0) return [];

  const productIds = [...new Set(items.map((i) => i.productId))];

  const [products] = await db.query<ProductRow[]>(
    `SELECT p.id, p.name, p.price, p.stock, p.is_available, c.restaurant_id
       FROM products p
       JOIN categories c ON c.id = p.category_id
      WHERE p.id IN (?)`,
    [productIds]
  );
  const productMap = new Map(products.map((p) => [p.id, p]));

  const [optionRows] = await db.query<OptionRow[]>(
    `SELECT o.product_id, o.id AS option_id, o.name AS option_name, o.required, o.multiple,
            ch.id AS choice_id, ch.name AS choice_name, ch.price AS choice_price
       FROM product_options o
       LEFT JOIN option_choices ch ON ch.option_id = o.id
      WHERE o.product_id IN (?)
      ORDER BY o.sort_order, o.id, ch.sort_order, ch.id`,
    [productIds]
  );
  const optionsByProduct = new Map<number, Map<number, OptionDef>>();
  for (const r of optionRows) {
    let options = optionsByProduct.get(r.product_id);
    if (!options) {
      options = new Map();
      optionsByProduct.set(r.product_id, options);
    }
    let option = options.get(r.option_id);
    if (!option) {
      option = {
        id: r.option_id,
        name: r.option_name,
        required: Boolean(r.required),
        multiple: Boolean(r.multiple),
        choices: new Map(),
      };
      options.set(r.option_id, option);
    }
    if (r.choice_id !== null) {
      option.choices.set(r.choice_id, {
        id: r.choice_id,
        name: r.choice_name as string,
        price: Number(r.choice_price),
      });
    }
  }

  return items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new ApiError('PRODUCT_NOT_FOUND', `找不到餐點 (id: ${item.productId})`, 404);
    }
    if (opts.restaurantId !== undefined && product.restaurant_id !== opts.restaurantId) {
      throw new ApiError('PRODUCT_NOT_FOUND', `${product.name}不屬於所選分店`, 404);
    }

    const defs = optionsByProduct.get(product.id) ?? new Map<number, OptionDef>();
    const selected = new Map<number, number[]>();
    for (const sel of item.options ?? []) {
      if (selected.has(sel.optionId)) {
        throw new ApiError('INVALID_OPTION', `${product.name}的選項重複送出`, 400);
      }
      selected.set(sel.optionId, sel.choiceIds);
    }

    const choices: PricedChoice[] = [];
    for (const [optionId, choiceIds] of selected) {
      const def = defs.get(optionId);
      if (!def) {
        throw new ApiError('INVALID_OPTION', `${product.name}沒有此客製化選項 (id: ${optionId})`, 400);
      }
      if (new Set(choiceIds).size !== choiceIds.length) {
        throw new ApiError('INVALID_OPTION', `「${def.name}」的選項重複送出`, 400);
      }
      if (!def.multiple && choiceIds.length > 1) {
        throw new ApiError('INVALID_OPTION', `「${def.name}」只能選擇一項`, 400);
      }
      for (const choiceId of choiceIds) {
        const choice = def.choices.get(choiceId);
        if (!choice) {
          throw new ApiError('INVALID_OPTION', `「${def.name}」沒有此選項 (id: ${choiceId})`, 400);
        }
        choices.push({
          optionId,
          optionName: def.name,
          choiceId,
          choiceName: choice.name,
          price: choice.price,
        });
      }
    }

    if (opts.enforceRequired) {
      for (const def of defs.values()) {
        if (def.required && !(selected.get(def.id)?.length)) {
          throw new ApiError('INVALID_OPTION', `${product.name}的「${def.name}」為必選項目`, 400);
        }
      }
    }

    const stock = Number(product.stock);
    const signature = createHash('sha1')
      .update(
        choices
          .map((c) => c.choiceId)
          .sort((a, b) => a - b)
          .join(',')
      )
      .digest('hex');

    return {
      productId: product.id,
      productName: product.name,
      restaurantId: product.restaurant_id,
      quantity: item.quantity,
      unitPrice: Number(product.price) + choices.reduce((sum, c) => sum + c.price, 0),
      stock,
      isAvailable: Boolean(product.is_available) && stock > 0,
      choices,
      signature,
    };
  });
}

export function calcSubtotal(lines: { unitPrice: number; quantity: number }[]): number {
  return lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
}
