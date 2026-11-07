import type { FunctionReturnType } from "convex/server";
import type { api } from "../../../convex/_generated/api";

export type DeckCard = FunctionReturnType<typeof api.public.donorDeck>[number];
