/* Cedwyn records browser v0.6.0 (was the catalogue browser) — one front end for every record in the central catalogue.
   Records are read live (REST /api/catalogue today; a GraphQL endpoint can be switched in via CONFIG or ?source=graphql&endpoint=...).
   Record pages: artifact placeholder -> description / transcript -> interpretation box. Nothing here edits a record.
   v0.3.0: Google-style search with tabs (All · Web · Images · Videos · Blog · Books) and a preview image per result; sources.json is a display/classification map only.
   v0.5.0: the standard site header; a Google-style home (logo, search box, Search button; v0.6.0 drops "I'm feeling lucky" for a Trending row); tabs All · Web · Images · Videos · PDF · Books · Blog
   with galleries for Images, Videos and PDF front pages; real preview thumbnails (thumbs/index.json + thumbs/tN.json, derived WebP copies, never record data);
   a typed card wherever no picture exists. Records are still read live and never edited here. — Tab agent */
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
  var KINDS = { evidence: 'Evidence', artifact: 'Artifact', missing_record: 'Missing record', person: 'Person', catalogue_candidate: 'Candidate' };
  var app = document.getElementById('app');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var IDRE = /\b(EV|MR|AR|PE|CC)-\d{3,4}\b/g;
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
  var VQ = '?v=0.5.0-' + Math.floor(Date.now() / 300000);
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
  function isPrivate(r) { var d = r.data || {}; return /privately|subject[- ]access|personal data|personal material|\bSAR\b/i.test([r.status, d.label, r.holder, d.type, r.title].join(' ').replace(/FOI\/EIR\/SAR/g, 'FOI')); }
  function recTab(r, x) {                                   // the mapping file first, then the same rules for records added since
    var t = String((r.data || {}).type || ''), ti = TI[r.id] || {};
    if (ti.k === 'pdf' || (PDFRE.test(t) && !/png|jpe?g|xlsx?|odt|docx?/i.test(t))) return 'pdf';
    if (ti.k === 'img') return 'images';
    if (x.cat && x.cat[r.id] && x.cat[r.id] !== 'all') return x.cat[r.id];
    if ((x.recon || []).indexOf(r.id) >= 0 || r.kind === 'artifact' || IMGRE.test(t)) return 'images';
    if (/video|film/i.test(t)) return 'videos';
    if (BOOKRE.test(t)) return 'books';
    if (WEBRE.test(t)) return 'web';
    return 'all';
  }
  function hasRecon(id, x) { return (x.recon || []).indexOf(id) >= 0 || RC.indexOf(id) >= 0; }
  function fromRecord(r, x) {
    var d = r.data || {}, ti = TI[r.id] || {}, priv = isPrivate(r);
    var it = { tab: recTab(r, x), id: r.id, rt: r.title, t: r.id + ': ' + r.title, u: '?id=' + r.id, s: 'Records · ' + (KINDS[r.kind] || r.kind) + (d.type ? ' · ' + d.type : ''),
      d: r.summary || r.status || '', dt: r.updated || '', ic: r.kind, ty: d.type || KINDS[r.kind] || r.kind, priv: priv,
      h: [r.id, r.alias, r.title, r.holder, r.summary, r.status, r.date_display, d.type, d.label, d.their_ref, d.reference].join(' ').toLowerCase(), ds: r.date_sort || '' };
    if (!priv && ti.s != null) it.tk = r.id;
    else if (!priv && hasRecon(r.id, x)) { it.img = 'recon/' + r.id + '.webp'; it.sk = 1; }
    return it;
  }
  function bookImg(u) { var m = /archive\.org\/details\/([^\/\s?#]+)/.exec(u || ''); return m ? 'https://archive.org/services/img/' + m[1] : null; }
  function build(recs, x) {
    var out = recs.map(function (r) { return fromRecord(r, x); });
    (x.items || []).forEach(function (it) {
      var u = String(it.u || '');
      if (it.ic === 'pdf' || /\.pdf($|[?#])/i.test(u)) it.tab = 'pdf';
      var k = skey(u), ti = TI[k];
      if (ti) { if (ti.s != null) it.tk = k; if (ti.d) it.dur = ti.d; }
      if (!it.img && !it.tk && (it.tab === 'books' || it.ic === 'book')) it.img = bookImg(u);
      it.u = u.split(' (')[0];
      it.ty = it.tab === 'pdf' ? 'PDF' : it.tab === 'videos' ? 'Video' : it.tab === 'books' ? 'Book' : it.tab === 'blog' ? 'Blog post' : 'Web page';
      it.h = [it.t, it.d, it.s, it.k].join(' ').toLowerCase(); it.ds = it.dt || ''; out.push(it);
    });
    return out;
  }
  function card(it) {                                        // typed placeholder: never an empty box
    return '<span class="pc"><span class="pct">' + esc(String(it.priv ? 'Held privately' : it.ty || '').slice(0, 40)) + '</span>' + (it.id ? '<span class="pcid">' + esc(it.id) + '</span>' : '') + '</span>';
  }
  function pic(it, cls) {
    var c = card(it).replace(/"/g, '&quot;');
    if (it.tk) return '<span class="th ' + cls + '"><img data-tk="' + esc(it.tk) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" decoding="async">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
    if (it.img) return '<span class="th ' + cls + '"><img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" onerror="this.outerHTML=\'' + c + '\'">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
    return '<span class="th ' + cls + '">' + card(it) + '</span>';
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function search(q) {
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean), qq = q.toLowerCase();
    return all.map(function (it) {
      if (!toks.every(function (t) { return it.h.indexOf(t) >= 0; })) return null;
      var tt = String(it.t || '').toLowerCase(), sc = 0;
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
      h += '<div class="vgal">' + page.map(function (it) {
        return '<article class="vi"><a class="vth" href="' + esc(it.u || '#') + '"' + ext(it) + '>' + pic(it, 'vim') + '<span class="play" aria-hidden="true">▶</span>' + (it.dur ? '<span class="dur">' + esc(it.dur) + '</span>' : '') + '</a>' +
          '<div class="vtx"><a class="vt" href="' + esc(it.u || '#') + '"' + ext(it) + '>' + esc(it.rt || it.t) + '</a><span class="vs">' + esc(it.s || host(it.u)) + (it.dt ? ' · ' + esc(String(it.dt).slice(0, 10)) : '') + '</span>' + (it.id ? recLink(it) : '') + '</div></article>';
      }).join('') + '</div>';
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

  /* ---- record page ---- */
  function previewFig(r) {                                  // v0.5.0: the derived thumbnail, linked to the original it was made from
    var ti = TI[r.id]; if (!ti || ti.s == null || isPrivate(r)) return '';
    return '<figure class="prev"><a href="' + esc(ti.u || '#') + '" rel="noopener"><img data-tk="' + esc(r.id) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Preview of ' + esc(r.title) + '"></a><figcaption>' + (ti.k === 'pdf' ? 'Front page' : ti.k === 'page' ? 'Picture from the record\'s page' : 'Preview') + ' · <a href="' + esc(ti.u || '#') + '" rel="noopener">open the original</a></figcaption></figure>';
  }
  function artifactCard(r) {
    var d = r.data || {}, st = String(r.status || '');
    if (isPrivate(r)) return '<div class="artifact"><strong>Document held privately — personal data</strong><span class="muted">The original is kept privately in the evidence repository and is not published here. The description and extract below are the public record of it.</span></div>';
    if (/not (yet )?(held|found|obtained)|requested|pending|blocked/i.test(st)) return '<div class="artifact"><strong>Artifact not yet held</strong><span class="muted">' + esc(st) + '. This entry records the document and where it should be; the original is not in the repository yet.</span></div>';
    return '<div class="artifact"><strong>' + esc(d.label || 'Artifact') + '</strong><span class="muted">' + esc(d.type || r.kind) + ' · ' + esc(st) + '. The artifact itself is shown on its holder\'s or the archive\'s own page; this page shows the record of it.</span></div>';
  }
  function row(k, v, self) { return v ? '<tr><th>' + esc(k) + '</th><td>' + txt(v, self) + '</td></tr>' : ''; }
  function interpBlock(r, extra) {
    var it = r.interpretation || (r.data || {}).interpretation || (extra && extra.interpretation), h = '<section class="interp" aria-label="Interpretation"><div class="lab">Interpretation — our reading, not a finding</div>';
    if (!it) return h + '<p>No interpretation has been written for this record yet. The record above stands on its own; an interpretation reading it against hindsight and the wider chronology will appear here when it is added.</p></section>';
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
    return '<figure class="recon"><img src="recon/' + encodeURIComponent(r.id) + '.webp" alt="Pencil sketch: an artist reconstruction of ' + esc(r.title) + '. It is not the document." loading="lazy" onerror="this.parentNode.remove()"><figcaption>tab.bot artist reconstruction</figcaption></figure>';
  }
  function renderRecord(id) {
    foot(true); app.innerHTML = '<p class="muted">Loading ' + esc(id) + '…</p>';
    Promise.all([SRC.get(id), pagesP, thumbsP]).then(function (a) {
      var r = a[0].item, links = a[0].links, extra = (a[1] || {})[id] || null;
      if (!r) throw new Error('not found');
      var d = r.data || {}; ttl(r.id + ' · ');
      var rel = {}; (links || []).forEach(function (l) { var t = l.target || l.to || l.id || l.dst; if (t && t !== r.id) rel[t] = 1; });
      (JSON.stringify(r).match(IDRE) || []).forEach(function (m) { if (m !== r.id) rel[m] = 1; });
      var h = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p><h1>' + esc(r.id) + ': ' + esc(r.title) + '</h1>';
      var pv = previewFig(r);
      h += '<h2>Artifact</h2>' + (pv || artifactCard(r)) + (pv ? '' : reconFig(r));
      h += '<h2>Description</h2>';
      if (r.summary) h += '<p>' + txt(r.summary, r.id) + '</p>';
      if (d.provenance) h += '<p>' + txt(d.provenance, r.id) + '</p>';
      if (!r.summary && !d.provenance) h += '<p class="muted">No description in the record.</p>';
      h += '<h2>Transcript</h2>';
      if (r.body) h += '<blockquote class="verbatim">' + txt(r.body, r.id) + '</blockquote>';
      else if (extra && extra.extract) h += '<p class="muted">' + esc(extra.extract_label || 'Extract (public-safe, verbatim)') + '</p><blockquote class="verbatim">' + txt(extra.extract, r.id) + '</blockquote>';
      else h += '<p class="muted">No transcript in the record.</p>';
      h += '<table class="ghf-ev-table"><tbody>' + row('ID', r.id + (r.alias ? ' (' + r.alias + ')' : ''), r.id) + row('Kind', KINDS[r.kind] || r.kind) + row('Title', r.title, r.id) +
        row('Date', r.date_display) + row('Status', r.status) + row('Type', d.type) + row('Evidence label', d.label) + row('Holder', r.holder || d.repository, r.id) +
        row('Reference', d.their_ref || d.reference) + row('Artifact', d.artifact) + row('Evidence grade', d.evidence_grade ? d.evidence_grade + (d.grade_note ? ' — ' + d.grade_note : '') : '') +
        row('Why we believe it exists', d.why_we_believe_it_exists, r.id) + row('How to obtain', d.obtain, r.id) + row('Source', typeof d.source === 'string' ? d.source : '', r.id) +
        (Object.keys(rel).length ? '<tr><th>Linked records</th><td>' + Object.keys(rel).sort().map(function (x) { return '<a href="?id=' + x + '">' + x + '</a>'; }).join(' · ') + '</td></tr>' : '') +
        row('Record entry', 'revision ' + (r.rev || 1) + (r.updated ? ', updated ' + r.updated.slice(0, 10) : '')) + '</tbody></table>';
      h += '<h2>Interpretation</h2>' + interpBlock(r, extra);
      h += '<p class="muted">Raw record: <a href="' + esc(CONFIG.rest + '/' + r.id) + '">JSON</a>' + (r.page && r.page.charAt(0) === '/' ? ' · Earlier page: <a href="https://bucklerfamily.estate' + esc(r.page) + '">' + esc(r.page) + '</a>' : '') + '</p>';
      app.innerHTML = h; hydrate(app); window.scrollTo(0, 0);
    }).catch(function (e) { app.innerHTML = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p><div class="err">Record ' + esc(id) + ' could not be read (' + esc(e.message) + '). It may not be in the records yet.</div>'; });
  }

  function route() {
    P = new URLSearchParams(location.search); var id = (P.get('id') || '').trim().toUpperCase();
    if (id) return renderRecord(id);
    if (all) return renderList();
    Promise.all([SRC.list(), extraP, thumbsP]).then(function (x) { all = build(x[0], x[1]); renderList(); }).catch(function (e) { app.innerHTML = '<div class="err">The records could not be read (' + esc(e.message) + '). Try again in a moment.</div>'; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="?"]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); if (!/[?&]id=/.test(a.getAttribute('href'))) shown = 30; route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);
  route();
})();
