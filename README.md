# VoiceSlate: selective USTX sharing preparation

**Offline Japanese/English sharing-preparation app for official OpenUtau `0.1.572.3-alpha`, USTX `0.10`, voice parts only.** Actual packaged-browser downloads passed the pinned production deserializer, native save/reopen, independent retained-state checks and JA/EN visual review. No native GUI or audio verification is claimed.

[Successful browser/native run](https://github.com/Masanori-Spec/voice-slate/actions/runs/37552523731) · [Exact browser evidence and limits](docs/UI-VERIFICATION.md) · [Earlier Python/native proof](docs/VERIFICATION.md)

VoiceSlate prepares a separate USTX copy by clearing explicitly selected project-wide settings: singer IDs, renderer/resampler/wavtool bindings, track colors, chosen phoneme-override fields, chosen per-note expression values and chosen curves. It keeps original part boundaries, note positions/durations, lyrics, note pitch points, vibrato, expression definitions and every unselected data value. YAML formatting/comments are not preserved when changes are made.

This is a modest sharing-preparation utility. OpenUtau already has **Reset All**, which can reset a part's pitch, vibrato, phoneme timings/aliases, expressions and curves. Format converters also support USTX. VoiceSlate focuses on reviewing selected settings across the existing project while keeping its other musical data, rather than rebuilding tracks/parts. See [demand and existing tools](docs/SOURCES.md).

It is **not an anonymizer, privacy guarantee or voicebank-compatibility fixer**. Names, lyrics, comments and unselected settings remain in the copy. The review contains affected original values and may itself include information the user does not want to share. No singing synthesis or audio-equivalence claim is made.

## Open the offline app

Extract [voice-slate-offline.zip](voice-slate-offline.zip) and open `index.html` in desktop Chrome/Chromium. Choose one saved `.ustx` file. Nothing is selected automatically. Choose settings, inspect affected original values and counts, then acknowledge the review before exporting a separate USTX copy. Input and policy changes invalidate acknowledgment; Clear and newer input cancel late reads, and policy changes cancel pending exports.

The review is paged in groups of 50 rows; JSON and print include every affected row. Track/part/note totals are separate from affected counts. The original part structure remains visible. The screen supports up to 2,000 selected changes per review; larger selections block the USTX copy until reduced. A JSON preview can still be downloaded without acknowledgment. No selection produces an exact byte copy.

The app reads only the supplied file and uses no account, storage, credentials or background network requests. Source text and affected values are inserted as literal text. A restrictive local-file CSP limits execution to the packaged scripts. The offline package includes js-yaml 5.4.2 JavaScript source and its upstream MIT notice; no original VoiceSlate license grant is added. See [browser acceptance](docs/BROWSER-ACCEPTANCE.md).

## Prototype

Python 3.11+ on Linux, with `PyYAML==6.0.3` installed from the official PyPI registry:

```sh
python3 -m pip install -r requirements.txt
python3 -m voice_slate source.ustx copy.ustx --policy scripts/policy.json --report preview.json --review-only
python3 -m voice_slate source.ustx copy.ustx --policy scripts/policy.json --report applied.json --acknowledge
```

Use your own explicit policy after reading the affected-value preview. The included policy belongs to the synthetic verification fixture; it is not a recommendation for every project. Existing output/report files are refused. Inputs are read-only and must be regular, nonsymlink files. No input path mentioned inside the YAML is opened. `--review-only` writes the report without a USTX copy; `--acknowledge` explicitly permits the selected copy operation. No selected changes returns byte-identical input.

The policy's independent boolean choices are `singer`, `render`, and `trackColor`; the last restores the native default `Blue`. `phonemeOverrideFields` may contain `phoneme`, `offset`, `preutter_delta`, `overlap_delta`, `attack_time_delta`, and `release_time_delta`. `phonemeExpressions` and `curves` select existing expression abbreviations. All choices apply across the project. Definitions, phonemizer names, project names/comments, volumes/pans and unselected expression data remain.

## Required official consumer gate

Hosted CI downloads the exact official Linux release and verifies its size/SHA-256 before using its unchanged production assemblies. A small .NET 10 harness creates a synthetic two-track, three-part, six-note project through the official classes and `Ustx.Save`. It does not build or patch OpenUtau, invent a replacement consumer, or claim GUI testing.

The independent Python prototype supplies a reference result. The packaged browser processes the actual native file through its file input and explicit controls; its real downloaded USTX and review are the files consumed by the gate. The gate checks **raw output and the production YAML deserializer before any native validation**, then separately runs normal `Ustx.Load`, `Ustx.Save`, and fresh reopen. This ordering matters: OpenUtau clears renderer bindings for missing singers during validation, which could otherwise hide a cleaner bug. A literal oracle checks all retained musical data, complete raw-document equality outside the 37 selected fixture changes, definition preservation, unchanged original bytes and actual corrupted-file controls. [Full contract](docs/TEST-DESIGN.md)

The browser/native gate passed at `3fef55877b3c506f85b9915072257ffb2dcd5c80`. Its actual downloads, prevalidation snapshots, byte-identical native saves, corruption controls and visual evidence are recorded in [UI-VERIFICATION.md](docs/UI-VERIFICATION.md). The earlier independent Python/native proof remains in [VERIFICATION.md](docs/VERIFICATION.md). Changes to either producer must satisfy the same gate again.

## Input scope and distribution

The readers accept a bounded UTF-8, single-document USTX 0.10 voice-part subset. Limits: 8 MiB input/output, 250,000 YAML events, depth 32, 65,536 characters per scalar, 64 tracks, 256 parts and 10,000 notes. Absolute part ends must fit native signed 32-bit integers. Aliases, anchors, directives, duplicate/nonstring keys, nonfinite numbers, unresolved expressions, malformed timing/note data and wave parts are rejected. Supported scalar interpretation follows YAML 1.2 for on/off/yes/no and date-looking strings; nondecimal, sexagesimal and leading-zero integer spellings are rejected to avoid YAML 1.1 ambiguity. Numbers whose exact decimal value cannot survive the producer’s serialization are rejected before any output. This prevents a rounded decimal spelling from changing the native consumer’s float32 pitch value.

Only source, the pinned js-yaml source/notice and synthetic test code are distributed. No OpenUtau/.NET binaries, voicebanks, real projects, original-code license grant, hosting setup or paid service is included. Official binaries are downloaded only into ignored hosted-CI scratch space; the retained evidence excludes them.

The browser implementation is independent of the Python cleaner. The accepted hosted run passed 20 JavaScript tests, 18 Python tests and 24 actual browser scenarios. It also proved the float32 decimal-boundary risk in the official deserializer and rejected that unsupported input before browser output. JA/EN desktop, 390px layouts and all twelve rendered print pages were inspected. This is bounded fixture evidence for the pinned alpha, not a claim about every USTX project or browser.
