// Hosted native API gate against unchanged assemblies from the pinned release.
// This is not a GUI test or voicebank/audio-rendering test.
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using OpenUtau.Core;
using OpenUtau.Core.Format;
using OpenUtau.Core.Ustx;
using OpenUtau.Classic;

static class Gate {
    static readonly JsonSerializerOptions Json = new() { WriteIndented = true };
    static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    static void Fresh(string path) { Require(!File.Exists(path), "Refuse stale output: " + path); }
    static void Write(string path, string text) { Fresh(path); File.WriteAllText(path, text, new UTF8Encoding(false)); }
    static void Save(string path, UProject project) {
        Fresh(path); Ustx.Save(path, project);
        Require(File.Exists(path) && new FileInfo(path).Length > 0 && project.Saved, "Official Ustx.Save did not produce a file");
        Require(project.FilePath == path, "Native save path mismatch");
    }
    static List<UVoicePart> Parts(UProject p) => p.voiceParts ?? p.parts.OfType<UVoicePart>().ToList();
    static object Snapshot(UProject p) => new {
        version = p.ustxVersion.ToString(), p.name, p.comment, p.outputDir, p.cacheDir, p.key,
        tempos = p.tempos.Select(x => new { x.position, x.bpm }).ToArray(),
        meters = p.timeSignatures.Select(x => new { x.barPosition, x.beatPerBar, x.beatUnit }).ToArray(),
        expressionDefinitions = Yaml.DefaultSerializer.Serialize(p.expressions),
        p.expSelectors, p.expPrimary, p.expSecondary,
        tracks = p.tracks.Select(t => new {
            t.TrackName, t.TrackColor, t.singer, t.phonemizer, t.Volume, t.Pan, t.Mute, t.Solo,
            renderer = t.RendererSettings.renderer, resampler = t.RendererSettings.resampler, wavtool = t.RendererSettings.wavtool,
            trackExpressions = Yaml.DefaultSerializer.Serialize(t.TrackExpressions), t.VoiceColorNames,
        }).ToArray(),
        parts = Parts(p).Select(v => new {
            v.name, v.comment, v.trackNo, v.position, v.duration,
            curves = v.curves.Select(c => new { c.abbr, c.xs, c.ys }).ToArray(),
            maskedCurves = Yaml.DefaultSerializer.Serialize(v.maskedCurves),
            notes = v.notes.Select(n => new {
                n.position, n.duration, n.tone, n.lyric, n.tuning, n.PhonemizerOverride,
                pitch = n.pitch.data.Select(q => new { x = q.X, y = q.Y, shape = q.shape.ToString() }).ToArray(),
                n.pitch.snapFirst,
                vibrato = new { n.vibrato.length, n.vibrato.period, n.vibrato.depth, fadeIn = n.vibrato.@in, fadeOut = n.vibrato.@out, n.vibrato.shift, n.vibrato.drift, n.vibrato.volLink },
                expressions = n.phonemeExpressions.Select(e => new { e.index, e.abbr, e.value }).ToArray(),
                overrides = n.phonemeOverrides.Select(o => new { o.index, o.phoneme, o.offset, o.preutterDelta, o.overlapDelta, o.attackTimeDelta, o.releaseTimeDelta }).ToArray(),
            }).ToArray(),
        }).ToArray(),
    };
    static void Capture(string dir, string name, UProject p) => Write(Path.Combine(dir, name + ".json"), JsonSerializer.Serialize(Snapshot(p), Json) + "\n");

