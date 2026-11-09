# cedwyn-catalogue — the Cedwyn catalogue browser

One front end for every record in the central Cedwyn catalogue (evidence, artifacts, missing records, people, candidates).

- **Live:** https://bucklerfamily.estate/catalogue/ (served from this repo's `main` by the Cloudflare Worker `bfe-catalogue`, source in `worker/bfe-catalogue.js`; a push to `main` is live within about 2 minutes). The old address https://catalogue.bucklerfamily.estate/ 301-redirects there, path and query kept. Every webapp lives at a path of bucklerfamily.estate (`/<app>/`), never a subdomain.
- **A record:** `https://bucklerfamily.estate/catalogue/?id=EV-0680`
- **Search:** `?q=ministry+of+defence`, `?kind=evidence`, `?sort=new`

## Where the data comes from
The source of truth is the central catalogue (unclehowell/cedwyn, `data/core`), served at
`https://cedwyn.bucklerfamily.estate/api/catalogue`. This repo holds **no copy of the records**: the browser reads them live in the
reader's browser (REST: `GET /api/catalogue?limit=500&offset=N` for the list, `GET /api/catalogue/<id>` for one record).
So a record added to the catalogue appears here, with its own page, as soon as the API serves it (the API caches for up to 5 minutes).
No build step and no extra commit are needed per record.

## Record page layout (the standard; schema of 9 Nov 2026, issue #30)
1. **Preview** — the artifact itself (its derived thumbnail) or a labelled placeholder, with the link to the artifact. The link opens **our archived copy**, never the external site; where no archived copy is held yet the caption states that and there is no link. Records held privately (subject-access or personal data) show "Document held privately — personal data".
2. **Record details, directly under the preview** — date of the record; our catalogue reference (EV-/MR-/CH-/MED-/AR- id, alias, holder's reference); location of the original record(s): the holder, and each original's website address as text, linked to **our archived copy's catalogue entry** (`?src=<key>`), or to our own file for copies we host.
3. **Description**, then a separate **Transcript** when the record is text (verbatim `body`, or a public-safe extract from `pages.json`), then **Interpretation** — the schema title: a clearly labelled box, our reading against hindsight and the wider record, with what cuts against it. Taken from the record's `interpretation` field, else `pages.json`, else a "not written yet" note.
4. The fuller metadata table in the Legal Wiki EV style follows (ID, kind, date, status, type, label, holder, reference, grade, how to obtain, linked records).

**Archived-copy entries (`?src=<key>`)** are the only pages that link out: preview and link to our copy, then date captured, catalogue reference, our archived copy, the **original website** (live link) and the **public archived copy** on the Internet Archive Wayback Machine. The original address comes from the wayback index (`wayback.bucklerfamily.estate/websites/index.json`). Watchtower tracks those external pages for updates.

## Files
- `index.html` — page shell and styles. `app.js` — routing, search, record pages, and the data layer.
- `pages.json` — page-only extras keyed by record ID (interpretation text, public-safe extracts). **Add-only.** It never holds or changes record data (catalogue lock).

## Switching to GraphQL later
`app.js` has two interchangeable sources with the same output shape: `rest` (today) and `graphql`. Set `CONFIG.source='graphql'` and
`CONFIG.graphql` to the endpoint (or test with `?source=graphql&endpoint=<url>`). Expected queries: `search(q:String, limit:Int): [Record]`
and `record(id: ID!): Record` with `links { rel target }`.

## Labels: one label, one record
- Every record has one id, and an id is never reused or renumbered. A duplicate entry is never deleted: it is marked `status: "WITHDRAWN: duplicate of <kept id>"` with `data.duplicate_of`, and the id keeps resolving.
- Physical or online copies of one record are **locations** on the single entry (`data.locations`, each with holder, url/page and `folded_from`), not separate entries.
- Evidence entries carry `data.holding_status` ("held" / "not held"). The missing-records list (`/research/missing-records/`) reads it from the evidence entry; an `MR-nnnn` that was the same document as an `EV-nnnn` is withdrawn and its page points to the EV entry.
- `MR-nnnn` names a **missing record** only. Media register items are `MED-nnnn`; their display alias is `MRG-nnnn` (same digits). Older pages called them "media register MR-nnnn"; that text is kept as `data.legacy_alias`, so an old `MR-` reference to a media item maps to the `MED-` id with the same digits.

## Rules
Add-only for catalogue content; never edit an existing record from here. Commits end with the agent signature; no force-push.
