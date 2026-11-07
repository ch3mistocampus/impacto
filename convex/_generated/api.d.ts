/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as ai from "../ai.js";
import type * as coordinator from "../coordinator.js";
import type * as crons from "../crons.js";
import type * as field from "../field.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_ledger from "../lib/ledger.js";
import type * as pledges from "../pledges.js";
import type * as projects from "../projects.js";
import type * as public_ from "../public.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  ai: typeof ai;
  coordinator: typeof coordinator;
  crons: typeof crons;
  field: typeof field;
  "lib/auth": typeof lib_auth;
  "lib/ledger": typeof lib_ledger;
  pledges: typeof pledges;
  projects: typeof projects;
  public: typeof public_;
  seed: typeof seed;
  sessions: typeof sessions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
