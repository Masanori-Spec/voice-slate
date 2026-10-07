'use strict';
// Node coverage for the independent browser producer. No native process or GUI
// is executed here. Hosted browser/native gates verify those separate layers.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const core = require('../web/core.js');
const yaml = require('../web/vendor/js-yaml.umd.min.js');
const encode = value => new TextEncoder().encode(typeof value === 'string' ? value :
  yaml.dump(value, {schema: yaml.CORE_SCHEMA, noRefs: true, forceQuotes: true}));
const decode = value => new TextDecoder().decode(value);
const sha256 = value => createHash('sha256').update(value).digest('hex');

function fixture() {
  return {name: 'Unit 雪', comment: 'Retained project comment', ustx_version: '0.10',
    expressions: Object.fromEntries(['gen', 'vel', 'dyn', 'brec'].map(abbr => [abbr, {abbr, name: abbr}])),
    tempos: [{position: 0, bpm: 137}],
    time_signatures: [{bar_position: 0, beat_per_bar: 4, beat_unit: 4}],
    tracks: [{track_name: 'Lead', singer: 'Synthetic singer', phonemizer: 'Retained phonemizer',
      renderer_settings: {renderer: 'Synthetic renderer', resampler: 'Synthetic resampler', wavtool: 'Synthetic wavtool', retained: 'extension'},
      track_color: 'Orange', track_expressions: [{abbr: 'local', name: 'Retained local descriptor'}], volume: -3.5}],
    voice_parts: [{name: 'Part sentinel', comment: 'Retained part comment', track_no: 0, position: 3840, duration: 1920,
      notes: [{position: 0, duration: 480, tone: 60, lyric: 'null', tuning: 12,
        pitch: {data: [{x: -25, y: 3, shape: 'io'}, {x: 5, y: -2, shape: 'l'}, {x: 80, y: 1, shape: 'o'}], snap_first: false},
        vibrato: {length: 55, period: 173, depth: 33, in: 12, out: 17, shift: 23, drift: -5, vol_link: 15},
        phoneme_expressions: [{index: 0, abbr: 'gen', value: 20}, {index: 0, abbr: 'vel', value: 115}, {index: 0, abbr: 'local', value: 7}],
        phoneme_overrides: [{index: 0, phoneme: 'alias', offset: 12, preutter_delta: 5, overlap_delta: -3,
          attack_time_delta: 2, release_time_delta: -1, retained: 'override extension'}]}],
      curves: [{abbr: 'dyn', xs: [0, 240], ys: [0, -10]}, {abbr: 'brec', xs: [0, 240], ys: [5, 10]}],
      masked_curves: [{abbr: 'dyn', xs: [0], ys: [5]}]}],
    wave_parts: [], unknown_extension: {strings: ['on', 'off', 'yes', 'no', '2020-01-01', '060', '0x40'],
      path: '../../private-file', url: 'https://example.invalid/never-open', nested: [1, false, null]}};
}
const POLICY = {singer: true, render: true, trackColor: true,
  phonemeOverrideFields: ['phoneme', 'preutter_delta'], phonemeExpressions: ['gen'], curves: ['dyn']};

