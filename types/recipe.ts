export interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  source: 'manual' | 'instagram' | 'pinterest' | 'tiktok' | 'web';
  sourceUrl?: string;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: string;
  isFavorite: boolean;
}

export interface PantryItem {
  id: string;
  name: string;
  category: string;
  inStock: boolean;
}

export type TagCategory = 
  | 'breakfast' 
  | 'lunch' 
  | 'dinner' 
  | 'dessert' 
  | 'snack'
  | 'vegetarian'
  | 'quick'
  | 'healthy'
  | 'comfort'
  | 'italian'
  | 'asian'
  | 'mexican';

export const ALL_TAGS: TagCategory[] = [
  'breakfast',
  'lunch', 
  'dinner',
  'dessert',
  'snack',
  'vegetarian',
  'quick',
  'healthy',
  'comfort',
  'italian',
  'asian',
  'mexican',
];
