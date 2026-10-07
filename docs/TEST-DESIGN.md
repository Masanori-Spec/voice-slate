# Mandatory native-first contract

## Original native fixture

The unchanged official release classes author `native-input.ustx` through `Ustx.Create`, `UTrack`, `UNote`, `UVoicePart`, native expression objects and `Ustx.Save`. The fixture has two tracks, three separated voice parts and six notes. There is no hand-written native project substitute.

Track names are `Lead α` and `Harmony 雪`, with synthetic singer IDs, renderer/resampler/wavtool strings, different colors and retained volume/pan values. Official ClassicSinger/Voicebank metadata objects provide the IDs only while saving. No voicebank is installed or loaded and no audio runs. Base `USinger.CreateMissing` has no Id, so it cannot author this sentinel through BeforeSave.

The parts are `(track 0, position 0, duration 1920)`, `(track 0, position 3840, duration 1920)` and `(track 1, position 960, duration 1920)`. Each has notes at relative ticks 0 and 600, lasting 240 and 360 ticks. Six literal notes use tones 60–65, Japanese and literal `null` lyrics, nonzero tuning, three pitch points with `snap_first:false`, and explicit vibrato. Tempos are 137 BPM at tick 0 and 149 at 1920; meters are 4/4 at bar 0 and 3/4 at bar 2.

Every note has selected `clr`/`gen` overrides and retained `vel`/track-local `vsl` overrides. Every part has selected `dyn` and retained `brec`/`pitd` curves. The full default and track-level expression definitions remain. Each phoneme override has an alias and preutterance delta to clear, while offset, overlap, attack and release deltas remain.

The explicit fixture policy produces 37 changes: two singer IDs, six renderer bindings, two colors, twelve per-note expression entries, twelve phoneme fields and three curves. The affected-value report must list exactly these original paths and values.

## Independent boundaries

1. The prototype transforms the actual native-authored input. Its original bytes are hashed before and after; the source is never written.
2. A separate Python oracle, importing neither the prototype nor fixture author, checks literal note/part/timing values and exact raw-data equality outside the hardcoded chosen paths. It uses its own BaseLoader/scalar interpretation for the fixed evidence, preserving YAML 1.2 strings.
3. The official production `Yaml.DefaultDeserializer.Deserialize<UProject>` consumes output **before** AddDefaultExpressions, AfterLoad or ValidateFull. Full native snapshots and canonical serialization must show the selected fields already cleared and all unselected musical state retained. Native missing-singer normalization cannot substitute for this test.
4. Normal official `Ustx.Load` then `Ustx.Save` and a fresh Load consume the same actual output. A second native save must be byte-identical. Expected normalization is limited to consuming the serialized track phonemizer field into its runtime object on Load; Save restores that unchanged default type. No retained pitch, vibrato, duration, curve, definition or layout difference is silently ignored.
5. Actual corrupted USTX files alter one retained pitch Y or remove an unselected breath curve. Both are read through the identical production deserializer/snapshot path. They must fail the same whole-output/native-state oracle that accepts the real copy, even though the corruptions remain syntactically valid.

The released core and YAML DLL hashes are recorded and checked unchanged after execution. The official release archive is verified against the official API size/digest before extraction. No vendor parser patch, test subclass, monkeypatch, private state setter, GUI simulation or fake native-success flag is used.

## Scope and stopping point

This first gate establishes a bounded native/API feasibility result only. It makes no GUI, browser, voicebank compatibility, audio rendering/equivalence, anonymity or privacy guarantee. All content is synthetic. A browser UI may begin only after actual hosted evidence passes independent inspection. Any future browser producer must pass the same gate using its real downloaded USTX rather than a substituted prototype output.

Local tests cover explicit acknowledgment, category independence, no-op/idempotent copies, complete unselected-value retention, YAML scalar ambiguities/aliases/duplicates/tags, bounds, malformed timing/expressions, CLI exclusivity, source immutability and nonblocking FIFO/symlink rejection. Local prototype tests are not evidence that the native consumer ran.

## Verified native/API outcome

The complete contract passed in [run 37546077577](https://github.com/Masanori-Spec/voice-slate/actions/runs/37546077577) at commit `d3f8d4f39aeac95c4a1ccf860bbf10bfb84699cd`. The downloaded actual evidence, release/DLL pins, source/output hashes, prevalidation state, save/reopen identity and negative files are recorded in [VERIFICATION.md](VERIFICATION.md). This remains an API/serializer feasibility proof, not GUI or browser acceptance.

## Verified offline-browser outcome

After the independent native/API gate, the separate browser implementation passed the same contract using its actual downloaded files in [run 37552523731](https://github.com/Masanori-Spec/voice-slate/actions/runs/37552523731) at `3fef55877b3c506f85b9915072257ffb2dcd5c80`. Python output remained only an independent reference. The pinned eight-file ZIP was extracted and opened through `file://` in sandboxed Chromium; 24 UI scenarios, 20 JavaScript tests and 18 Python tests passed.

The real browser USTX passed raw whole-document, production prevalidation and normal native save/reopen checks. Both actual corrupted-file controls failed the retained-state oracle. An independent native float32 midpoint probe produced different bit patterns for the exact and rounded decimal spellings; both producers rejected the unsupported exact spelling before output. JA/EN desktop/mobile screens and all twelve rendered print pages were inspected, including the repaired one-line print statistics and visible mobile final-column header. [Detailed evidence and limits](UI-VERIFICATION.md)
