# Actual offline-browser acceptance contract

The historical Python/native result in [VERIFICATION.md](VERIFICATION.md) remains unchanged. It does not establish correctness of this new browser producer. Browser runtime and visual acceptance are pending a fresh exact-commit run and independent artifact inspection.

## Explicit choices and retained state

The supplied-file reader starts with every cleanup option off. Independent choices cover singer IDs, renderer/resampler/wavtool bindings, track colors, six supported phoneme override fields, existing per-note expression abbreviations and existing part-curve abbreviations. Selected changes apply across all original tracks and voice parts. Definitions and every unselected value remain; original parts, notes, timing, lyrics, note pitch points, vibrato and tuning are never rebuilt. YAML formatting/comments may change.

The app shows project totals, distinct affected track/part/note counts, every affected original value and the proposed removal/default value. A 50-row pager limits screen DOM size; all rows remain in the JSON review and print. A 2,000-change UI cap blocks USTX export until the selection is reduced. No selected changes gives a byte-identical copy. New input or policy changes clear acknowledgment and the cached output. Late reads and late exports cannot revive prior state or download an outdated policy result.

Names, lyrics, comments and unselected bindings/settings remain. The report itself contains original affected values. Both the interface and offline instructions disclose this; there is no anonymity/privacy, voicebank-compatibility or audio-equivalence guarantee. The scope is the pinned alpha and voice-only USTX 0.10.

## Bounded, inert parsing

The exact upstream js-yaml 5.4.2 browser source is pinned and accompanied by its MIT notice. The independent JavaScript policy/schema implementation shares the contract, not Python implementation code. It uses CORE_SCHEMA and explicit event inspection, rejects anchors/aliases, directives, multiple documents, unsupported tags, duplicate/nonstring/unsafe mapping keys, wave parts, unresolved/malformed expression data, numeric ambiguity and invalid native integer/timing ranges.

Limits include 8 MiB input/output, 250,000 events, depth 32, 65,536 scalar characters, 64 tracks, 256 parts and 10,000 notes. Before allocating parser events, a conservative preflight caps structural characters at 125,000, counting punctuation even inside strings/comments; this deliberately rejects some unusually punctuated valid documents. The event and scalar limits then apply before constructing data objects. Unsupported numeric spellings are rejected rather than converted approximately. Both producers compare the exact decimal coefficient/exponent with their numeric serialization and reject any precision-changing scalar before output, including unknown retained fields. A same-parsed-number comparison alone is insufficient. On/off/yes/no and date-looking strings follow YAML 1.2 semantics; native integer fields do not accept float scalar syntax.

Only one explicitly supplied `.ustx` file is read. The metadata byte cap is checked before `File.arrayBuffer`. The app does not resolve filenames inside YAML, execute markup or custom objects, use credentials/local storage, or make background network requests. The local-file CSP permits only packaged scripts/styles and disables connections, objects, frames, workers, base URLs, forms, image and font resources. UI text uses textContent. System fonts and inline SVG branding need no network.

## Actual native path

Hosted CI verifies and extracts the exact eight-file offline package and opens its `index.html` using `file://`. Standard Ubuntu 22.04 and sandboxed Chromium are used; actual process commands must omit sandbox-disabling flags. No kernel/AppArmor/browser-security changes are allowed.

The official release assemblies author a fresh two-track/three-part/six-note USTX. The independent Python core writes only `prototype-cleaned.ustx` and `prototype-review.json`. Node core tests compare against these independent reference files; a required native-fixture test cannot silently skip in this phase.

The actual packaged browser receives the original file through its real input, selects the explicit 37-change policy through controls, acknowledges the review and downloads `cleaned.ustx` plus `review.json`. These are the sole files consumed by the official native verifier. No direct converter API call or Python output substitutes for the browser download.

The unchanged production YAML deserializer checks that file before AddDefaultExpressions/AfterLoad/validation can normalize settings. Full raw/canonical/typed equality outside the 37 intended changes remains mandatory. Normal official Load/Save/fresh Load then verifies retained musical state, with only the already documented phonemizer normalization. Two real corrupted USTX files traverse the same production prevalidation boundary and must fail the same retained-state oracle.

A separate actual native precision probe reads the exact decimal `1.000000059604644775390625` and its rounded spelling `1.0000000596046448` in a retained PitchPoint.Y. The unchanged production deserializer must produce float32 bits `3f800000` and `3f800001`, proving the risk rather than assuming JSON-number equality is enough. Both the Python producer and the actual browser file input must reject the unsafe exact spelling before any output. This regression is independent of the integer-valued positive fixture. Source hashes cover the complete browser testing/export phase, and fresh native saves must be byte-identical.

An additional independent browser/Python check compares complete semantic output, the exact policy and all affected-value records, actual download digests, zero-change bytes, repeated-download identity and the shipped offline files. Both browser launches must retain sandboxing.

## Browser and visual evidence

The actual browser test covers Japanese/English labels and errors, keyboard skip/sample/acknowledgment/selection and real file-chooser activation, no automatic cleanup, independent categories, repeated inputs/downloads, empty changes, malformed YAML, missing/unsupported kinds, aliases/duplicates/wave references, size-before-read rejection and literal script-looking text. It instruments asynchronous completion delays to verify newer-input and Clear behavior, and to prove that an in-flight export cannot populate a stale conversion cache after a policy change. It does not claim operating-system picker-cancellation coverage.

Pagination must expose all rows, and print must restore the complete list. The 2,000-change cap must recover when choices are reduced. Retained evidence includes JA/EN desktop and 390px views, a mobile view whose actual rightmost diff column is fully visible after scrolling, complete Japanese and English print PNG/PDFs, and the real native-policy review. Console/page errors and HTTP requests must be empty. Screenshots and rendered PDF pages require independent visual inspection.

Delivery is GitHub source plus a ready-to-open offline ZIP. There is no Pages/Sites deployment or hosted-service requirement. Responsive views do not certify every mobile browser or file picker. Original native proof and new browser proof are retained separately.
