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

## Record page layout (the standard)
1. **Artifact** — a placeholder card. Records held privately (subject-access or personal data) show "Document held privately — personal data"; the original is never embedded here, and no PDF is shown.
2. **Description / transcript** — the record's summary and provenance, then its verbatim transcript (`body`). Where a record has no transcript, a public-safe verbatim extract may be supplied in `pages.json`.
   A metadata table in the Legal Wiki EV style follows (ID, kind, date, status, type, label, holder, reference, grade, how to obtain, linked records).
3. **Interpretation** — a clearly labelled box: our reading against hindsight and the wider record, with what cuts against it. Taken from the record's `interpretation` field when the catalogue carries one, else from `pages.json`, else a "not written yet" note.

## Files
- `index.html` — page shell and styles. `app.js` — routing, search, record pages, and the data layer.
- `pages.json` — page-only extras keyed by record ID (interpretation text, public-safe extracts). **Add-only.** It never holds or changes record data (catalogue lock).

## Switching to GraphQL later
`app.js` has two interchangeable sources with the same output shape: `rest` (today) and `graphql`. Set `CONFIG.source='graphql'` and
`CONFIG.graphql` to the endpoint (or test with `?source=graphql&endpoint=<url>`). Expected queries: `search(q:String, limit:Int): [Record]`
and `record(id: ID!): Record` with `links { rel target }`.

## Rules
Add-only for catalogue content; never edit an existing record from here. Commits end with the agent signature; no force-push.
