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
   v0.15.0 (11 Nov 2026, cedwyn-catalogue#38): every result's first line is the record's own date, then a short label of at most 4 words
   (labelOf(): a fixed display mapping over kind, type and title; nothing written into records); the old "Records · kind · type" line is gone. — Sion's Tab agent
   v0.14.0 (11 Nov 2026, cedwyn-catalogue#37): no share buttons on search results (only on an open record or source page, under its preview);
   each result shows the record's own date, never the catalogue entry date, which moves to the record page ("Added to catalogue"). — Sion's Tab agent
   v0.12.0 (10 Nov 2026, cedwyn-catalogue#34): transcripts start collapsed ("Show transcript", <details>); email records show the institution's logo
   (self-hosted, logos/map.json) or a neutral email picture. — Tab agent
   v0.10.0 (10 Nov 2026): an Emails tab beside Web, Images and Videos — every email in the case correspondence is its own record (kind email, ids in the EV series from EV-0906),
   read from the central catalogue like every other record; inbox-style rows; record page adds an Email block. — Tab agent
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
  var KINDS = { email: 'Email', evidence: 'Evidence', artifact: 'Artifact', missing_record: 'Missing record', person: 'Person', catalogue_candidate: 'Candidate', media: 'Media item' };
  var app = document.getElementById('app');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var IDRE = /\b(EV|MR|MED|AR|PE|CC|EM)-\d{3,4}\b/g;
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

  /* ---- v0.10.0 (10 Nov 2026): email records (kind email, ids in the EV series from EV-0906), one catalogue record per message (core schema 0.4.0).
     The central catalogue serves them through the REST API once loaded; until the API has kind=email rows, they are read from the
     catalogue's own record files (unclehowell/cedwyn data/core/records/emails/: index.json + emails-NN.json). Same row shape either way. */
  var EMAILS = 'https://raw.githubusercontent.com/unclehowell/cedwyn/' + (/^\/catalogue-preview\//.test(location.pathname) || P.get('emails') === 'staged' ? 'catalogue-emails-v0.4.0' : 'main') + '/data/core/records/emails/';
  var emIndexP = null, emPartP = {};
  function emIndex() { return emIndexP || (emIndexP = getJSON(EMAILS + 'index.json').catch(function () { return { records: [] }; })); }
  function emRowFromIndex(x) {                               // [id, datetime, s|r, institutions[], from, subject, thread, transcript_public, part, attachments]
    var sent = x[2] === 's', who = (x[3] || []).join(', ') || 'an unlisted correspondent', d = String(x[1] || '').slice(0, 10);
    return { id: x[0], kind: 'email', alias: null, title: (sent ? 'Email to ' : 'Email from ') + who + (d ? ' (' + emDate(d) + ')' : ''), date_display: d ? emDate(d) : '', date_sort: d,
      status: x[13] ? 'headers only (subject-access correspondence)' : x[7] ? 'transcript public' + (x[12] ? ' (' + x[12] + ' passage' + (x[12] === 1 ? '' : 's') + ' redacted)' : '') : 'not yet transcribed', holder: 'Cedwyn email archive', body: null,
      summary: 'Subject: ' + (x[5] || '(no subject)'), page: null,
      data: { type: 'Email', label: 'EMAIL', email: { direction: sent ? 'sent' : 'received', datetime: x[1], institutions: (x[3] || []).map(function (n) { return { name: n }; }), from: x[4] || '', subject: x[5], thread_id: x[6], transcript_public: !!x[7], headers_only: !!x[13], attachments: x[9] || 0 }, part: x[8] }, updated: null, rev: 1 };
  }
  function emRowFromRecord(r) {                              // core record -> the catalogue row shape the API serves (body = public transcript)
    var e = r.email || {};
    return { id: r.id, kind: 'email', alias: (r.aliases || [])[0] || null, title: r.title, date_display: (r.date || {}).display, date_sort: (r.date || {}).sort,
      status: r.transcript_status, holder: (r.provenance || {}).holder, body: r.transcript || null, summary: r.description, page: null,
      data: { type: 'Email', label: 'EMAIL', reference: (r.provenance || {}).reference, email: e, sources: r.sources || [] }, updated: r.updated, rev: r.rev };
  }
  var MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  /* v0.10.1 (10 Nov 2026): redaction. Removed passages arrive from the build as black blocks (U+2588); the originals are never published.
     Each block is drawn as a black box; hovering, tapping or focusing it shows the label with the request link. */
  var RDX_LABEL = 'Redacted. The uncensored original costs £9.99.';
  function rdx(html, id) {
    var rid = id || P.get('id') || '';
    return String(html).replace(/\u2588+/g, function () {
      return '<span class="rdx" tabindex="0" role="button" aria-label="' + RDX_LABEL + '"><span class="rdl" role="tooltip">' + RDX_LABEL +
        ' <a href="/catalogue/request-original/?id=' + encodeURIComponent(rid) + '">Request the original</a></span></span>';
    });
  }
  function rdxPlain(html) { return String(html).replace(/\u2588+/g, '<span class="rdx rdx-s" title="' + RDX_LABEL + ' Open the record to request it."></span>'); }
  function emDate(d) { var p = String(d).split('-'); return p.length === 3 ? (+p[2]) + ' ' + MON[+p[1] - 1] + ' ' + p[0] : d; }
  function emGet(id) {
    return emIndex().then(function (ix) {
      var x = (ix.records || []).filter(function (y) { return y[0] === id; })[0]; if (!x) return null;
      var n = ('0' + x[8]).slice(-2);
      return (emPartP[n] || (emPartP[n] = getJSON(EMAILS + 'emails-' + n + '.json'))).then(function (sh) {
        var r = (sh.records || []).filter(function (y) { return y.id === id; })[0]; return r ? { item: emRowFromRecord(r), links: [] } : null;
      });
    });
  }
  (function () {
    var L = Sources.rest.list, G = Sources.rest.get;
    Sources.rest.list = function () {
      return L.apply(this, arguments).then(function (items) {
        if (items.some(function (r) { return r.kind === 'email'; })) return items;
        return emIndex().then(function (ix) { return items.concat((ix.records || []).map(emRowFromIndex)); });
      });
    };
    Sources.rest.get = function (id) {
      if (!/^EV-\d+$/.test(id) || +id.slice(3) < 906) return G.apply(this, arguments);   // emails are EV-0906 onwards (one numbering format, owner 10 Nov 2026)
      var self = this, args = arguments;
      return emGet(id).then(function (d) { return d || G.apply(self, args); }, function () { return G.apply(self, args); })   // v0.10.2: the record file carries the transcript; the API row is metadata only
        .then(function (d) { if (!d) throw new Error('not found'); return d; });
    };
  })();
  (function () {                                             // email row and record styles
    var s = document.createElement('style');
    s.textContent = '.mres{border-top:1px solid rgba(127,127,127,.25)}.mr{display:grid;grid-template-columns:4.6rem minmax(0,1fr);gap:.2rem .7rem;padding:.7rem 0;border-bottom:1px solid rgba(127,127,127,.25)}' +
      '.mr .md{font-size:.78rem;opacity:.75;line-height:1.3}.mr .mdir{display:block;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}.mr .mw{font-size:.82rem;opacity:.8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
      '.mr .ms{display:block;font-weight:500;overflow-wrap:anywhere}.mr .mid{font-size:.75rem;opacity:.7}.mhead{margin:0 0 1rem}.mhead dt{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;opacity:.7;margin-top:.5rem}.mhead dd{margin:0;overflow-wrap:anywhere}' +
      '.rdx{display:inline-block;position:relative;background:#000;color:#000;min-width:3.2em;height:1.05em;vertical-align:-.15em;border-radius:2px;cursor:pointer;margin:0 .1em}' +
      '.rdx:focus{outline:2px solid #d9a441}.rdx .rdl{display:none;position:absolute;left:0;top:1.4em;z-index:20;width:15rem;max-width:80vw;padding:.55rem .7rem;background:#fff8e6;color:#1d1d24;border:1px solid #d9a441;border-radius:6px;font-size:.85rem;line-height:1.35;box-shadow:0 2px 10px rgba(0,0,0,.2);white-space:normal}' +
      '.rdx:hover .rdl,.rdx:focus .rdl,.rdx:focus-within .rdl{display:block}.rdx .rdl a{color:#7a3b12;font-weight:600}.rdx-s{min-width:2.4em}';
    document.head.appendChild(s);
  })();
  /* v0.12.0 (10 Nov 2026, cedwyn-catalogue#34): a transcript is always collapsed on load, opened by its own "Show transcript" control
     (<details>/<summary>: works without script). Email records show the logo of the institution on the other side of the exchange,
     worked out from its mail domain and self-hosted in logos/ (logos/map.json: record -> logo); personal mail domains, private
     individuals and unlisted correspondents keep the neutral email picture logos/email.png. Display only: no record is changed. */
  function trx(inner) {
    return '<details class="trx"><summary><span class="trs">Show transcript</span><span class="trh">Hide transcript</span></summary>' + inner + '</details>';
  }
  var LG = { rec: {}, logos: {} }, LGBASE = 'logos/';
  var logosP = getJSON(LGBASE + 'map.json?v=' + Math.floor(Date.now() / 300000)).then(function (d) { LG = d || LG; LG.rec = LG.rec || {}; LG.logos = LG.logos || {}; return LG; }).catch(function () { return LG; });
  function logoOf(id) { var k = LG.rec[id]; return k && LG.logos[k] ? { src: LGBASE + k + '.png', n: LG.logos[k] } : { src: LGBASE + 'email.png', n: '' }; }
  function logoImg(id, cls) { var o = logoOf(id); return '<img class="lgimg' + (cls ? ' ' + cls : '') + '" src="' + esc(o.src) + '" alt="' + esc(o.n ? 'Logo: ' + o.n : 'Email') + '" loading="lazy" decoding="async" width="64" height="64">'; }
  (function () {
    var s = document.createElement('style');
    s.textContent = 'details.trx{margin:.3rem 0 1rem;border:1px solid rgba(127,127,127,.35);border-radius:8px;padding:0 .8rem}details.trx>summary{cursor:pointer;padding:.65rem 0;font-weight:600;list-style:none;color:var(--acc,#7a3b12)}' +
      'details.trx>summary::-webkit-details-marker{display:none}details.trx>summary::before{content:"\\25B8";display:inline-block;margin-right:.45rem;transition:transform .15s}details.trx[open]>summary::before{transform:rotate(90deg)}' +
      'details.trx .trh,details.trx[open] .trs{display:none}details.trx[open] .trh{display:inline}details.trx>summary:focus-visible{outline:2px solid #d9a441;outline-offset:2px}' +
      '.th img.lgimg{object-fit:contain;background:#fff;padding:10%;box-sizing:border-box}.mr{grid-template-columns:2.6rem 4.6rem minmax(0,1fr)}.mr .mlg{width:2.6rem;height:2.6rem;border-radius:6px;overflow:hidden;border:1px solid rgba(127,127,127,.25);background:#fff}' +
      '.mr .mlg img{width:100%;height:100%;object-fit:contain;display:block;padding:8%;box-sizing:border-box}.mfig{display:flex;align-items:center;gap:.7rem;margin:0 0 .8rem}.mfig img{width:64px;height:64px;object-fit:contain;background:#fff;border:1px solid rgba(127,127,127,.3);border-radius:10px;padding:6px;box-sizing:border-box}.mfig figcaption{font-size:.85rem;opacity:.8}';
    document.head.appendChild(s);
  })();
  function emailRow(it) {
    var e = (it.r && it.r.data && it.r.data.email) || {}, sent = e.direction === 'sent', who = (e.institutions || []).map(function (x) { return x.name; }).join(', ') || 'Unlisted correspondent';
    return '<article class="mr"><a class="mlg" href="?id=' + esc(it.id) + '" tabindex="-1" aria-hidden="true">' + logoImg(it.id) + '</a><div class="md">' + esc(it.r.date_display || '') + '<span class="mdir">' + (sent ? '→ sent' : '← received') + '</span></div><div>' +
      '<div class="mw">' + esc((sent ? 'To ' : 'From ') + who) + (e.from && !sent ? ' · ' + rdxPlain(esc(e.from)) : '') + '</div>' +
      '<a class="ms" href="?id=' + esc(it.id) + '">' + rdxPlain(esc(e.subject || '(no subject)')) + '</a>' +
      '<span class="mid">' + esc(it.id) + (e.attachments ? ' · ' + e.attachments + ' attachment' + (e.attachments === 1 ? '' : 's') : '') + (e.transcript_public ? '' : e.headers_only ? ' · headers only' : ' · not yet transcribed') + '</span></div></article>';
  }
  function emailBlock(r) {
    var e = (r.data || {}).email || {}, sent = e.direction === 'sent', who = (e.institutions || []).map(function (x) { return x.name; }).join(', ');
    var src = ((r.data || {}).sources || [])[0];
    var lo = logoOf(r.id);
    return '<h2>Email</h2><figure class="mfig">' + logoImg(r.id) + '<figcaption>' + (lo.n ? esc(lo.n) + ' (logo from its own website, matched by the mail domain)' : 'No institution logo: personal, private or unlisted mail') + '</figcaption></figure><dl class="mhead"><dt>' + (sent ? 'Sent to' : 'Received from') + '</dt><dd>' + esc(who || 'an unlisted correspondent') + (e.from && !sent ? ' (' + rdx(esc(e.from), r.id) + ')' : '') + '</dd>' +
      '<dt>Date and time (UTC)</dt><dd>' + esc(String(e.datetime || '').replace('T', ' ').replace('Z', '')) + '</dd><dt>Subject line</dt><dd>' + rdx(esc(e.subject || '(no subject)'), r.id) + '</dd>' +
      (e.attachments ? '<dt>Attachments</dt><dd>' + e.attachments + '</dd>' : '') + '<dt>Transcript</dt><dd>' + esc(r.status || '') + '</dd>' +
      (e.headers_only ? '<dt>Original</dt><dd><a href="/catalogue/request-original/?id=' + encodeURIComponent(r.id) + '">Request the uncensored original (£9.99)</a></dd>' : '') +
      (src && src.href ? '<dt>Archive copy</dt><dd><a href="' + esc(src.href) + '" rel="noopener">' + esc(src.href.split('/').pop()) + '</a></dd>' : '') + '</dl>';
  }
  var SRC = Sources[CONFIG.source] || Sources.rest;
  var pagesP = getJSON(CONFIG.pages + '?v=' + Math.floor(Date.now() / 300000)).catch(function () { return {}; });

  /* ---- search (v0.5.0): Google-style home, tabs, galleries, real thumbnails ---- */
  var all = null, shown = 30;
  var TABS = [['all', 'All'], ['web', 'Web'], ['images', 'Images'], ['videos', 'Videos'], ['pdf', 'PDF'], ['news', 'News'], ['emails', 'Emails'], ['books', 'Books'], ['blog', 'Blog']];
  var PIN = { all: 1, web: 1, images: 1, videos: 1, pdf: 1 };   // v0.13.0: always on the row; the tabs after them fold into "More" as width runs out
  var IMGRE = /image|photo|map|plan\b|drawing|aerial|postcard|sketch|png|jpe?g/i, BOOKRE = /book|trade directory|library item/i, WEBRE = /web page|press|website|newspaper/i, PDFRE = /\bpdf\b/i;
  var VQ = '?v=0.9.0-' + Math.floor(Date.now() / 300000);
  var extraP = Promise.all([getJSON('sources.json' + VQ).catch(function () { return { items: [], cat: {}, recon: [] }; }),
    getJSON('sources-books.json' + VQ).catch(function () { return { items: [] }; })]).then(function (a) { a[0].items = (a[0].items || []).concat(a[1].items || []); return a[0]; });
  /* thumbnails: a small index (key -> shard, source type, original URL, video duration) and shards of WebP data URIs, fetched only when shown */
  var TI = {}, RC = [], shardP = {};
  var thumbsP = Promise.all([getJSON('thumbs/index.json' + VQ).catch(function () { return {}; }), getJSON('thumbs/rec-index.json' + VQ).catch(function () { return {}; })]).then(function (a) {
    var d = a[0] || {}; TI = d.items || {}; RC = d.recon || [];
    var R = (a[1] || {}).items || {};                         // v0.11.0: each record's own preview, cut from its file
    Object.keys(R).forEach(function (id) { var o = TI[id] || {}, x = R[id]; TI[id] = { k: x.k || o.k, u: x.u || o.u, s: x.s, c: x.how }; });
    return TI;
  });
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
  // v0.14.0 (11 Nov 2026, cedwyn-catalogue#37): a result shows the RECORD's own date (date_display, else date_sort), never the date the
  // entry was added to the catalogue (updated); a record stated as undated / date not recorded shows no date. — Sion's Tab agent
  var MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function recDate(r) {
    if (!r) return '';
    var s = String(r.date_display || '').split(/[;(]/)[0].trim();
    if (s.length > 48) s = s.slice(0, 48).replace(/\s+\S*$/, '') + '\u2026';
    if (s) return /undated|not recorded|unknown|not known|not shown|not stated|not given|not yet found|no date/i.test(s) && !/\d{3,4}/.test(s) ? '' : s;
    var m = /^(\d{4})(?:-(\d{2}))?/.exec(String(r.date_sort || ''));
    if (!m || m[1] === '0000') return '';
    return (m[2] && +m[2] >= 1 && +m[2] <= 12 ? MON3[+m[2] - 1] + ' ' : '') + m[1];
  }
  function resDate(it) { if (it.r) return recDate(it.r) || (it.mail ? String(it.dt || '').slice(0, 10) : ''); return it.dt ? String(it.dt).slice(0, 10) : ''; }
  function addedOn(s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? (+m[3]) + ' ' + MON3[+m[2] - 1] + ' ' + m[1] : String(s || '').slice(0, 10); }

  // v0.15.0 (11 Nov 2026, cedwyn-catalogue#38): each result's first line is the record's own date, then a short plain label (at most 4 words) of what the
  // item is, worked out here from the record's kind, type and title by the fixed rules below. Display only: no label is written into
  // any record. No rule matches -> no label (never the old "Records · kind · type" line). — Sion's Tab agent
  var LBT = [                                                 // [label, test on the record's type]
    ['Court record', /court record|chancery|pleading/], ['Court judgment', /judgment|law-report|law report/], ['Legal commentary', /legal commentary/],
    ['Statutory instrument', /statutory instrument/], ['Act of Parliament', /\bstatute/], ['Parliamentary notice', /parliamentary/],
    ['Gazette notice', /gazette|official journal/], ['Fee schedule', /fee schedule|price list/], ['FOI review response', /internal review/],
    ['FOI response letter', /foi response letter/], ['SAR response', /\bsar response/], ['FOI reply', /foi reply|foi response|email\/foi/],
    ['Procedure leaflet', /procedure leaflet/], ['Finding aid', /finding aid/], ['Spreadsheet', /spreadsheet|\bxlsx?\b/],
    ['Council minutes', /minutes/], ['Map extract', /map extract|map screenshot/], ['Map or plan', /map\/plan|\bplan\b/], ['Map', /\bmaps?\b/],
    ['Released document', /released document/], ['Tenancy agreement', /tenancy|lease/], ['Deed', /\bdeeds?\b/],
    ['Land Registry record', /land registry/], ['Company register entry', /company register/], ['Planning record', /planning/],
    ['Monument record', /monument record/], ['Survey report', /survey/], ['Analysis chart', /analysis chart/], ['Analysis table', /analysis table/],
    ['Family account', /oral|family account/], ['Trade directory', /directory/], ['Printed charters', /charters/], ['Book extract', /\bbook\b/],
    ['Newspaper extract', /snippet/], ['Newspaper reports', /newspaper reports|press reports/], ['Newspaper report', /newspaper|\bpress\b/],
    ['Journal article', /journal/], ['Blog post', /\bblog/], ['Video', /youtube|\bvideo/], ['Social media post', /\bsocial\b/],
    ['Tithe record', /tithe/], ['Manorial record', /manorial/], ['Company record', /compan(y|ies)/], ['Heritage record', /heritage|listing record|listed building|designation/],
    ['Act of Parliament', /legislation|\bact\b/], ['Magazine article', /periodical|article/], ['Research note', /research|\bnote\b/],
    ['Sale particulars', /sale catalogue|auction|particulars/], ['Conveyance', /conveyance|contract for sale|covenant|title/], ['Petition', /petition/],
    ['Consultation paper', /consultation/], ['Printed records', /edited record|record volume/], ['Government file', /government|council papers/],
    ['Archive file', /archive (series|item|piece|file)|archive files|series listing/], ['Letting record', /letting/], ['Web page', /web page/],
    ['Order form', /order form|request form/], ['Charity register entry', /charity register/], ['Research thesis', /thesis/],
    ['Database record', /database/], ['Data extract', /change log|\bcsv\b/], ['Family statement', /statement/], ['Official report', /official report/],
    ['Historical source', /early source|early county|printed secondary|secondary account/], ['Reference list', /secondary reference/],
    ['Archive catalogue entry', /catalogue/], ['Image', /\bimage\b|\bjpe?g\b|\bpng\b/],
    ['Photograph', /\bphoto/], ['Letter', /\bletter\b/], ['Official record', /official record/], ['Email', /\bemail\b/], ['Document', /\bpdf\b|\bodt\b|\bdocument\b/]
  ];
  var LBX = [                                                 // [label, test on the title], for catalogue entries, correspondence and untyped records
    ['Witness statement', /^witness statement/], ['FOI request', /^whatdotheyknow/], ['Probate entry', /\bprobate\b/], ['Census entry', /\bcensus\b/],
    ['Monument record', /coflein|\bher \d|historic environment record|national monuments record/], ['Museum object', /museum|amgueddfa/],
    ['Community archive item', /people's collection/], ['Social media post', /facebook|instagram|twitter|tiktok/], ['House price data', /zoopla|price-paid|sold house/],
    ['Textbook extract', /textbook/], ['Sales brochure', /brochure/], ['Fee schedule', /fee schedule|price list/], ['Diary', /\bdiary\b/],
    ['SAR correspondence', /\bsar\b|subject access/], ['FOI correspondence', /\bfoi\b|\beir\b|freedom of information|environmental information/],
    ['Complaint correspondence', /complain/], ['Newspaper extract', /snippet/],
    ['Newspaper report', /\becho\b|\btimes\b|\bherald\b|\bstar\b|\bnews\b|\bpost,|\bmail,|\bgazette\b|\bpress cutting|newspaper|\bweekly\b/],
    ['Encyclopedia article', /wikipedia|wikishire/], ['Photograph', /wikimedia commons|\.jpe?g\b/], ['Heritage listing', /listed buildings/],
    ['Council web page', /community council/], ['Order form', /order form/], ['Building specification', /finishes schedule|specification/],
    ['Membership card', /membership card/], ['Boundary record', /boundary record/], ['Estate record', /estate records/], ['Textbook extract', /university press/],
    ['Image', /archive image/],
    ['Title abstract', /abstract of title/], ['Estate accounts', /receipts and payments|\baccounts\b|rental/], ['Agreement', /\bagreement\b/],
    ['Archaeology report', /archaeolog|excavation/], ['Video footage', /footage/], ['Title papers', /title papers|title deeds/], ['Place-name notes', /place-name/],
    ['Map', /\bmaps?\b|\bplan of\b/], ['Photograph', /\bphoto/], ['Report', /\breport\b/], ['Book extract', /\bbook\b|printed page/],
    ['Scanned document', /scanned|\bpdf\b/], ['Letter', /\bletter\b/]
  ];
  var LBR = [['Painted reconstruction', /painted reconstruction/], ['Colourised photograph', /colouri[sz]ed/], ['Artist reconstruction', /reconstruction|pencil sketch|drawing/], ['Photograph', /photograph/]],
      LBA = LBX.filter(function (x) { return /^(Monument record|Museum object|Community archive item)$/.test(x[0]); }),
      LBC = LBX.filter(function (x) { return /^(SAR|FOI|Complaint) correspondence$/.test(x[0]); });
  function pick(tab, s) { for (var i = 0; i < tab.length; i++) if (tab[i][1].test(s)) return tab[i][0]; return ''; }
  function labelOf(r) {
    if (!r) return '';
    var t = String((r.data || {}).type || '').toLowerCase(), ti = String(r.title || '').toLowerCase();
    if (r.kind === 'email') return /^email from/.test(ti) ? 'Email received' : /^email to/.test(ti) ? 'Email sent' : 'Email';
    if (r.kind === 'person') return 'Person';
    if (r.kind === 'missing_record') return 'Record not yet found';
    if (/archive.?catalogue|catalogue entr|estate record/.test(t)) return pick(LBA, ti) || 'Archive catalogue entry';
    if (r.kind === 'artifact') { var ar = pick(LBR, ti); if (ar) return ar; }
    if (/correspondence/.test(t)) return pick(LBC, ti) || 'Correspondence';
    var a = t && !/^(other|none)$/.test(t) ? pick(LBT, t) : '';
    if (a === 'Document' || a === 'Email' || !a) a = pick(LBX, ti) || a;
    if (!a && r.kind === 'artifact') a = 'Image';
    return a;
  }
  function leadLine(date, label) { return (date ? '<b class="rd">' + esc(date) + '</b>' : '') + (date && label ? ' · ' : '') + (label ? esc(label) : ''); }
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
      '<g font-family="system-ui,sans-serif">' +
      '<rect x="0" y="228" width="320" height="12" fill="#1f1f1f" opacity=".88"/><text x="160" y="237" font-size="7.6" fill="#fff" text-anchor="middle">' + esc(SKLABF) + '</text></g></svg>';
  }
  function sketchOf(r) { return isFootage(r) ? filmSketch(r) : docSketch(r); }
  function isPrivate(r) { var d = r.data || {}; return /privately|subject[- ]access|personal data|personal material|\bSAR\b/i.test([r.status, d.label, r.holder, d.type, r.title].join(' ').replace(/FOI\/EIR\/SAR/g, 'FOI')); }
  function recTab(r, x) {                                   // the mapping file first, then the same rules for records added since
    var t = String((r.data || {}).type || ''), ti = TI[r.id] || {};
    if (r.kind === 'email') return 'emails';
    if (isFootage(r)) return 'videos';
    if (isNews(r)) return 'news';                            // v0.11.0: press, newspaper reports, clippings and scans of them
    if (isBlog(r)) return 'blog';                            // v0.11.0: external blogs about the case (our own are not listed)
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
    var it = { tab: recTab(r, x), id: r.id, rt: r.title, t: r.id + ': ' + r.title, u: '?id=' + r.id, lb: labelOf(r),
      d: r.summary || r.status || '', dt: r.updated || '', ic: r.kind, ty: d.type || KINDS[r.kind] || r.kind, priv: priv,
      h: [r.id, r.alias, r.title, r.holder, r.summary, r.status, r.date_display, d.type, d.label, d.their_ref, d.reference].concat(d.email ? [d.email.subject, d.email.from, (d.email.institutions || []).map(function (x) { return x.name; }).join(' ')] : []).join(' ').toLowerCase(), ds: r.date_sort || '', r: r, foot: isFootage(r) };
    if (r.kind === 'email') { it.dt = (d.email && d.email.datetime) || r.date_sort || ''; it.mail = 1; it.img = logoOf(r.id).src; it.lg = 1; return it; }
    if (!priv && ti.s != null) it.tk = r.id;
    else if (!priv && hasRecon(r.id, x)) { it.img = 'recon/' + r.id + '.webp'; it.sk = 1; }
    return it;
  }
  function bookImg(u) { var m = /archive\.org\/details\/([^\/\s?#]+)/.exec(u || ''); return m ? 'https://archive.org/services/img/' + m[1] : null; }
  var SRCK = {};                                             // v0.9.0: every archived-copy entry by key, including those a record describes
  function build(recs, x) {
    var out = recs.filter(function (r) { return !isOwnSite(r); }).map(function (r) { return fromRecord(r, x); }), byId = {}, REC = x.rec || {};
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
      if (ownSource(u)) return;                              // v0.11.0: our own websites, webapps and blog posts are not evidence
      if (it.tab === 'web' && NEWSU.test(u)) it.tab = 'news';
      if (ti) { if (ti.s != null) it.tk = k; if (ti.d) it.dur = ti.d; }
      if (!it.img && !it.tk && (it.tab === 'books' || it.ic === 'book')) it.img = bookImg(u);
      it.ou = u.split(' (')[0]; it.key = k; it.unc = 1; it.u = '?src=' + k;
      it.ty = it.tab === 'pdf' ? 'PDF' : it.tab === 'books' ? 'Book' : it.tab === 'blog' ? 'Blog post' : 'Web page';
      it.s = 'Uncatalogued source · ' + (it.s || host(it.ou));
      it.lb = it.tab === 'news' ? 'News page' : it.ty === 'PDF' ? 'PDF document' : it.ty;   // v0.15.0: short label shown on results
      it.h = [it.t, it.d, it.s, it.k].join(' ').toLowerCase(); it.ds = it.dt || ''; out.push(it);
    });
    out.forEach(function (it) { if (it.tab === 'blog' && it.r) { var bu = (it.r.data || {}).url; it.arc = bu ? (copyOf(bu) || 0) : null; } });
    out.forEach(function (it) { if (it.srcs) it.d = 'Source file: ' + it.srcs.map(function (s) { return s.t; }).join(' · ') + (it.d ? ' — ' + it.d : ''); });
    return out;
  }
  function card(it) {                                        // typed placeholder: never an empty box
    return '<span class="pc"><span class="pct">' + esc(String(it.priv ? 'Held privately' : it.ty || '').slice(0, 40)) + '</span>' + (it.id ? '<span class="pcid">' + esc(it.id) + '</span>' : '') + '</span>';
  }
  function pic(it, cls) {
    var c = card(it).replace(/"/g, '&quot;');
    if (it.tk) return '<span class="th ' + cls + '"><img data-tk="' + esc(it.tk) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="" decoding="async">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
    if (it.img) return '<span class="th ' + cls + '"><img' + (it.sk ? ' class="skimg"' : it.lg ? ' class="lgimg"' : '') + ' src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" onerror="this.outerHTML=\'' + c + '\'">' + (it.sk ? '<b class="bdg">sketch</b>' : '') + '</span>';
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
      if (it.id && it.id.toLowerCase() === qq) sc += 50; if (qq && tt.indexOf(qq) >= 0) sc += 5; if (it.id) sc += 1; if (it.tk || it.img) sc += 0.5; if (it.mail) sc -= 2;   // emails rank below other records in All
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
    var q = (P.get('q') || '').trim(), tab = P.get('tab') || 'all', sort = P.get('sort') || (tab === 'emails' && !q ? 'date-desc' : 'rel');
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
      if ((b.tk || b.img && !b.lg ? 1 : 0) !== (a.tk || a.img && !a.lg ? 1 : 0)) return (b.tk || b.img && !b.lg ? 1 : 0) - (a.tk || a.img && !a.lg ? 1 : 0);
      if (a.id && b.id) return a.id.localeCompare(b.id, 'en', { numeric: true });
      return a.id ? -1 : b.id ? 1 : 0;
    });
    var h = '<div class="sx"><div class="sbar"><a class="logo" href="./" aria-label="' + T('home') + '">' + LOGOH() + '</a>';
    h += '<form class="sbox" role="search" id="sf"><span class="mag" aria-hidden="true">⌕</span><input type="search" id="q" placeholder="Search the records" value="' + esc(q) + '" aria-label="Search" autocomplete="off" enterkeyhint="search"><button type="submit" class="sbtn" aria-label="Search">Search</button></form></div>';
    h += '<nav class="tabs" id="tabs" aria-label="Result type">' + TABS.map(function (t) {
      var on = t[0] === tab, href = '?' + qs({ tab: t[0] === 'all' ? '' : t[0] });
      return '<a href="' + esc(href) + '"' + (PIN[t[0]] ? '' : ' data-tm="1"') + (on ? ' aria-current="page" class="on"' : '') + '>' + t[1] + '</a>';
    }).join('') + '<div class="tmore" hidden><button type="button" id="tabmore" aria-haspopup="true" aria-expanded="false" aria-controls="tabmenu">More</button>' +
      '<div class="tmenu" id="tabmenu" role="menu" aria-label="More result types" hidden></div></div></nav>';
    h += '<div class="meta"><span>About ' + rows.length + ' result' + (rows.length === 1 ? '' : 's') + (q ? ' for <b>' + esc(q) + '</b>' : '') + '</span><select id="sort" aria-label="Sort"><option value="rel">Sort: relevance</option><option value="id">Sort: record number</option><option value="new">Sort: recently added</option><option value="date">Sort: date (oldest)</option><option value="date-desc">Sort: date (newest)</option></select></div></div>';
    if (!rows.length) h += '<p class="none">No results' + (q ? ' for <b>' + esc(q) + '</b>' : '') + (tab !== 'all' ? ' in ' + TABS.filter(function (t) { return t[0] === tab; })[0][1] + '. Try <a href="?' + esc(qs({ tab: '' })) + '">All</a>.' : '.') + '</p>';
    var page = rows.slice(0, shown);
    function lead(it) { var l = leadLine(resDate(it), it.lb); return l ? '<span class="gd">' + l + '</span>' : ''; }
    function recLink(it) { return it.id ? '<a class="rl" href="?id=' + esc(it.id) + '">' + esc(it.id) + ' · record</a>' : (it.u ? '<a class="rl" href="' + esc(it.u) + '" rel="noopener">' + esc(host(it.u)) + '</a>' : ''); }
    if (tab === 'images') {
      h += '<div class="gal">' + page.map(function (it) { return '<figure class="gi"><a href="' + esc(it.u || '#') + '"' + ext(it) + '>' + pic(it, 'gim') + '</a><figcaption>' + lead(it) + '<span class="gt">' + esc(it.rt || it.t) + '</span>' + recLink(it) + '</figcaption></figure>'; }).join('') + '</div>';
    } else if (tab === 'videos') {
      var vcard = function (it) {                            // catalogued footage only; no footage file is held here yet, so each shows its sketch frame
        return '<article class="vi"><a class="vth" href="?id=' + esc(it.id) + '" aria-label="' + esc(it.rt) + '"><span class="th vim vff">' + filmSketch(it.r) + '</span></a>' +
          '<div class="vtx">' + lead(it) + '<a class="vt" href="?id=' + esc(it.id) + '">' + esc(it.rt) + '</a>' + recLink(it) + '</div></article>';
      };
      h += '<div class="vgal">' + page.map(vcard).join('') + '</div>';
      if (q) {
        var seen = {}; rows.forEach(function (it) { seen[it.id] = 1; });
        var other = all.filter(function (it) { return it.tab === 'videos' && it.r && !seen[it.id]; });
        if (other.length) h += '<h3 class="vo">Other catalogued footage</h3><div class="vgal">' + other.map(vcard).join('') + '</div>';
      }
    } else if (tab === 'emails') {
      h += '<div class="mres">' + page.map(emailRow).join('') + '</div>';
    } else if (tab === 'pdf') {
      h += '<div class="pgal">' + page.map(function (it) {
        return '<figure class="pi"><a href="' + esc(it.u || '#') + '"' + ext(it) + '>' + pic(it, 'pim') + '<b class="pdfb">PDF</b></a><figcaption>' + lead(it) + '<span class="gt">' + esc(it.rt || it.t) + '</span>' + recLink(it) + '</figcaption></figure>';
      }).join('') + '</div>';
    } else {
      h += '<div class="res">' + page.map(function (it) {
        var l1 = leadLine(resDate(it), it.lb);
        return '<article class="r"><div class="tx">' + (l1 ? '<div class="src">' + l1 + '</div>' : '') +
          (it.u ? '<a class="tt" href="' + esc(it.u) + '"' + ext(it) + '>' + esc(it.t) + '</a>' : '<span class="tt">' + esc(it.t) + '</span>') +
          (it.d ? '<p class="sn">' + esc(it.d) + '</p>' : '') + (it.arc ? '<a class="arcl" href="?src=' + esc(it.arc.key) + '">Read our archived copy</a>' : it.arc === 0 ? '<span class="arcl muted">Our archived copy: pending</span>' : '') + '</div>' + (it.u ? '<a class="tl" href="' + esc(it.u) + '"' + ext(it) + ' tabindex="-1" aria-hidden="true">' + pic(it, 'lim') + '</a>' : pic(it, 'lim')) + '</article>';
      }).join('') + '</div>';
    }
    if (rows.length > shown) h += '<button class="more" id="more">More results (' + (rows.length - shown) + ')</button>';
    app.innerHTML = h; hydrate(app); tabsFit();
    document.getElementById('sort').value = sort;
    var qi = document.getElementById('q');
    document.getElementById('sf').addEventListener('submit', function (e) { e.preventDefault(); setParam('q', qi.value.trim()); });
    document.getElementById('sort').addEventListener('change', function (e) { setParam('sort', e.target.value === 'rel' ? '' : e.target.value); });
    var m = document.getElementById('more'); if (m) m.addEventListener('click', function () { shown += 60; renderList(); });
  }
  /* ---- v0.13.0 (11 Nov 2026, cedwyn-catalogue#36): the result tabs never scroll sideways. All, Web, Images, Videos and PDF always show;
     the tabs after them show while they fit on the row and the rest go into a "More" menu, always the last item on the right (priority+,
     measured with ResizeObserver). Choosing a menu item is the same link as the tab. — Sion's Tab agent */
  var tabCur = null;
  function tabsFit() {
    if (tabCur) { tabCur.stop(); tabCur = null; }
    var nav = document.getElementById('tabs'); if (!nav) return;
    var wrap = nav.querySelector('.tmore'), btn = document.getElementById('tabmore'), menu = document.getElementById('tabmenu');
    var mov = [].slice.call(nav.querySelectorAll('a[data-tm]')), lastW = -1, ro = null;
    function items() { return [].slice.call(menu.querySelectorAll('a')); }
    function label() {
      var on = menu.querySelector('a.on');
      btn.innerHTML = (on ? 'More: ' + esc(on.textContent) : 'More') + ' <span class="car" aria-hidden="true">\u25BE</span>';
      btn.className = on ? 'on' : '';
    }
    function over() {
      var kids = [].slice.call(nav.children).filter(function (k) { return !k.hidden; }), last = kids[kids.length - 1];
      return nav.scrollWidth > nav.clientWidth + 1 || (!!last && last.getBoundingClientRect().right > nav.getBoundingClientRect().right + 1);
    }
    function open(first) {
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (first) { var f = menu.querySelector('a.on') || items()[0]; if (f) f.focus(); }
    }
    function close(refocus) {
      if (menu.hidden) return; menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (refocus) btn.focus();
    }
    function flow() {
      var w = nav.clientWidth; if (w === lastW) return; lastW = w;
      close(false); nav.classList.remove('tight');
      mov.forEach(function (a) { a.removeAttribute('role'); a.removeAttribute('tabindex'); nav.insertBefore(a, wrap); });
      wrap.hidden = true; label();
      if (!over()) return;
      wrap.hidden = false;
      for (var i = mov.length - 1; i >= 0; i--) {
        var a = mov[i]; a.setAttribute('role', 'menuitem'); a.setAttribute('tabindex', '-1');
        menu.insertBefore(a, menu.firstChild); label();
        if (!over()) break;
      }
      if (over()) nav.classList.add('tight');
    }
    btn.addEventListener('click', function () { if (menu.hidden) open(false); else close(false); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); }
    });
    menu.addEventListener('keydown', function (e) {
      var l = items(), i = l.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); l[(i + 1) % l.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); l[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); l[l.length - 1].focus(); }
      else if (e.key === 'Tab') close(false);
    });
    function onResize() { flow(); }
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { flow(); }); ro.observe(nav); }
    else window.addEventListener('resize', onResize);
    flow();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (tabCur && tabCur.nav === nav) { lastW = -1; flow(); } });
    tabCur = { nav: nav, wrap: wrap, close: close, stop: function () { if (ro) ro.disconnect(); window.removeEventListener('resize', onResize); } };
  }
  document.addEventListener('click', function (e) { if (tabCur && !tabCur.wrap.contains(e.target)) tabCur.close(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && tabCur && document.getElementById('tabmenu') && !document.getElementById('tabmenu').hidden) { e.preventDefault(); tabCur.close(true); }
  });
  function ext(it) { return it.u && it.u.charAt(0) !== '?' ? ' rel="noopener"' : ''; }
  function qs(o) { var p = new URLSearchParams(P.toString()); p.delete('id'); Object.keys(o).forEach(function (k) { if (o[k]) p.set(k, o[k]); else p.delete(k); }); return p.toString(); }
  function setParam(k, v) {
    if (v) P.set(k, v); else P.delete(k); P.delete('id'); shown = 30;
    history.pushState(null, '', '?' + P.toString()); renderList();
  }


  /* ---- v0.11.0 (10 Nov 2026, cedwyn-catalogue#32): each record that holds a file shows a preview cut from that file (the picture on the page
     where there is one, else its first page; thumbs/rec-index.json + thumbs/trN.json, derived display images, never record data); pencil
     sketches only where the file is pending; the file opens from this site (file/<ID>); share buttons under every preview; a News tab;
     Blogs = external blogs about the case, each opening our archived copy; our own websites, webapps and blog posts are not evidence and are
     left out of the listing, search and counts (records are never edited, only not listed). — Sion's Tab agent */
  var OWNH = /(^|\.)bucklerfamily\.estate$|^greathousefarmwiki\.wordpress\.com$/i;
  function hostOf(u) { var m = /^[a-z]+:\/\/([^\/?#]+)/i.exec(String(u || '')); return m ? m[1].toLowerCase().replace(/^www\./, '') : ''; }
  function ownSource(u) { u = String(u || ''); var h = hostOf(u); return !!h && OWNH.test(h) && h !== 'wayback.bucklerfamily.estate' && !/\/wp-content\/uploads\//i.test(u) && !/\.pdf($|[?#])/i.test(u); }
  function isOwnSite(r) { var d = r.data || {}; return /\bblog\b|web ?page|website|web ?app/i.test(String(d.type || '')) && ownSource(d.url || ''); }
  var NEWST = /\b(press|newspapers?|news|clippings?|cuttings?)\b/i, NEWSX = /gazette|notice|catalogue|register|journal/i,
      NEWSTI = /\b(newspaper|Western Mail|South Wales (Daily )?(Echo|News)|Penarth (Times|Observer)|Barry (Dock News|Herald)|Cardiff Times|Evening (Post|Express)|Wales ?Online|BBC News|ITV (News|Wales)|press cutting|clipping|Glamorgan Gazette)\b/i,
      NEWSU = /newspapers\.library\.wales|\.nub\.news|walesonline\.co\.uk|bbc\.co\.uk\/news|penarthtimes|britishnewspaperarchive/i;
  function isNews(r) { var t = String((r.data || {}).type || ''); if (NEWST.test(t)) return true; if (NEWSX.test(t)) return false; return NEWSTI.test(String(r.title || '')); }
  function isBlog(r) { return /\bblog\b/i.test(String((r.data || {}).type || '')); }
  function fileHref(r) {                                    // the record's own file, served from this site; null while the file is pending
    var t = TI[r.id]; if (!t || !t.u || isPrivate(r)) return null;
    if (t.k === 'img' || t.k === 'pdf') return 'file/' + encodeURIComponent(r.id);
    var c = copyOf(t.u); if (c) return WB.byCopy[nurl(c.copy)] || !ours(t.u) ? '?src=' + c.key : c.copy;
    return hostOf(t.u) === 'greathousefarmwiki.wordpress.com' ? t.u : null;
  }
  var ICON = {
    ig: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.4" cy="6.6" r="1.3" fill="currentColor"/></svg>',
    fb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v6h4v-6h3l.6-4h-3.6V8.9c0-.6.3-.9.9-.9z" fill="currentColor"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h4.6l4.1 5.9L17.8 3H20l-6.3 7.3L21 21h-4.6l-4.5-6.4L6.3 21H4l6.9-7.9z" fill="currentColor"/></svg>',
    li: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="9" width="4" height="12" fill="currentColor"/><circle cx="5" cy="5" r="2.2" fill="currentColor"/><path d="M10 9h3.8v1.8c.6-1.1 2-2.1 4-2.1 3.3 0 4.2 2 4.2 5.2V21h-4v-6.2c0-1.5-.3-2.6-1.8-2.6-1.6 0-2.2 1.1-2.2 2.7V21h-4z" fill="currentColor"/></svg>',
    em: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 7l8 6 8-6" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
  };
  function shareBase() { return location.origin + location.pathname.replace(/[^\/]*$/, ''); }
  function shareRow(kind, id, title, big) {                  // under every preview: Instagram (share sheet, else copy link), Facebook, X, LinkedIn, email
    if (!id) return '';
    var u = shareBase() + '?' + (kind === 'src' ? 'src=' : 'id=') + encodeURIComponent(id), t = String(title || id), e = encodeURIComponent;
    var igl = navigator.share ? 'Instagram' : 'Copy link to share on Instagram';
    function a(href, k, lab) { return '<a class="shb" href="' + esc(href) + '"' + (k === 'em' ? '' : ' target="_blank" rel="noopener"') + ' aria-label="Share on ' + lab + '" title="' + lab + '">' + ICON[k] + (big ? '<span>' + lab + '</span>' : '') + '</a>'; }
    return '<div class="shr" role="group" aria-label="Share ' + esc(id) + '">' +
      '<button type="button" class="shb" data-share="ig" data-u="' + esc(u) + '" data-t="' + esc(t) + '" aria-label="' + igl + '" title="' + igl + '">' + ICON.ig + (big ? '<span>' + igl + '</span>' : '') + '</button>' +
      a('https://www.facebook.com/sharer/sharer.php?u=' + e(u), 'fb', 'Facebook') + a('https://x.com/intent/post?url=' + e(u) + '&text=' + e(t), 'x', 'X') +
      a('https://www.linkedin.com/sharing/share-offsite/?url=' + e(u), 'li', 'LinkedIn') + a('mailto:?subject=' + e(t) + '&body=' + e(t + '\n\n' + u), 'em', 'Email').replace('Share on Email', 'Share by email') + '</div>';
  }
  // v0.14.0 (cedwyn-catalogue#37): share buttons only on an open record (?id=) or source (?src=) page, under its preview; none on results
  function shr(it) { return it.id ? shareRow('id', it.id, it.t) : it.key ? shareRow('src', it.key, it.t) : ''; }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('button[data-share="ig"]'); if (!b) return;
    ev.preventDefault(); var u = b.getAttribute('data-u'), t = b.getAttribute('data-t');
    function done(msg) { var s = b.parentNode.querySelector('.shmsg') || document.createElement('span'); s.className = 'shmsg'; s.textContent = msg; b.parentNode.appendChild(s); setTimeout(function () { s.remove(); }, 4000); }
    if (navigator.share) { navigator.share({ title: t, url: u }).catch(function () {}); return; }
    var c = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(u) : Promise.reject();
    c.then(function () { done('Link copied. Paste it into your Instagram post or story.'); }, function () { window.prompt('Copy this link to share on Instagram', u); });
  });
  (function () {
    var s = document.createElement('style');
    s.textContent = '.shr{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0 2px;align-items:center}.shb{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-width:28px;height:28px;padding:0 6px;border:1px solid var(--line,#ccc);border-radius:999px;background:var(--card,#fff);color:var(--fg,#222);font:inherit;font-size:12px;line-height:1;text-decoration:none;cursor:pointer}' +
      '.shb svg{width:14px;height:14px;flex:none}.shb:hover{border-color:var(--acc,#7a3b12);color:var(--acc,#7a3b12)}.shmsg{font-size:12px;color:var(--mut,#666);flex-basis:100%}.fopen{font-weight:600}.fpend{font-size:14px;color:var(--mut,#666);margin:6px 0}.arcl{display:inline-block;font-size:13px;margin-top:2px}';
    document.head.appendChild(s);
  })();

  /* ---- record page (v0.7.0): UID and title -> preview -> description, transcript -> interpretation -> record details ---- */
  function previewFig(r, srcs) {                            // v0.11.0: the preview cut from the record's own file; tapping it opens the file
    if (isPrivate(r)) return '';
    var ti = TI[r.id], k = r.id, ou = ti && ti.u;
    if (!ti || ti.s == null) { ti = null; (srcs || []).some(function (s) { var t = TI[s.k]; if (t && t.s != null) { ti = t; k = s.k; ou = s.u; return true; } return false; }); }
    if (!ti) return '';
    var c = copyOf(ou), href = fileHref(r) || (c ? (ours(ou) && !WB.byCopy[nurl(ou)] ? c.copy : '?src=' + c.key) : '');
    var lab = ti.c === 'cropped-picture' ? 'Picture from the file' : ti.k === 'pdf' || /\.pdf/i.test(ou || '') ? 'First page' : ti.k === 'page' ? 'Picture from the record\'s page' : 'Preview';
    var img = '<img data-tk="' + esc(k) + '" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="Preview of ' + esc(r.title) + '">';
    return '<figure class="prev">' + (href ? '<a href="' + esc(href) + '">' + img + '</a>' : img) + '<figcaption>' + lab + ' · ' + (href ? '<a class="fopen" href="' + esc(href) + '">Open file</a>' : 'file pending') + '</figcaption></figure>';
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
    if (d.url && !seen[nurl(d.url)] && !isPrivate(r)) { seen[nurl(d.url)] = 1; locs.push(locLink(d.url)); }   // v0.11.0: a blog or web record opens our archived copy
    var hold = r.holder || d.repository, ref = [r.id + (r.alias ? ' (' + r.alias + ')' : ''), d.their_ref || d.reference ? 'holder\'s reference ' + (d.their_ref || d.reference) : ''].filter(Boolean).join(' · ');
    return '<table class="ghf-ev-table recmeta"><tbody>' + row('Date of the record', r.date_display || 'not recorded') +
      (r.updated ? '<tr><th>' + ((r.rev || 1) > 1 ? 'Catalogue entry updated' : 'Added to catalogue') + '</th><td>' + esc(addedOn(r.updated)) + ((r.rev || 1) > 1 ? ' (revision ' + esc(r.rev) + ')' : '') + '</td></tr>' : '') +   // v0.14.0: the catalogue date lives here, not on results
      '<tr><th>Catalogue reference</th><td>' + esc(ref) + '</td></tr>' +
      '<tr><th>Original record' + (locs.length > 1 ? 's' : '') + '</th><td>' + (hold ? txt(hold, r.id) + (locs.length ? '<br>' : '') : '') +
      (locs.length ? locs.join('<br>') : (hold ? '' : '<span class="muted">not recorded</span>')) + '</td></tr></tbody></table>';
  }
  function isText(r) { var t = String(((r.data || {}).type) || '') + ' ' + (KINDS[r.kind] || ''); return !isFootage(r) && r.kind !== 'artifact' && r.kind !== 'media' && !IMGRE.test(t); }
  function renderRecord(id) {
    foot(true); app.innerHTML = '<p class="muted">Loading ' + esc(id) + '…</p>';
    Promise.all([SRC.get(id), pagesP, thumbsP, extraP, wbP, logosP]).then(function (a) {
      var r = a[0].item, links = a[0].links, extra = (a[1] || {})[id] || null, srcs = srcsFor(id, a[3]);
      if (!r) throw new Error('not found');
      var d = r.data || {}; ttl(r.id + ' · ');
      var rel = {}; (links || []).forEach(function (l) { var t = l.target || l.to || l.id || l.dst; if (t && t !== r.id) rel[t] = 1; });
      (JSON.stringify(r).match(IDRE) || []).forEach(function (m) { if (m !== r.id) rel[m] = 1; });
      var h = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p>' + uidLine(r.id) + '<h1>' + esc(r.id) + ': ' + esc(r.title) + '</h1>';
      var pv = previewFig(r, srcs);
      if (r.kind === 'email') h += emailBlock(r);                // v0.10.0: an email shows its header, not a picture
      else { h += '<h2>Preview</h2>';
      if (isPrivate(r)) h += artifactCard(r);
      else if (pv) h += pv;
      else if (hasRecon(r.id, a[3] || {}) && !isFootage(r)) h += reconFig(r) + statusNote(r);
      else h += placeholderFrame(r) + statusNote(r);
      if (!pv && !isPrivate(r)) h += '<p class="fpend">File pending</p>'; }
      h += shareRow('id', r.id, r.id + ': ' + r.title, 1);
      h += metaBlock(r, srcs);
      h += '<h2>Description</h2>';
      var desc = [r.summary, d.description && d.description !== r.summary ? d.description : '', d.provenance].filter(Boolean);
      if (desc.length) h += desc.map(function (p) { return '<p>' + txt(p, r.id) + '</p>'; }).join('');
      else h += '<p class="nya">Description not yet added.</p>';
      if (r.body) h += '<h2>Transcript</h2>' + trx('<blockquote class="verbatim">' + rdx(txt(r.body, r.id), r.id) + '</blockquote>' +
        (/\u2588/.test(r.body) ? '<p class="muted">Black blocks mark redacted passages. <a href="/catalogue/request-original/?id=' + encodeURIComponent(r.id) + '">Request the uncensored original (£9.99)</a>.</p>' : ''));
      else if (extra && extra.extract) h += '<h2>Transcript</h2>' + trx('<p class="muted">' + esc(extra.extract_label || 'Extract (public-safe, verbatim)') + '</p><blockquote class="verbatim">' + txt(extra.extract, r.id) + '</blockquote>');
      else if (isText(r)) h += '<h2>Transcript</h2><p class="nya">Transcript not yet added.</p>';
      h += '<h2>Interpretation</h2>' + interpBlock(r, extra);
      h += '<h2>Record details</h2><table class="ghf-ev-table"><tbody>' + row('ID', r.id + (r.alias ? ' (' + r.alias + ')' : ''), r.id) + row('Kind', KINDS[r.kind] || r.kind) + row('Title', r.title, r.id) +
        row('Date', r.date_display) + row('Status', r.status) + row('Type', d.type) + row('Evidence label', d.label) + row('Holder', r.holder || d.repository, r.id) +
        row('Reference', d.their_ref || d.reference) + row('Artifact', d.artifact) + row('Evidence grade', d.evidence_grade ? d.evidence_grade + (d.grade_note ? ' — ' + d.grade_note : '') : '') +
        row('Why we believe it exists', d.why_we_believe_it_exists, r.id) + row('How to obtain', d.obtain, r.id) + row('Source', typeof d.source === 'string' ? d.source : '', r.id) +
        (Object.keys(rel).length ? '<tr><th>Linked records</th><td>' + Object.keys(rel).sort().map(function (x) { return '<a href="?id=' + x + '">' + x + '</a>'; }).join(' · ') + '</td></tr>' : '') +
        row('Record entry', 'revision ' + (r.rev || 1) + (r.updated ? ', updated ' + r.updated.slice(0, 10) : '')) + '</tbody></table>';
      h += '<p class="muted">Raw record: <a href="' + esc(CONFIG.rest + '/' + r.id) + '">JSON</a>' + (r.page && r.page.charAt(0) === '/' ? ' · Earlier page: <a href="https://bucklerfamily.estate' + esc(r.page) + '">' + esc(r.page) + '</a>' : '') + '</p>';
      app.innerHTML = rdx(h, r.id); hydrate(app); window.scrollTo(0, 0);
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
      h += shareRow('src', key, it.t, 1);
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
    Promise.all([SRC.list(), extraP, thumbsP, wbP, logosP]).then(function (x) { all = build(x[0], x[1]); if (sk) renderSource(sk); else renderList(); }).catch(function (e) { app.innerHTML = '<div class="err">The records could not be read (' + esc(e.message) + '). Try again in a moment.</div>'; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="?"]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); if (!/[?&](id|src)=/.test(a.getAttribute('href'))) shown = 30; route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);
  route();
})();
