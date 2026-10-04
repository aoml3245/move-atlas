# Move Atlas — copyright, attribution and license notice

Copyright (c) 2026 Move Atlas contributors (aoml3245).
Publication review: 2026-10-04. This is an independent project; the upstream
projects and reference publishers have not endorsed it.

## Scope of the project license

The original application source, build scripts, tests, and deployment workflow
are offered under **GNU Affero General Public License version 3 only
(AGPL-3.0-only)**. The complete license is in `LICENSE` and
`public/licenses/AGPL-3.0.txt`. The application is provided without warranty.
Users may obtain the complete published application source, build instructions,
retained upstream text snapshots, corrections and delivered assets, without
charge, at https://github.com/aoml3245/move-atlas .

Third-party material is a separately attributed collection. The project license
does not replace its original license or restrict rights granted by that license.
In particular, CC BY-SA material is not relicensed as AGPL. `public/catalog.json`
is a mixed-license collection, **not a dataset wholly under one license**.
The `sources`, `originalInstructions`, and `credits` fields identify imported
material and its applicable license. Keep these fields and this notice when
redistributing the collection. The same source notices apply to the retained
text snapshots in `data/sources/`.

## Imported sources

| Source | Retained input records | Applicable terms | Notice |
| --- | ---: | --- | --- |
| [Free Exercise DB](https://github.com/yuhonas/free-exercise-db) — yuhonas and contributors | 876 | Unlicense | Full upstream notice: `public/licenses/free-exercise-db.txt` |
| [Exercises Dataset](https://github.com/hasaneyldrm/exercises-dataset) — Hasan Emir Yıldırım | 1,324 | MIT for code, structure and instruction text/translations; media excluded | Copyright (c) 2026 Hasan Emir Yıldırım; full MIT notice and media exception: `public/licenses/exercises-dataset.txt` |
| [wger exercise data](https://wger.de), [project repository](https://github.com/wger-project/wger) — credited community authors | 914 | CC BY-SA 3.0, CC BY-SA 4.0, or CC0 as recorded per entry **and per translation** | Author histories, supplied source URLs and license links remain in `sources[].credits`; full on-site author index: `public/credits.html` |
| [Liftosaur](https://github.com/astashov/liftosaur) — Anton Astashov and contributors | 392 equipment variants | AGPL-3.0 | Extracted from `src/models/exercise.ts` and `src/models/exerciseImage.ts`; retained snapshots and extraction source are published, with the complete license in `public/licenses/liftosaur.txt` |

Text snapshots were retrieved on 2026-10-02. Source license copies were compared
with upstream official files on 2026-10-03. License blob IDs and SHA-256 hashes
are in `data/upstream-license-check.json`. Retrieval and sanitized snapshot hashes
are in `data/source-snapshots.json`.

### Changes to imported material

Move Atlas normalizes exercise names, joins duplicate source records, retains
movement/equipment/grip variants, maps muscle and equipment labels, adds Korean
metadata summaries, and applies documented equipment clarifications.
Original instruction text has HTML tags removed and whitespace normalized.
English descriptions use the **English translation's** license where it differs
from the base exercise license. wger's original CC licenses continue to cover
its original/adapted expression. Relevant original authors and license links
must remain with reuse; adaptations must meet the applicable ShareAlike terms.
Where the API supplies no author identity, this is explicitly marked
`not-supplied-by-upstream`, not replaced with an invented attribution.
No source license is upgraded merely because records appear in one JSON file.

- [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)

### Upstream exercise media is excluded

No upstream exercise photograph, GIF, video or muscle-diagram file is distributed
or hotlinked by this application. In particular, the Exercises Dataset MIT grant
**does not cover Gym visual media**. Those files are excluded. Any retained
media filenames, URLs or copyright metadata in a source text snapshot are
provenance only and do not grant media reuse rights. Obtain a separate license
from the rights holder before reusing such media. Gym visual's original
attribution is “© Gym visual — https://gymvisual.com/”.

## Newly created instructional illustrations and captions

The delivered WebP files in `public/illustrations/` were generated with the
built-in image generation tool, selected and visually reviewed by agents.
They are newly made exercise-method diagrams, not copied upstream media.
The new illustrations and Korean movement captions are offered under
**CC BY-SA 4.0**, to the extent Move Atlas contributors hold applicable rights.
Attribution: “Move Atlas contributors — AI-generated and agent-reviewed exercise
illustrations”, with a link to https://github.com/aoml3245/move-atlas and
https://creativecommons.org/licenses/by-sa/4.0/ . Preserve relevant underlying
source credits and identify modifications. This grant does not promise exclusive
copyright in AI output or waive others' rights.

Reference links used to clarify some movements remain in
`public/illustrations/manifest.json` and in the on-site attribution index.
Those reference websites are credited for factual movement research; **their
photographs, videos, logos and article text are not licensed by this project**.

For delivery, images were encoded to WebP at quality 90, without cropping,
resizing, drawing edits or pose changes. `data/illustration-reviews.json` records
the original visually reviewed SHA-256 and the separate delivery SHA-256.
Original PNGs, rejected candidates and private production logs remain local
and are not required to build or run the published app.

## Training templates and bundled software

The training engine, UI, record storage and sync implementation are independently
written AGPL-3.0-only source. The factual research references and app-specific
adaptations are listed in `public/training-guide.html`: ACSM, NSCA, StrongLifts
and Jim Wendler's publicly available articles. Paid guides, original prose,
logos, program screenshots and spreadsheet assets are not distributed.
StrongLifts and 5/3/1 names identify references, not endorsement or affiliation.

The Firebase JavaScript SDK (Google LLC and contributors) is Apache-2.0, with
the protobuf component under BSD-3-Clause. Full upstream terms are retained in
`public/licenses/firebase-sdk.txt`, obtained from the official
https://github.com/firebase/firebase-js-sdk/blob/main/LICENSE on 2026-10-04.
The generated browser bundle retains its source copyright/license comments in
`cloud.js.LEGAL.txt`. esbuild is an MIT-licensed build dependency; npm package
versions and the dependency tree are preserved in `package-lock.json`.
Third-party licenses remain applicable and are not replaced by the project license.

## Reuse and limitations

The full public code and static assets may be served locally using the README
instructions. Reusers must follow each applicable license, including AGPL source
availability, MIT notice retention, and CC attribution/ShareAlike requirements.
No extra legal or technological restrictions are imposed on CC material.
Exercise method facts, independently written code, original source expression,
and generated artwork are identified separately rather than assigned one
blanket license. This review records observable terms, not a legal opinion or
a guarantee that upstream contributors own every underlying right.