test('selective copy preserves the complete object except literal selected paths', async () => {
  const source = fixture();
  const expected = structuredClone(source);
  delete expected.tracks[0].singer;
  for (const key of ['renderer', 'resampler', 'wavtool']) delete expected.tracks[0].renderer_settings[key];
  expected.tracks[0].track_color = 'Blue';
  delete expected.voice_parts[0].notes[0].phoneme_overrides[0].phoneme;
  delete expected.voice_parts[0].notes[0].phoneme_overrides[0].preutter_delta;
  expected.voice_parts[0].notes[0].phoneme_expressions.splice(0, 1);
  expected.voice_parts[0].curves.splice(0, 1);
  const raw = encode(source), before = new Uint8Array(raw);
  const model = await core.inspect(raw);
  const preview = core.review(model, POLICY);
  assert.deepEqual(preview.outputData, expected);
  assert.deepEqual(preview.counts, {changes: 9, tracks: 1, parts: 1, notes: 1});
  assert.equal(preview.report.acknowledged, false);
  assert.equal(preview.report.outputSha256, undefined);
  assert.match(preview.report.retained, /not anonymization/);
  assert.deepEqual(preview.outputData.expressions, source.expressions);
  assert.deepEqual(preview.outputData.tracks[0].track_expressions, source.tracks[0].track_expressions);
  assert.deepEqual(preview.outputData.voice_parts[0].masked_curves, source.voice_parts[0].masked_curves);
  const result = await core.convert(model, POLICY, {acknowledged: true});
  assert.deepEqual((await core.inspect(result.output)).data, expected);
  assert.deepEqual(raw, before);
  assert.equal(result.report.sourceSha256, sha256(raw));
  assert.equal(result.report.outputSha256, sha256(result.output));
  assert.equal(result.report.acknowledged, true);
  assert.deepEqual(result.report.changes, preview.changes);
});

test('each independent category changes only its explicitly selected fields', async () => {
  const model = await core.inspect(encode(fixture()));
  const cases = [
    [{singer: true}, [['tracks', 0, 'singer']]],
    [{render: true}, ['renderer', 'resampler', 'wavtool'].map(key => ['tracks', 0, 'renderer_settings', key])],
    [{trackColor: true}, [['tracks', 0, 'track_color']]],
    ...core.OVERRIDE_FIELDS.map(key => [{phonemeOverrideFields: [key]}, [['voice_parts', 0, 'notes', 0, 'phoneme_overrides', 0, key]]]),
    [{phonemeExpressions: ['local']}, [['voice_parts', 0, 'notes', 0, 'phoneme_expressions', 2]]],
    [{curves: ['dyn']}, [['voice_parts', 0, 'curves', 0]]]
  ];
  for (const [policy, paths] of cases) {
    const preview = core.review(model, policy);
    assert.deepEqual(preview.changes.map(change => change.path), paths);
    if (!policy.singer) assert.equal(preview.outputData.tracks[0].singer, model.data.tracks[0].singer);
    if (!policy.render) assert.deepEqual(preview.outputData.tracks[0].renderer_settings, model.data.tracks[0].renderer_settings);
    assert.deepEqual(preview.outputData.voice_parts[0].notes[0].pitch, model.data.voice_parts[0].notes[0].pitch);
    assert.deepEqual(preview.outputData.voice_parts[0].notes[0].vibrato, model.data.voice_parts[0].notes[0].vibrato);
  }
});

test('affected counts distinguish track-only and part-only changes from project totals', async () => {
  const model = await core.inspect(encode(fixture()));
  assert.deepEqual(model.counts, {tracks: 1, parts: 1, notes: 1});
  assert.deepEqual(core.review(model, {singer: true}).counts, {changes: 1, tracks: 1, parts: 0, notes: 0});
  assert.deepEqual(core.review(model, {curves: ['dyn']}).counts, {changes: 1, tracks: 1, parts: 1, notes: 0});
});

test('no-op is byte-identical including BOM and comments; repeat cleanup is idempotent', async () => {
  const raw = encode('\ufeff# Retain these bytes in a no-op\n' + decode(encode(fixture())));
  const model = await core.inspect(raw);
  const unchanged = await core.convert(model, {}, {acknowledged: true});
  assert.deepEqual(unchanged.output, raw);
  assert.deepEqual(unchanged.report.changes, []);
  assert.equal(unchanged.report.sourceSha256, unchanged.report.outputSha256);
  const first = await core.convert(model, POLICY, {acknowledged: true});
  const again = await core.convert(await core.inspect(first.output), POLICY, {acknowledged: true});
  assert.deepEqual(again.output, first.output);
  assert.deepEqual(again.report.changes, []);
});

