# Primary sources and scope

## Demand and modest difference

- [OpenUtau issue #1417](https://github.com/openutau/OpenUtau/issues/1417), created 2025-02-13 and updated 2026-06-21, requests easier clearing of voicebanks, resamplers, track colors and expression settings before sharing.
- [Native ResetBatchEdits](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Editing/ResetBatchEdits.cs) already provides Reset All and narrower reset operations. Reset All takes one voice part and resets pitch, vibrato, phoneme data, expressions and curves. VoiceSlate must not be presented as the first way to reset tuning.
- [UtaFormatix's USTX writer](https://github.com/sdercolin/utaformatix3/blob/f3c83354f57894492410bbc5ba03f7e97169c92c/core/src/main/kotlin/core/io/Ustx.kt) is a useful format converter which generates parts and tuning from its own model.
- [LibreSVIP's USTX generator](https://github.com/SoulMelody/LibreSVIP/blob/e0476b3d9d7e80511c8df0d8e930c4961d8c2f97/libresvip/plugins/ustx/ustx_generator.py) also constructs output parts and note tuning. The proposed distinction is selective preparation of an existing project, retaining its original boundaries and unselected values.

This is a small workflow utility, not a new editing/synthesis category or a privacy-redaction product. Upstream improvements may make it unnecessary.

## Exact official version

- [OpenUtau 0.1.572.3-alpha release](https://github.com/openutau/OpenUtau/releases/tag/0.1.572.3-alpha), published 2026-10-06T12:24:05Z. It is explicitly an alpha.
- Tag commit: `9fe0e923aac9d14475f1473a7d86d9f042df979d`
- [Official Linux x64 archive](https://github.com/openutau/OpenUtau/releases/download/0.1.572.3-alpha/OpenUtau-linux-x64.tar.gz), asset `615446735`, 328,302,323 bytes
- Release API SHA-256: `f9f7854af0fd2e4d8c8c6416ac86069b6e4e4e264cc73f255f85d9ab215466e2`
- [Release API](https://api.github.com/repos/openutau/OpenUtau/releases/tags/0.1.572.3-alpha) and [tag API](https://api.github.com/repos/openutau/OpenUtau/git/ref/tags/0.1.572.3-alpha) were independently checked before publication. Binary verification/execution occurs in the hosted gate.

The pinned application targets .NET 10. Its production YAML dependency is YamlDotNet 15.1.2. [Core project file](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/OpenUtau.Core.csproj)

## Consumer behavior that governs acceptance

- [USTx.cs](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Format/USTx.cs) defines current format 0.10. Save calls native BeforeSave and the production serializer. Load calls the production deserializer, default-expression registration, AfterLoad and ValidateFull.
- [Production YAML configuration](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Util/Yaml.cs) uses underscore naming and ignores unmatched properties on native deserialization. That makes independent raw-document comparison necessary.
- [UTrack.cs](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Ustx/UTrack.cs) clears renderer/resampler/wavtool values when the singer is absent or missing. BeforeSave derives singer ID and phonemizer type from runtime objects; AfterLoad consumes the serialized phonemizer name.
- [UNote.cs](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Ustx/UNote.cs) drops unresolved expression overrides, clamps too-short durations, and rewrites the first pitch Y when `snap_first` is true. The fixture uses resolved definitions, valid durations and `snap_first:false` pitch sentinels.
- [UPart.cs](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Ustx/UPart.cs) expands too-short parts and drops unresolved curves. Valid long-enough part durations and all required definitions are retained.
- [UProject.cs](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Ustx/UProject.cs) sorts serialized parts by track/position. The fixture and oracle use that native order.
- [ClassicSinger constructor](https://github.com/openutau/OpenUtau/blob/9fe0e923aac9d14475f1473a7d86d9f042df979d/OpenUtau.Core/Classic/ClassicSinger.cs) stores the supplied official Voicebank metadata object; this provides a synthetic ID on the authoring/Save path. No singer is loaded, synthesized or substituted with a test subclass. The IDs are removed before normal native Load.
- [YamlDotNet SerializerBuilder](https://github.com/aaubry/YamlDotNet/blob/v15.1.2/YamlDotNet/Serialization/SerializerBuilder.cs) defaults `WithQuotingNecessaryStrings` to YAML 1.2 string handling. Plain on/off options remain strings; a YAML 1.1 reader must not silently turn them into booleans.

## Browser YAML source dependency

The offline candidate uses **js-yaml 5.4.2**, [tag commit `494400bd45cad078123cfc057e674a9a0a8d9983`](https://github.com/nodeca/js-yaml/tree/494400bd45cad078123cfc057e674a9a0a8d9983), released 2026-09-13. [Upstream changelog](https://github.com/nodeca/js-yaml/blob/494400bd45cad078123cfc057e674a9a0a8d9983/CHANGELOG.md) records its parsing and security fixes. The npm registry tarball was retrieved from `https://registry.npmjs.org/js-yaml/-/js-yaml-5.4.2.tgz` and verified against registry SHA-512 `m+aqu+LwO1O6sIopafj8HUVl5aawITwZQe/yHpMCKjaWBaA/d07B/QdMb3529REftiU+RMMHL3Vlsw3hON7vWg==`.

The exact upstream browser UMD source and MIT notice are shipped unchanged. Their hashes are in `vendor-manifest.json`; the notice applies to that dependency only. No original VoiceSlate code license grant is supplied. VoiceSlate uses the library's CORE_SCHEMA, bounded-depth event parser and construction API with aliases disabled, then applies its own stricter event/scalar/schema/policy checks. It never enables YAML merge or executable/custom object tags. The offline package needs no dependency download at launch.
