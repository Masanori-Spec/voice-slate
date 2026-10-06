# VoiceSlate: selective USTX sharing preparation

**Native/API feasibility passed for official OpenUtau `0.1.572.3-alpha`, USTX `0.10`, voice parts only.** This source prototype has no browser UI, GUI or audio verification claim.

[Successful native run](https://github.com/Masanori-Spec/voice-slate/actions/runs/37546077577) · [Exact evidence and limits](docs/VERIFICATION.md)

VoiceSlate prepares a separate USTX copy by clearing explicitly selected project-wide settings: singer IDs, renderer/resampler/wavtool bindings, track colors, chosen phoneme-override fields, chosen per-note expression values and chosen curves. It keeps original part boundaries, note positions/durations, lyrics, pitch points, vibrato, expression definitions and every unselected data value. YAML formatting/comments are not preserved when changes are made.

This is a modest sharing-preparation utility. OpenUtau already has **Reset All**, which can reset a part's pitch, vibrato, phoneme timings/aliases, expressions and curves. Format converters also support USTX. This candidate focuses on reviewing selected settings across the existing project while keeping its other musical data, rather than rebuilding tracks/parts. See [demand and existing tools](docs/SOURCES.md).

It is **not an anonymizer, privacy guarantee or voicebank-compatibility fixer**. Names, lyrics, comments and unselected settings remain in the copy. The review contains affected original values and may itself include information the user does not want to share. No singing synthesis or audio-equivalence claim is made.

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

The independent prototype processes that actual native file. The gate checks **raw output and the production YAML deserializer before any native validation**, then separately runs normal `Ustx.Load`, `Ustx.Save`, and fresh reopen. This ordering matters: OpenUtau clears renderer bindings for missing singers during validation, which could otherwise hide a cleaner bug. A literal oracle checks all retained musical data, complete raw-document equality outside the 37 selected fixture changes, definition preservation, unchanged original bytes and actual corrupted-file controls. [Full contract](docs/TEST-DESIGN.md)

The native gate passed at `d3f8d4f39aeac95c4a1ccf860bbf10bfb84699cd`. Its actual cleaned file, prevalidation snapshots, byte-identical native saves and corruption controls are recorded in [VERIFICATION.md](docs/VERIFICATION.md). A future browser producer must pass again using its own real downloaded USTX; this prototype result does not pre-approve a different implementation.

## Input scope and distribution

The prototype accepts UTF-8, single-document USTX 0.10 with voice parts. Limits: 8 MiB input/output, 250,000 YAML events, depth 32, 65,536 characters per scalar, 64 tracks, 256 parts and 10,000 notes. Absolute part ends must fit native signed 32-bit integers. Aliases, anchors, directives, duplicate/nonstring keys, nonfinite numbers, unresolved expressions, malformed timing/note data and wave parts are rejected. Supported scalar interpretation follows YAML 1.2 for on/off/yes/no and date-looking strings; nondecimal, sexagesimal and leading-zero integer spellings are rejected to avoid YAML 1.1 ambiguity.

Only source and synthetic test code are distributed. No OpenUtau/.NET binaries, voicebanks, real projects, original-code license grant, hosting setup or paid service is included. Official binaries are downloaded only into ignored hosted-CI scratch space; the retained evidence excludes them.
