// bfe-catalogue 1.0.0 — serves unclehowell/cedwyn-catalogue (main) at https://bucklerfamily.estate/catalogue/
// and 301s the old catalogue.bucklerfamily.estate host there (path and query kept). Owner 6 Nov 2026 09:48: no
// subdomains, paths of bucklerfamily.estate. Files come from the repo's main branch (edge-cached 2 min), so a push
// to main is live within minutes. Nothing else on the zone is touched: the apex router still serves every other path.
// — Sion's Tab agent
const VERSION = '1.0.0';
const SRC = 'https://raw.githubusercontent.com/unclehowell/cedwyn-catalogue/main/';
const APEX = 'https://bucklerfamily.estate';
const BASE = '/catalogue/';
const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json', woff2: 'font/woff2' };
const HIDDEN = new Set(['CNAME', '.nojekyll']);
function hdrs(type, maxAge) {
  return { 'content-type': type, 'cache-control': 'public, max-age=' + maxAge, 'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*', 'referrer-policy': 'no-referrer', 'x-bfe-catalogue': VERSION };
}
function notFound(path) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Not found · Catalogue</title>' +
    '<p style="font:16px/1.5 system-ui,sans-serif;margin:24px">Not found: ' + path.replace(/[<>&"]/g, '') + '. <a href="' + BASE + '">Open the catalogue</a>.</p>',
    { status: 404, headers: hdrs('text/html; charset=utf-8', 60) });
}
export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (u.hostname !== 'bucklerfamily.estate') {
      // catalogue.bucklerfamily.estate (and any other host routed here) -> the path on the main domain
      const p = u.pathname === '/' ? '' : u.pathname.replace(/^\/+/, '');
      return Response.redirect(APEX + BASE + p + u.search, 301);
    }
    if (u.pathname === '/catalogue') return Response.redirect(APEX + BASE + u.search, 301);
    if (!u.pathname.startsWith(BASE)) return notFound(u.pathname);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    let rest = decodeURIComponent(u.pathname.slice(BASE.length));
    if (rest === '' || rest.endsWith('/')) rest += 'index.html';
    if (rest.split('/').some(s => s === '..' || s === '.' || s.startsWith('.') && s !== '.well-known') || HIDDEN.has(rest)) return notFound(u.pathname);
    const ext = (rest.split('.').pop() || '').toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const up = await fetch(SRC + rest.split('/').map(encodeURIComponent).join('/'), { cf: { cacheTtl: 120, cacheEverything: true } });
    if (up.status === 404) return notFound(u.pathname);
    if (!up.ok) return new Response('The catalogue files could not be read just now (' + up.status + '). Please try again in a minute.', { status: 502, headers: hdrs('text/plain; charset=utf-8', 0) });
    const maxAge = ext === 'html' ? 60 : 300;
    return new Response(request.method === 'HEAD' ? null : up.body, { status: 200, headers: hdrs(type, maxAge) });
  }
};
