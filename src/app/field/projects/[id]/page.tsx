// Alias route (Update 2): /field/projects/[id] renders the same screen as /field/[id].
// Re-exporting keeps the Suspense boundary used there (useParams suspends under cacheComponents).
export { default } from "../../[id]/page";
