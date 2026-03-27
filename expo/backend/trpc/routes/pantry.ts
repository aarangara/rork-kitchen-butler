import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, rateLimitedProcedure } from "../create-context";
import { query } from "../../db";

const pantryItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  inStock: z.boolean(),
});

const pantryItemInputSchema = pantryItemSchema.omit({ id: true });

interface PantryDbItem {
  id: string;
  name: string;
  category: string;
  inStock: boolean;
  userId: string;
  createdAt: string;
}

export const pantryRouter = createTRPCRouter({
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      inStock: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      let sql = `SELECT * FROM pantry WHERE userId = '${userId}'`;
      
      if (input?.category) {
        sql += ` AND category = '${input.category}'`;
      }
      
      if (input?.inStock !== undefined) {
        sql += ` AND inStock = ${input.inStock}`;
      }
      
      sql += ` ORDER BY name ASC`;
      
      const result = await query<PantryDbItem>(sql);
      const items = result.map(item => ({
        id: String(item.id).replace('pantry:', ''),
        name: item.name,
        category: item.category,
        inStock: item.inStock,
      }));
      
      return {
        items,
        total: items.length,
      };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<PantryDbItem>(
        `SELECT * FROM pantry:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pantry item not found",
        });
      }
      
      const item = result[0];
      return {
        id: String(item.id).replace('pantry:', ''),
        name: item.name,
        category: item.category,
        inStock: item.inStock,
      };
    }),

  create: rateLimitedProcedure({ maxRequests: 50, windowMs: 60000 })
    .input(pantryItemInputSchema)
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await query(
        `CREATE pantry:${id} CONTENT {
          name: '${input.name.replace(/'/g, "\\'")}',
          category: '${input.category.replace(/'/g, "\\'")}',
          inStock: ${input.inStock},
          userId: '${userId}',
          createdAt: time::now()
        }`
      );
      
      console.log(`Pantry item created: ${input.name} (${id})`);
      
      return {
        id,
        name: input.name,
        category: input.category,
        inStock: input.inStock,
      };
    }),

  update: rateLimitedProcedure({ maxRequests: 100, windowMs: 60000 })
    .input(z.object({
      id: z.string(),
      data: pantryItemInputSchema.partial(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const checkResult = await query<PantryDbItem>(
        `SELECT * FROM pantry:${input.id} WHERE userId = '${userId}'`
      );
      
      if (checkResult.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pantry item not found",
        });
      }
      
      const updates: string[] = [];
      if (input.data.name !== undefined) updates.push(`name = '${input.data.name.replace(/'/g, "\\'")}'`);
      if (input.data.category !== undefined) updates.push(`category = '${input.data.category.replace(/'/g, "\\'")}'`);
      if (input.data.inStock !== undefined) updates.push(`inStock = ${input.data.inStock}`);
      
      if (updates.length > 0) {
        await query(`UPDATE pantry:${input.id} SET ${updates.join(', ')}`);
      }
      
      const updated = await query<PantryDbItem>(`SELECT * FROM pantry:${input.id}`);
      const item = updated[0];
      
      return {
        id: input.id,
        name: item?.name || '',
        category: item?.category || '',
        inStock: item?.inStock ?? false,
      };
    }),

  toggleStock: rateLimitedProcedure({ maxRequests: 100, windowMs: 60000 })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<PantryDbItem>(
        `SELECT * FROM pantry:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pantry item not found",
        });
      }
      
      const existing = result[0];
      await query(`UPDATE pantry:${input.id} SET inStock = ${!existing.inStock}`);
      
      return {
        id: input.id,
        name: existing.name,
        category: existing.category,
        inStock: !existing.inStock,
      };
    }),

  delete: rateLimitedProcedure({ maxRequests: 50, windowMs: 60000 })
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      const result = await query<PantryDbItem>(
        `SELECT * FROM pantry:${input.id} WHERE userId = '${userId}'`
      );
      
      if (result.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pantry item not found",
        });
      }
      
      await query(`DELETE pantry:${input.id}`);
      console.log(`Pantry item deleted: ${result[0].name} (${input.id})`);
      
      return { success: true, id: input.id };
    }),

  sync: rateLimitedProcedure({ maxRequests: 10, windowMs: 60000 })
    .input(z.object({
      items: z.array(pantryItemSchema),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      
      for (const item of input.items) {
        const escapedName = item.name.replace(/'/g, "\\'");
        const escapedCategory = item.category.replace(/'/g, "\\'");
        
        await query(
          `UPSERT pantry:${item.id} CONTENT {
            name: '${escapedName}',
            category: '${escapedCategory}',
            inStock: ${item.inStock},
            userId: '${userId}'
          }`
        );
      }
      
      console.log(`Synced ${input.items.length} pantry items`);
      
      return {
        success: true,
        syncedCount: input.items.length,
        serverTime: new Date().toISOString(),
      };
    }),

  bulkToggle: rateLimitedProcedure({ maxRequests: 20, windowMs: 60000 })
    .input(z.object({
      ids: z.array(z.string()),
      inStock: z.boolean(),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.clientIp;
      const updated: z.infer<typeof pantryItemSchema>[] = [];
      
      for (const id of input.ids) {
        const result = await query<PantryDbItem>(
          `SELECT * FROM pantry:${id} WHERE userId = '${userId}'`
        );
        
        if (result.length > 0) {
          await query(`UPDATE pantry:${id} SET inStock = ${input.inStock}`);
          updated.push({
            id,
            name: result[0].name,
            category: result[0].category,
            inStock: input.inStock,
          });
        }
      }
      
      return {
        success: true,
        updatedCount: updated.length,
        items: updated,
      };
    }),
});
