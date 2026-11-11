// bfe-catalogue 2.0.0 — serves unclehowell/cedwyn-catalogue (main) at https://bucklerfamily.estate/catalogue/
// and 301s the old catalogue.bucklerfamily.estate host there (path and query kept). Owner 6 Nov 2026 09:48: no
// subdomains, paths of bucklerfamily.estate. Files come from the repo (edge-cached 2 min), so a push is live within minutes.
// 2.0.0 (10 Nov 2026, cedwyn-catalogue#32): a record address (?id=EV-…) carries its own link-preview tags (og:/twitter:
// title, description, image) written here, so a shared link shows the record's own preview picture; og/<ID>.jpg serves
// that picture (decoded from the repo's thumbs/trN.json shards; since 2.2.0 pending records carry no picture); file/<ID>
// opens the record's own file (its PDF or image, read from where the catalogue's thumbs/rec-index.json says it lives;
// only files listed there). Nothing else on the zone is touched. Records are read, never written. — Sion's Tab agent
// 2.1.0 (10 Nov 2026, cedwyn-catalogue#34): logos/<key>.png serves a self-hosted institution logo (decoded from the repo's
// logos/logos.json; logos/map.json maps each email record to its logo). An email record's link preview (og:image, and
// og/<ID>.jpg) is that logo, or the neutral email picture for personal, private or unlisted mail. No third-party logo service.
// 2.1.1: og:image size for a logo is its real 192 x 192.
// 2.2.0 (11 Nov 2026): no pencil-sketch picture any more. A record whose file is pending gets no og:image at all (title and
// description only, twitter:card summary); og/<ID>.jpg answers 404 for it. sketch/og-pending.jpg is no longer read. — Sion's Tab agent
const VERSION = '2.2.0';
const SRC = 'https://raw.githubusercontent.com/unclehowell/cedwyn-catalogue/main/';
const APEX = 'https://bucklerfamily.estate';
const BASE = '/catalogue/';
const API = APEX + '/api/catalogue/';
const SITE = 'Great House, Cedwyn Estate records';
const TYPES = { html: 'text/html; charset=utf-8', js: 'application/javascript; charset=utf-8', mjs: 'application/javascript; charset=utf-8',
  json: 'application/json; charset=utf-8', css: 'text/css; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg',
  jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', xml: 'application/xml; charset=utf-8',
  webmanifest: 'application/manifest+json', woff2: 'font/woff2', pdf: 'application/pdf' };
