# Changelog

## 0.15.0 — 2026-11-11
- **Date first, then a short label.** Every search result (All, Web, Images, Videos, PDF and the tabs under More) now opens with the record's own date, followed by a plain description of what the item is in four words or fewer, e.g. "November 1891 · Newspaper report". The old "Records · kind · type" line (e.g. "Records · Media item · archive-catalogue") is gone. Labels come from a fixed display mapping over each record's kind, type and title (`labelOf()` in app.js); nothing is written into any record, and an item no rule fits shows no label. The record title stays the main link; the record page is unchanged. Issue #38.

## 0.14.0 — 2026-11-11
- **Share buttons only on the open record.** Search results (All, Web, Images, Videos, PDF and the tabs under More) no longer carry the Instagram, Facebook, X, LinkedIn and email buttons. They stay on the record page (`?id=`) and the archived-copy page (`?src=`), directly under the preview or pencil-sketch placeholder.
- **Results show the record's own date.** The date beside each record result is now the date of the record itself (its `date_display`, first clause, e.g. "November 1891" for an 1891 newspaper report), or the year and month of its `date_sort` when no display date is given. It is never the date the entry was added to the catalogue. Records stated as undated or "date not recorded" show no date rather than a catalogue date.
- **Catalogue date on the record page.** The record details table under the preview gains "Added to catalogue <d Mon yyyy>" (or "Catalogue entry updated … (revision N)" for a revised entry). The "Newest added" sort still uses that date. UI only: no record was changed. (cedwyn-catalogue#37)

## 0.13.0 — 2026-11-11
- **Result tabs fold into "More".** The tab row no longer scrolls sideways. All, Web, Images, Videos and PDF always show; News, Emails, Books and Blog follow them while they fit on the row, and whatever does not fit goes into a **More ▾** menu, always the last item on the right of the same row. The wider the screen, the more tabs show inline; on a wide screen every tab shows and More is hidden. The row is measured with ResizeObserver and re-flows on resize. More is a button with a menu (arrow keys, Esc and an outside click close it); choosing an item is the same link as the tab, and when the chosen tab sits inside More the button reads "More: <tab>". UI only: no record was changed. (cedwyn-catalogue#36)

## 0.12.0 — 2026-11-10
- **Transcripts collapsed.** Every transcript (and public-safe extract) on a record page now starts closed under a "Show transcript" control (`<details>`/`<summary>`, so it opens without script too); "Hide transcript" closes it again.
- **Institution logos for emails.** Each email record (EV-0906 onwards) shows the logo of the institution on the other side of the exchange, worked out from its mail domain: in the Emails tab row, as the card picture in All, on the record page beside the header, and as the link-preview picture (`og:image`). Logos were fetched once from each institution's own website and are served from this site (`logos/logos.json`, `/catalogue/logos/<key>.png`); `logos/map.json` maps records to logos. Personal mail domains, private individuals and unlisted correspondents keep a neutral email picture. Display only: no record was changed. (cedwyn-catalogue#34)

## 0.11.0 — 2026-11-10
- **Real previews.** Every record that holds a file now shows a preview cut from that file: where a page carries a photograph (EV-0094, the barn), the picture itself is cropped out; otherwise the first page or the image. Derived display images only (`thumbs/rec-index.json` + `thumbs/trN.json`); records are never edited. The pencil filter over real previews is gone: pencil sketches are kept only for records whose file is still pending, and no sketch carries a "placeholder" tag.
- **Open file.** Under each preview an "Open file" link; tapping the preview opens the file too. Files are served from this site at `/catalogue/file/<ID>` (only files the index lists). A record with no file says "File pending".
- **Share buttons** under every preview and on every record page: Instagram (the phone's share sheet, or "Copy link to share on Instagram"), Facebook, X, LinkedIn, Email.
- **Link previews.** A record address (`?id=EV-…`) now carries its own og:/twitter: title, description and image, written by the site's Worker, so a shared link shows the record's own picture (pending records show the pencil sketch).
- **News tab** for press, newspaper reports, clippings and scans of them. Images keeps photographs, maps and drawings.
- **Blogs** lists only external blogs about the case; each opens our archived copy, never the live blog. Our own websites, webapps and blog posts are not evidence and are no longer listed, searched or counted (nothing deleted).

## 0.10.2 — 2026-11-10
- Subject-access correspondence shows its headers only (sender, date, subject line), with a link to request the original; no transcript is shown.
- An email's page reads its record file first (the transcript lives there); the catalogue API row for an email carries its header data only.

## 0.10.1 — 2026-11-10
- Email records now carry ids in the EV series (EV-0906 onwards), one numbering format throughout the catalogue; the EM prefix is gone.
- Every email is shown. Passages that cannot be published are black blocks; hovering, tapping or focusing a block shows "Redacted. The uncensored original costs £9.99." with a link to the request form.
- New page `request-original/`: record id, name, email and reason, then the £9.99 Stripe payment. The price is stated on the form.
- Ids sort by their number, so ids past EV-9999 (EV-10000 … EV-1000000) stay in order.

## 0.10.0 — 2026-11-10
- **Emails tab** beside Web, Images and Videos: every email in the case correspondence is a catalogue record of its own (kind `email`, ids in the EV series, core schema 0.4.0).
  Inbox-style rows (date, sent/received, correspondent, subject line, record id); newest first when there is no search; search covers subject, sender and correspondent.
- Email record page: an Email header block (sent to / received from, date and time, subject line, attachments, transcript state, archive copy) in place of the picture preview; the transcript shows only where the record makes it public.
- Records are read from the central catalogue like every other kind. Until the API serves `kind=email` rows they are read from the catalogue's own record files (`unclehowell/cedwyn` `data/core/records/emails/`); the preview at /catalogue-preview/ reads them from the pull-request branch `catalogue-emails-v0.4.0`.
- Emails rank below other records in All, so evidence still leads a mixed search. Nothing here edits a record.

## 0.9.0 — 2026-11-09
- Record page schema (issue #30): preview + link to the artifact, then record details directly under it (date of the record, our catalogue reference, location of the original record(s)), then Description, Transcript (text records only) and Interpretation.
- Every link to where an original lives now opens our archived copy (its `?src=` catalogue entry, or our own hosted file). The preview no longer links straight to third-party sites; where no archived copy is held, the address is shown as text.
- Archived-copy entries (`?src=`) now show our archived copy, then the live original website, then the public Internet Archive Wayback copy; they resolve for sources a record already describes and for any page in the wayback index.

## 0.8.3 — 2026-11-09
- The page no longer shows its no-JavaScript fallback as raw markup while it loads (issue #29). The app shell `<main id="app">` now carries `data-cw-nolevels`, so the shared reading-levels script leaves it alone instead of wrapping it in a "The full list" card whose preview printed the `<noscript>` text with its tags. Readers see only "Loading the records…" until the search box appears; the `<noscript>` fallback stays real HTML for readers with JavaScript off.

## 0.8.2 — 2026-11-09
- One entry per record, round 2 (PR #28): MED-0043/0044/0045 (BAILII, CaseMine, vLex copies of [1987] EWCA Civ 2) withdrawn → EV-0080 and kept as its locations; MR-0036…MR-0046 withdrawn → their EV entries, which now carry `holding_status`; EV-0126 confirmed held (scanned copy of the GGAT August 1990 assessment) and MR-0045's "not yet obtained" retired; MED-0086/0087 and EV-0456/0457 checked and kept as separate records (`not_duplicate_of`).
- Media register display aliases are now MRG-nnnn, so MR-nnnn names missing records only (README, "Labels: one label, one record").

## 0.8.1 — 2026-11-08
- One central catalogue: 359 records moved in from the older evidence lists: 230 correspondence and evidence records under their existing EV numbers (EV-0226 to EV-0606), EV-0899 (the 1990 and 1994 GGAT archaeology record, formerly numbered EV-0900), and 128 newspaper, archive and web items from the media register as kind "Media item" (MED-xxxx, each carrying its register number as an alias). Media items are labelled and their ids link like other records.

## 0.8.0 — 2026-11-08
- Fillers are now scenes composed from the site's own photographs, drawn as one black-and-white graphite pencil sketch and labelled "Artist's impression — not the original". The 1974 footage record (MR-0081) shows a TV-news frame of a reporter interviewing Mary Williams in front of the Great House, built from the site's photograph of her and the white-walls picture of the house (AR-REC-0001), with a lower third from the record's title and dates. The 1988 footage record (EV-0083) shows the farmhouse as reported, built from Cadw's survey photograph of 29 July 1988 (EV-0095).
- A record with no file shows its reconstructed sheet (words only from the record's own fields) laid over a pencil sketch of a real photograph: the Great House, the Williams plan (deeds, plans, title and registry records), the farmhouse from the side (press) or Mary Williams (records naming her). Six small WebP files under sketch/.
- Real thumbnails (result cards, the image, PDF and video galleries, record-page previews) carry the same pencil look through one SVG filter (#pencil: greyscale, colour-dodge sketch, paper grain) applied by CSS; full-size originals and opened PDFs are unchanged. Pre-drawn reconstructions are not filtered twice.
- No record data changed. Cache-busters 0.8.0.

## 0.7.0 — 2026-11-08
- Videos shows catalogued footage records only: records whose type or medium is film, video or broadcast footage, or whose title names a film or broadcaster (today EV-0083, the 1988 ITV/HTV Wales report, and MR-0081, the 1974 HTV Report Wales film items). Channel uploads, Shorts and other social clips are no longer listed; analysis entries about footage are not footage.
- No footage file is held here yet, so each footage record shows a 4:3 pencil-sketch TV frame: scanlines, grain, a PLACEHOLDER tag and a lower third built from the record's own title and date. It opens the record.
- A record with no file now shows a greyscale graphite artist's impression of the document, labelled "Artist's impression — text reconstructed, not the original document". Every word drawn on it comes from the record's own fields (title, date, issuer named in the title, reference numbers, description); where those run out it draws pencil strokes, never filler text. The record data is unchanged. All drawn in inline SVG; no new image files.
- On a searched Videos tab, footage records that do not match the words are listed under "Other catalogued footage".
- Every result opens a page whose address carries its UID (?id=EV-0113). Record pages run top to bottom: UID and title, Preview (first page, image or artist's impression), Description, Transcript, Interpretation, then the record details table. Empty sections read "Description not yet added", "Transcript not yet added" or "Interpretation not yet added".
- A source file that a record already describes now folds into that record: one result, the record's, with a "Source file:" line (35 wayback PDFs; index in sources.json "rec", display only). Searching the file name finds the record.
- Other sources (archived pages, PDFs, books, blog posts) are labelled "Uncatalogued source" and open their own page at ?src=<key> with a preview and empty sections. They are not records and no record is made for them here.

## 0.6.0 — 2026-11-07
- The search webapp is now Records. The wordmark reads "Great House, Cedwyn Estate" in English and "Tŷ Mawr, Ystâd Cedwyn" in Welsh (the site's own forms: "Tŷ Mawr" for Great House, "Ystâd Cedwyn" for Cedwyn Estate), in the same one-colour type; it follows the site language switch.
- The header title above "N of 59" reads Records (Cofnodion in Welsh, Registros in Spanish). Page titles read "Records · Great House, Cedwyn Estate". Interface wording uses "records", not "catalogue". Addresses (/catalogue/) and record numbers are unchanged.
- "I'm feeling lucky" is gone. Under the search box a Trending row of tappable topics runs that search: Llandough, Great House Farm, Tŷ Mawr, Land Registry, Bute, BP Properties, Leckwith Common, Tithe. This webapp keeps no log of searches, so the row is the topics the most catalogue records mention, plus Leckwith Common.

## 0.5.1 — 2026-11-07
- The home page is just the header, the wordmark, the search box, the Search button and "I'm feeling lucky". The browse-by-type links, the counts line and the two-sentence note under them are gone from the home page.
- The wordmark reads "Cedwyn Estate" in one plain colour, in the standard header's type, with no subtitle beneath it, on the home page and above the results.
- Result tabs are plain words (All · Web · Images · Videos · PDF · Books · Blog) with no counts. No emoji anywhere in the interface: typed cards show the record type and number in text, and artifact boxes carry no icon.
- The note that records are read live and that interpretation boxes are our reading stays on results and record pages; interpretation boxes keep their own label.

## 0.5.0 — 2026-11-07
- The standard site header (the same ghf-boot header every other webapp loads), placed with the Research Library.
- A Google-style home: the Cedwyn logo, one large search box, an "I'm feeling lucky" link under it (opens the best-matching record, or a random record with a picture when the box is empty) and a Search button.
- Results open under tabs: All · Web · Images · Videos · PDF · Books · Blog, each with its own count. Web is the archived copies of pages that cite the farm. Images is a picture gallery with the catalogue record linked under each picture. Videos is a video gallery (16:9 poster, play mark, running time, title, source and date). PDF is a gallery of front pages, each linked to its record or to the file.
- Real preview thumbnails: 153 catalogue records and 72 archived PDFs now carry a small preview made from their own original (a downscaled image, the first page of the PDF, or the picture on the record's page). They are derived copies in thumbs/ (index.json plus shards of WebP data), loaded only when shown. Book results use the Internet Archive's own cover image; web captures and videos keep their existing pictures.
- Wherever no picture exists or may be shown, a typed card stands in (the record type, its icon and its number), never an empty box. Records held privately or containing subject-access or personal material get no picture at all.
- Relevance sort is now the default (title matches first); sort by catalogue number is still in the menu.
- Record pages show the preview (linked to the original it was made from) in the Artifact slot. Record data is read live and is unchanged; nothing in this release edits a record.

## 0.3.0 — 2026-11-06
- The catalogue list is now a minimal search page: one centred search box with tabs beneath it — All · Web · Images · Videos · Blog · Books — each tab showing its own count for the current search.
- Every result carries a preview image (lazy-loaded; a small icon stands in when no picture exists or an image fails to load). Images opens as a picture grid.
- Web: archived website captures and archived PDFs. Images: image, photo, map and artifact records plus the artist reconstruction sketches. Videos: the documentary and published YouTube films. Blog: Cedwyn blog posts. Books: the e-books and quoted book findings. Records that fit no single type appear under All.
- `sources.json` is a display and classification map only (which tab a record appears in, and the outside items listed beside the catalogue). Catalogue records are still read live and are never edited here; records added later are placed by the same rules.
- URL keeps `?q=` and `sort=` and adds `&tab=` (all, web, images, videos, blog, books). `?id=` record pages are unchanged, with a link back to the search you came from.
- Light and dark themes follow the device; layout checked at 390 px wide.

## 0.2.1
- Earlier releases: live catalogue list, record pages with artifact, transcript and interpretation sections.
