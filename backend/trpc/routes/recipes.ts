import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedProcedure } from "../create-context";
import { query } from "../../db";

const ingredientSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  amount: z.string().max(50),
  unit: z.string().max(50),
});

const recipeSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  imageUrl: z.string().url().max(2000),
  source: z.enum(["manual", "instagram", "pinterest", "tiktok", "web"]),
  sourceUrl: z.string().url().max(2000).optional(),
  tags: z.array(z.string()).max(12),
  ingredients: z.array(ingredientSchema).min(1).max(100),
  instructions: z.array(z.string().max(2000)).min(1).max(100),
  servings: z.number().int().min(1).max(100),
  prepTime: z.number().int().min(0).max(1440),
  cookTime: z.number().int().min(0).max(1440),
  difficulty: z.enum(["easy", "medium", "hard"]),
  createdAt: z.string(),
  isFavorite: z.boolean(),
});

const recipeInputSchema = recipeSchema.omit({ id: true, createdAt: true });

const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(50).default(20),
});

const searchSchema = z.object({
  query: z.string().max(200).default(""),
  tags: z.array(z.string()).max(12).default([]),
});

interface RecipeDbItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  source: string;
  sourceUrl?: string;
  tags: string[];
  ingredients: { id: string; name: string; amount: string; unit: string }[];
  instructions: string[];
  servings: number;
  prepTime: number;
  cookTime: number;
  difficulty: string;
  createdAt: string;
  isFavorite: boolean;
  userId: string;
}