const HIDDEN = new Set(['CNAME', '.nojekyll']);
const IDRE = /^[A-Z]{2,4}(-[A-Z]{2,4})?-\d{3,7}$/;
function hdrs(type, maxAge) {
  return { 'content-type': type, 'cache-control': 'public, max-age=' + maxAge, 'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*', 'referrer-policy': 'no-referrer', 'x-bfe-catalogue': VERSION };
}
function clean(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, ''); }
function page(status, title, msg) {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + clean(title) + ' · Catalogue</title>' +
    '<p style="font:16px/1.5 system-ui,sans-serif;margin:24px">' + msg + ' <a href="' + BASE + '">Open the catalogue</a>.</p>',
    { status: status, headers: hdrs('text/html; charset=utf-8', 60) });
}
function notFound(path) { return page(404, 'Not found', 'Not found: ' + clean(path) + '.'); }
async function repoJSON(name) {
  const r = await fetch(SRC + name, { cf: { cacheTtl: 120, cacheEverything: true } });
  if (!r.ok) return null;
  try { return await r.json(); } catch (e) { return null; }
}
async function recIndex() { const d = await repoJSON('thumbs/rec-index.json'); return (d && d.items) || {}; }
async function logoMap() { return (await repoJSON('logos/map.json')) || { rec: {}, logos: {} }; }
async function logoKey(id) { const M = await logoMap(), k = (M.rec || {})[id]; return k && (M.logos || {})[k] ? k : 'email'; }
async function logoPNG(key, method) {
  const L = ((await repoJSON('logos/logos.json')) || {}).items || {}, d = L[key];
  const m = d && /^data:image\/png;base64,(.*)$/.exec(d);
  if (!m) return notFound(BASE + 'logos/' + key + '.png');
  const bin = Uint8Array.from(atob(m[1]), c => c.charCodeAt(0));
  return new Response(method === 'HEAD' ? null : bin, { status: 200, headers: hdrs('image/png', 86400) });
}
function isEmailId(id) { const m = /^EV-(\d+)$/.exec(id); return !!m && +m[1] >= 906; }
async function ogImage(id) {
  if (isEmailId(id)) return logoPNG(await logoKey(id), 'GET');
  const R = await recIndex(), x = R[id];
  if (x && x.s != null) {
    const sh = await repoJSON('thumbs/t' + x.s + '.json'), d = sh && sh[id];
    if (d && d.startsWith('data:image/')) {
      const m = /^data:(image\/[a-z]+);base64,(.*)$/.exec(d);
      if (m) { const bin = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0)); return new Response(bin, { status: 200, headers: hdrs(m[1], 3600) }); }
    }
  }
  return notFound(BASE + 'og/' + id + '.jpg');   // 2.2.0: a pending record has no preview picture
}
async function openFile(id, method) {
  const R = await recIndex(), x = R[id];
  if (!x || !x.u || !(x.k === 'pdf' || x.k === 'img')) return page(404, id, 'The file for record <b>' + clean(id) + '</b> is pending: it is not held on this site yet. <a href="' + BASE + '?id=' + encodeURIComponent(id) + '">Back to the record</a>.');
  if (/^https:\/\/([a-z0-9-]+\.)*bucklerfamily\.estate\//i.test(x.u)) return Response.redirect(x.u, 302);   // already on this site
  const up = await fetch(x.u, { headers: { 'user-agent': 'Mozilla/5.0 (bucklerfamily.estate catalogue file)' }, cf: { cacheTtl: 86400, cacheEverything: true } });
  if (!up.ok) return page(502, id, 'The file for record <b>' + clean(id) + '</b> could not be read just now (' + up.status + '). Please try again in a minute. <a href="' + BASE + '?id=' + encodeURIComponent(id) + '">Back to the record</a>.');
  let type = up.headers.get('content-type') || (x.k === 'pdf' ? 'application/pdf' : 'image/jpeg');
  if (/octet-stream|text\/plain/.test(type) && x.k === 'pdf') type = 'application/pdf';
  const ext = type.includes('pdf') ? 'pdf' : (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').split(';')[0];
  const h = hdrs(type, 86400); h['content-disposition'] = 'inline; filename="' + id + '.' + ext + '"';
  return new Response(method === 'HEAD' ? null : up.body, { status: 200, headers: h });
}
async function recordMeta(id) {
  // title and description come from thumbs/og-meta.json (copied from the catalogue at build time: a Worker cannot read the
  // catalogue API on its own zone); a record added since then gets its id and a plain line until the next build
  const M = ((await repoJSON('thumbs/og-meta.json')) || {}).items || {}, e = M[id] || null;
  const R = await recIndex(), x = R[id] || null;
  const priv = !!(e && e[2]);
  const title = e ? e[0] : 'Record ' + id;
  const desc = (e && e[1]) || 'A record in the Great House, Cedwyn Estate catalogue.';
  const real = !!(x && x.s != null && !priv);
  if (isEmailId(id)) { const k = await logoKey(id); return { title, desc, img: APEX + BASE + 'logos/' + k + '.png', w: 192, h: 192, real: k !== 'email', type: 'image/png', logo: true }; }
  if (!real) return { title, desc, img: '', real: false };   // 2.2.0: no placeholder picture for a pending record
  return { title, desc, img: APEX + BASE + 'og/' + encodeURIComponent(id) + '.jpg', w: x.w, h: x.h, real };
}
class Attr { constructor(v) { this.v = v; } element(e) { e.setAttribute('content', this.v); } }
class Txt { constructor(v) { this.v = v; } element(e) { e.setInnerContent(this.v); } }
class Head { constructor(tags) { this.tags = tags; } element(e) { e.append(this.tags, { html: true }); } }
function q(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
async function withMeta(resp, id) {
  const m = await recordMeta(id), url = APEX + BASE + '?id=' + encodeURIComponent(id);
  const tags = '\n<meta property="og:type" content="article"><meta property="og:site_name" content="' + q(SITE) + '">' +
    '<meta property="og:title" content="' + q(m.title) + '"><meta property="og:description" content="' + q(m.desc) + '">' +
    '<meta property="og:url" content="' + q(url) + '"><link rel="canonical" href="' + q(url) + '">' +
    (m.img ? '<meta property="og:image" content="' + q(m.img) + '"><meta property="og:image:secure_url" content="' + q(m.img) + '"><meta property="og:image:type" content="' + (m.type || 'image/jpeg') + '">' +
    (m.w ? '<meta property="og:image:width" content="' + m.w + '"><meta property="og:image:height" content="' + m.h + '">' : '') +
    '<meta property="og:image:alt" content="' + q(m.logo ? (m.real ? 'Institution logo for ' : 'Email picture for ') + m.title : 'Preview of ' + m.title) + '">' : '') +
    '<meta name="twitter:card" content="' + (m.logo || !m.img ? 'summary' : 'summary_large_image') + '"><meta name="twitter:title" content="' + q(m.title) + '">' +
    '<meta name="twitter:description" content="' + q(m.desc) + '">' + (m.img ? '<meta name="twitter:image" content="' + q(m.img) + '">' : '') + '\n';
  return new HTMLRewriter().on('title', new Txt(m.title + ' · ' + SITE)).on('meta[name="description"]', new Attr(m.desc)).on('head', new Head(tags)).transform(resp);
}
export default {
  async fetch(request) {
    const u = new URL(request.url);
    if (u.hostname !== 'bucklerfamily.estate') {
      const p = u.pathname === '/' ? '' : u.pathname.replace(/^\/+/, '');
      return Response.redirect(APEX + BASE + p + u.search, 301);
    }
    if (u.pathname === BASE.slice(0, -1)) return Response.redirect(APEX + BASE + u.search, 301);
    if (!u.pathname.startsWith(BASE)) return notFound(u.pathname);
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    let rest = decodeURIComponent(u.pathname.slice(BASE.length));
    let m = /^og\/([A-Za-z0-9-]+)\.jpg$/.exec(rest);
    if (m) return ogImage(m[1].toUpperCase());
    m = /^logos\/([a-z0-9-]+)\.png$/.exec(rest);
    if (m) return logoPNG(m[1], request.method);
    m = /^file\/([A-Za-z0-9-]+)(\.[a-z]+)?$/.exec(rest);
    if (m) return openFile(m[1].toUpperCase(), request.method);
    if (rest === '' || rest.endsWith('/')) rest += 'index.html';
    if (rest.split('/').some(s => s === '..' || s === '.' || s.startsWith('.') && s !== '.well-known') || HIDDEN.has(rest)) return notFound(u.pathname);
    const ext = (rest.split('.').pop() || '').toLowerCase();
    const type = TYPES[ext] || 'application/octet-stream';
    const up = await fetch(SRC + rest.split('/').map(encodeURIComponent).join('/'), { cf: { cacheTtl: 120, cacheEverything: true } });
    if (up.status === 404) return notFound(u.pathname);
    if (!up.ok) return new Response('The catalogue files could not be read just now (' + up.status + '). Please try again in a minute.', { status: 502, headers: hdrs('text/plain; charset=utf-8', 0) });
    const maxAge = ext === 'html' ? 60 : 300;
    let resp = new Response(request.method === 'HEAD' ? null : up.body, { status: 200, headers: hdrs(type, maxAge) });
    const id = (u.searchParams.get('id') || '').trim().toUpperCase();
    if (rest === 'index.html' && id && IDRE.test(id) && request.method === 'GET') { try { resp = await withMeta(resp, id); } catch (e) {} }
    return resp;
  }
};
