const RESERVED = new Set(["www", "app", "api", "admin", "mail", "sites", "static", "cdn", "status", "suporte", "help", "blog"]);

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/.test(slug) && !RESERVED.has(slug) && !slug.includes("--");
}

export function isValidDomain(d: string): boolean {
  return /^(?=.{4,253}$)(?!-)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(d);
}
