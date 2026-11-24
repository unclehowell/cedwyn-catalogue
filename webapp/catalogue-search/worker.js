// Catalogue Search Gateway — Worker source deployed as bfe-catalogue-frontdoor.
// Serves webapp/catalogue-search/index.html from this repository.
// Search requests are forwarded to the canonical catalogue; no results are invented.
const SOURCE = "https://raw.githubusercontent.com/unclehowell/cedwyn-catalogue/main/webapp/catalogue-search/index.html";
const CATALOGUE = "https://bucklerfamily.estate/catalogue/";
const ALLOWED_SUFFIX = "-datro.bucklerfamily.estate";
function catalogueURL(incoming) {
  const target = new URL(CATALOGUE);
  for (const key of ["q", "kind", "sort", "id", "src", "tab"]) {
    for (const value of incoming.searchParams.getAll(key)) target.searchParams.append(key, value);
  }
  return target;
}
function hasCatalogueQuery(url) {
  return ["q", "kind", "sort", "id", "src", "tab"].some((key) => url.searchParams.has(key));
}
function fallback() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Catalogue Search</title><p>Search the live records catalogue at <a href="https://bucklerfamily.estate/catalogue/">bucklerfamily.estate/catalogue</a>.</p>', {
    status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }
  });
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    if (host === "bucklerfamily.estate" || host === "www.bucklerfamily.estate" || host.endsWith(ALLOWED_SUFFIX)) {
      return fetch(request);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }
    if (hasCatalogueQuery(url)) return Response.redirect(catalogueURL(url).toString(), 302);
    try {
      const page = await fetch(SOURCE, { cf: { cacheTtl: 300, cacheEverything: true } });
      if (!page.ok) return fallback();
      const headers = new Headers(page.headers);
      headers.set("content-type", "text/html; charset=utf-8");
      headers.set("cache-control", "public, max-age=60, s-maxage=300");
      headers.set("x-catalogue-search-gateway", "1.0.0");
      headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(request.method === "HEAD" ? null : page.body, { status: 200, headers });
    } catch { return fallback(); }
  }
};