    static UProject Fixture() {
        var p = Ustx.Create();
        p.name = "VoiceSlate Native Fixture"; p.comment = "Synthetic values remain unless selected"; p.key = 3;
        p.tempos = [new UTempo(0, 137), new UTempo(1920, 149)];
        p.timeSignatures = [new UTimeSignature(0, 4, 4), new UTimeSignature(2, 3, 4)];
        p.expressions[Ustx.CLR] = new UExpressionDescriptor("voice color", Ustx.CLR, false, ["", "Warm", "Soft"]);
        p.tracks.Clear();
        for (int i = 0; i < 2; i++) {
            var t = new UTrack(i == 0 ? "Lead α" : "Harmony 雪") {
                TrackColor = i == 0 ? "Orange" : "Purple",
                // Official metadata objects only; never loaded or validated.
                // USinger.CreateMissing has no Id and cannot author this field.
                Singer = new ClassicSinger(new Voicebank { Id = "VoiceSlate Missing " + i, Name = "Synthetic metadata " + i }),
                Volume = -3.5 + i, Pan = i == 0 ? -0.2 : 0.3,
                RendererSettings = new URenderSettings { renderer = "SYNTHETIC_RENDERER_" + i, resampler = "SYNTHETIC_RESAMPLER_" + i, wavtool = "SYNTHETIC_WAVTOOL_" + i },
            };
            t.TrackExpressions.Add(new UExpressionDescriptor("local retained", "vsl", 0, 100, 5));
            p.tracks.Add(t);
        }
        var positions = new[] { 0, 3840, 960 };
        var trackNos = new[] { 0, 0, 1 };
        var lyrics = new[] { "あ", "null", "雪", "la", "echo", "終" };
        for (int pi = 0; pi < 3; pi++) {
            var part = new UVoicePart { name = "Part " + (pi + 1), comment = "Retained part " + pi, trackNo = trackNos[pi], position = positions[pi], duration = 1920 };
            for (int ni = 0; ni < 2; ni++) {
                int i = pi * 2 + ni;
                var n = UNote.Create(); n.position = ni == 0 ? 0 : 600; n.duration = ni == 0 ? 240 : 360; n.tone = 60 + i; n.lyric = lyrics[i]; n.tuning = 12 * i;
                n.pitch.snapFirst = false;
                n.pitch.AddPoint(new PitchPoint(-25, 3 + i)); n.pitch.AddPoint(new PitchPoint(5, -2 - i)); n.pitch.AddPoint(new PitchPoint(80, 1 + i));
                n.vibrato = new UVibrato { length = 55, period = 173, depth = 33, @in = 12, @out = 17, shift = 23, drift = -5, volLink = 15 };
                foreach (var (abbr, value) in new[] { ("clr", 1f), ("gen", 20f + i), ("vel", 110f + i) })
                    n.phonemeExpressions.Add(new UExpression(p.expressions[abbr]) { index = 0, value = value });
                n.phonemeExpressions.Add(new UExpression(p.tracks[part.trackNo].TrackExpressions[0]) { index = 0, value = 7 + i });
                n.phonemeOverrides.Add(new UPhonemeOverride { index = 0, phoneme = "custom-" + i, offset = 12 + i, preutterDelta = 5, overlapDelta = -3, attackTimeDelta = 2, releaseTimeDelta = -1 });
                part.notes.Add(n);
            }
            foreach (var abbr in new[] { "dyn", "brec", "pitd" }) {
                var c = new UCurve(p.expressions[abbr]); c.xs.AddRange([0, 240, 600]);
                c.ys.AddRange(abbr == "dyn" ? [0, -10 - pi, 0] : abbr == "brec" ? [5, 10 + pi, 5] : [0, 30 + pi, -10]);
                part.curves.Add(c);
            }
            p.parts.Add(part);
        }
        return p;
    }

    static void AssertClean(UProject p) {
        Require(p.tracks.Count == 2 && Parts(p).Count == 3, "Native structure changed");
        foreach (var t in p.tracks) {
            Require(t.singer == null, "Singer was not cleared before validation");
            Require(t.RendererSettings.renderer == null && t.RendererSettings.resampler == null && t.RendererSettings.wavtool == null, "Renderer fields were not cleared before validation");
            Require(t.TrackColor == "Blue", "Track color was not reset");
        }
        foreach (var v in Parts(p)) {
            Require(v.curves.Count == 2 && v.curves.All(c => c.abbr != "dyn"), "Selected curve remains");
            foreach (var n in v.notes) {
                Require(n.phonemeExpressions.Count == 2 && n.phonemeExpressions.All(e => e.abbr != "gen" && e.abbr != "clr"), "Selected note expression remains");
                Require(n.phonemeOverrides.Count == 1 && n.phonemeOverrides[0].phoneme == null && n.phonemeOverrides[0].preutterDelta == null, "Selected phoneme fields remain");
            }
        }
    }

