import { createTRPCRouter } from "./create-context";
import { recipesRouter } from "./routes/recipes";
import { pantryRouter } from "./routes/pantry";

export const appRouter = createTRPCRouter({
  recipes: recipesRouter,
  pantry: pantryRouter,
});

export type AppRouter = typeof appRouter;
