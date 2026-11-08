# Changelog

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
