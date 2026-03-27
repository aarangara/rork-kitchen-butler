import { z } from 'zod';
import { ALL_TAGS, TagCategory } from '@/types/recipe';

export const ingredientSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).transform(s => s.trim()),
  amount: z.string().max(50).transform(s => s.trim()),
  unit: z.string().max(50).transform(s => s.trim()),
});

export const recipeInputSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title too long')
    .transform(s => s.trim()),
  description: z.string()
    .max(2000, 'Description too long')
    .transform(s => s.trim())
    .default(''),
  imageUrl: z.string()
    .url('Invalid image URL')
    .max(2000)
    .optional()
    .or(z.literal('')),
  source: z.enum(['manual', 'instagram', 'pinterest', 'web']).default('manual'),
  sourceUrl: z.string()
    .url('Invalid source URL')
    .max(2000)
    .optional()
    .or(z.literal('')),
  tags: z.array(z.enum(ALL_TAGS as unknown as [TagCategory, ...TagCategory[]]))
    .max(12)
    .default([]),
  ingredients: z.array(ingredientSchema)
    .min(1, 'At least one ingredient required')
    .max(100, 'Too many ingredients'),
  instructions: z.array(
    z.string().min(1).max(2000).transform(s => s.trim())
  )
    .min(1, 'At least one instruction required')
    .max(100, 'Too many instructions'),
  servings: z.number()
    .int()
    .min(1, 'Servings must be at least 1')
    .max(100, 'Servings too high')
    .default(4),
  prepTime: z.number()
    .int()
    .min(0, 'Prep time cannot be negative')
    .max(1440, 'Prep time too long')
    .default(15),
  cookTime: z.number()
    .int()
    .min(0, 'Cook time cannot be negative')
    .max(1440, 'Cook time too long')
    .default(30),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
  isFavorite: z.boolean().default(false),
});

export const recipeSchema = recipeInputSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().datetime(),
});

export const pantryItemInputSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name too long')
    .transform(s => s.trim()),
  category: z.string()
    .min(1, 'Category is required')
    .max(100, 'Category too long')
    .transform(s => s.trim()),
  inStock: z.boolean().default(true),
});

export const pantryItemSchema = pantryItemInputSchema.extend({
  id: z.string().min(1),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const searchSchema = z.object({
  query: z.string().max(200).default(''),
  tags: z.array(z.string()).max(12).default([]),
});

export type RecipeInput = z.infer<typeof recipeInputSchema>;
export type ValidatedRecipe = z.infer<typeof recipeSchema>;
export type PantryItemInput = z.infer<typeof pantryItemInputSchema>;
export type ValidatedPantryItem = z.infer<typeof pantryItemSchema>;
export type PaginationParams = z.infer<typeof paginationSchema>;
export type SearchParams = z.infer<typeof searchSchema>;

export function validateRecipeInput(data: unknown): { success: true; data: RecipeInput } | { success: false; errors: string[] } {
  const result = recipeInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

export function validatePantryItemInput(data: unknown): { success: true; data: PantryItemInput } | { success: false; errors: string[] } {
  const result = pantryItemInputSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}