test('inspection snapshots mutable input and review cannot mutate the inspected source', async () => {
  const raw = Buffer.from(encode(fixture()));
  const before = new Uint8Array(raw);
  const pending = core.inspect(raw);
  raw.fill(0);
  const model = await pending;
  assert.equal(model.sourceSha256, sha256(before));
  assert.equal(model.sourceBytes, before.length);
  assert.throws(() => { model.data.tracks[0].singer = 'changed'; }, TypeError);
  const policy = {phonemeExpressions: ['gen']};
  const preview = core.review(model, policy);
  policy.phonemeExpressions.push('vel');
  assert.deepEqual(preview.policy.phonemeExpressions, ['gen']);
  assert.throws(() => { preview.changes[0].before.value = 999; }, TypeError);
  const unchanged = await core.convert(model, {}, {acknowledged: true});
  assert.deepEqual(unchanged.output, before);
  unchanged.output.fill(0);
  assert.deepEqual((await core.convert(model, {}, {acknowledged: true})).output, before);
});

test('export requires explicit acknowledgment and an authentic inspected model', async () => {
  const model = await core.inspect(encode(fixture()));
  for (const options of [undefined, {}, null, {acknowledged: false}, {acknowledged: 1}, {acknowledged: 'true'}]) {
    await assert.rejects(core.convert(model, POLICY, options), core.InvalidProject);
  }
  assert.throws(() => core.review({data: model.data}, POLICY), core.InvalidProject);
  await assert.rejects(core.convert({...model}, POLICY, {acknowledged: true}), core.InvalidProject);
});

test('policies reject unknown names, wrong types, duplicates and unrecognized abbreviations', async () => {
  const model = await core.inspect(encode(fixture()));
  for (const policy of [null, [], {unknown: true}, {singer: 1}, {render: null}, {trackColor: 'yes'},
    {phonemeOverrideFields: ['index']}, {phonemeOverrideFields: ['phoneme', 'phoneme']},
    {phonemeExpressions: 'gen'}, {phonemeExpressions: [1]}, {curves: null},
    {curves: ['missing']}, {curves: ['dyn', 'dyn']}, {curves: Array(257).fill('dyn')}]) {
    assert.throws(() => core.review(model, policy), core.InvalidProject);
  }
});

test('YAML 1.2 strings, explicit safe tags and unknown extension values survive conversion', async () => {
  const suffix = '\nplain_on: on\nplain_off: off\nplain_yes: yes\nplain_no: no\nplain_date: 2020-01-01\n' +
    'typed_string: !!str 060\nexplicit_map: !!map {quoted: !!str false}\nexplicit_list: !!seq [!!int 3, !!float 0.5, !!bool true, !!null null]\n' +
    'negative_zero: -0.0\nscientific: 1.0e-7\n';
  const model = await core.inspect(encode(decode(encode(fixture())) + suffix));
  assert.deepEqual(['plain_on', 'plain_off', 'plain_yes', 'plain_no', 'plain_date'].map(key => model.data[key]),
    ['on', 'off', 'yes', 'no', '2020-01-01']);
  assert.equal(model.data.typed_string, '060');
  assert.deepEqual(model.data.explicit_list, [3, 0.5, true, null]);
  assert.ok(Object.is(model.data.negative_zero, -0));
  const result = await core.convert(model, {singer: true}, {acknowledged: true});
  const expected = structuredClone(model.data); delete expected.tracks[0].singer;
  assert.deepEqual((await core.inspect(result.output)).data, expected);
});

test('ambiguous or unsafe numeric values are rejected even in unknown fields', async () => {
  const raw = decode(encode(fixture()));
  const scalars = ['060', '+012', '-09', '0x40', '-0X40', '0o40', '0b101', '+0b101',
    '1:20', '1:20:05.5', '1_000', '1_000.25', '1e2', '1e+2', '1.0e2', '.nan', '.NaN', '-.inf',
    'FALSE', 'True', '!!bool on', '!!int 0x40', '!!float .inf', '9007199254740992', '-9007199254740992',
    '9'.repeat(4000), '9'.repeat(5000), '1.0e+9999', '1.0e-400'];
  for (const scalar of scalars) {
    await assert.rejects(core.inspect(encode(raw + '\nunknown_numeric: ' + scalar + '\n')), core.InvalidProject, scalar.slice(0, 40));
  }
});