    public static void Main(string[] args) {
        Require(args.Length == 2, "Usage: NativeGate author|verify EVIDENCE_DIR");
        var dir = Path.GetFullPath(args[1]); Directory.CreateDirectory(dir);
        var assembly = typeof(UProject).Assembly;
        Require(Ustx.kUstxVersion.ToString() == "0.10", "Wrong official USTX version");
        var identity = new { assembly = assembly.GetName().Name, location = assembly.Location, sha256 = Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(assembly.Location))).ToLowerInvariant(), sourceCommit = "9fe0e923aac9d14475f1473a7d86d9f042df979d", applicationRelease = "0.1.572.3-alpha" };
        if (args[0] == "author") {
            Write(Path.Combine(dir, "official-assembly.json"), JsonSerializer.Serialize(identity, Json));
            var input = Path.Combine(dir, "native-input.ustx"); Save(input, Fixture());
            // Save's production serializer authored the actual input. Deserialize
            // it directly; do not normalize away synthetic bindings with Load.
            var raw = Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(input));
            Require(raw.tracks.All(t => t.singer != null && t.RendererSettings.renderer != null), "Fixture lacks binding sentinels");
            Capture(dir, "native-input-prevalidation", raw);
            Write(Path.Combine(dir, "native-input-canonical.ustx"), Yaml.DefaultSerializer.Serialize(raw));
        } else if (args[0] == "verify") {
            var output = Path.Combine(dir, "cleaned.ustx");
            var raw = Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(output));
            AssertClean(raw); Capture(dir, "native-output-prevalidation", raw);
            Write(Path.Combine(dir, "native-output-canonical.ustx"), Yaml.DefaultSerializer.Serialize(raw));
            // Real corrupted USTX files traverse the identical production
            // deserializer and snapshot boundary. The independent oracle must
            // reject their retained-state mismatch, even though they parse.
            var badPitch = Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(output));
            Parts(badPitch)[0].notes.First().pitch.data[1].Y += 1;
            var pitchPath = Path.Combine(dir, "negative-pitch.ustx");
            Write(pitchPath, Yaml.DefaultSerializer.Serialize(badPitch));
            Capture(dir, "negative-pitch-prevalidation", Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(pitchPath)));
            var badCurve = Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(output));
            Parts(badCurve)[2].curves.RemoveAt(0);
            var curvePath = Path.Combine(dir, "negative-curve.ustx");
            Write(curvePath, Yaml.DefaultSerializer.Serialize(badCurve));
            Capture(dir, "negative-curve-prevalidation", Yaml.DefaultDeserializer.Deserialize<UProject>(File.ReadAllText(curvePath)));
            var loaded = Ustx.Load(output); AssertClean(loaded); Capture(dir, "native-loaded", loaded);
            var saved = Path.Combine(dir, "native-saved.ustx"); Save(saved, loaded);
            var reopened = Ustx.Load(saved); AssertClean(reopened); Capture(dir, "native-reopened", reopened);
            var fresh = Path.Combine(dir, "native-reopened-saved.ustx"); Save(fresh, reopened);
            Write(Path.Combine(dir, "native-result.json"), JsonSerializer.Serialize(new { status = "pass", consumer = "Unmodified official release UProject/UNote, production YAML deserializer before validation, Ustx.Load/Save/fresh Load", guiTest = false, audioTest = false, identity }, Json));
        } else throw new Exception("Unknown native gate mode");
    }
}
