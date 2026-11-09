/* Cedwyn records browser v0.9.0 (was the catalogue browser) — one front end for every record in the central catalogue.
   Records are read live (REST /api/catalogue today; a GraphQL endpoint can be switched in via CONFIG or ?source=graphql&endpoint=...).
   Record page schema (v0.9.0, 9 Nov 2026, cedwyn-catalogue#30): preview or placeholder + link to the artifact -> record details
   (date, our catalogue reference, where the original(s) are, each linked to OUR archived copy) -> Description -> Transcript (text
   records) -> Interpretation (the schema title). Only an archived-copy entry (?src=) links to the live website, then to the
   public Internet Archive copy. Nothing here edits a record.
   v0.3.0: Google-style search with tabs (All · Web · Images · Videos · Blog · Books) and a preview image per result; sources.json is a display/classification map only.
   v0.5.0: the standard site header; a Google-style home (logo, search box, Search button; v0.6.0 drops "I'm feeling lucky" for a Trending row); tabs All · Web · Images · Videos · PDF · Books · Blog
   with galleries for Images, Videos and PDF front pages; real preview thumbnails (thumbs/index.json + thumbs/tN.json, derived WebP copies, never record data);
   a typed card wherever no picture exists. Records are still read live and never edited here. — Tab agent
   v0.8.0 (8 Nov 2026): every filler is a scene composed from the site's own photographs (the Great House, Mary Williams, the Williams plan),
   drawn as one black-and-white graphite pencil sketch and labelled "Artist's impression — not the original"; the two footage records show TV-news
   frames (1974: a reporter interviewing Mary Williams in front of the Great House; 1988: the farmhouse as reported); real thumbnails carry the same
   pencil look through the SVG filter #pencil applied by CSS. Full-size originals and opened PDFs stay unfiltered.
   v0.7.0 (8 Nov 2026): Videos shows catalogued footage records only (social clips removed), each with a 4:3 pencil-sketch TV frame
   (scanlines, grain, a PLACEHOLDER tag, a lower third from the record's own title and date); a record with no file gets a graphite
   artist's impression whose words come only from its own fields, labelled as reconstructed; every result opens a page whose
   address carries its UID (?id=);
   a source file that a record describes folds into that record (sources.json 'rec' index); other sources are labelled
   'Uncatalogued source' and open ?src=<key>. Record page: UID and title, preview, description, transcript, interpretation. — Tab agent */