test('float32 midpoint decimals are rejected before any numeric spelling can change', async () => {
  const raw = decode(encode(fixture()));
  const midpoint = '1.000000059604644775390625';
  // This is a native float32 midpoint. The producer's shortest Number spelling
  // lies above it, despite both spellings parsing to the same JS Number.
  assert.equal(Number(midpoint).toString(), '1.0000000596046448');
  assert.ok(raw.includes('y: 3'));
  await assert.rejects(core.inspect(encode(raw.replace('y: 3', 'y: ' + midpoint))), /Numeric precision would change/);
  for (const spelling of [midpoint, '-' + midpoint, '1.000000059604644775390625e+0',
    '!!float ' + midpoint, '!!float "' + midpoint + '"', '0.10000000000000001', '9007199254740991.1',
    '4.9406564584124654e-324']) {
    await assert.rejects(core.inspect(encode(raw + '\nunknown_decimal: ' + spelling + '\n')), /Numeric precision would change/, spelling);
  }
  const source = raw + '\nquoted_midpoint: "' + midpoint + '"\ntyped_midpoint: !!str ' + midpoint + '\n';
  const model = await core.inspect(encode(source));
  const result = await core.convert(model, {singer: true}, {acknowledged: true});
  const output = (await core.inspect(result.output)).data;
  assert.equal(output.quoted_midpoint, midpoint);
  assert.equal(output.typed_midpoint, midpoint);
});

test('ordinary decimal, trailing-zero and exponent-equivalent spellings retain exact decimal values', async () => {
  const raw = decode(encode(fixture()));
  const spellings = ['0.1', '0.1000', '+0.1000', '.1000', '1.000e-1', '1000.0e-4',
    '1.2300', '123.000e-2', '0.012300e+2', '-12.5000', '-12500.0e-3',
    '1.2345678901234567', '1.2345678901234567000', '9007199254740991',
    '5.0e-324', '0.0000', '+0.0e+10000', '-0', '-0.0000', '-0.0e-10000', '!!float 10.00'];
  const source = raw + '\nnumeric_extension:\n' + spellings.map((value, index) => '  n' + index + ': ' + value).join('\n') + '\n';
  const model = await core.inspect(encode(source));
  const values = model.data.numeric_extension;
  for (let i = 0; i < 6; i++) assert.equal(values['n' + i], 0.1);
  assert.equal(values.n6, 1.23); assert.equal(values.n7, 1.23); assert.equal(values.n8, 1.23);
  assert.equal(values.n9, -12.5); assert.equal(values.n10, -12.5);
  for (const index of [17, 18, 19]) assert.ok(Object.is(values['n' + index], -0));
  const result = await core.convert(model, {singer: true}, {acknowledged: true});
  assert.deepEqual((await core.inspect(result.output)).data.numeric_extension, values);
  await assert.rejects(core.inspect(encode(raw.replace('position: 0', 'position: -0'))), /Negative zero cannot round-trip/);
});

