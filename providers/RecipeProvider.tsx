import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Recipe, PantryItem } from '@/types/recipe';
import { mockRecipes, mockPantryItems } from '@/mocks/recipes';
import { 
  sanitizeString, 
  sanitizeUrl, 
  sanitizeNumber, 
  checkRateLimit, 
  RATE_LIMITS,
  generateSecureId 
} from '@/utils/security';
import { logAuditEvent } from '@/utils/audit';
import { memoryCache, createCacheKey, compressData, decompressData } from '@/utils/cache';
import { trpc, isBackendEnabled } from '@/lib/trpc';

const RECIPES_KEY = 'kitchenbutler_recipes';
const PANTRY_KEY = 'kitchenbutler_pantry';
const LAST_SYNC_KEY = 'kitchenbutler_last_sync';

const MAX_RECIPES = 500;
const MAX_PANTRY_ITEMS = 1000;
const CURRENT_DATA_VERSION = 1;
const BATCH_SAVE_DELAY = 500;
const SYNC_INTERVAL = 5 * 60 * 1000;

export const [RecipeProvider, useRecipes] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  
  const recipeSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pantrySaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRecipesRef = useRef<Recipe[] | null>(null);
  const pendingPantryRef = useRef<PantryItem[] | null>(null);
  
  const backendEnabled = isBackendEnabled();

  const recipesQuery = useQuery({
    queryKey: ['recipes'],
    queryFn: async () => {
      const cacheKey = createCacheKey('recipes', 'all');
      const cached = memoryCache.get<Recipe[]>(cacheKey);
      if (cached) {
        console.log(`Loaded ${cached.length} recipes from memory cache`);
        return cached;
      }
      
      try {
        const stored = await AsyncStorage.getItem(RECIPES_KEY);
        if (stored) {
          const decompressed = stored.startsWith('\x00') ? decompressData(stored) : stored;
          const parsed = JSON.parse(decompressed) as Recipe[];
          const limited = parsed.slice(0, MAX_RECIPES);
          memoryCache.set(cacheKey, limited, 10 * 60 * 1000);
          console.log(`Loaded ${limited.length} recipes from local storage`);
          logAuditEvent('DATA_IMPORT', 'Recipes loaded from storage', {
            metadata: { count: limited.length },
          });
          return limited;
        }
        await AsyncStorage.setItem(RECIPES_KEY, JSON.stringify(mockRecipes));
        memoryCache.set(cacheKey, mockRecipes, 10 * 60 * 1000);
        return mockRecipes;
      } catch (error) {
        console.error('Failed to load recipes:', error);
        logAuditEvent('API_ERROR', 'Failed to load recipes', {
          severity: 'error',
          metadata: { error: error instanceof Error ? error.message : 'Unknown' },
        });
        return mockRecipes;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const pantryQuery = useQuery({
    queryKey: ['pantry'],
    queryFn: async () => {
      const cacheKey = createCacheKey('pantry', 'all');
      const cached = memoryCache.get<PantryItem[]>(cacheKey);
      if (cached) {
        console.log(`Loaded ${cached.length} pantry items from memory cache`);
        return cached;
      }
      
      try {
        const stored = await AsyncStorage.getItem(PANTRY_KEY);
        if (stored) {
          const decompressed = stored.startsWith('\x00') ? decompressData(stored) : stored;
          const parsed = JSON.parse(decompressed) as PantryItem[];
          const limited = parsed.slice(0, MAX_PANTRY_ITEMS);
          memoryCache.set(cacheKey, limited, 10 * 60 * 1000);
          console.log(`Loaded ${limited.length} pantry items from storage`);
          return limited;
        }
        await AsyncStorage.setItem(PANTRY_KEY, JSON.stringify(mockPantryItems));
        memoryCache.set(cacheKey, mockPantryItems, 10 * 60 * 1000);
        return mockPantryItems;
      } catch (error) {
        console.error('Failed to load pantry:', error);
        logAuditEvent('API_ERROR', 'Failed to load pantry', {
          severity: 'error',
          metadata: { error: error instanceof Error ? error.message : 'Unknown' },
        });
        return mockPantryItems;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  useEffect(() => {
    if (recipesQuery.data) {
      setRecipes(recipesQuery.data);
    }
  }, [recipesQuery.data]);

  useEffect(() => {
    if (pantryQuery.data) {
      setPantryItems(pantryQuery.data);
    }
  }, [pantryQuery.data]);

  const { mutate: saveRecipesImmediate } = useMutation({
    mutationFn: async (newRecipes: Recipe[]) => {
      const limited = newRecipes.slice(0, MAX_RECIPES);
      const jsonData = JSON.stringify(limited);
      const compressed = jsonData.length > 10000 ? compressData(jsonData) : jsonData;
      await AsyncStorage.setItem(RECIPES_KEY, compressed);
      memoryCache.set(createCacheKey('recipes', 'all'), limited, 10 * 60 * 1000);
      return limited;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
    onError: (error) => {
      console.error('Failed to save recipes:', error);
      logAuditEvent('API_ERROR', 'Failed to save recipes', {
        severity: 'error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    },
  });

  const saveRecipes = useCallback((newRecipes: Recipe[]) => {
    pendingRecipesRef.current = newRecipes;
    
    if (recipeSaveTimeoutRef.current) {
      clearTimeout(recipeSaveTimeoutRef.current);
    }
    
    recipeSaveTimeoutRef.current = setTimeout(() => {
      if (pendingRecipesRef.current) {
        saveRecipesImmediate(pendingRecipesRef.current);
        pendingRecipesRef.current = null;
      }
    }, BATCH_SAVE_DELAY);
  }, [saveRecipesImmediate]);

  const { mutate: savePantryImmediate } = useMutation({
    mutationFn: async (newPantry: PantryItem[]) => {
      const limited = newPantry.slice(0, MAX_PANTRY_ITEMS);
      const jsonData = JSON.stringify(limited);
      const compressed = jsonData.length > 5000 ? compressData(jsonData) : jsonData;
      await AsyncStorage.setItem(PANTRY_KEY, compressed);
      memoryCache.set(createCacheKey('pantry', 'all'), limited, 10 * 60 * 1000);
      return limited;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pantry'] });
    },
    onError: (error) => {
      console.error('Failed to save pantry:', error);
      logAuditEvent('API_ERROR', 'Failed to save pantry', {
        severity: 'error',
        metadata: { error: error instanceof Error ? error.message : 'Unknown' },
      });
    },
  });

  const savePantry = useCallback((newPantry: PantryItem[]) => {
    pendingPantryRef.current = newPantry;
    
    if (pantrySaveTimeoutRef.current) {
      clearTimeout(pantrySaveTimeoutRef.current);
    }
    
    pantrySaveTimeoutRef.current = setTimeout(() => {
      if (pendingPantryRef.current) {
        savePantryImmediate(pendingPantryRef.current);
        pendingPantryRef.current = null;
      }
    }, BATCH_SAVE_DELAY);
  }, [savePantryImmediate]);

  const addRecipe = useCallback((recipeInput: Omit<Recipe, 'id' | 'createdAt'>) => {
    const rateCheck = checkRateLimit('recipe_create', RATE_LIMITS.RECIPE_CREATE);
    if (!rateCheck.allowed) {
      console.warn('Rate limit exceeded for recipe creation');
      throw new Error('Too many recipes created. Please wait a moment.');
    }

    if (recipes.length >= MAX_RECIPES) {
      throw new Error(`Maximum recipe limit (${MAX_RECIPES}) reached`);
    }

    const sanitizedInput = {
      ...recipeInput,
      title: sanitizeString(recipeInput.title),
      description: sanitizeString(recipeInput.description),
      imageUrl: sanitizeUrl(recipeInput.imageUrl) || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800',
      sourceUrl: recipeInput.sourceUrl ? sanitizeUrl(recipeInput.sourceUrl) : undefined,
      ingredients: recipeInput.ingredients.map(ing => ({
        ...ing,
        name: sanitizeString(ing.name),
        amount: sanitizeString(ing.amount),
        unit: sanitizeString(ing.unit),
      })),
      instructions: recipeInput.instructions.map(inst => sanitizeString(inst)),
      servings: sanitizeNumber(recipeInput.servings, 1, 100, 4),
      prepTime: sanitizeNumber(recipeInput.prepTime, 0, 1440, 15),
      cookTime: sanitizeNumber(recipeInput.cookTime, 0, 1440, 30),
    };

    const newRecipe: Recipe = {
      ...sanitizedInput,
      id: generateSecureId(),
      createdAt: new Date().toISOString(),
    };

    const updated = [...recipes, newRecipe];
    setRecipes(updated);
    saveRecipes(updated);
    console.log(`Recipe created: ${newRecipe.title} (${newRecipe.id})`);
    logAuditEvent('RECIPE_CREATE', `Recipe created: ${newRecipe.title}`, {
      resourceId: newRecipe.id,
      metadata: { title: newRecipe.title, ingredientCount: newRecipe.ingredients.length },
    });
    return newRecipe;
  }, [recipes, saveRecipes]);

  const updateRecipe = useCallback((id: string, updates: Partial<Recipe>) => {
    const sanitizedUpdates: Partial<Recipe> = {};
    
    if (updates.title) sanitizedUpdates.title = sanitizeString(updates.title);
    if (updates.description) sanitizedUpdates.description = sanitizeString(updates.description);
    if (updates.imageUrl) sanitizedUpdates.imageUrl = sanitizeUrl(updates.imageUrl);
    if (updates.sourceUrl) sanitizedUpdates.sourceUrl = sanitizeUrl(updates.sourceUrl);
    if (updates.ingredients) {
      sanitizedUpdates.ingredients = updates.ingredients.map(ing => ({
        ...ing,
        name: sanitizeString(ing.name),
        amount: sanitizeString(ing.amount),
        unit: sanitizeString(ing.unit),
      }));
    }
    if (updates.instructions) {
      sanitizedUpdates.instructions = updates.instructions.map(inst => sanitizeString(inst));
    }
    if (updates.servings !== undefined) {
      sanitizedUpdates.servings = sanitizeNumber(updates.servings, 1, 100, 4);
    }
    if (updates.prepTime !== undefined) {
      sanitizedUpdates.prepTime = sanitizeNumber(updates.prepTime, 0, 1440, 15);
    }
    if (updates.cookTime !== undefined) {
      sanitizedUpdates.cookTime = sanitizeNumber(updates.cookTime, 0, 1440, 30);
    }
    if (updates.difficulty) sanitizedUpdates.difficulty = updates.difficulty;
    if (updates.tags) sanitizedUpdates.tags = updates.tags;
    if (updates.source) sanitizedUpdates.source = updates.source;
    if (updates.isFavorite !== undefined) sanitizedUpdates.isFavorite = updates.isFavorite;

    const updated = recipes.map(r => r.id === id ? { ...r, ...sanitizedUpdates } : r);
    setRecipes(updated);
    saveRecipes(updated);
    console.log(`Recipe updated: ${id}`);
    logAuditEvent('RECIPE_UPDATE', `Recipe updated: ${id}`, {
      resourceId: id,
      metadata: { updatedFields: Object.keys(sanitizedUpdates) },
    });
  }, [recipes, saveRecipes]);

  const deleteRecipe = useCallback((id: string) => {
    const recipe = recipes.find(r => r.id === id);
    const updated = recipes.filter(r => r.id !== id);
    setRecipes(updated);
    saveRecipes(updated);
    console.log(`Recipe deleted: ${id}`);
    logAuditEvent('RECIPE_DELETE', `Recipe deleted: ${recipe?.title || id}`, {
      resourceId: id,
      metadata: { title: recipe?.title },
    });
  }, [recipes, saveRecipes]);

  const toggleFavorite = useCallback((id: string) => {
    const updated = recipes.map(r => 
      r.id === id ? { ...r, isFavorite: !r.isFavorite } : r
    );
    setRecipes(updated);
    saveRecipes(updated);
  }, [recipes, saveRecipes]);

  const togglePantryItem = useCallback((id: string) => {
    const rateCheck = checkRateLimit('pantry_update', RATE_LIMITS.PANTRY_UPDATE);
    if (!rateCheck.allowed) {
      console.warn('Rate limit exceeded for pantry updates');
      logAuditEvent('RATE_LIMIT_HIT', 'Pantry update rate limited', {
        severity: 'warning',
        resourceId: id,
      });
      return;
    }

    const updated = pantryItems.map(item =>
      item.id === id ? { ...item, inStock: !item.inStock } : item
    );
    setPantryItems(updated);
    savePantry(updated);
    logAuditEvent('PANTRY_UPDATE', `Pantry item toggled: ${id}`, {
      resourceId: id,
    });
  }, [pantryItems, savePantry]);

  const addPantryItem = useCallback((itemInput: Omit<PantryItem, 'id'>) => {
    if (pantryItems.length >= MAX_PANTRY_ITEMS) {
      throw new Error(`Maximum pantry item limit (${MAX_PANTRY_ITEMS}) reached`);
    }

    const sanitizedInput = {
      name: sanitizeString(itemInput.name),
      category: sanitizeString(itemInput.category),
      inStock: Boolean(itemInput.inStock),
    };

    const newItem: PantryItem = {
      ...sanitizedInput,
      id: generateSecureId(),
    };
    const updated = [...pantryItems, newItem];
    setPantryItems(updated);
    savePantry(updated);
    console.log(`Pantry item created: ${newItem.name} (${newItem.id})`);
    logAuditEvent('PANTRY_UPDATE', `Pantry item created: ${newItem.name}`, {
      resourceId: newItem.id,
      metadata: { name: newItem.name, category: newItem.category },
    });
  }, [pantryItems, savePantry]);

  const removePantryItem = useCallback((id: string) => {
    const item = pantryItems.find(i => i.id === id);
    const updated = pantryItems.filter(i => i.id !== id);
    setPantryItems(updated);
    savePantry(updated);
    console.log(`Pantry item deleted: ${id}`);
    logAuditEvent('PANTRY_UPDATE', `Pantry item deleted: ${item?.name || id}`, {
      resourceId: id,
      metadata: { name: item?.name },
    });
  }, [pantryItems, savePantry]);

  const getFeaturedRecipe = useCallback(() => {
    const favorites = recipes.filter(r => r.isFavorite);
    if (favorites.length > 0) {
      const today = new Date().getDate();
      return favorites[today % favorites.length];
    }
    if (recipes.length > 0) {
      const today = new Date().getDate();
      return recipes[today % recipes.length];
    }
    return null;
  }, [recipes]);

  const getMatchingRecipes = useCallback(() => {
    const inStockItems = pantryItems
      .filter(item => item.inStock)
      .map(item => item.name.toLowerCase());

    return recipes
      .map(recipe => {
        const recipeIngredients = recipe.ingredients.map(i => i.name.toLowerCase());
        const matchCount = recipeIngredients.filter(ing => 
          inStockItems.some(stock => ing.includes(stock) || stock.includes(ing))
        ).length;
        const matchPercent = (matchCount / recipeIngredients.length) * 100;
        return { recipe, matchPercent, matchCount, totalIngredients: recipeIngredients.length };
      })
      .filter(item => item.matchPercent >= 50)
      .sort((a, b) => b.matchPercent - a.matchPercent);
  }, [recipes, pantryItems]);

  const getRecipesPaginated = useCallback((page: number, limit: number = 20) => {
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
      recipes: recipes.slice(start, end),
      total: recipes.length,
      hasMore: end < recipes.length,
      page,
      limit,
    };
  }, [recipes]);

  const stats = useMemo(() => ({
    totalRecipes: recipes.length,
    favoriteRecipes: recipes.filter(r => r.isFavorite).length,
    totalPantryItems: pantryItems.length,
    inStockItems: pantryItems.filter(p => p.inStock).length,
    cacheStats: memoryCache.getStats(),
  }), [recipes, pantryItems]);

  const batchUpdatePantry = useCallback((updates: { id: string; inStock: boolean }[]) => {
    const rateCheck = checkRateLimit('pantry_update', RATE_LIMITS.PANTRY_UPDATE);
    if (!rateCheck.allowed) {
      console.warn('Rate limit exceeded for batch pantry updates');
      return;
    }

    const updateMap = new Map(updates.map(u => [u.id, u.inStock]));
    const updated = pantryItems.map(item => 
      updateMap.has(item.id) ? { ...item, inStock: updateMap.get(item.id)! } : item
    );
    setPantryItems(updated);
    savePantry(updated);
    logAuditEvent('PANTRY_UPDATE', `Batch updated ${updates.length} pantry items`, {
      metadata: { count: updates.length },
    });
  }, [pantryItems, savePantry]);

  const exportData = useCallback(async () => {
    const data = {
      version: CURRENT_DATA_VERSION,
      exportedAt: new Date().toISOString(),
      recipes,
      pantryItems,
    };
    logAuditEvent('DATA_EXPORT', 'Data exported', {
      metadata: { recipeCount: recipes.length, pantryCount: pantryItems.length },
    });
    return data;
  }, [recipes, pantryItems]);

  const importData = useCallback(async (data: { recipes?: Recipe[]; pantryItems?: PantryItem[] }) => {
    if (data.recipes) {
      const sanitized = data.recipes.slice(0, MAX_RECIPES).map(r => ({
        ...r,
        title: sanitizeString(r.title),
        description: sanitizeString(r.description),
        imageUrl: sanitizeUrl(r.imageUrl) || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=800',
      }));
      setRecipes(sanitized);
      saveRecipes(sanitized);
    }
    if (data.pantryItems) {
      const sanitized = data.pantryItems.slice(0, MAX_PANTRY_ITEMS).map(p => ({
        ...p,
        name: sanitizeString(p.name),
        category: sanitizeString(p.category),
      }));
      setPantryItems(sanitized);
      savePantry(sanitized);
    }
    logAuditEvent('DATA_IMPORT', 'Data imported', {
      metadata: { 
        recipeCount: data.recipes?.length || 0, 
        pantryCount: data.pantryItems?.length || 0,
      },
    });
  }, [saveRecipes, savePantry]);

  const backendRecipesQuery = trpc.recipes.list.useQuery(
    undefined,
    { enabled: backendEnabled, staleTime: 5 * 60 * 1000, retry: 1, retryDelay: 5000 }
  );

  const backendPantryQuery = trpc.pantry.list.useQuery(
    undefined,
    { enabled: backendEnabled, staleTime: 5 * 60 * 1000, retry: 1, retryDelay: 5000 }
  );

  const recipeSyncMutation = trpc.recipes.sync.useMutation();
  const pantrySyncMutation = trpc.pantry.sync.useMutation();

  const syncToBackendFn = useCallback(async () => {
    if (!backendEnabled) return;
    setIsSyncing(true);
    console.log('Starting sync to backend...');

    try {
      if (recipes.length > 0) {
        await recipeSyncMutation.mutateAsync({
          recipes,
          lastSyncTime: lastSyncTime || undefined,
        });
        console.log(`Synced ${recipes.length} recipes to backend`);
      }

      if (pantryItems.length > 0) {
        await pantrySyncMutation.mutateAsync({
          items: pantryItems,
        });
        console.log(`Synced ${pantryItems.length} pantry items to backend`);
      }

      const now = new Date().toISOString();
      setLastSyncTime(now);
      await AsyncStorage.setItem(LAST_SYNC_KEY, now);
      
      logAuditEvent('SYNC_SUCCESS', 'Data synced to backend', {
        metadata: { recipeCount: recipes.length, pantryCount: pantryItems.length },
      });
    } catch (error) {
      const isNetworkError = error instanceof Error && 
        (error.message.includes('NetworkError') || 
         error.message.includes('fetch') || 
         error.message.includes('network') ||
         error.message.includes('Failed to fetch'));
      
      if (isNetworkError) {
        console.warn('Sync skipped: backend unreachable');
      } else {
        console.error('Sync failed:', error);
        logAuditEvent('SYNC_ERROR', 'Failed to sync to backend', {
          severity: 'error',
          metadata: { error: error instanceof Error ? error.message : 'Unknown' },
        });
      }
    } finally {
      setIsSyncing(false);
    }
  }, [backendEnabled, recipes, pantryItems, lastSyncTime, recipeSyncMutation, pantrySyncMutation]);

  useEffect(() => {
    AsyncStorage.getItem(LAST_SYNC_KEY).then(time => {
      if (time) setLastSyncTime(time);
    });
  }, []);

  useEffect(() => {
    if (!backendEnabled) return;

    const interval = setInterval(() => {
      if (recipes.length > 0 || pantryItems.length > 0) {
        console.log('Auto-syncing to backend...');
        syncToBackendFn();
      }
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [backendEnabled, recipes, pantryItems, syncToBackendFn]);

  useEffect(() => {
    if (backendEnabled && backendRecipesQuery.data && backendRecipesQuery.data.recipes?.length > recipes.length) {
      console.log(`Backend has ${backendRecipesQuery.data.recipes.length} recipes, local has ${recipes.length}`);
      const merged = [...recipes];
      backendRecipesQuery.data.recipes.forEach(serverRecipe => {
        if (!merged.find(r => r.id === serverRecipe.id)) {
          merged.push(serverRecipe as Recipe);
        }
      });
      if (merged.length > recipes.length) {
        setRecipes(merged);
        saveRecipes(merged);
        console.log(`Merged ${merged.length - recipes.length} recipes from backend`);
      }
    }
  }, [backendRecipesQuery.data, backendEnabled, recipes, saveRecipes]);

  useEffect(() => {
    if (backendEnabled && backendPantryQuery.data && backendPantryQuery.data.items?.length > pantryItems.length) {
      console.log(`Backend has ${backendPantryQuery.data.items.length} pantry items, local has ${pantryItems.length}`);
      const merged = [...pantryItems];
      backendPantryQuery.data.items.forEach(serverItem => {
        if (!merged.find(p => p.id === serverItem.id)) {
          merged.push(serverItem);
        }
      });
      if (merged.length > pantryItems.length) {
        setPantryItems(merged);
        savePantry(merged);
        console.log(`Merged ${merged.length - pantryItems.length} pantry items from backend`);
      }
    }
  }, [backendPantryQuery.data, backendEnabled, pantryItems, savePantry]);

  return {
    recipes,
    pantryItems,
    isLoading: recipesQuery.isLoading || pantryQuery.isLoading,
    isSyncing,
    lastSyncTime,
    backendEnabled,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    toggleFavorite,
    togglePantryItem,
    addPantryItem,
    removePantryItem,
    getFeaturedRecipe,
    getMatchingRecipes,
    getRecipesPaginated,
    stats,
    batchUpdatePantry,
    exportData,
    importData,
    syncToBackend: syncToBackendFn,
  };
});

export function useFilteredRecipes(tags: string[], searchQuery: string) {
  const { recipes } = useRecipes();
  
  return useMemo(() => {
    const sanitizedQuery = searchQuery.toLowerCase().trim();
    
    return recipes.filter(recipe => {
      const matchesTags = tags.length === 0 || tags.some(tag => recipe.tags.includes(tag));
      const matchesSearch = sanitizedQuery === '' || 
        recipe.title.toLowerCase().includes(sanitizedQuery) ||
        recipe.description.toLowerCase().includes(sanitizedQuery);
      return matchesTags && matchesSearch;
    });
  }, [recipes, tags, searchQuery]);
}

export function useFavoriteRecipes() {
  const { recipes } = useRecipes();
  return useMemo(() => recipes.filter(r => r.isFavorite), [recipes]);
}

export function useRecipeById(id: string) {
  const { recipes } = useRecipes();
  return useMemo(() => recipes.find(r => r.id === id), [recipes, id]);
}
