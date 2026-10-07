# Offline-browser verification

The actual eight-file offline app passed at commit `3fef55877b3c506f85b9915072257ffb2dcd5c80` in [GitHub Actions run 37552523731](https://github.com/Masanori-Spec/voice-slate/actions/runs/37552523731), completed successfully on 2026-10-07. The raw artifact was downloaded, size/digest/ZIP integrity checked, and its native data and rendered UI evidence independently inspected. This result uses the real browser download as the native input; the Python output is only a separate reference.

## Reproducible identities

| Item | Identity |
| --- | --- |
| Tested offline ZIP | `2993e7355a6d5802aeadea32fe34b02616a4c155fc1900c42d2d575c2c986317` (SHA-256; 151,396 bytes) |
| Actions artifact | `11453178012`, 63 files, 3,129,993 bytes |
| Raw evidence ZIP SHA-256 | `42f633cbf8f8a94187a521821281a76e62bb503b24eb0844ab5de7bd96bdef21` |
| Native original USTX SHA-256 | `f1802201c4844f8efa7c57ea753930a09ae624211dd25099f31aa32861cd75a3` |
| Actual browser USTX SHA-256 | `b23bf2e45a129bc47ab61e31af5f7f9de3314db413b34daee99aae9704421004` |
| Actual review JSON SHA-256 | `25aed31801705f48b651be64d71840a56cd587a45295edb462f8eb49ea835a41` |
| Both native saved files SHA-256 | `d42d9ff01131e2d6b5e867fc3b4e46efedb3c7b1abaaa17f43c2042b029b4833` |

The eight extracted shipped files match `offline-manifest.json` and the tested ZIP byte-for-byte. The pinned js-yaml source and its upstream MIT notice are included; vendor executables and original VoiceSlate license grants are excluded. Actions artifacts have limited retention, so the raw proof is also kept with the release records.

## Actual producer and consumer

The fresh synthetic fixture was authored with the unchanged official OpenUtau `0.1.572.3-alpha` release assemblies, source commit `9fe0e923aac9d14475f1473a7d86d9f042df979d`. The official Linux archive was size/hash verified: 328,302,323 bytes and SHA-256 `f9f7854af0fd2e4d8c8c6416ac86069b6e4e4e264cc73f255f85d9ab215466e2`. The released Core and YamlDotNet DLLs were checked unchanged after execution. The original [native/API proof](VERIFICATION.md) records those pins and the literal fixture in detail.

Sandboxed Chromium opened the extracted offline `index.html` through `file://`. Its actual file input received the fresh USTX; controls selected the fixture policy, acknowledged the review, and downloaded the copy and JSON report. Both browser launches retained their sandbox and made no HTTP requests. No converter API invocation or Python-generated copy substituted for these downloads.

The actual copy has exactly the intended 37 effects across two tracks, three separated parts and six notes. Its full raw data, exact affected-value report, native prevalidation snapshots and canonical serialization agree with the independent literal oracle. All other musical data and expression definitions remain, including original part boundaries, timing, lyrics, note pitch points, vibrato and unselected expressions/curves. The original file hash stayed unchanged throughout browser testing and export.

The production YAML deserializer inspected the output before native validation could clear missing-singer bindings. Normal `Ustx.Load`, `Ustx.Save` and fresh Load then passed; the two fresh saves are byte-identical. The known normalization is limited to the track phonemizer name being consumed into its runtime object and restored on Save. Two real corrupted USTX files, containing one changed retained pitch point or one deleted unselected breath curve, traversed the same production deserializer and failed the same retained-state oracle.

## Numeric precision regression

The official deserializer read retained PitchPoint.Y spellings `1.000000059604644775390625` and `1.0000000596046448` as different float32 values: bits `3f800000` and `3f800001`. The exact input SHA-256 is `518a0e916d543ee2fabfc1fd74649d8000ae230636a3c4f733ccc2f2795735aa`; the rounded input is `6e3e717c57cba67ddbf98d027f36c791094617c6828131e041838a7de60fa320`.

Both independent producers rejected the unsupported exact spelling before output, including through the real browser file input. This fail-closed rule compares exact decimal value with serialization, rather than relying on equal JavaScript/Python floating-point values. The ordinary positive fixture and all unselected musical-state checks also passed.

## UI and visual review

The accepted run passed 18 Python tests, 20 JavaScript tests against the fresh native fixture, and 24 actual browser scenarios. Coverage includes explicit independent selections, all 37 before/after records, acknowledgment reset, real keyboard file-chooser activation, repeated same-file selection, exact no-op copies, deterministic repeated downloads, unsupported inputs, size-before-read limits, literal text, late reads, Clear, explicit empty input changes and stale export/cache rejection. OS-picker cancellation is not claimed.

An 82-row case proves pagination and complete print expansion; a 2,035-change case proves the 2,000-change UI limit and recovery. JA/EN desktop and 390px layouts remain readable, with the entire rightmost diff column measured and shown after horizontal scrolling. Japanese and English PDFs each contain six pages: all 37 affected values, original part structure and sharing limits are present. All twelve rendered pages were visually inspected. Print statistics remain on one line in both languages. Browser console/page errors and HTTP-request logs are empty.

## Scope

This is fixture-based verification of the pinned alpha's bounded voice-only USTX 0.10 subset, using its production API and serializer. It is not native GUI, voicebank, singing/audio-equivalence, anonymization or universal compatibility certification. Wave parts and unsupported YAML/precision are rejected. Names, lyrics, comments and unselected settings remain; the review itself exposes affected original values. Changed YAML formatting/comments are not retained. Delivery is public source and a local offline ZIP, with no hosting service required.