test('malicious keys, duplicate keys, nonstring keys and YAML execution features are rejected', async () => {
  const raw = decode(encode(fixture()));
  const suffixes = ['x: &a [1]\ny: *a\n', 'x: &unused 1\n', 'x: *missing\n',
    'x: !unsafe y\n', 'x: !!timestamp 2020-01-01\n', 'x: !!binary aGVsbG8=\n',
    'x: !!python/object:builtins.object {}\n', 'x: 1\nx: 2\n', 'x: {a: 1, "a": 2}\n',
    'x: {__proto__: {polluted: true}}\n', 'x: {constructor: {prototype: {polluted: true}}}\n',
    'x: {"protot\\u0079pe": 1}\n', 'x: {<<: {a: 1}}\n', 'x: {1: number-key}\n',
    'x: {true: boolean-key}\n', 'x: {null: null-key}\n', 'x: {? [a, b]: complex-key}\n'];
  for (const suffix of suffixes) await assert.rejects(core.inspect(encode(raw + suffix)), core.InvalidProject, suffix);
  assert.equal({}.polluted, undefined);
  for (const text of ['---\n' + raw + '\n---\n' + raw, '%YAML 1.2\n---\n' + raw,
    '%TAG !a! tag:yaml.org,2002:\n---\n' + raw, raw + 'x: [unclosed\n']) {
    await assert.rejects(core.inspect(encode(text)), core.InvalidProject);
  }
});

test('source snippets are not exposed in parser errors', async () => {
  const secret = 'private-sentinel-do-not-display';
  await assert.rejects(core.inspect(encode('x: [' + secret)), error =>
    error instanceof core.InvalidProject && !error.message.includes(secret));
});

test('byte, UTF-8, scalar, structural preflight and nesting limits fail safely', async () => {
  await assert.rejects(core.inspect('string instead of bytes'), core.InvalidProject);
  await assert.rejects(core.inspect(new Uint8Array(core.LIMITS.bytes + 1)), /8 MiB/);
  await assert.rejects(core.inspect(new Uint8Array([0xff])), /UTF-8/);
  await assert.rejects(core.inspect(encode('x: ' + 'a'.repeat(core.LIMITS.scalar + 1))), /Scalar length/);
  await assert.rejects(core.inspect(encode('\n'.repeat(core.LIMITS.structuralCharacters + 1))), /structural character budget/);
  await assert.rejects(core.inspect(encode('x: ' + '['.repeat(40) + '0' + ']'.repeat(40))), core.InvalidProject);
});

test('malformed native timing and note structures are rejected', async () => {
  const mutations = [
    p => { p.ustx_version = 0.10; }, p => { p.ustx_version = '0.9'; }, p => { p.tracks = []; },
    p => { p.tempos = [0]; }, p => { p.tempos[0].position = 1; }, p => { p.tempos.push({...p.tempos[0]}); },
    p => { p.tempos[0].bpm = 0; }, p => { p.time_signatures[0].bar_position = 1; },
    p => { p.time_signatures[0].beat_unit = 3; }, p => { p.time_signatures[0].beat_per_bar = true; },
    p => { p.voice_parts[0].track_no = 3; }, p => { p.voice_parts[0].position = 2147483647; },
    p => { p.voice_parts[0].notes[0].lyric = true; }, p => { p.voice_parts[0].notes[0].duration = 0; },
    p => { p.voice_parts[0].notes[0].position = 1800; }, p => { p.voice_parts[0].notes[0].tone = 128; },
    p => { p.voice_parts[0].notes.push(structuredClone(p.voice_parts[0].notes[0])); },
    p => { p.voice_parts[0].notes[0].pitch.data = []; }, p => { p.voice_parts[0].notes[0].pitch.snap_first = 'false'; },
    p => { p.voice_parts[0].notes[0].pitch.data[1].x = -25; }, p => { p.voice_parts[0].notes[0].pitch.data[0].shape = 'unknown'; },
    p => { p.voice_parts[0].notes[0].vibrato.period = 1; }, p => { p.voice_parts[0].notes[0].vibrato.in = 90; },
    p => { p.voice_parts[0].notes[0].phoneme_expressions[0].abbr = 'missing'; },
    p => { p.voice_parts[0].notes[0].phoneme_expressions[0].index = 256; },
    p => { p.voice_parts[0].notes[0].phoneme_overrides[0].offset = 2147483648; },
    p => { p.voice_parts[0].notes[0].phoneme_overrides[0].phoneme = false; },
    p => { p.voice_parts[0].curves[0].ys = [1]; }, p => { p.voice_parts[0].curves[0].xs = [240, 0]; },
    p => { p.voice_parts[0].curves[0].abbr = 'missing'; }, p => { p.tracks[0].renderer_settings = 'not a map'; },
    p => { p.tracks[0].renderer_settings.renderer = false; }, p => { p.wave_parts = [{relative_path: 'outside.wav'}]; },
    p => { p.voice_parts[0].curves = null; }, p => { p.voice_parts[0].notes[0].phoneme_expressions = null; },
    p => { p.tracks[0].track_expressions = null; }
  ];
  for (const [index, mutate] of mutations.entries()) {
    const source = fixture(); mutate(source);
    await assert.rejects(core.inspect(encode(source)), core.InvalidProject, 'mutation ' + index);
  }
});

