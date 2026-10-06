# Native/API feasibility verification

## Exact result

**Passed for this Python prototype against official OpenUtau `0.1.572.3-alpha` and USTX `0.10`.** No browser UI, GUI interaction, voicebank rendering or audio-equivalence result is claimed.

- Producer commit: `d3f8d4f39aeac95c4a1ccf860bbf10bfb84699cd`
- [Successful run 37546077577](https://github.com/Masanori-Spec/voice-slate/actions/runs/37546077577), completed 2026-10-06
- [Native artifact 11451071339](https://github.com/Masanori-Spec/voice-slate/actions/runs/37546077577/artifacts/11451071339): 24 files, 32,684 bytes
- Actual downloaded proof ZIP SHA-256: `8342aee28160213b25f8be09d77276cfd1a11ef86d016734826c2e19b99fb0de`
- Native-authored input SHA-256: `f1802201c4844f8efa7c57ea753930a09ae624211dd25099f31aa32861cd75a3`
- Actual cleaned USTX SHA-256: `25b2948a5abe2e22e40f5ee8d061b1f8227e007d845f0f7c0e8f97738c621c35`

The official release archive matched its pinned 328,302,323-byte size and SHA-256 before extraction. The loaded `OpenUtau.Core.dll` SHA-256 was `105cdfa0d73c3ace161801f2564a170a7493fadae9c2dc26b524db40d73aed19`; `YamlDotNet.dll` was `b2c3c891dba016c3826c4970a8c6813ef295ad15631aaaee47437b797bf5647b`. Both remained unchanged after execution. The hosted runtime used Ubuntu 24.04, .NET SDK 10.0.401 and runtime host 10.0.12. No vendor source was built or patched.

GitHub artifacts expire after 14 days. Exact source and proof are retained in separate private backups. The public source and retained evidence contain no vendor runtime, voicebank, real user project or original-code license grant.

## Actual production path

Official `Ustx.Create`, `UTrack`, `UNote`, expression objects and `Ustx.Save` authored the input. Unchanged official ClassicSinger/Voicebank metadata objects supplied synthetic IDs only on the authoring/Save path; they were never loaded or rendered. This is API authoring, not GUI authoring or a fake singer subclass.

The separate Python prototype applied the explicit policy to those actual native bytes. Raw-data comparison and the unchanged production YAML deserializer then checked the cleaned file **before** native default-expression registration, AfterLoad or validation. This proved that singer IDs and renderer/resampler/wavtool fields were already absent, instead of relying on the consumer's missing-singer cleanup.

Normal `Ustx.Load` accepted that output, `Ustx.Save` wrote a fresh file, and a fresh Load restored the same typed snapshot. A second native save was byte-identical to the first. The only snapshot normalization was the known consumption of the serialized phonemizer name into the runtime object during AfterLoad; Save restored the same type string. No retained musical field difference was ignored.

## Independent preservation and controls

All 17 prototype tests passed in hosted CI. The independent oracle checked the full document and the exact 37 permitted changes across two tracks, three separated parts and six notes. Original timing maps, lyrics, pitch, vibrato, tuning, expression definitions, track-local definitions, volume/pan, names/comments and every unselected value remained.

| Note | Relative tick | Duration | Tone | Lyric | Tuning |
| --- | ---: | ---: | ---: | --- | ---: |
| Part 1 / 1 | 0 | 240 | 60 | あ | 0 |
| Part 1 / 2 | 600 | 360 | 61 | null (literal text) | 12 |
| Part 2 / 1 | 0 | 240 | 62 | 雪 | 24 |
| Part 2 / 2 | 600 | 360 | 63 | la | 36 |
| Part 3 / 1 | 0 | 240 | 64 | echo | 48 |
| Part 3 / 2 | 600 | 360 | 65 | 終 | 60 |

All three pitch points per note, explicit vibrato parameters, retained `vel`/`vsl` values and `brec`/`pitd` curves matched the handwritten expected data. Project and track expression definitions remained complete, so the native loader did not silently drop unresolved entries. Part positions/durations and source boundaries were unchanged.

Two actual corrupted USTX files went through the same production deserializer and typed snapshot capture: one changed a retained pitch Y, and the other removed an unselected breath curve. Both failed the same full-output/native-state comparison used for the accepted file. The affected-value review contained exactly the 37 expected original paths/values. Original input hashes were identical before and after processing.

The downloaded proof digest, actual raw and typed files, both precise corruption differences, source/output hashes and byte-identical native saves were independently inspected.

## Scope

This establishes selective settings-copy feasibility for the pinned alpha version and bounded voice-only input. It does not establish privacy/anonymity, universal voicebank compatibility, audio equivalence, a GUI workflow or a completed browser app. Unselected personal text and settings remain, and the review itself contains affected original values. YAML formatting/comments may change; data-value preservation is the tested contract.

Any future browser producer must be tested with its actual downloaded USTX through the same prevalidation/native/literal checks and actual-file negative controls. A self-consistent replacement parser or a substituted Python output is insufficient.
