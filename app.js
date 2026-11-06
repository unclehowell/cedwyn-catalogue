/* Cedwyn catalogue browser v0.1.0 — one front end for every record in the central catalogue.
   Records are read live (REST /api/catalogue today; a GraphQL endpoint can be switched in via CONFIG or ?source=graphql&endpoint=...).
   Record pages: artifact placeholder -> description / transcript -> interpretation box. Nothing here edits a record. — Tab agent */
(function () {
  'use strict';
  var CONFIG = {
    source: 'rest',                                            // 'rest' | 'graphql'
    rest: 'https://cedwyn.bucklerfamily.estate/api/catalogue',  // GET ?limit&offset[&kind] -> {total,items}; GET /<id> -> {item,links}
    graphql: null,                                             // e.g. 'https://cedwyn.bucklerfamily.estate/api/graphql' once it exists
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

  /* ---- list / search ---- */
  var all = null, shown = 50;
  function hay(r) { var d = r.data || {}; return [r.id, r.alias, r.title, r.holder, r.summary, r.status, r.date_display, d.type, d.label, d.their_ref, d.reference].join(' ').toLowerCase(); }
  function renderList() {
    var q = (P.get('q') || '').trim(), kind = P.get('kind') || '', sort = P.get('sort') || 'id';
    document.title = 'Catalogue · Cedwyn';
    var counts = {}; all.forEach(function (r) { counts[r.kind] = (counts[r.kind] || 0) + 1; });
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    var rows = all.filter(function (r) { if (kind && r.kind !== kind) return false; var h = hay(r); return toks.every(function (t) { return h.indexOf(t) >= 0; }); });
    rows.sort(function (a, b) {
      if (sort === 'new') return String(b.updated || '').localeCompare(String(a.updated || '')) || b.id.localeCompare(a.id);
      if (sort === 'date') return String(a.date_sort || '9999').localeCompare(String(b.date_sort || '9999'));
      if (sort === 'date-desc') return String(b.date_sort || '').localeCompare(String(a.date_sort || ''));
      return a.id.localeCompare(b.id, 'en', { numeric: true });
    });
    var h = '<h1>The catalogue</h1><p class="muted">' + all.length + ' records, read live from the central catalogue. Search by ID, title, holder, reference or status.</p>';
    h += '<div class="controls"><input type="search" id="q" placeholder="Search, e.g. EV-0680 or Ministry of Defence" value="' + esc(q) + '" aria-label="Search the catalogue">';
    h += '<select id="sort" aria-label="Sort"><option value="id">Sort: ID</option><option value="new">Sort: recently added</option><option value="date">Sort: date (oldest)</option><option value="date-desc">Sort: date (newest)</option></select>';
    h += '<select id="kind" aria-label="Kind"><option value="">All kinds</option>' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + KINDS[k] + ' (' + (counts[k] || 0) + ')</option>'; }).join('') + '</select></div>';
    h += '<p class="muted">' + rows.length + ' shown</p><div id="rows">';
    rows.slice(0, shown).forEach(function (r) {
      h += '<a class="rec" href="?id=' + esc(r.id) + '"><span class="id">' + esc(r.id) + '</span><span class="badge">' + esc(KINDS[r.kind] || r.kind) + '</span><span class="t">' + esc(r.title) + '</span><span class="m">' + esc(r.date_display || 'date not recorded') + ' · ' + esc(r.status || '') + '</span></a>';
    });
    h += '</div>' + (rows.length > shown ? '<button class="more" id="more">Show more (' + (rows.length - shown) + ' left)</button>' : '');
    app.innerHTML = h;
    document.getElementById('sort').value = sort; document.getElementById('kind').value = kind;
    var t; document.getElementById('q').addEventListener('input', function (e) { clearTimeout(t); t = setTimeout(function () { setParam('q', e.target.value.trim()); }, 250); });
    document.getElementById('sort').addEventListener('change', function (e) { setParam('sort', e.target.value === 'id' ? '' : e.target.value); });
    document.getElementById('kind').addEventListener('change', function (e) { setParam('kind', e.target.value); });
    var m = document.getElementById('more'); if (m) m.addEventListener('click', function () { shown += 100; renderList(); });
  }
  function setParam(k, v) {
    if (v) P.set(k, v); else P.delete(k); P.delete('id'); shown = 50;
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
  function renderRecord(id) {
    app.innerHTML = '<p class="muted">Loading ' + esc(id) + '…</p>';
    Promise.all([SRC.get(id), pagesP]).then(function (a) {
      var r = a[0].item, links = a[0].links, extra = (a[1] || {})[id] || null;
      if (!r) throw new Error('not found');
      var d = r.data || {}; document.title = r.id + ' · Catalogue · Cedwyn';
      var rel = {}; (links || []).forEach(function (l) { var t = l.target || l.to || l.id || l.dst; if (t && t !== r.id) rel[t] = 1; });
      (JSON.stringify(r).match(IDRE) || []).forEach(function (m) { if (m !== r.id) rel[m] = 1; });
      var h = '<p class="muted"><a href="./">← All records</a></p><h1>' + esc(r.id) + ': ' + esc(r.title) + '</h1>';
      h += '<h2>Artifact</h2>' + artifactCard(r);
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
        row('How to obtain', d.obtain, r.id) + row('Source', typeof d.source === 'string' ? d.source : '', r.id) +
        (Object.keys(rel).length ? '<tr><th>Linked records</th><td>' + Object.keys(rel).sort().map(function (x) { return '<a href="?id=' + x + '">' + x + '</a>'; }).join(' · ') + '</td></tr>' : '') +
        row('Catalogue entry', 'revision ' + (r.rev || 1) + (r.updated ? ', updated ' + r.updated.slice(0, 10) : '')) + '</tbody></table>';
      h += '<h2>Interpretation</h2>' + interpBlock(r, extra);
      h += '<p class="muted">Raw record: <a href="' + esc(CONFIG.rest + '/' + r.id) + '">JSON</a>' + (r.page && r.page.charAt(0) === '/' ? ' · Earlier page: <a href="https://cedwyn.bucklerfamily.estate' + esc(r.page) + '">' + esc(r.page) + '</a>' : '') + '</p>';
      app.innerHTML = h; window.scrollTo(0, 0);
    }).catch(function (e) { app.innerHTML = '<p class="muted"><a href="./">← All records</a></p><div class="err">Record ' + esc(id) + ' could not be read (' + esc(e.message) + '). It may not be in the catalogue yet.</div>'; });
  }

  function route() {
    P = new URLSearchParams(location.search); var id = (P.get('id') || '').trim().toUpperCase();
    if (id) return renderRecord(id);
    if (all) return renderList();
    SRC.list().then(function (x) { all = x; renderList(); }).catch(function (e) { app.innerHTML = '<div class="err">The catalogue could not be read (' + esc(e.message) + '). Try again in a moment.</div>'; });
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="?"]'); if (!a || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); history.pushState(null, '', a.getAttribute('href')); route();
  });
  window.addEventListener('popstate', route);
  route();
})();