test('integer native fields reject float scalar syntax without rejecting unknown float fields', async () => {
  const raw = decode(encode(fixture()));
  for (const [before, after] of [['position: 3840', 'position: 3840.0'], ['duration: 480', 'duration: 4.8e+2'],
    ['tone: 60', 'tone: !!float 60'], ['index: 0', 'index: 0.0'], ['offset: 12', 'offset: 12.0'],
    ['beat_per_bar: 4', 'beat_per_bar: 4.0'], ['bar_position: 0', 'bar_position: 0.0']]) {
    assert.ok(raw.includes(before));
    await assert.rejects(core.inspect(encode(raw.replace(before, after))), /integer YAML scalars/);
  }
  const model = await core.inspect(encode(raw + '\nunknown: {duration: 10.0, index: 1.0}\n'));
  assert.deepEqual(model.data.unknown, {duration: 10, index: 1});
});

test('all tracks and descriptors are checked, even tracks with no parts', async () => {
  for (const descriptors of [[{}], [{abbr: ''}], [{abbr: 'x'}, {abbr: 'x'}], [3], null]) {
    const source = fixture(); source.tracks.push({track_expressions: descriptors});
    await assert.rejects(core.inspect(encode(source)), core.InvalidProject);
  }
  const source = fixture(); source.expressions.gen.abbr = 'different';
  await assert.rejects(core.inspect(encode(source)), core.InvalidProject);
});

test('project track and part limits reject oversized collections', async () => {
  const tooManyTracks = fixture();
  tooManyTracks.tracks = Array.from({length: 65}, () => ({}));
  await assert.rejects(core.inspect(encode(tooManyTracks)), core.InvalidProject);
  const tooManyParts = fixture();
  tooManyParts.voice_parts = Array.from({length: 257}, () => ({track_no: 0, position: 0, duration: 1920, notes: []}));
  await assert.rejects(core.inspect(encode(tooManyParts)), core.InvalidProject);
});

test('absent optional fields stay absent, and track color reset records a missing prior value', async () => {
  const source = fixture();
  delete source.tracks[0].singer;
  delete source.tracks[0].renderer_settings;
  delete source.tracks[0].track_color;
  delete source.voice_parts[0].notes[0].phoneme_overrides;
  delete source.voice_parts[0].notes[0].phoneme_expressions;
  delete source.voice_parts[0].curves;
  const model = await core.inspect(encode(source));
  const preview = core.review(model, POLICY);
  assert.deepEqual(preview.changes, [{path: ['tracks', 0, 'track_color'], before: null, after: 'Blue', operation: 'set'}]);
  const expected = structuredClone(source); expected.tracks[0].track_color = 'Blue';
  assert.deepEqual(preview.outputData, expected);
});