export const recipesRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({
      pagination: paginationSchema.optional(),
      search: searchSchema.optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      let sql = `SELECT * FROM recipes WHERE userId = '${userId}'`;
      
      if (input?.search?.query) {
        const searchQuery = input.search.query.replace(/'/g, "\\'").toLowerCase();
        sql += ` AND (string::lowercase(title) CONTAINS '${searchQuery}' OR string::lowercase(description) CONTAINS '${searchQuery}')`;
      }
      
      sql += ` ORDER BY createdAt DESC`;
      
      const result = await query<RecipeDbItem>(sql);
      let recipes = result.map(r => ({
        ...r,
        id: String(r.id).replace('recipes:', ''),
      }));
      
      if (input?.search?.tags && input.search.tags.length > 0) {
        recipes = recipes.filter(r =>
          input.search!.tags.some(tag => r.tags.includes(tag))
        );
      }
      
      const page = input?.pagination?.page ?? 1;
      const limit = input?.pagination?.limit ?? 20;
      const start = (page - 1) * limit;
      const paginatedRecipes = recipes.slice(start, start + limit);
      
      return {
        recipes: paginatedRecipes,
        total: recipes.length,
        page,
        limit,
        hasMore: start + limit < recipes.length,
      };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<RecipeDbItem>(
        `SELECT * FROM recipes:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }
      
      return {
        ...result[0],
        id: String(result[0].id).replace('recipes:', ''),
      };
    }),

  create: rateLimitedProcedure({ maxRequests: 20, windowMs: 60000 })
    .input(recipeInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const createdAt = new Date().toISOString();
      
      const escapedTitle = input.title.replace(/'/g, "\\'");
      const escapedDescription = input.description.replace(/'/g, "\\'");
      const tagsJson = JSON.stringify(input.tags);
      const ingredientsJson = JSON.stringify(input.ingredients);
      const instructionsJson = JSON.stringify(input.instructions);
      
      await query(
        `CREATE recipes:${id} CONTENT {
          title: '${escapedTitle}',
          description: '${escapedDescription}',
          imageUrl: '${input.imageUrl}',
          source: '${input.source}',
          ${input.sourceUrl ? `sourceUrl: '${input.sourceUrl}',` : ''}
          tags: ${tagsJson},
          ingredients: ${ingredientsJson},
          instructions: ${instructionsJson},
          servings: ${input.servings},
          prepTime: ${input.prepTime},
          cookTime: ${input.cookTime},
          difficulty: '${input.difficulty}',
          isFavorite: ${input.isFavorite},
          userId: '${userId}',
          createdAt: '${createdAt}'
        }`
      );
      
      console.log(`Recipe created: ${input.title} (${id})`);
      
      return {
        ...input,
        id,
        createdAt,
      };
    }),

  update: rateLimitedProcedure({ maxRequests: 30, windowMs: 60000 })
    .input(z.object({
      id: z.string(),
      data: recipeInputSchema.partial(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const checkResult = await query<RecipeDbItem>(
        `SELECT * FROM recipes:${input.id} WHERE userId = '${userId}'`
      );
      
      if (checkResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }
      
      const updates: string[] = [];
      if (input.data.title !== undefined) updates.push(`title = '${input.data.title.replace(/'/g, "\\'")}'`);
      if (input.data.description !== undefined) updates.push(`description = '${input.data.description.replace(/'/g, "\\'")}'`);
      if (input.data.imageUrl !== undefined) updates.push(`imageUrl = '${input.data.imageUrl}'`);
      if (input.data.source !== undefined) updates.push(`source = '${input.data.source}'`);
      if (input.data.sourceUrl !== undefined) updates.push(`sourceUrl = '${input.data.sourceUrl}'`);
      if (input.data.tags !== undefined) updates.push(`tags = ${JSON.stringify(input.data.tags)}`);
      if (input.data.ingredients !== undefined) updates.push(`ingredients = ${JSON.stringify(input.data.ingredients)}`);
      if (input.data.instructions !== undefined) updates.push(`instructions = ${JSON.stringify(input.data.instructions)}`);
      if (input.data.servings !== undefined) updates.push(`servings = ${input.data.servings}`);
      if (input.data.prepTime !== undefined) updates.push(`prepTime = ${input.data.prepTime}`);
      if (input.data.cookTime !== undefined) updates.push(`cookTime = ${input.data.cookTime}`);
      if (input.data.difficulty !== undefined) updates.push(`difficulty = '${input.data.difficulty}'`);
      if (input.data.isFavorite !== undefined) updates.push(`isFavorite = ${input.data.isFavorite}`);
      
      if (updates.length > 0) {
        await query(`UPDATE recipes:${input.id} SET ${updates.join(', ')}`);
      }
      
      const existing = checkResult[0];
      console.log(`Recipe updated: ${input.data.title || existing.title} (${input.id})`);
      
      return {
        ...existing,
        ...input.data,
        id: input.id,
      };
    }),

  delete: rateLimitedProcedure({ maxRequests: 20, windowMs: 60000 })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<RecipeDbItem>(
        `SELECT * FROM recipes:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }
      
      await query(`DELETE recipes:${input.id}`);
      console.log(`Recipe deleted: ${result[0].title} (${input.id})`);
      
      return { success: true, id: input.id };
    }),

  toggleFavorite: rateLimitedProcedure({ maxRequests: 50, windowMs: 60000 })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<RecipeDbItem>(
        `SELECT * FROM recipes:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Recipe not found",
        });
      }
      
      const existing = result[0];
      await query(`UPDATE recipes:${input.id} SET isFavorite = ${!existing.isFavorite}`);
      
      return {
        ...existing,
        id: String(existing.id).replace('recipes:', ''),
        isFavorite: !existing.isFavorite,
      };
    }),

  sync: rateLimitedProcedure({ maxRequests: 10, windowMs: 60000 })
    .input(z.object({
      recipes: z.array(recipeSchema),
      lastSyncTime: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      for (const recipe of input.recipes) {
        const escapedTitle = recipe.title.replace(/'/g, "\\'");
        const escapedDescription = recipe.description.replace(/'/g, "\\'");
        
        await query(
          `UPSERT recipes:${recipe.id} CONTENT {
            title: '${escapedTitle}',
            description: '${escapedDescription}',
            imageUrl: '${recipe.imageUrl}',
            source: '${recipe.source}',
            ${recipe.sourceUrl ? `sourceUrl: '${recipe.sourceUrl}',` : ''}
            tags: ${JSON.stringify(recipe.tags)},
            ingredients: ${JSON.stringify(recipe.ingredients)},
            instructions: ${JSON.stringify(recipe.instructions)},
            servings: ${recipe.servings},
            prepTime: ${recipe.prepTime},
            cookTime: ${recipe.cookTime},
            difficulty: '${recipe.difficulty}',
            isFavorite: ${recipe.isFavorite},
            createdAt: '${recipe.createdAt}',
            userId: '${userId}'
          }`
        );
      }
      
      console.log(`Synced ${input.recipes.length} recipes`);
      
      return {
        success: true,
        syncedCount: input.recipes.length,
        serverTime: new Date().toISOString(),
      };
    }),

  fetchUrl: rateLimitedProcedure({ maxRequests: 20, windowMs: 60000 })
    .input(z.object({ url: z.string().url() }))
    .mutation(async ({ input }) => {
      console.log('Fetching URL server-side:', input.url);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(input.url, {
          headers: {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1',
          },
          signal: controller.signal,
          redirect: 'follow',
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error('Fetch failed with status:', response.status, response.statusText);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Failed to fetch URL: ${response.status}`,
          });
        }
        
        const html = await response.text();
        console.log('Fetched HTML length:', html.length);
        
        if (html.length < 100) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Page content too short or empty",
          });
        }
        
        return { html: html.substring(0, 100000) };
      } catch (error) {
        console.error('Fetch error:', error);
        if (error instanceof TRPCError) throw error;
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TRPCError({
            code: "TIMEOUT",
            message: "Request timed out",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch URL content",
        });
      }
    }),
});
