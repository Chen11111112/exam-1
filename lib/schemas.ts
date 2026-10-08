import { z } from 'zod';

export const idSchema = z.coerce.number().int().positive();

export const selectedOptionSchema = z.object({
  optionId: idSchema,
  choiceIds: z.array(idSchema).max(50),
});

export const quantitySchema = z.number().int().min(1).max(99);

export const addCartItemSchema = z.object({
  productId: idSchema,
  quantity: quantitySchema,
  options: z.array(selectedOptionSchema).max(20).default([]),
});

export const updateCartItemSchema = z.object({
  quantity: quantitySchema,
});

export const couponCodeSchema = z.string().trim().min(1).max(32);

export const validateCouponSchema = z.object({
  code: couponCodeSchema,
  restaurantId: idSchema,
  items: z
    .array(
      z.object({
        productId: idSchema,
        quantity: quantitySchema,
        options: z.array(selectedOptionSchema).max(20).optional(),
      })
    )
    .min(1)
    .max(50),
});

export const createOrderSchema = z.object({
  restaurantId: idSchema,
  orderType: z.enum(['TAKEOUT', 'DINE_IN']),
  items: z
    .array(
      z.object({
        productId: idSchema,
        quantity: quantitySchema,
        options: z.array(selectedOptionSchema).max(20).default([]),
      })
    )
    .min(1)
    .max(50),
  couponCode: couponCodeSchema.optional(),
});

export const orderIdSchema = z.string().trim().regex(/^ORD\d{12}$/);
