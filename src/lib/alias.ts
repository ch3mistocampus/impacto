/** Drafts get a placeholder alias "Borrador XXXX" until the coordinator names them; show it in the UI language. */
export function displayAlias(alias: string, locale: "es" | "en"): string {
  return locale === "en" ? alias.replace(/^Borrador /, "Draft ") : alias;
}