// Set VOICESLATE_EVIDENCE_DIR to the accepted native run directory. A reference
// prefix keeps independently produced Python files separate from browser output.
// Explicit evidence paths or REQUIRE_NATIVE=1 make missing evidence a failure;
// a checkout without native artifacts otherwise reports an explicit skip.
const evidenceDir = process.env.VOICESLATE_EVIDENCE_DIR || path.resolve(__dirname, '../evidence');
const referencePrefix = process.env.VOICESLATE_REFERENCE_PREFIX || '';
const requiredEvidence = ['native-input.ustx', referencePrefix + 'cleaned.ustx', referencePrefix + 'review.json'];
const hasNativeEvidence = requiredEvidence.every(filename => fs.existsSync(path.join(evidenceDir, filename)));
const requireNative = process.env.VOICESLATE_REQUIRE_NATIVE === '1' || Boolean(process.env.VOICESLATE_EVIDENCE_DIR);
test('actual native input matches accepted Python output and all 37 review records', {
  skip: !requireNative && !hasNativeEvidence ? 'Run the native evidence gate or set VOICESLATE_EVIDENCE_DIR' : false
}, async () => {
  const input = fs.readFileSync(path.join(evidenceDir, 'native-input.ustx'));
  const expected = yaml.load(fs.readFileSync(path.join(evidenceDir, referencePrefix + 'cleaned.ustx'), 'utf8'), {schema: yaml.CORE_SCHEMA});
  const acceptedReview = JSON.parse(fs.readFileSync(path.join(evidenceDir, referencePrefix + 'review.json'), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../scripts/policy.json'), 'utf8'));
  const model = await core.inspect(input);
  const preview = core.review(model, policy);
  assert.deepEqual(model.counts, {tracks: 2, parts: 3, notes: 6});
  assert.deepEqual(preview.counts, {changes: 37, tracks: 2, parts: 3, notes: 6});
  assert.deepEqual(preview.outputData, expected);
  assert.deepEqual(preview.changes, acceptedReview.changes);
  const result = await core.convert(model, policy, {acknowledged: true});
  assert.deepEqual(yaml.load(decode(result.output), {schema: yaml.CORE_SCHEMA}), expected);
  assert.equal(result.report.sourceSha256, acceptedReview.sourceSha256);
  assert.equal(result.report.outputSha256, sha256(result.output));
  assert.deepEqual(result.report.changes, acceptedReview.changes);
  assert.deepEqual(model.data.voice_parts.map(part => [part.track_no, part.position, part.duration]),
    [[0, 0, 1920], [0, 3840, 1920], [1, 960, 1920]]);
  const expectedLyrics = ['あ', 'null', '雪', 'la', 'echo', '終'];
  let index = 0;
  for (let pi = 0; pi < model.data.voice_parts.length; pi++) {
    const originalPart = model.data.voice_parts[pi], outputPart = preview.outputData.voice_parts[pi];
    assert.deepEqual([outputPart.name, outputPart.comment, outputPart.track_no, outputPart.position, outputPart.duration],
      [originalPart.name, originalPart.comment, originalPart.track_no, originalPart.position, originalPart.duration]);
    for (let ni = 0; ni < originalPart.notes.length; ni++, index++) {
      const originalNote = originalPart.notes[ni], outputNote = outputPart.notes[ni];
      assert.deepEqual([outputNote.position, outputNote.duration, outputNote.tone, outputNote.lyric, outputNote.tuning],
        [ni === 0 ? 0 : 600, ni === 0 ? 240 : 360, 60 + index, expectedLyrics[index], 12 * index]);
      assert.deepEqual(outputNote.pitch, originalNote.pitch);
      assert.deepEqual(outputNote.pitch.data.map(point => [point.x, point.y]), [[-25, 3 + index], [5, -2 - index], [80, 1 + index]]);
      assert.deepEqual(outputNote.vibrato, {length: 55, period: 173, depth: 33, in: 12, out: 17, shift: 23, drift: -5, vol_link: 15});
    }
  }
  assert.equal(index, 6);
  assert.deepEqual(preview.outputData.expressions, model.data.expressions);
  assert.deepEqual(preview.outputData.tracks.map(track => track.track_expressions), model.data.tracks.map(track => track.track_expressions));
  assert.equal(sha256(fs.readFileSync(path.join(evidenceDir, 'native-input.ustx'))), acceptedReview.sourceSha256);
});