(function () {
  'use strict';
  var CONFIG = {
    source: 'rest',                                            // 'rest' | 'graphql'
    rest: 'https://bucklerfamily.estate/api/catalogue',  // GET ?limit&offset[&kind] -> {total,items}; GET /<id> -> {item,links}
    graphql: null,                                             // e.g. 'https://bucklerfamily.estate/api/graphql' once it exists
    pages: 'pages.json'                                        // page-only extras (interpretation text, public-safe extracts); never record data
  };
  var P = new URLSearchParams(location.search);
  if (P.get('source') === 'graphql' && P.get('endpoint')) { CONFIG.source = 'graphql'; CONFIG.graphql = P.get('endpoint'); }
  var KINDS = { evidence: 'Evidence', artifact: 'Artifact', missing_record: 'Missing record', person: 'Person', catalogue_candidate: 'Candidate', media: 'Media item' };
  var app = document.getElementById('app');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var IDRE = /\b(EV|MR|MED|AR|PE|CC)-\d{3,4}\b/g;
  function linkIds(html, self) { return html.replace(IDRE, function (m) { return m === self ? m : '<a href="?id=' + m + '">' + m + '</a>'; }); }
  function txt(s, self) { return linkIds(esc(s), self); }
  function getJSON(u) { return fetch(u, { headers: { accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }); }

  /* ---- data layer: two interchangeable sources with the same shape ---- */
  var Sources = {
    rest: {
      list: function () {
        var out = [];
        function page(off) {
          return getJSON(CONFIG.rest + '?limit=500&offset=' + off).then(function (d) {
            out = out.concat(d.items || []);
            if ((d.items || []).length && out.length < (d.total || 0)) return page(out.length);
            return out;
          });
        }
        return page(0);
      },
      get: function (id) { return getJSON(CONFIG.rest + '/' + encodeURIComponent(id)).then(function (d) { return { item: d.item, links: d.links || [] }; }); }
    },
    graphql: {
      q: function (query, variables) {
        return fetch(CONFIG.graphql, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ query: query, variables: variables || {} }) })
          .then(function (r) { return r.json(); }).then(function (j) { if (j.errors) throw new Error(j.errors[0].message); return j.data; });
      },
      F: 'id kind alias title dateDisplay dateSort status holder summary body page updated rev interpretation data',
      map: function (r) { if (!r) return r; return { id: r.id, kind: r.kind, alias: r.alias, title: r.title, date_display: r.dateDisplay, date_sort: r.dateSort, status: r.status, holder: r.holder, summary: r.summary, body: r.body, page: r.page, updated: r.updated, rev: r.rev, interpretation: r.interpretation, data: typeof r.data === 'string' ? JSON.parse(r.data) : (r.data || {}) }; },
      list: function () { var s = this; return s.q('query{search(q:"",limit:5000){' + s.F + '}}').then(function (d) { return d.search.map(s.map); }); },
      get: function (id) { var s = this; return s.q('query($id:ID!){record(id:$id){' + s.F + ' links{rel target}}}', { id: id }).then(function (d) { var r = d.record; return { item: s.map(r), links: (r && r.links) || [] }; }); }
    }
  };
  var SRC = Sources[CONFIG.source] || Sources.rest;
  var pagesP = getJSON(CONFIG.pages + '?v=' + Math.floor(Date.now() / 300000)).catch(function () { return {}; });

  /* ---- search (v0.5.0): Google-style home, tabs, galleries, real thumbnails ---- */
  var all = null, shown = 30;
  var TABS = [['all', 'All'], ['web', 'Web'], ['images', 'Images'], ['videos', 'Videos'], ['pdf', 'PDF'], ['books', 'Books'], ['blog', 'Blog']];
  var IMGRE = /image|photo|map|plan\b|drawing|aerial|postcard|sketch|png|jpe?g/i, BOOKRE = /book|trade directory|library item/i, WEBRE = /web page|press|website|newspaper/i, PDFRE = /\bpdf\b/i;
  var VQ = '?v=0.9.0-' + Math.floor(Date.now() / 300000);
  var extraP = Promise.all([getJSON('sources.json' + VQ).catch(function () { return { items: [], cat: {}, recon: [] }; }),
    getJSON('sources-books.json' + VQ).catch(function () { return { items: [] }; })]).then(function (a) { a[0].items = (a[0].items || []).concat(a[1].items || []); return a[0]; });
  /* thumbnails: a small index (key -> shard, source type, original URL, video duration) and shards of WebP data URIs, fetched only when shown */
  var TI = {}, RC = [], shardP = {};
  var thumbsP = getJSON('thumbs/index.json' + VQ).then(function (d) { TI = d.items || {}; RC = d.recon || []; return TI; }).catch(function () { return TI; });
  function shard(n) { if (!shardP[n]) shardP[n] = getJSON('thumbs/t' + n + '.json' + VQ).catch(function () { return {}; }); return shardP[n]; }
  function hydrate(root) {
    [].forEach.call((root || document).querySelectorAll('img[data-tk]'), function (im) {
      var k = im.getAttribute('data-tk'), e = TI[k]; if (!e || e.s == null) return;
      shard(e.s).then(function (s) { if (s[k]) { im.src = s[k]; im.removeAttribute('data-tk'); } });
    });
  }
  /* v0.9.0 (9 Nov 2026, cedwyn-catalogue#30): record page schema. Every link to where an original lives goes to OUR archived copy
     (its catalogue entry, ?src=); only an archived-copy entry links out, to the live website and then to the public Internet Archive copy. */
  var WBI = 'https://wayback.bucklerfamily.estate/websites/index.json', WB = { byOrig: {}, byCopy: {} };
  function nurl(u) { return String(u || '').split(' (')[0].replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/[#].*$/, '').replace(/\/+$/, '').toLowerCase(); }
  var wbP = getJSON(WBI).then(function (d) {
    (d.items || []).forEach(function (e) {
      if (!e.url || !e.latest) return;
      var copy = 'https://wayback.bucklerfamily.estate' + e.latest, o = { orig: e.url, copy: copy, t: e.title, dt: e.captured, v: e.version };
      WB.byOrig[nurl(e.url)] = o; WB.byCopy[nurl(copy)] = o; WB.byCopy[nurl(copy.replace(/latest\.html$/, ''))] = o;
    });
    return WB;
  }).catch(function () { return WB; });
  function ours(u) { return /^(https?:\/\/)?([a-z0-9-]+\.)*bucklerfamily\.estate(\/|$)/i.test(String(u || '')) || String(u || '').charAt(0) === '/'; }
  function copyOf(u) {                                       // -> {copy, orig, key} our archived copy of u, or null
    if (!u) return null;
    var w = WB.byCopy[nurl(u)];
    if (w) return { copy: w.copy, orig: w.orig, key: skey(String(u).split(' (')[0]), dt: w.dt };
    if (ours(u)) return { copy: String(u).split(' (')[0], orig: null, key: skey(String(u).split(' (')[0]) };
    w = WB.byOrig[nurl(u)];
    return w ? { copy: w.copy, orig: w.orig, key: skey(w.copy), dt: w.dt } : null;
  }
  function wbMachine(u) { return 'https://web.archive.org/web/*/' + String(u || '').replace(/^https?:\/\//i, ''); }
  function skey(u) {                                         // same key the thumbnail builder used: 'S' + first 10 hex of sha1(url)
    return 'S' + sha1(u).slice(0, 10);
  }
  function sha1(str) {
    function rotl(n, s) { return n << s | n >>> 32 - s; }
    var b = unescape(encodeURIComponent(str)), i, w = [], l = b.length, H = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    for (i = 0; i < l; i++) w[i >> 2] |= b.charCodeAt(i) << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8); w[((l + 8 >> 6) + 1) * 16 - 1] = l * 8;
    for (var j = 0; j < w.length; j += 16) {
      var a = H[0], bb = H[1], c = H[2], d = H[3], e = H[4], W = [];
      for (i = 0; i < 80; i++) {
        W[i] = i < 16 ? (w[j + i] | 0) : rotl(W[i - 3] ^ W[i - 8] ^ W[i - 14] ^ W[i - 16], 1);
        var f = i < 20 ? (bb & c | ~bb & d) + 0x5A827999 : i < 40 ? (bb ^ c ^ d) + 0x6ED9EBA1 : i < 60 ? (bb & c | bb & d | c & d) + 0x8F1BBCDC : (bb ^ c ^ d) + 0xCA62C1D6;
        var t = (rotl(a, 5) + f + e + W[i]) | 0; e = d; d = c; c = rotl(bb, 30); bb = a; a = t;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + bb | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0; H[4] = H[4] + e | 0;
    }
    return H.map(function (x) { return ('00000000' + (x >>> 0).toString(16)).slice(-8); }).join('');
  }



  /* ---- v0.7.0 (8 Nov 2026): footage records, pencil-sketch artist's impressions, record UID pages, uncatalogued sources ---- */
  // Footage = a catalogued record whose type or medium is film/video/broadcast, or whose title names a film or a broadcaster.
  // Secondary/analysis entries about footage are not footage. Social-media clips (sources.json tab 'videos') are not records and are not shown.
  var FOOT_T = /\b(film|films|footage|video|videocassette|broadcast|newsreel|television|cine)\b|\b(HTV|ITV|BBC|S4C|TWW)\b/i,
      FOOT_D = /\b(film|footage|video|broadcast|newsreel|television|audiovisual|moving image)\b/i;
  function isFootage(r) {
    var d = r.data || {};
    if (/analysis|secondary/i.test(String(d.label || ''))) return false;
    return FOOT_D.test([d.type, d.medium].join(' ')) || FOOT_T.test(String(r.title || ''));
  }
  // Records with no file get a greyscale graphite artist's impression in inline SVG. Every word drawn on it comes from the
  // record's own fields (title, date, issuer named in the title, reference numbers, description); where those run out the
  // sketch draws pencil strokes, never filler text. The record itself is never changed.
  var SKN = 0, SKLAB = "Artist's impression \u2014 not the original",
      SKLABF = "Artist's impression \u2014 not the original",
      SKV = '?v=0.8.0', SKD = 'sketch/',
      // the footage records: a TV-news frame composed from the site's photographs, pre-drawn as a pencil sketch (lower third from the record's title and date)
      FOOTIMG = { 'MR-0081': { f: 'tv-1974.webp', from: 'the site\'s photographs of Mary Williams and of the Great House (the white-walls picture, AR-REC-0001)' },
                  'EV-0083': { f: 'tv-1988.webp', from: 'Cadw\'s survey photograph of the farmhouse, 29 July 1988 (EV-0095)' } },
      SCENES = { house: 'the Great House (AR-REC-0001)', plan: 'the Williams plan held on this site', side: 'the farmhouse from the side', mary: 'the photograph of Mary Williams' },
      SKFONT = "'Segoe Print','Bradley Hand','Patrick Hand','Comic Neue','Chalkboard SE','Comic Sans MS',cursive";
  var ISSUERS = /^(HM Land Registry|Ministry of Justice|Welsh Government(?:\/Cadw)?|Cadw(?: \/ Welsh Government)?|Wales Office(?: FOI Team)?|Department for Culture, Media and Sport|DCMS|Information Commissioner's Office|Post Office Limited|Glamorgan-Gwent Archaeological Trust|GGAT|RCAHMW|Amgueddfa Cymru(?: \u2013 Museum Wales)?|Museum Wales|Vale of Glamorgan(?: Council)?|Cardiff Corporation|Cardiff and Vale University Health Board|Llandough Community Council|South Wales Police|National Library of Wales|Glamorgan Archives|Companies House|Cotswold Archaeolog\w*(?: Trust)?|Ideal Homes Wales|South Wales Echo|London Gazette|Board of Trade Journal|Court of Appeal|BP)\b/;
  function wrapT(s, n, max) {
    var w = String(s || '').split(/\s+/), out = [], cur = '';
    w.forEach(function (x) { if ((cur + ' ' + x).trim().length > n && cur) { out.push(cur); cur = x; } else cur = (cur + ' ' + x).trim(); });
    if (cur) out.push(cur);
    if (out.length > max) { out = out.slice(0, max); out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + ' \u2026'; }
    return out;
  }
  function shortDate(r) { return String(r.date_display || '').split(/[;(]/)[0].trim().slice(0, 34); }
  function refsOf(r) {                                     // reference numbers already in the record; nothing invented
    var d = r.data || {}, s = [r.title, d.their_ref, d.reference].join(' '),
        m = s.match(/\b\d{2}\/\d{3,5}\/[A-Z]{2,4}\b|\b(?:ATISN|FOI|IR|SAR|TO|IC|RC|WA|CAN|NPRN|PRN)[- \/]?\d[\dA-Z\/-]{2,}\b|\b[A-Z]{1,3}\d{5,}[A-Z0-9]*\b/g) || [];
    return m.filter(function (x, i) { return m.indexOf(x) === i; }).slice(0, 2);
  }
  function issuerOf(r) { var m = ISSUERS.exec(String(r.title || '')); return m ? m[1] : ''; }
  function skDefs(id) {
    return '<defs><filter id="pn' + id + '" x="-3%" y="-3%" width="106%" height="106%"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="' + (id % 9 + 1) + '"/><feDisplacementMap in="SourceGraphic" scale="1.6"/></filter>' +
      '<filter id="pp' + id + '"><feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="3" seed="4"/><feColorMatrix values="0 0 0 0 .3 0 0 0 0 .3 0 0 0 0 .29 0 0 0 .2 0"/></filter>' +
      '<pattern id="ph' + id + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0 V5" stroke="#888" stroke-width=".6" opacity=".5"/></pattern></defs>';
  }
  function tx(x, y, s, sz, anc, wt, fill) { return '<text x="' + x + '" y="' + y + '" font-size="' + sz + '"' + (anc ? ' text-anchor="' + anc + '"' : '') + (wt ? ' font-weight="' + wt + '"' : '') + (fill ? ' fill="' + fill + '"' : '') + '>' + esc(s) + '</text>'; }
  function stroke(x, y, w, id) {                            // a pencil line standing for text that the record does not hold
    var p = 'M' + x + ' ' + y, n = Math.max(3, Math.round(w / 8));
    for (var i = 1; i <= n; i++) p += ' Q' + (x + (i - .5) * w / n).toFixed(1) + ' ' + (y - 2.2 + ((i * 5 + id) % 3) * 1.4).toFixed(1) + ' ' + (x + i * w / n).toFixed(1) + ' ' + y;
    return '<path d="' + p + '" fill="none" stroke="#777" stroke-width=".85" stroke-linecap="round" opacity=".7"/>';
  }
  function sceneOf(r) {                                    // which real photograph the sheet is laid over
    var d = r.data || {}, all = [r.title, d.type, d.description, r.summary].join(' ');
    if (/Mary (Doreen )?Williams|Mrs\.? Williams|Nancy/i.test(all)) return 'mary';
    if (/\b(deed|conveyance|plan|map|tithe|parcel|title|registr|boundary|survey|lease|indenture|tenancy|common)\b/i.test(all)) return 'plan';
    if (/press|newspaper|gazette|journal|echo|western mail/i.test(all)) return 'side';
    return 'house';
  }
  function docSketch(r) {                                   // portrait sheet, 300 x 400, laid over a pencil sketch of a real photograph
    var id = ++SKN, d = r.data || {}, ty = String(d.type || ''), tall = ty + ' ' + String(r.title || ''), dt = shortDate(r), refs = refsOf(r), iss = issuerOf(r);
    var letter = /letter|email|reply|response|correspondence|acknowledg|FOI|SAR/i.test(tall), deed = /\b(deed|conveyance|lease|indenture|tenancy|agreement)\b/i.test(tall),
        press = /press|newspaper/i.test(ty), notice = /gazette|notice/i.test(ty);
    var desc = r.kind === 'evidence' || r.kind === 'artifact' ? [r.summary, d.description].filter(Boolean)[0] || '' : '';   // a missing record's note is about the search, not the document's text
    var h = '<svg class="sk" viewBox="0 0 300 400" role="img" aria-label="' + esc(SKLAB + ': ' + r.title) + '" xmlns="http://www.w3.org/2000/svg">' + skDefs(id) +
      '<rect width="300" height="400" fill="#ecebe6"/><image href="' + SKD + 'bg-' + sceneOf(r) + '.webp' + SKV + '" width="300" height="400" preserveAspectRatio="xMidYMid slice"/>' +
      '<g transform="translate(98 118) rotate(4 93 124) scale(.62)"><path d="M30 28 L290 26 L294 392 L28 396 Z" fill="#000" opacity=".28"/>' +
      '<g filter="url(#pn' + id + ')" fill="#3b3b3b" font-family="' + SKFONT + '">' +
      '<path d="M24 20 L278 17 L281 380 L21 383 Z" fill="#f7f6f2" stroke="#4d4d4d" stroke-width="1.1"/>' +
      '<path d="M281 24 L289 29 L288 389 L28 391 L21 383 L281 380 Z" fill="url(#ph' + id + ')" stroke="#8a8a8a" stroke-width=".7"/>';
    var y = 44;
    if (press) { h += '<path d="M34 28 H268 M34 56 H268 M34 59 H268" stroke="#4d4d4d" stroke-width="1"/>' + tx(150, 49, iss || 'PRESS REPORT', 15, 'middle', 700); y = 74; }
    else if (iss) { h += tx(36, y, iss, 13, '', 700) + '<path d="M36 ' + (y + 6) + ' H200" stroke="#555" stroke-width=".9"/>'; y += 22; }
    if (dt) h += tx(266, y, dt, 10.5, 'end');
    if (refs.length) { h += tx(36, y, (letter ? 'Our ref: ' : 'Ref: ') + refs.join(' \u00b7 '), 10.5); }
    y += 24;
    var tl = wrapT(r.title, 38, 3);
    if (letter && !press) { h += tx(36, y, 'Dear Sir or Madam,', 11.5); y += 20; tl.forEach(function (l, i) { h += tx(36, y, (i ? '' : 'Re: ') + l, 11, '', 700); y += 15; }); }
    else if (deed) { tl.forEach(function (l) { h += tx(150, y, l, 12, 'middle', 700); y += 16; }); y += 4; h += tx(36, y, 'THIS INDENTURE made' + (dt ? ' ' + dt : ''), 10.5); }
    else if (notice) { h += tx(150, y, 'NOTICE', 14, 'middle', 700); y += 18; tl.forEach(function (l) { h += tx(150, y, l, 11, 'middle'); y += 15; }); }
    else { tl.forEach(function (l) { h += tx(150, y, l, 12, 'middle', 700); y += 16; }); }
    y += 14;
    wrapT(desc, 46, 9).forEach(function (l) { if (y < 316) { h += tx(36, y, l, 10); y += 14; } });
    var k = 0; if (desc) y += 6;
    while (y < 320) { h += stroke(36 + (k % 5 === 0 ? 14 : 0), y, (k % 4 === 3 ? 140 : 226) - (k % 5 === 0 ? 14 : 0), id + k); y += 14; k++; if (k % 5 === 4) y += 7; }
    if (letter && !press) h += tx(36, 342, 'Yours faithfully,', 10.5) + '<path d="M40 362 q10 -15 20 0 t18 -4 t24 2" fill="none" stroke="#444" stroke-width="1.1"/>' + (iss ? tx(36, 374, iss, 9) : '');
    return h + '</g></g><rect x="0" y="388" width="300" height="12" fill="#262626" opacity=".85"/>' +
      '<text x="150" y="397" font-size="7.4" fill="#fff" text-anchor="middle" font-family="system-ui,sans-serif">' + esc(SKLAB) + '</text></svg>';
  }
  function filmSketch(r) {                                  // 4:3 pencil-sketch TV frame, 320 x 240: scanlines, grain, a lower third from the record's title and date
    var fi = FOOTIMG[r.id];
    if (fi) return '<img class="skimg" src="' + SKD + fi.f + SKV + '" alt="' + esc(SKLABF + ': ' + r.title) + '" width="640" height="480" loading="lazy" decoding="async">';
    var id = ++SKN, dt = shortDate(r), lines = wrapT(r.title, 44, 2), lh = lines.length > 1 ? 50 : 36, top = 222 - lh;
    return '<svg class="sk skf" viewBox="0 0 320 240" role="img" aria-label="' + esc(SKLABF + ': ' + r.title) + '" xmlns="http://www.w3.org/2000/svg">' + skDefs(id) +
      '<defs><pattern id="sl' + id + '" width="4" height="3" patternUnits="userSpaceOnUse"><path d="M0 .5 H4" stroke="#6d6d6d" stroke-width=".5" opacity=".5"/></pattern></defs>' +
      '<rect width="320" height="240" fill="#e7e5df"/><rect width="320" height="240" filter="url(#pp' + id + ')"/>' +
      '<g filter="url(#pn' + id + ')" fill="none" stroke="#444" stroke-linecap="round">' +
      '<rect x="10" y="9" width="300" height="214" rx="20" stroke-width="1.5"/><rect x="10" y="9" width="300" height="214" rx="20" fill="url(#ph' + id + ')" stroke="none" opacity=".35"/>' +
      '</g><image href="' + SKD + 'bg-house.webp' + SKV + '" x="11" y="10" width="298" height="212" preserveAspectRatio="xMidYMid slice"/>' +
      '<rect x="10" y="9" width="300" height="214" rx="20" fill="url(#sl' + id + ')"/>' +
      '<g filter="url(#pn' + id + ')" font-family="' + SKFONT + '"><path d="M18 ' + top + ' H302 V' + (top + lh) + ' H18 Z" fill="#3a3a3a" opacity=".82" stroke="#222"/>' +
      lines.map(function (l, i) { return tx(26, top + 15 + i * 14, l, 11, '', 700, '#f2f0ea'); }).join('') +
      (dt ? tx(26, top + lh - 7, dt, 9.5, '', '', '#d6d3cb') : '') + '</g>' +
      '<g font-family="system-ui,sans-serif"><rect x="18" y="17" width="80" height="15" rx="2" fill="#2a2a2a"/><text x="58" y="27.6" font-size="8.2" fill="#fff" text-anchor="middle" font-weight="700" letter-spacing=".9">PLACEHOLDER</text>' +
      '<rect x="0" y="228" width="320" height="12" fill="#1f1f1f" opacity=".88"/><text x="160" y="237" font-size="7.6" fill="#fff" text-anchor="middle">' + esc(SKLABF) + '</text></g></svg>';
  }
  function sketchOf(r) { return isFootage(r) ? filmSketch(r) : docSketch(r); }
  function isPrivate(r) { var d = r.data || {}; return /privately|subject[- ]access|personal data|personal material|\bSAR\b/i.test([r.status, d.label, r.holder, d.type, r.title].join(' ').replace(/FOI\/EIR\/SAR/g, 'FOI')); }
  function recTab(r, x) {                                   // the mapping file first, then the same rules for records added since
    var t = String((r.data || {}).type || ''), ti = TI[r.id] || {};
    if (isFootage(r)) return 'videos';
    if (ti.k === 'pdf' || (PDFRE.test(t) && !/png|jpe?g|xlsx?|odt|docx?/i.test(t))) return 'pdf';
    if (ti.k === 'img') return 'images';
    if (x.cat && x.cat[r.id] && x.cat[r.id] !== 'all') return x.cat[r.id];
    if ((x.recon || []).indexOf(r.id) >= 0 || r.kind === 'artifact' || IMGRE.test(t)) return 'images';
    if (BOOKRE.test(t)) return 'books';
    if (WEBRE.test(t)) return 'web';
    return 'all';
  }
  function hasRecon(id, x) { return (x.recon || []).indexOf(id) >= 0 || RC.indexOf(id) >= 0; }
  function fromRecord(r, x) {
    var d = r.data || {}, ti = TI[r.id] || {}, priv = isPrivate(r);
    var it = { tab: recTab(r, x), id: r.id, rt: r.title, t: r.id + ': ' + r.title, u: '?id=' + r.id, s: 'Records · ' + (KINDS[r.kind] || r.kind) + (d.type ? ' · ' + d.type : ''),
      d: r.summary || r.status || '', dt: r.updated || '', ic: r.kind, ty: d.type || KINDS[r.kind] || r.kind, priv: priv,
      h: [r.id, r.alias, r.title, r.holder, r.summary, r.status, r.date_display, d.type, d.label, d.their_ref, d.reference].join(' ').toLowerCase(), ds: r.date_sort || '', r: r, foot: isFootage(r) };
    if (!priv && ti.s != null) it.tk = r.id;
    else if (!priv && hasRecon(r.id, x)) { it.img = 'recon/' + r.id + '.webp'; it.sk = 1; }
    return it;
  }
  function bookImg(u) { var m = /archive\.org\/details\/([^\/\s?#]+)/.exec(u || ''); return m ? 'https://archive.org/services/img/' + m[1] : null; }
  var SRCK = {};                                             // v0.9.0: every archived-copy entry by key, including those a record describes
  function build(recs, x) {
    var out = recs.map(function (r) { return fromRecord(r, x); }), byId = {}, REC = x.rec || {};
    out.forEach(function (it) { byId[it.id] = it; });
    (x.items || []).forEach(function (it) {
      var u = String(it.u || '');
      if (it.tab === 'videos') return;                       // v0.7.0: channel uploads and social clips are not catalogued evidence
      if (it.ic === 'pdf' || /\.pdf($|[?#])/i.test(u)) it.tab = 'pdf';
      var k = skey(u), ti = TI[k], ro = REC[u] && byId[REC[u]];
      if (ro) {                                              // a source file a record already describes: one result, the record's
        SRCK[k] = { t: it.t, ou: u.split(' (')[0], key: k, tab: it.tab, dt: it.dt, s: it.s, img: it.img, tk: ti && ti.s != null ? k : null, rec: ro.id };
        (ro.srcs = ro.srcs || []).push({ t: it.t, u: u.split(' (')[0], k: k });
        ro.h += ' ' + String(it.t || '').toLowerCase();
        if (!ro.tk && !ro.img && !ro.priv && ti && ti.s != null) ro.tk = k;
        if (it.tab === 'pdf' && !ro.foot) ro.tab = 'pdf';
        return;
      }
      if (ti) { if (ti.s != null) it.tk = k; if (ti.d) it.dur = ti.d; }
      if (!it.img && !it.tk && (it.tab === 'books' || it.ic === 'book')) it.img = bookImg(u);
      it.ou = u.split(' (')[0]; it.key = k; it.unc = 1; it.u = '?src=' + k;
      it.ty = it.tab === 'pdf' ? 'PDF' : it.tab === 'books' ? 'Book' : it.tab === 'blog' ? 'Blog post' : 'Web page';
      it.s = 'Uncatalogued source · ' + (it.s || host(it.ou));
      it.h = [it.t, it.d, it.s, it.k].join(' ').toLowerCase(); it.ds = it.dt || ''; out.push(it);
    });
    out.forEach(function (it) { if (it.srcs) it.d = 'Source file: ' + it.srcs.map(function (s) { return s.t; }).join(' · ') + (it.d ? ' — ' + it.d : ''); });
    return out;
  }
  function card(it) {                                        // typed placeholder: never an empty box
    return '<span class="pc"><span class="pct">' + esc(String(it.priv ? 'Held privately' : it.ty || '').slice(0, 40)) + '</span>' + (it.id ? '<span class="pcid">' + esc(it.id) + '</span>' : '') + '</span>';
  }
  function pic(it, cls) {
    var c = card(it).replace(/"/g, '&quot;');
    if (it.tk) return '<span class="th ' + cls + '"><img data-tk="' + esc(it.tk) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" decoding="async">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
    if (it.img) return '<span class="th ' + cls + '"><img' + (it.sk ? ' class="skimg"' : '') + ' src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" onerror="this.outerHTML=\'' + c + '\'">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
    if (it.r && !it.priv) return '<span class="th ' + cls + ' thsk">' + sketchOf(it.r) + '</span>';
    return '<span class="th ' + cls + '">' + card(it) + '</span>';
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function search(q) {
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean), qq = q.toLowerCase();
    return all.map(function (it) {
      if (!toks.every(function (t) { return it.h.indexOf(t) >= 0; })) return null;
      var tt = (String(it.t || '') + ' ' + (it.srcs || []).map(function (s) { return s.t; }).join(' ')).toLowerCase(), sc = 0;
      toks.forEach(function (t) { sc += tt.indexOf(t) >= 0 ? 3 : 1; });
      if (it.id && it.id.toLowerCase() === qq) sc += 50; if (qq && tt.indexOf(qq) >= 0) sc += 5; if (it.id) sc += 1; if (it.tk || it.img) sc += 0.5;
      it.sc = sc; return it;
    }).filter(Boolean);
  }


  // v0.6.0 (7 Nov 2026): the search webapp is now Records. Wordmark "Great House, Cedwyn Estate" (Welsh "Tŷ Mawr, Ystâd Cedwyn",
  // the site's own forms: basecamp sub "Tŷ Mawr", estate "Ystâd Cedwyn"); the header title above "N of 59" reads Records;
  // a Trending row under the box. The site language is <html lang> (set by ghf-lang.js); these few strings follow it.
  var TX = {
    en: { w1: 'Great House,', w2: 'Cedwyn Estate', rec: 'Records', trend: 'Trending', home: 'Great House, Cedwyn Estate records home' },
    cy: { w1: 'Tŷ Mawr,', w2: 'Ystâd Cedwyn', rec: 'Cofnodion', trend: 'Poblogaidd', home: 'Hafan cofnodion Tŷ Mawr, Ystâd Cedwyn' },
    es: { w1: 'Great House,', w2: 'Finca Cedwyn', rec: 'Registros', trend: 'Tendencias', home: 'Inicio de los registros de Great House, Finca Cedwyn' }
  };
  function lang() { var l = (document.documentElement.getAttribute('lang') || 'en').slice(0, 2).toLowerCase(); return TX[l] ? l : 'en'; }
  function T(k) { return TX[lang()][k]; }
  // Trending: this webapp keeps no log of what people type, so the row is the record topics that the most catalogue records
  // mention (counted over all 563 records on 7 Nov 2026), plus Leckwith Common. Label is the shown word; q is the search run.
  var TREND = [
    { q: 'Llandough', cy: 'Llandochau' }, { q: 'Great House Farm', cy: 'Fferm Tŷ Mawr' }, { q: 'Tŷ Mawr' },
    { q: 'Land Registry', cy: 'Cofrestrfa Tir' }, { q: 'Bute' }, { q: 'BP Properties' }, { q: 'Leckwith Common', cy: 'Comin Lecwydd' }, { q: 'Tithe', cy: 'Degwm' }
  ];
  var tpre = '';
  function ttl(pre) { tpre = pre || ''; document.title = tpre + T('rec') + ' · ' + T('w1') + ' ' + T('w2'); }
  function trendRow() {
    return '<div class="trend" data-no-translate translate="no"><span class="trl" data-t="trend">' + T('trend') + '</span>' +
      TREND.map(function (t) { return '<a class="trc" href="?q=' + encodeURIComponent(t.q) + '" data-q="' + t.q + '"' + (t.cy ? ' data-cy="' + t.cy + '"' : '') + '>' + ((lang() === 'cy' && t.cy) || t.q) + '</a>'; }).join('') + '</div>';
  }
  function relabel() {   // wordmark, trending labels, title and the header's webapp name, in the current language
    [].forEach.call(document.querySelectorAll('[data-t]'), function (e) { var v = T(e.getAttribute('data-t')); if (v && e.textContent !== v) e.textContent = v; });
    [].forEach.call(document.querySelectorAll('.trc'), function (a) { var v = (lang() === 'cy' && a.getAttribute('data-cy')) || a.getAttribute('data-q'); if (a.textContent !== v) a.textContent = v; });
    [].forEach.call(document.querySelectorAll('.glogo,.logo'), function (a) { a.setAttribute('aria-label', T('home')); });
    var b = document.querySelector('.ghf-v2-name b'); if (b && b.textContent !== T('rec')) b.textContent = T('rec');
    var cb = b && b.closest('[aria-label]'); if (cb && cb.getAttribute('aria-label') !== T('rec') && cb.querySelector('.ghf-v2-name')) cb.setAttribute('aria-label', T('rec'));
    var want = tpre + T('rec') + ' · ' + T('w1') + ' ' + T('w2'); if (document.title !== want) document.title = want;
  }
  new MutationObserver(function () { relabel(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  (function hook(n) {   // the shared header is drawn by basecamp.js after this file runs, and redrawn on a language change
    var w = document.querySelector('.ghf-v2');
    if (w) { relabel(); new MutationObserver(function () { relabel(); }).observe(w, { childList: true, subtree: true, characterData: true }); return; }
    if (n < 60) setTimeout(function () { hook(n + 1); }, 250);
  })(0);
  function LOGOH() { return '<span class="lg" data-no-translate translate="no"><span class="lw" data-t="w1">' + T('w1') + '</span> <span class="lw" data-t="w2">' + T('w2') + '</span></span>'; }
  function foot(on) { var f = document.getElementById('cfoot'); if (f) f.hidden = !on; }   // v0.5.1: the record-reading note sits on results and record pages, not on the home page
  function homePage() {
    window.__cs = './'; ttl(''); foot(false);
    app.innerHTML = '<div class="gh"><a class="glogo" href="./" aria-label="' + T('home') + '">' + LOGOH() + '</a>' +
      '<form class="gform" role="search" id="sf" action="./"><div class="gbox"><span class="mag" aria-hidden="true">⌕</span><input type="search" name="q" id="q" placeholder="Search records, archived pages, images, films and PDFs" aria-label="Search the records" autocomplete="off" enterkeyhint="search"></div>' +
      trendRow() +
      '<div class="gbtns"><button type="submit" class="gbtn">Search</button></div></form>' +
      '</div>';
    var qi = document.getElementById('q');
    document.getElementById('sf').addEventListener('submit', function (e) { e.preventDefault(); P = new URLSearchParams(); if (qi.value.trim()) P.set('q', qi.value.trim()); history.pushState(null, '', '?' + P.toString()); shown = 30; renderList(); });
    relabel();
  }
  function renderList() {
    var q = (P.get('q') || '').trim(), sort = P.get('sort') || 'rel', tab = P.get('tab') || 'all';
    if (!q && !P.get('tab')) return homePage();
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'all';
    window.__cs = location.search || './'; foot(true);
    ttl(q ? q + ' · ' : '');
    var hits = search(q);
    var counts = { all: hits.length }; hits.forEach(function (it) { if (it.tab !== 'all') counts[it.tab] = (counts[it.tab] || 0) + 1; });
    var rows = tab === 'all' ? hits : hits.filter(function (it) { return it.tab === tab; });
    rows = rows.slice().sort(function (a, b) {
      if (sort === 'new') return String(b.dt || '').localeCompare(String(a.dt || ''));
      if (sort === 'date') return String(a.ds || '9999').localeCompare(String(b.ds || '9999'));
      if (sort === 'date-desc') return String(b.ds || '').localeCompare(String(a.ds || ''));
      if (sort === 'id') { if (a.id && b.id) return a.id.localeCompare(b.id, 'en', { numeric: true }); return a.id ? -1 : b.id ? 1 : 0; }
      if (q && b.sc !== a.sc) return b.sc - a.sc;
      if ((b.tk || b.img ? 1 : 0) !== (a.tk || a.img ? 1 : 0)) return (b.tk || b.img ? 1 : 0) - (a.tk || a.img ? 1 : 0);
      if (a.id && b.id) return a.id.localeCompare(b.id, 'en', { numeric: true });
      return a.id ? -1 : b.id ? 1 : 0;
    });
    var h = '<div class="sx"><div class="sbar"><a class="logo" href="./" aria-label="' + T('home') + '">' + LOGOH() + '</a>';
    h += '<form class="sbox" role="search" id="sf"><span class="mag" aria-hidden="true">⌕</span><input type="search" id="q" placeholder="Search the records" value="' + esc(q) + '" aria-label="Search" autocomplete="off" enterkeyhint="search"><button type="submit" class="sbtn" aria-label="Search">Search</button></form></div>';
    h += '<nav class="tabs" aria-label="Result type">' + TABS.map(function (t) {
      var on = t[0] === tab, href = '?' + qs({ tab: t[0] === 'all' ? '' : t[0] });
      return '<a href="' + esc(href) + '"' + (on ? ' aria-current="page" class="on"' : '') + '>' + t[1] + '</a>';
    }).join('') + '</nav>';
    h += '<div class="meta"><span>About ' + rows.length + ' result' + (rows.length === 1 ? '' : 's') + (q ? ' for <b>' + esc(q) + '</b>' : '') + '</span><select id="sort" aria-label="Sort"><option value="rel">Sort: relevance</option><option value="id">Sort: record number</option><option value="new">Sort: recently added</option><option value="date">Sort: date (oldest)</option><option value="date-desc">Sort: date (newest)</option></select></div></div>';
    if (!rows.length) h += '<p class="none">No results' + (q ? ' for <b>' + esc(q) + '</b>' : '') + (tab !== 'all' ? ' in ' + TABS.filter(function (t) { return t[0] === tab; })[0][1] + '. Try <a href="?' + esc(qs({ tab: '' })) + '">All</a>.' : '.') + '</p>';
    var page = rows.slice(0, shown);
    function recLink(it) { return it.id ? '<a class="rl" href="?id=' + esc(it.id) + '">' + esc(it.id) + ' · record</a>' : (it.u ? '<a class="rl" href="' + esc(it.u) + '" rel="noopener">' + esc(host(it.u)) + '</a>' : ''); }
    if (tab === 'images') {
      h += '<div class="gal">' + page.map(function (it) { return '<figure class="gi"><a href="' + esc(it.u || '#') + '"' + ext(it) + '>' + pic(it, 'gim') + '</a><figcaption><span class="gt">' + esc(it.rt || it.t) + '</span>' + recLink(it) + '</figcaption></figure>'; }).join('') + '</div>';
    } else if (tab === 'videos') {
      var vcard = function (it) {                            // catalogued footage only; no footage file is held here yet, so each shows its sketch frame
        return '<article class="vi"><a class="vth" href="?id=' + esc(it.id) + '" aria-label="' + esc(it.rt) + '"><span class="th vim vff">' + filmSketch(it.r) + '</span></a>' +
          '<div class="vtx"><a class="vt" href="?id=' + esc(it.id) + '">' + esc(it.rt) + '</a><span class="vs">' + esc(it.id) + ' · ' + esc(KINDS[it.r.kind] || it.r.kind) + (it.r.date_display ? ' · ' + esc(shortDate(it.r)) : '') + '</span>' + recLink(it) + '</div></article>';
      };
      h += '<div class="vgal">' + page.map(vcard).join('') + '</div>';
      if (q) {
        var seen = {}; rows.forEach(function (it) { seen[it.id] = 1; });
        var other = all.filter(function (it) { return it.tab === 'videos' && it.r && !seen[it.id]; });
        if (other.length) h += '<h3 class="vo">Other catalogued footage</h3><div class="vgal">' + other.map(vcard).join('') + '</div>';
      }
    } else if (tab === 'pdf') {
      h += '<div class="pgal">' + page.map(function (it) {
        return '<figure class="pi"><a href="' + esc(it.u || '#') + '"' + ext(it) + '>' + pic(it, 'pim') + '<b class="pdfb">PDF</b></a><figcaption><span class="gt">' + esc(it.rt || it.t) + '</span>' + recLink(it) + '</figcaption></figure>';
      }).join('') + '</div>';
    } else {
      h += '<div class="res">' + page.map(function (it) {
        var src = it.s || host(it.u);
        return '<article class="r"><div class="tx"><div class="src">' + esc(src) + (it.dt ? ' · ' + esc(String(it.dt).slice(0, 10)) : '') + '</div>' +
          (it.u ? '<a class="tt" href="' + esc(it.u) + '"' + ext(it) + '>' + esc(it.t) + '</a>' : '<span class="tt">' + esc(it.t) + '</span>') +
          (it.d ? '<p class="sn">' + esc(it.d) + '</p>' : '') + '</div>' + (it.u ? '<a class="tl" href="' + esc(it.u) + '"' + ext(it) + ' tabindex="-1" aria-hidden="true">' + pic(it, 'lim') + '</a>' : pic(it, 'lim')) + '</article>';
      }).join('') + '</div>';
    }
    if (rows.length > shown) h += '<button class="more" id="more">More results (' + (rows.length - shown) + ')</button>';
    app.innerHTML = h; hydrate(app);
    document.getElementById('sort').value = sort;
    var qi = document.getElementById('q');
    document.getElementById('sf').addEventListener('submit', function (e) { e.preventDefault(); setParam('q', qi.value.trim()); });
    document.getElementById('sort').addEventListener('change', function (e) { setParam('sort', e.target.value === 'rel' ? '' : e.target.value); });
    var m = document.getElementById('more'); if (m) m.addEventListener('click', function () { shown += 60; renderList(); });
  }
  function ext(it) { return it.u && it.u.charAt(0) !== '?' ? ' rel="noopener"' : ''; }
  function qs(o) { var p = new URLSearchParams(P.toString()); p.delete('id'); Object.keys(o).forEach(function (k) { if (o[k]) p.set(k, o[k]); else p.delete(k); }); return p.toString(); }
  function setParam(k, v) {
    if (v) P.set(k, v); else P.delete(k); P.delete('id'); shown = 30;
    history.pushState(null, '', '?' + P.toString()); renderList();
  }


  /* ---- record page (v0.7.0): UID and title -> preview -> description, transcript -> interpretation -> record details ---- */
  function previewFig(r, srcs) {                            // the derived thumbnail (the record's own, else its source file's front page), linked to the original
    if (isPrivate(r)) return '';
    var ti = TI[r.id], k = r.id, ou = ti && ti.u;
    if (!ti || ti.s == null) { ti = null; (srcs || []).some(function (s) { var t = TI[s.k]; if (t && t.s != null) { ti = t; k = s.k; ou = s.u; return true; } return false; }); }
    if (!ti) return '';
    var c = copyOf(ou), href = c ? (ours(ou) && !WB.byCopy[nurl(ou)] ? c.copy : '?src=' + c.key) : '', lab = ti.k === 'pdf' || /\.pdf/i.test(ou || '') ? 'First page' : ti.k === 'page' ? 'Picture from the record\'s page' : 'Preview';
    var img = '<img data-tk="' + esc(k) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Preview of ' + esc(r.title) + '">';
    return '<figure class="prev">' + (href ? '<a href="' + esc(href) + '">' + img + '</a>' : img) + '<figcaption>' + lab + ' · ' + (href ? '<a href="' + esc(href) + '">open the artifact (our archived copy)</a>' : 'our archived copy of the original is not held yet') + '</figcaption></figure>';
  }
  function placeholderFrame(r) {                           // no file is held here: a graphite artist's impression, labelled as such
    var f = isFootage(r);
    var fi = FOOTIMG[r.id], from = f ? (fi ? fi.from : SCENES.house) : SCENES[sceneOf(r)];
    return '<figure class="skfig' + (f ? ' skfilm' : '') + '">' + (f ? filmSketch(r) : docSketch(r)) + '<figcaption>' + esc(f ? SKLABF : SKLAB) + '. A pencil sketch composed from ' + esc(from) + '; every word on it comes from this record\'s own title, date, references and description. No file of this item is held here yet.</figcaption></figure>';
  }
  function statusNote(r) {
    var d = r.data || {}, st = String(r.status || '');
    if (/not (yet )?(held|found|obtained)|requested|pending|blocked|sought/i.test(st)) return '<p class="muted stn">' + esc(st) + '. This entry records the item and where it should be; the original is not in the repository yet.</p>';
    return '<p class="muted stn">' + esc(d.label || KINDS[r.kind] || r.kind) + (st ? ' · ' + esc(st) : '') + '. The original is shown on its holder\'s or the archive\'s own page; this page shows the record of it.</p>';
  }
  function artifactCard(r) {
    return '<div class="artifact"><strong>Document held privately — personal data</strong><span class="muted">The original is kept privately in the evidence repository and is not published here. The description and extract below are the public record of it.</span></div>';
  }
  function row(k, v, self) { return v ? '<tr><th>' + esc(k) + '</th><td>' + txt(v, self) + '</td></tr>' : ''; }
  function interpBlock(r, extra) {
    var it = r.interpretation || (r.data || {}).interpretation || (extra && extra.interpretation), h = '<section class="interp" aria-label="Interpretation"><div class="lab">Interpretation — our reading, not a finding</div>';
    if (!it) return h + '<p class="nya">Interpretation not yet added.</p></section>';
    if (typeof it === 'string') return h + it.split(/\n{2,}/).map(function (p) { return '<p>' + txt(p, r.id) + '</p>'; }).join('') + '</section>';
    (it.sections || []).forEach(function (s) {
      h += '<h3>' + esc(s.h) + '</h3>';
      if (s.p) s.p.forEach(function (p) { h += '<p>' + txt(p, r.id) + '</p>'; });
      if (s.li) h += '<ul>' + s.li.map(function (p) { return '<li>' + txt(p, r.id) + '</li>'; }).join('') + '</ul>';
    });
    if (it.updated) h += '<p class="muted">Interpretation written ' + esc(it.updated) + (it.version ? ' · v' + esc(it.version) : '') + '. It reads the record; it does not change it.</p>';
    return h + '</section>';
  }
  function reconFig(r) {
    return '<figure class="recon"><img class="skimg" src="recon/' + encodeURIComponent(r.id) + '.webp" alt="Pencil sketch: an artist reconstruction of ' + esc(r.title) + '. It is not the document." loading="lazy"><figcaption>tab.bot artist reconstruction</figcaption></figure>';
  }
  function srcsFor(id, x) { var out = []; Object.keys((x && x.rec) || {}).forEach(function (u) { if (x.rec[u] === id) { var t = ((x.items || []).filter(function (i) { return i.u === u; })[0] || {}).t; out.push({ u: u.split(' (')[0], k: skey(u), t: t || u }); } }); return out; }
  function uidLine(id, lab) { var url = 'https://bucklerfamily.estate/catalogue/?' + (lab === 'src' ? 'src=' : 'id=') + id; return '<p class="uid">' + (lab === 'src' ? 'Source key' : 'Record UID') + ' <b>' + esc(id) + '</b> · <a href="' + esc(url) + '">' + esc(url.replace('https://', '')) + '</a></p>'; }
  function locLink(u, t) {                                   // where an original lives: the text names the original, the link opens OUR copy
    var c = copyOf(u), shown = (c && c.orig) || String(u || '').split(' (')[0];
    if (!c) return '<span>' + esc(t ? t + ' — ' : '') + esc(shown) + '</span> <span class="muted">(our archived copy is not held yet)</span>';
    var href = WB.byCopy[nurl(c.copy)] || !ours(u) ? '?src=' + c.key : c.copy;
    return '<a href="' + esc(href) + '">' + esc(t || shown) + '</a> <span class="muted">· ' + esc(c.orig ? host(c.orig) : 'our archive') + ' · our archived copy</span>';
  }
  function metaBlock(r, srcs) {                              // directly under the preview: date, our catalogue reference, where the original(s) are
    var d = r.data || {}, ti = TI[r.id], seen = {}, locs = [];
    (srcs || []).forEach(function (s) { if (!seen[nurl(s.u)]) { seen[nurl(s.u)] = 1; locs.push(locLink(s.u, s.t)); } });
    if (ti && ti.u && !seen[nurl(ti.u)] && !isPrivate(r)) { seen[nurl(ti.u)] = 1; locs.push(locLink(ti.u)); }
    var hold = r.holder || d.repository, ref = [r.id + (r.alias ? ' (' + r.alias + ')' : ''), d.their_ref || d.reference ? 'holder\'s reference ' + (d.their_ref || d.reference) : ''].filter(Boolean).join(' · ');
    return '<table class="ghf-ev-table recmeta"><tbody>' + row('Date of the record', r.date_display || 'not recorded') +
      '<tr><th>Catalogue reference</th><td>' + esc(ref) + '</td></tr>' +
      '<tr><th>Original record' + (locs.length > 1 ? 's' : '') + '</th><td>' + (hold ? txt(hold, r.id) + (locs.length ? '<br>' : '') : '') +
      (locs.length ? locs.join('<br>') : (hold ? '' : '<span class="muted">not recorded</span>')) + '</td></tr></tbody></table>';
  }
  function isText(r) { var t = String(((r.data || {}).type) || '') + ' ' + (KINDS[r.kind] || ''); return !isFootage(r) && r.kind !== 'artifact' && r.kind !== 'media' && !IMGRE.test(t); }
  function renderRecord(id) {
    foot(true); app.innerHTML = '<p class="muted">Loading ' + esc(id) + '…</p>';
    Promise.all([SRC.get(id), pagesP, thumbsP, extraP, wbP]).then(function (a) {
      var r = a[0].item, links = a[0].links, extra = (a[1] || {})[id] || null, srcs = srcsFor(id, a[3]);
      if (!r) throw new Error('not found');
      var d = r.data || {}; ttl(r.id + ' · ');
      var rel = {}; (links || []).forEach(function (l) { var t = l.target || l.to || l.id || l.dst; if (t && t !== r.id) rel[t] = 1; });
      (JSON.stringify(r).match(IDRE) || []).forEach(function (m) { if (m !== r.id) rel[m] = 1; });
      var h = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p>' + uidLine(r.id) + '<h1>' + esc(r.id) + ': ' + esc(r.title) + '</h1>';
      var pv = previewFig(r, srcs);
      h += '<h2>Preview</h2>';
      if (isPrivate(r)) h += artifactCard(r);
      else if (pv) h += pv;
      else if (hasRecon(r.id, a[3] || {}) && !isFootage(r)) h += reconFig(r) + statusNote(r);
      else h += placeholderFrame(r) + statusNote(r);
      h += metaBlock(r, srcs);
      h += '<h2>Description</h2>';
      var desc = [r.summary, d.description && d.description !== r.summary ? d.description : '', d.provenance].filter(Boolean);
      if (desc.length) h += desc.map(function (p) { return '<p>' + txt(p, r.id) + '</p>'; }).join('');
      else h += '<p class="nya">Description not yet added.</p>';
      if (r.body) h += '<h2>Transcript</h2><blockquote class="verbatim">' + txt(r.body, r.id) + '</blockquote>';
      else if (extra && extra.extract) h += '<h2>Transcript</h2><p class="muted">' + esc(extra.extract_label || 'Extract (public-safe, verbatim)') + '</p><blockquote class="verbatim">' + txt(extra.extract, r.id) + '</blockquote>';
      else if (isText(r)) h += '<h2>Transcript</h2><p class="nya">Transcript not yet added.</p>';
      h += '<h2>Interpretation</h2>' + interpBlock(r, extra);
      h += '<h2>Record details</h2><table class="ghf-ev-table"><tbody>' + row('ID', r.id + (r.alias ? ' (' + r.alias + ')' : ''), r.id) + row('Kind', KINDS[r.kind] || r.kind) + row('Title', r.title, r.id) +
        row('Date', r.date_display) + row('Status', r.status) + row('Type', d.type) + row('Evidence label', d.label) + row('Holder', r.holder || d.repository, r.id) +
        row('Reference', d.their_ref || d.reference) + row('Artifact', d.artifact) + row('Evidence grade', d.evidence_grade ? d.evidence_grade + (d.grade_note ? ' — ' + d.grade_note : '') : '') +
        row('Why we believe it exists', d.why_we_believe_it_exists, r.id) + row('How to obtain', d.obtain, r.id) + row('Source', typeof d.source === 'string' ? d.source : '', r.id) +
        (Object.keys(rel).length ? '<tr><th>Linked records</th><td>' + Object.keys(rel).sort().map(function (x) { return '<a href="?id=' + x + '">' + x + '</a>'; }).join(' · ') + '</td></tr>' : '') +
        row('Record entry', 'revision ' + (r.rev || 1) + (r.updated ? ', updated ' + r.updated.slice(0, 10) : '')) + '</tbody></table>';
      h += '<p class="muted">Raw record: <a href="' + esc(CONFIG.rest + '/' + r.id) + '">JSON</a>' + (r.page && r.page.charAt(0) === '/' ? ' · Earlier page: <a href="https://bucklerfamily.estate' + esc(r.page) + '">' + esc(r.page) + '</a>' : '') + '</p>';
      app.innerHTML = h; hydrate(app); window.scrollTo(0, 0);
    }).catch(function (e) { app.innerHTML = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p><div class="err">Record ' + esc(id) + ' could not be read (' + esc(e.message) + '). It may not be in the records yet.</div>'; });
  }
  function renderSource(key) {                              // OUR archived copy of a page or file: the one place that links out (live site, then Internet Archive)
    foot(true);
    var back = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p>';
    wbP.then(function () {
      var it = (all || []).filter(function (x) { return x.key === key; })[0] || SRCK[key];
      if (!it) { Object.keys(WB.byOrig).some(function (n) { var w = WB.byOrig[n]; if (skey(w.copy) === key) { it = { t: w.t, ou: w.copy, key: key, dt: w.dt, tab: 'web', s: host(w.orig) }; return true; } return false; }); }
      if (!it) { app.innerHTML = back + '<div class="err">Source ' + esc(key) + ' is not in the search index.</div>'; return; }
      ttl(String(it.t || '').slice(0, 60) + ' · ');
      var held = ours(it.ou), w = WB.byCopy[nurl(it.ou)], orig = w ? w.orig : (held ? null : it.ou);
      var h = back + uidLine(key, 'src') + '<h1>' + esc(it.t) + '</h1>' + (held ? '<p class="unc">Our archived copy</p>' : '<p class="unc">Uncatalogued source</p>') +
        (it.rec ? '<p class="muted">Described by catalogue record <a href="?id=' + esc(it.rec) + '">' + esc(it.rec) + '</a>.</p>' : '<p class="muted">No catalogue record describes this ' + (held ? 'archived copy' : 'source') + ' yet, so it has no record UID; it is listed for the catalogue to take up.</p>');
      h += '<h2>Preview</h2>';
      var img = it.tk ? '<img data-tk="' + esc(it.tk) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Preview of ' + esc(it.t) + '">' : it.img ? '<img src="' + esc(it.img) + '" alt="Preview of ' + esc(it.t) + '" onerror="this.remove()">' : '';
      if (held) h += img ? '<figure class="prev"><a href="' + esc(it.ou) + '">' + img + '</a><figcaption>' + (it.tab === 'pdf' ? 'First page' : 'Preview') + ' · <a href="' + esc(it.ou) + '">open our archived copy</a></figcaption></figure>'
        : '<div class="artifact"><strong>' + esc(it.ty || 'Source') + '</strong><span class="muted">No preview yet. <a href="' + esc(it.ou) + '">Open our archived copy</a>.</span></div>';
      else h += (img ? '<figure class="prev">' + img + '<figcaption>Preview · our archived copy is not held yet</figcaption></figure>' : '<div class="artifact"><strong>' + esc(it.ty || 'Source') + '</strong><span class="muted">Our archived copy of this source is not held yet.</span></div>');
      h += '<table class="ghf-ev-table recmeta"><tbody>' + row('Date captured', it.dt ? String(it.dt).slice(0, 10) : 'not recorded') +
        '<tr><th>Catalogue reference</th><td>' + esc(key) + (it.rec ? ' · described by <a href="?id=' + esc(it.rec) + '">' + esc(it.rec) + '</a>' : '') + '</td></tr>' +
        '<tr><th>Our archived copy</th><td>' + (held ? '<a href="' + esc(it.ou) + '">' + esc(it.ou.replace(/^https?:\/\//, '')) + '</a>' : '<span class="muted">not held yet</span>') + '</td></tr>' +
        (orig ? '<tr><th>Original website</th><td>' + (held ? '<a href="' + esc(orig) + '" rel="noopener external">' + esc(orig) + '</a>' : esc(orig)) + '</td></tr>' : '') +
        (orig && held ? '<tr><th>Public archived copy</th><td><a href="' + esc(wbMachine(orig)) + '" rel="noopener external">Internet Archive Wayback Machine</a></td></tr>' : '') + '</tbody></table>';
      h += '<h2>Description</h2><p class="nya">Description not yet added.</p><p class="muted">' + esc(it.s || '') + '</p>';
      if (it.tab !== 'images') h += '<h2>Transcript</h2><p class="nya">' + (held ? 'The text is in <a href="' + esc(it.ou) + '">our archived copy</a>; a transcript is not yet added here.' : 'Transcript not yet added.') + '</p>';
      h += '<h2>Interpretation</h2><section class="interp" aria-label="Interpretation"><div class="lab">Interpretation — our reading, not a finding</div><p class="nya">Interpretation not yet added.</p></section>';
      app.innerHTML = h; hydrate(app); window.scrollTo(0, 0);
    });
  }

  function route() {
    P = new URLSearchParams(location.search); var id = (P.get('id') || '').trim().toUpperCase();
    if (id) return renderRecord(id);
    var sk = (P.get('src') || '').trim();
    if (all) return sk ? renderSource(sk) : renderList();
    Promise.all([SRC.list(), extraP, thumbsP]).then(function (x) { all = build(x[0], x[1]); if (sk) renderSource(sk); else renderList(); }).catch(function (e) { app.innerHTML = '<div class="err">The records could not be read (' + esc(e.message) + '). Try again in a moment.</div>'; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="?"]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); if (!/[?&](id|src)=/.test(a.getAttribute('href'))) shown = 30; route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);
  route();
})();
