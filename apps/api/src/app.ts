import { Layer } from "effect";
import { HealthRoutes } from "./health/routes.ts";
import { UserRoutes } from "./users/routes.ts";

export const ApiRoutes = Layer.mergeAll(HealthRoutes, UserRoutes);
