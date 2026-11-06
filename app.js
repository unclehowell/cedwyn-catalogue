/* Cedwyn catalogue browser v0.3.0 — one front end for every record in the central catalogue.
   Records are read live (REST /api/catalogue today; a GraphQL endpoint can be switched in via CONFIG or ?source=graphql&endpoint=...).
   Record pages: artifact placeholder -> description / transcript -> interpretation box. Nothing here edits a record.
   v0.3.0: Google-style search with tabs (All · Web · Images · Videos · Blog · Books) and a preview image per result; sources.json is a display/classification map only. — Tab agent */
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

  /* ---- search (v0.3.0): one box, tabs beneath, a preview image on every result ---- */
  var all = null, extra = null, shown = 30;
  var TABS = [['all', 'All'], ['web', 'Web'], ['images', 'Images'], ['videos', 'Videos'], ['blog', 'Blog'], ['books', 'Books']];
  var ICON = { web: '🌐', pdf: '📄', images: '🖼️', videos: '▶️', blog: '✍️', books: '📚', book: '📖', all: '📁', person: '👤', missing_record: '📭', evidence: '📄', artifact: '🖼️', catalogue_candidate: '🗂️' };
  var IMGRE = /image|photo|map|plan\b|drawing|aerial|postcard|sketch/i, BOOKRE = /book|trade directory|library item/i, WEBRE = /web page|press|website/i;
  var VQ = '?v=0.3.0-' + Math.floor(Date.now() / 300000);
  var extraP = Promise.all([getJSON('sources.json' + VQ).catch(function () { return { items: [], cat: {}, recon: [] }; }),
    getJSON('sources-books.json' + VQ).catch(function () { return { items: [] }; })]).then(function (a) { a[0].items = (a[0].items || []).concat(a[1].items || []); return a[0]; });
  function recTab(r, x) {                                   // the mapping file first, then the same rules for records added since
    if (x.cat && x.cat[r.id]) return x.cat[r.id];
    var t = String((r.data || {}).type || '');
    if ((x.recon || []).indexOf(r.id) >= 0 || r.kind === 'artifact' || IMGRE.test(t)) return 'images';
    if (/video|film/i.test(t)) return 'videos';
    if (BOOKRE.test(t)) return 'books';
    if (WEBRE.test(t)) return 'web';
    return 'all';
  }
  function fromRecord(r, x) {
    var d = r.data || {};
    return { tab: recTab(r, x), id: r.id, t: r.id + ': ' + r.title, u: '?id=' + r.id, s: 'Catalogue · ' + (KINDS[r.kind] || r.kind) + (d.type ? ' · ' + d.type : ''),
      d: r.summary || r.status || '', dt: r.updated || '', ic: r.kind, img: (x.recon || []).indexOf(r.id) >= 0 ? 'recon/' + r.id + '.webp' : null,
      h: [r.id, r.alias, r.title, r.holder, r.summary, r.status, r.date_display, d.type, d.label, d.their_ref, d.reference].join(' ').toLowerCase(), ds: r.date_sort || '' };
  }
  function build(recs, x) {
    var out = recs.map(function (r) { return fromRecord(r, x); });
    (x.items || []).forEach(function (it) { it.h = [it.t, it.d, it.s, it.k].join(' ').toLowerCase(); it.ds = it.dt || ''; out.push(it); });
    return out;
  }
  function thumb(it, big) {
    var ic = ICON[it.ic] || ICON[it.tab] || '📁';
    var ph = '<span class="ph" aria-hidden="true">' + ic + '</span>';
    if (!it.img) return '<span class="th' + (big ? ' big' : '') + '">' + ph + '</span>';
    return '<span class="th' + (big ? ' big' : '') + '"><img src="' + esc(it.img) + '" alt="" loading="lazy" decoding="async" onerror="this.outerHTML=\'' + ph.replace(/"/g, '&quot;') + '\'"></span>';
  }
  function host(u) { try { return new URL(u, location.href).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  function renderList() {
    var q = (P.get('q') || '').trim(), sort = P.get('sort') || 'id', tab = P.get('tab') || 'all';
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'all';
    window.__cs = location.search || './';
    document.title = (q ? q + ' · ' : '') + 'Catalogue search · Cedwyn';
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    var hits = all.filter(function (it) { return toks.every(function (t) { return it.h.indexOf(t) >= 0; }); });
    var counts = { all: hits.length }; hits.forEach(function (it) { if (it.tab !== 'all') counts[it.tab] = (counts[it.tab] || 0) + 1; });
    var rows = tab === 'all' ? hits : hits.filter(function (it) { return it.tab === tab; });
    rows = rows.slice().sort(function (a, b) {
      if (sort === 'new') return String(b.dt || '').localeCompare(String(a.dt || ''));
      if (sort === 'date') return String(a.ds || '9999').localeCompare(String(b.ds || '9999'));
      if (sort === 'date-desc') return String(b.ds || '').localeCompare(String(a.ds || ''));
      if (a.id && b.id) return a.id.localeCompare(b.id, 'en', { numeric: true });
      return a.id ? -1 : b.id ? 1 : 0;
    });
    var h = '<div class="sx' + (q ? '' : ' home') + '"><a class="logo" href="./">Cedwyn<span>catalogue</span></a>';
    h += '<form class="sbox" role="search" id="sf"><span class="mag" aria-hidden="true">⌕</span><input type="search" id="q" placeholder="Search the catalogue, archive, films, blog and books" value="' + esc(q) + '" aria-label="Search" autocomplete="off"></form>';
    h += '<nav class="tabs" aria-label="Result type">' + TABS.map(function (t) {
      var on = t[0] === tab, href = '?' + qs({ tab: t[0] === 'all' ? '' : t[0] });
      return '<a href="' + esc(href) + '"' + (on ? ' aria-current="page" class="on"' : '') + '>' + t[1] + (q ? '<small>' + (counts[t[0]] || 0) + '</small>' : '') + '</a>';
    }).join('') + '</nav>';
    h += '<div class="meta"><span>' + rows.length + ' result' + (rows.length === 1 ? '' : 's') + '</span><select id="sort" aria-label="Sort"><option value="id">Sort: relevance</option><option value="new">Sort: recently added</option><option value="date">Sort: date (oldest)</option><option value="date-desc">Sort: date (newest)</option></select></div></div>';
    if (!rows.length) h += '<p class="none">No results' + (q ? ' for <b>' + esc(q) + '</b>' : '') + (tab !== 'all' ? ' in ' + TABS.filter(function (t) { return t[0] === tab; })[0][1] + '. Try <a href="?' + esc(qs({ tab: '' })) + '">All</a>.' : '.') + '</p>';
    if (tab === 'images') {
      h += '<div class="grid">' + rows.slice(0, shown).map(function (it) { return '<a class="cell" href="' + esc(it.u || '#') + '"' + ext(it) + '>' + thumb(it, true) + '<span class="cap">' + esc(it.t) + '</span></a>'; }).join('') + '</div>';
    } else {
      h += '<div class="res">' + rows.slice(0, shown).map(function (it) {
        var src = it.s || host(it.u);
        return '<article class="r"><div class="tx"><div class="src">' + esc(src) + (it.dt ? ' · ' + esc(String(it.dt).slice(0, 10)) : '') + '</div>' +
          (it.u ? '<a class="tt" href="' + esc(it.u) + '"' + ext(it) + '>' + esc(it.t) + '</a>' : '<span class="tt">' + esc(it.t) + '</span>') +
          (it.d ? '<p class="sn">' + esc(it.d) + '</p>' : '') + '</div>' + (it.u ? '<a class="tl" href="' + esc(it.u) + '"' + ext(it) + ' tabindex="-1" aria-hidden="true">' + thumb(it) + '</a>' : thumb(it)) + '</article>';
      }).join('') + '</div>';
    }
    if (rows.length > shown) h += '<button class="more" id="more">More results (' + (rows.length - shown) + ')</button>';
    app.innerHTML = h;
    document.getElementById('sort').value = sort;
    var qi = document.getElementById('q'), t;
    qi.addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { setParam('q', e.target.value.trim()); }, 300); });
    document.getElementById('sf').addEventListener('submit', function (e) { e.preventDefault(); clearTimeout(t); setParam('q', qi.value.trim()); });
    document.getElementById('sort').addEventListener('change', function (e) { setParam('sort', e.target.value === 'id' ? '' : e.target.value); });
    var m = document.getElementById('more'); if (m) m.addEventListener('click', function () { shown += 60; renderList(); });
  }
  function ext(it) { return it.u && it.u.charAt(0) !== '?' ? ' rel="noopener"' : ''; }
  function qs(o) { var p = new URLSearchParams(P.toString()); p.delete('id'); Object.keys(o).forEach(function (k) { if (o[k]) p.set(k, o[k]); else p.delete(k); }); return p.toString(); }
  function setParam(k, v) {
    if (v) P.set(k, v); else P.delete(k); P.delete('id'); shown = 30;
    history.replaceState(null, '', '?' + P.toString()); renderList();
    if (k === 'q') { var i = document.getElementById('q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }

  /* ---- record page ---- */
  function isPrivate(r) { var d = r.data || {}; return /privately|subject[- ]access|personal data/i.test([r.status, d.label, r.holder].join(' ')); }
  function artifactCard(r) {
    var d = r.data || {}, st = String(r.status || '');
    if (isPrivate(r)) return '<div class="artifact"><div class="ic" aria-hidden="true">🔒</div><strong>Document held privately — personal data</strong><span class="muted">The original is kept privately in the evidence repository and is not published here. The description and extract below are the public record of it.</span></div>';
    if (/not (yet )?(held|found|obtained)|requested|pending|blocked/i.test(st)) return '<div class="artifact"><div class="ic" aria-hidden="true">📭</div><strong>Artifact not yet held</strong><span class="muted">' + esc(st) + '. This entry records the document and where it should be; the original is not in the repository yet.</span></div>';
    return '<div class="artifact"><div class="ic" aria-hidden="true">📄</div><strong>' + esc(d.label || 'Artifact') + '</strong><span class="muted">' + esc(d.type || r.kind) + ' · ' + esc(st) + '. The artifact itself is shown on its holder\'s or the archive\'s own page; this catalogue shows the record of it.</span></div>';
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
    app.innerHTML = '<p class="muted">Loading ' + esc(id) + '…</p>';
    Promise.all([SRC.get(id), pagesP]).then(function (a) {
      var r = a[0].item, links = a[0].links, extra = (a[1] || {})[id] || null;
      if (!r) throw new Error('not found');
      var d = r.data || {}; document.title = r.id + ' · Catalogue · Cedwyn';
      var rel = {}; (links || []).forEach(function (l) { var t = l.target || l.to || l.id || l.dst; if (t && t !== r.id) rel[t] = 1; });
      (JSON.stringify(r).match(IDRE) || []).forEach(function (m) { if (m !== r.id) rel[m] = 1; });
      var h = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p><h1>' + esc(r.id) + ': ' + esc(r.title) + '</h1>';
      h += '<h2>Artifact</h2>' + artifactCard(r) + reconFig(r);
      h += '<h2>Description</h2>';
      if (r.summary) h += '<p>' + txt(r.summary, r.id) + '</p>';
      if (d.provenance) h += '<p>' + txt(d.provenance, r.id) + '</p>';
      if (!r.summary && !d.provenance) h += '<p class="muted">No description in the catalogue record.</p>';
      h += '<h2>Transcript</h2>';
      if (r.body) h += '<blockquote class="verbatim">' + txt(r.body, r.id) + '</blockquote>';
      else if (extra && extra.extract) h += '<p class="muted">' + esc(extra.extract_label || 'Extract (public-safe, verbatim)') + '</p><blockquote class="verbatim">' + txt(extra.extract, r.id) + '</blockquote>';
      else h += '<p class="muted">No transcript in the catalogue record.</p>';
      h += '<table class="ghf-ev-table"><tbody>' + row('ID', r.id + (r.alias ? ' (' + r.alias + ')' : ''), r.id) + row('Kind', KINDS[r.kind] || r.kind) + row('Title', r.title, r.id) +
        row('Date', r.date_display) + row('Status', r.status) + row('Type', d.type) + row('Evidence label', d.label) + row('Holder', r.holder || d.repository, r.id) +
        row('Reference', d.their_ref || d.reference) + row('Artifact', d.artifact) + row('Evidence grade', d.evidence_grade ? d.evidence_grade + (d.grade_note ? ' — ' + d.grade_note : '') : '') +
        row('Why we believe it exists', d.why_we_believe_it_exists, r.id) + row('How to obtain', d.obtain, r.id) + row('Source', typeof d.source === 'string' ? d.source : '', r.id) +
        (Object.keys(rel).length ? '<tr><th>Linked records</th><td>' + Object.keys(rel).sort().map(function (x) { return '<a href="?id=' + x + '">' + x + '</a>'; }).join(' · ') + '</td></tr>' : '') +
        row('Catalogue entry', 'revision ' + (r.rev || 1) + (r.updated ? ', updated ' + r.updated.slice(0, 10) : '')) + '</tbody></table>';
      h += '<h2>Interpretation</h2>' + interpBlock(r, extra);
      h += '<p class="muted">Raw record: <a href="' + esc(CONFIG.rest + '/' + r.id) + '">JSON</a>' + (r.page && r.page.charAt(0) === '/' ? ' · Earlier page: <a href="https://bucklerfamily.estate' + esc(r.page) + '">' + esc(r.page) + '</a>' : '') + '</p>';
      app.innerHTML = h; window.scrollTo(0, 0);
    }).catch(function (e) { app.innerHTML = '<p class="muted"><a href="' + esc(window.__cs || './') + '">← Back to search</a></p><div class="err">Record ' + esc(id) + ' could not be read (' + esc(e.message) + '). It may not be in the catalogue yet.</div>'; });
  }

  function route() {
    P = new URLSearchParams(location.search); var id = (P.get('id') || '').trim().toUpperCase();
    if (id) return renderRecord(id);
    if (all) return renderList();
    Promise.all([SRC.list(), extraP]).then(function (x) { all = build(x[0], x[1]); renderList(); }).catch(function (e) { app.innerHTML = '<div class="err">The catalogue could not be read (' + esc(e.message) + '). Try again in a moment.</div>'; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="?"]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); if (!/[?&]id=/.test(a.getAttribute('href'))) shown = 30; route(); window.scrollTo(0, 0);
  });
  window.addEventListener('popstate', route);
  route();
})();
