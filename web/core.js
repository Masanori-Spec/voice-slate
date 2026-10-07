/* VoiceSlate's data-only browser producer. No DOM, file, network or native calls. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./vendor/js-yaml.umd.min.js'), globalThis.crypto);
  } else {
    root.VoiceSlateCore = factory(root.jsyaml, root.crypto);
  }
})(globalThis, function (yaml, cryptoProvider) {
  'use strict';

  const LIMITS = Object.freeze({bytes: 8 * 1024 * 1024, events: 250000,
    depth: 32, scalar: 65536, structuralCharacters: 125000,
    tracks: 64, parts: 256, notes: 10000});
  const OVERRIDE_FIELDS = Object.freeze(['phoneme', 'offset', 'preutter_delta',
    'overlap_delta', 'attack_time_delta', 'release_time_delta']);
  const BOOLEAN_CHOICES = ['singer', 'render', 'trackColor'];
  const LIST_CHOICES = ['phonemeOverrideFields', 'phonemeExpressions', 'curves'];
  const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor', '<<']);
  const MAX_INT = 2147483647;
  const MIN_INT = -2147483648;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const models = new WeakMap();
  const RETAINED = 'Unselected data values, including lyrics, names and comments, remain. This is not anonymization.';
  const LIMITATIONS = Object.freeze([
    'This is not a privacy, anonymity, voicebank compatibility or audio equivalence guarantee.',
    'The review contains original affected values and may contain private information.',
    'Changed copies preserve data values, not YAML formatting, comments or byte layout.',
    'Only explicitly selected settings are cleared; expression definitions and unselected settings remain.'
  ]);

  class InvalidProject extends Error {
    constructor(message) { super(message); this.name = 'InvalidProject'; }
  }
  function fail(message) { throw new InvalidProject(message); }
  function mapping(value, label) {
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail(label + ' must be a mapping');
    return value;
  }
  function sequence(value, label, maximum) {
    if (!Array.isArray(value) || value.length > maximum) fail('Invalid ' + label + ' collection');
    return value;
  }
  function integer(value, label, low = 0, high = MAX_INT) {
    if (!Number.isInteger(value) || value < low || value > high) fail('Invalid ' + label);
  }
  function number(value, label, low = -1e9, high = 1e9) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < low || value > high) fail('Invalid ' + label);
  }
  function freeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
    return value;
  }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (value !== null && typeof value === 'object') {
      const result = {};
      for (const key of Object.keys(value)) result[key] = clone(value[key]);
      return result;
    }
    return value;
  }
  function equal(a, b) {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return false;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(key => own(b, key) && equal(a[key], b[key]));
  }
  function bounded(value) {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER) fail('Nonfinite or unsafe numeric value');
      return;
    }
    if (Array.isArray(value)) { for (const child of value) bounded(child); return; }
    mapping(value, 'YAML value');
    for (const key of Object.keys(value)) {
      if (UNSAFE_KEYS.has(key)) fail('Unsafe or unsupported mapping key');
      bounded(value[key]);
    }
  }

  function exactDecimal(spelling) {
    // Canonical decimal coefficient/exponent, computed from characters only.
    // BigInt is used solely for the base-10 exponent so long exponent tokens
    // never round during comparison. The coefficient stays a bounded string.
    const [mantissa, exponent = '0'] = spelling.toLowerCase().split('e');
    const negative = mantissa[0] === '-';
    const unsigned = /^[+-]/.test(mantissa) ? mantissa.slice(1) : mantissa;
    const dot = unsigned.indexOf('.');
    const fractionalDigits = dot < 0 ? 0 : unsigned.length - dot - 1;
    let coefficient = unsigned.replace('.', '').replace(/^0+/, '');
    if (!coefficient) return negative ? '-0' : '0';
    const trailingZeros = (coefficient.match(/0+$/) || [''])[0].length;
    if (trailingZeros) coefficient = coefficient.slice(0, -trailingZeros);
    const scale = BigInt(exponent) - BigInt(fractionalDigits) + BigInt(trailingZeros);
    return (negative ? '-' : '') + coefficient + 'e' + scale.toString();
  }

  function scalarValue(text, event, tag) {
    const value = yaml.getScalarValue(text, event);
    if (value.length > LIMITS.scalar) fail('Scalar length limit exceeded');
    if (tag === 'str' || (!tag && event.style !== yaml.SCALAR_STYLE.PLAIN)) return value;
    // These spellings have differing YAML 1.1/1.2 meanings. Reject them even
    // in unknown extension values, rather than normalizing them silently.
    if (/^[-+]?0[0-9]+$/.test(value) || /^[-+]?0[xob][0-9a-f_]+$/i.test(value) ||
        /^[-+]?[0-9][0-9_]*(?::[0-9_]+)+(?:\.[0-9_]*)?$/.test(value) ||
        (value.includes('_') && /^[-+]?(?:[0-9][0-9_]*(?:\.[0-9_]*)?|\.[0-9_]+)(?:[eE][-+]?[0-9_]+)?$/.test(value))) {
      fail('Only unambiguous decimal numeric syntax is supported; quote intended strings');
    }
    if (/^[-+]?\.(?:inf|nan)$/i.test(value)) fail('Nonfinite numeric value');
    if (/^(?:true|false)$/i.test(value) && value !== 'true' && value !== 'false') fail('Only lowercase boolean literals are supported');
    const decimal = /^[-+]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$/;
    if (decimal.test(value)) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || Math.abs(numeric) > Number.MAX_SAFE_INTEGER) fail('Nonfinite or unsafe numeric value');
      if (numeric === 0 && /[1-9]/.test(value.split(/[eE]/)[0])) fail('Numeric underflow is unsupported');
      // Native consumers may parse decimal tokens directly to float32. Merely
      // comparing parsed JS Numbers misses a double-rounding change across a
      // float32 midpoint, even when the JS value itself appears unchanged.
      // Require the exact input decimal to equal the producer's shortest
      // decimal output, modulo trailing zeros, decimal point and exponent form.
      const shortest = Object.is(numeric, -0) ? '-0' : numeric.toString();
      if (exactDecimal(value) !== exactDecimal(shortest)) fail('Numeric precision would change on serialization');
      if (!tag && /[eE]/.test(value) && !/^[-+]?(?:[0-9]+\.[0-9]*|\.[0-9]+)[eE][-+][0-9]+$/.test(value)) {
        fail('Ambiguous exponent syntax; use a decimal point and signed exponent');
      }
    }
    if (tag === 'int' && !/^[-+]?(?:0|[1-9][0-9]*)$/.test(value)) fail('Invalid explicit decimal integer');
    if (tag === 'float' && !decimal.test(value)) fail('Invalid explicit decimal float');
    if (tag === 'bool' && value !== 'true' && value !== 'false') fail('Invalid explicit boolean');
    const scalarTags = {str: yaml.strTag, int: yaml.intCoreTag, float: yaml.floatCoreTag,
      bool: yaml.boolCoreTag, null: yaml.nullCoreTag};
    if (tag) {
      const definition = scalarTags[tag];
      if (!definition) fail('Unsupported scalar tag');
      const resolved = definition.resolve(value, true, definition.tagName);
      if (resolved === yaml.NOT_RESOLVED) fail('Invalid explicit scalar');
      return resolved;
    }
    for (const definition of [yaml.nullCoreTag, yaml.boolCoreTag, yaml.intCoreTag, yaml.floatCoreTag]) {
      const resolved = definition.resolve(value, false, definition.tagName);
      if (resolved !== yaml.NOT_RESOLVED) return resolved;
    }
    return value; // Includes on/off/yes/no and dates, intentionally strings.
  }

  function inspectEvents(text, events) {
    if (events.length > LIMITS.events) fail('YAML event limit exceeded');
    const E = yaml.EVENT_ID;
    const stack = [];
    let documents = 0;
    for (const event of events) {
      if (event.type === E.DOCUMENT) {
        if (++documents > 1 || event.directives.length) fail('One YAML document without directives is required');
        stack.push({type: E.DOCUMENT, path: []});
        continue;
      }
      if (event.type === E.POP) { stack.pop(); continue; }
      if (event.type === E.ALIAS || event.anchorStart >= 0) fail('YAML aliases and anchors are unsupported');
      let tag = null;
      if (event.tagStart >= 0) {
        const spelling = text.slice(event.tagStart, event.tagEnd);
        const match = /^(?:!!(str|int|float|bool|null|seq|map)|!<tag:yaml\.org,2002:(str|int|float|bool|null|seq|map)>)$/.exec(spelling);
        if (!match) fail('Unsupported YAML tag');
        tag = match[1] || match[2];
      }
      const parent = stack[stack.length - 1];
      const isKey = parent && parent.type === E.MAPPING && parent.nextKey;
      const path = !parent || parent.type === E.DOCUMENT ? [] :
        [...parent.path, parent.type === E.MAPPING ? parent.key : parent.nextIndex];
      if (isKey && event.type !== E.SCALAR) fail('Only string mapping keys are supported');
      if (event.type === E.SCALAR) {
        const value = scalarValue(text, event, tag);
        if (isKey) {
          if (typeof value !== 'string') fail('Only string mapping keys are supported');
          if (UNSAFE_KEYS.has(value)) fail('Unsafe or unsupported mapping key');
          if (parent.keys.has(value)) fail('Duplicate mapping key');
          parent.keys.add(value);
          parent.key = value;
        } else if (typeof value === 'number' && integerPath(path)) {
          // JS has one numeric type. Preserve the native/Python distinction at
          // the source boundary: YAML floats cannot fill native integer fields.
          const spelling = yaml.getScalarValue(text, event);
          if (Object.is(value, -0)) fail('Negative zero cannot round-trip in native integer fields');
          if (tag === 'float' || (!tag && !/^[-+]?(?:0|[1-9][0-9]*)$/.test(spelling))) {
            fail('Native integer fields require integer YAML scalars');
          }
        }
      } else if (event.type === E.MAPPING || event.type === E.SEQUENCE) {
        if (tag && tag !== (event.type === E.MAPPING ? 'map' : 'seq')) fail('Invalid collection tag');
      } else fail('Unsupported YAML event');
      if (parent && parent.type === E.MAPPING) parent.nextKey = !parent.nextKey;
      if (parent && parent.type === E.SEQUENCE) parent.nextIndex++;
      if (event.type === E.MAPPING || event.type === E.SEQUENCE) {
        stack.push({type: event.type, path, nextKey: true, key: null, nextIndex: 0, keys: new Set()});
      }
    }
    if (documents !== 1) fail('One YAML document is required');
  }

  function integerPath(path) {
    if (path.length === 3 && path[0] === 'tempos') return path[2] === 'position';
    if (path.length === 3 && path[0] === 'time_signatures') return ['bar_position', 'beat_per_bar', 'beat_unit'].includes(path[2]);
    if (path[0] !== 'voice_parts') return false;
    if (path.length === 3) return ['track_no', 'position', 'duration'].includes(path[2]);
    if (path.length === 6 && path[2] === 'curves') return ['xs', 'ys'].includes(path[4]);
    if (path[2] !== 'notes') return false;
    if (path.length === 5) return ['position', 'duration', 'tone'].includes(path[4]);
    if (path.length === 7 && path[4] === 'phoneme_expressions') return path[6] === 'index';
    if (path.length === 7 && path[4] === 'phoneme_overrides') return ['index', 'offset'].includes(path[6]);
    return false;
  }

  function parse(bytes) {
    if (!(bytes instanceof Uint8Array)) fail('Input must be a Uint8Array');
    if (bytes.byteLength > LIMITS.bytes) fail('Input exceeds 8 MiB');
    if (!yaml || typeof yaml.parseEvents !== 'function') fail('Bundled YAML parser is unavailable');
    let text;
    try { text = new TextDecoder('utf-8', {fatal: true}).decode(bytes); }
    catch (_) { fail('Input must be UTF-8'); }
    // A deliberately conservative allocation preflight: count punctuation even
    // inside strings/comments. This bounds parser work BEFORE event allocation;
    // valid but punctuation-heavy files may fall outside the supported subset.
    let structural = 0;
    for (let i = 0; i < text.length; i++) {
      if ('\n\r:,[]{}-?'.includes(text[i]) && ++structural > LIMITS.structuralCharacters) {
        fail('YAML structural character budget exceeded');
      }
    }
    let data;
    try {
      const events = yaml.parseEvents(text, {maxDepth: LIMITS.depth});
      inspectEvents(text, events);
      const documents = yaml.constructFromEvents(events, {source: text, schema: yaml.CORE_SCHEMA,
        json: false, maxAliases: 0, maxTotalMergeKeys: 0});
      if (documents.length !== 1) fail('One YAML document is required');
      data = documents[0];
    } catch (error) {
      if (error instanceof InvalidProject) throw error;
      // Parser exceptions can contain source snippets. Keep private source text
      // out of a UI error message, while preserving an actionable failure class.
      fail('Malformed or unsupported YAML');
    }
    bounded(data);
    validate(data);
    return data;
  }

  function validate(project) {
    mapping(project, 'Project');
    if (project.ustx_version !== '0.10') fail('Only USTX 0.10 is supported; the version must be a string');
    const expressions = mapping(project.expressions, 'Expression definitions');
    for (const [key, descriptor] of Object.entries(expressions)) {
      mapping(descriptor, 'Expression descriptor');
      if (!key || descriptor.abbr !== key) fail('Invalid expression definition key/abbreviation');
    }
    const tracks = sequence(project.tracks, 'tracks', LIMITS.tracks);
    if (!tracks.length) fail('At least one track is required');
    const definitions = [];
    for (const track of tracks) {
      mapping(track, 'Track');
      for (const key of ['singer', 'phonemizer', 'track_name', 'track_color']) {
        if (own(track, key) && track[key] !== null && typeof track[key] !== 'string') fail('Invalid track ' + key);
      }
      if (own(track, 'renderer_settings')) {
        for (const value of Object.values(mapping(track.renderer_settings, 'Renderer settings'))) {
          if (value !== null && typeof value !== 'string') fail('Invalid renderer binding');
        }
      }
      const local = new Set();
      for (const descriptor of sequence(own(track, 'track_expressions') ? track.track_expressions : [], 'track expression definitions', 256)) {
        mapping(descriptor, 'Track expression definition');
        if (typeof descriptor.abbr !== 'string' || !descriptor.abbr || local.has(descriptor.abbr)) fail('Invalid or duplicate track expression abbreviation');
        local.add(descriptor.abbr);
      }
      definitions.push(new Set([...Object.keys(expressions), ...local]));
    }
    const tempos = sequence(project.tempos, 'tempos', 1000);
    const meters = sequence(project.time_signatures, 'time signatures', 1000);
    if (!tempos.length || !meters.length) fail('Timing maps must start at zero');
    let previous = -1;
    for (const tempo of tempos) {
      mapping(tempo, 'Tempo'); integer(tempo.position, 'tempo position'); number(tempo.bpm, 'tempo', 1, 1000);
      if (tempo.position <= previous || (previous === -1 && tempo.position !== 0)) fail('Tempo positions must start at zero and increase');
      previous = tempo.position;
    }
    previous = -1;
    for (const meter of meters) {
      mapping(meter, 'Meter'); integer(meter.bar_position, 'meter position');
      integer(meter.beat_per_bar, 'beats per bar', 1, 64); integer(meter.beat_unit, 'beat unit', 1, 64);
      if (meter.bar_position <= previous || (previous === -1 && meter.bar_position !== 0) ||
          ![1, 2, 4, 8, 16, 32, 64].includes(meter.beat_unit)) fail('Invalid time signature map');
      previous = meter.bar_position;
    }
    if (own(project, 'wave_parts') && project.wave_parts !== null &&
        (!Array.isArray(project.wave_parts) || project.wave_parts.length)) fail('Wave parts are outside this voice-only scope');
    const parts = sequence(project.voice_parts, 'voice parts', LIMITS.parts);
    let totalNotes = 0;
    for (const part of parts) {
      mapping(part, 'Voice part'); integer(part.track_no, 'track number', 0, tracks.length - 1);
      integer(part.position, 'part position'); integer(part.duration, 'part duration', 1);
      if (part.position + part.duration > MAX_INT) fail('Absolute part end exceeds native integer range');
      const notes = sequence(part.notes, 'notes', LIMITS.notes);
      totalNotes += notes.length;
      if (totalNotes > LIMITS.notes) fail('Note limit exceeded');
      let previousEnd = -1;
      for (const note of notes) {
        mapping(note, 'Note'); integer(note.position, 'note position'); integer(note.duration, 'note duration', 10);
        integer(note.tone, 'note tone', 0, 127);
        if (note.position < previousEnd) fail('Unordered or overlapping notes are unsupported');
        previousEnd = note.position + note.duration;
        if (previousEnd > part.duration) fail('Note exceeds its part');
        if (typeof note.lyric !== 'string') fail('Lyric must be a string; quote ambiguous lyrics');
        const pitch = mapping(note.pitch, 'Pitch');
        const points = sequence(pitch.data, 'pitch points', 10000);
        if (points.length < 2 || typeof pitch.snap_first !== 'boolean') fail('Invalid pitch shape');
        let previousX = -Infinity;
        for (const point of points) {
          mapping(point, 'Pitch point'); number(point.x, 'pitch X'); number(point.y, 'pitch Y');
          if (point.x <= previousX || !['io', 'i', 'o', 'l'].includes(point.shape)) fail('Invalid pitch point order or shape');
          previousX = point.x;
        }
        const vibrato = mapping(note.vibrato, 'Vibrato');
        for (const [key, low, high] of [['length', 0, 100], ['period', 5, 500], ['depth', 5, 200],
          ['in', 0, 100], ['out', 0, 100], ['shift', 0, 100], ['drift', -100, 100], ['vol_link', -100, 100]]) {
          number(vibrato[key], 'vibrato ' + key, low, high);
        }
        if (vibrato.in + vibrato.out > 100) fail('Vibrato fades exceed its length');
        for (const expression of sequence(own(note, 'phoneme_expressions') ? note.phoneme_expressions : [], 'phoneme expressions', 256)) {
          mapping(expression, 'Phoneme expression');
          if (typeof expression.abbr !== 'string' || !definitions[part.track_no].has(expression.abbr)) fail('Unresolved phoneme expression');
          if (expression.index !== undefined && expression.index !== null) integer(expression.index, 'expression index', 0, 255);
          number(expression.value, 'expression value');
        }
        for (const override of sequence(own(note, 'phoneme_overrides') ? note.phoneme_overrides : [], 'phoneme overrides', 256)) {
          mapping(override, 'Phoneme override'); integer(override.index, 'phoneme index', 0, 255);
          if (override.phoneme !== undefined && override.phoneme !== null && typeof override.phoneme !== 'string') fail('Phoneme alias must be a string');
          if (override.offset !== undefined && override.offset !== null) integer(override.offset, 'phoneme offset', MIN_INT);
          for (const key of OVERRIDE_FIELDS.slice(2)) {
            if (override[key] !== undefined && override[key] !== null) number(override[key], 'phoneme ' + key);
          }
        }
      }
      for (const curve of sequence(own(part, 'curves') ? part.curves : [], 'curves', 256)) {
        mapping(curve, 'Curve');
        if (typeof curve.abbr !== 'string' || !definitions[part.track_no].has(curve.abbr)) fail('Unresolved curve expression');
        const xs = sequence(curve.xs, 'curve X coordinates', 100000);
        const ys = sequence(curve.ys, 'curve Y coordinates', 100000);
        if (xs.length !== ys.length) fail('Curve coordinates have different lengths');
        let previousX = -1;
        for (const x of xs) {
          integer(x, 'curve X');
          if (x <= previousX) fail('Curve X coordinates must increase');
          previousX = x;
        }
        for (const y of ys) integer(y, 'curve Y', MIN_INT);
      }
    }
  }

  function checkedPolicy(policy, project) {
    mapping(policy, 'Policy');
    if (Object.keys(policy).some(key => ![...BOOLEAN_CHOICES, ...LIST_CHOICES].includes(key))) fail('Unknown cleanup setting');
    const selected = {};
    for (const key of BOOLEAN_CHOICES) {
      selected[key] = own(policy, key) ? policy[key] : false;
      if (typeof selected[key] !== 'boolean') fail('Settings must be true or false');
    }
    for (const key of LIST_CHOICES) {
      const list = own(policy, key) ? policy[key] : [];
      sequence(list, 'cleanup choices', 256);
      if (list.some(value => typeof value !== 'string') || new Set(list).size !== list.length) fail('Cleanup lists need unique field names');
      if (key === 'phonemeOverrideFields' && list.some(value => !OVERRIDE_FIELDS.includes(value))) fail('Unsupported phoneme override field');
      selected[key] = list.slice();
    }
    const definitions = new Set(Object.keys(project.expressions));
    for (const track of project.tracks) for (const descriptor of track.track_expressions || []) definitions.add(descriptor.abbr);
    if ([...selected.phonemeExpressions, ...selected.curves].some(value => !definitions.has(value))) fail('Unknown selected expression abbreviation');
    return selected;
  }

  async function sha256(bytes) {
    if (!cryptoProvider || !cryptoProvider.subtle) fail('SHA-256 is unavailable; use a browser with Web Crypto support');
    const hash = await cryptoProvider.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  }

  async function inspect(input) {
    // Snapshot immediately, before the first asynchronous boundary. Buffer.slice
    // would share memory, so use the Uint8Array constructor even under Node.
    if (!(input instanceof Uint8Array)) fail('Input must be a Uint8Array');
    if (input.byteLength > LIMITS.bytes) fail('Input exceeds 8 MiB');
    const source = new Uint8Array(input);
    const data = freeze(parse(source));
    const expressions = new Set(Object.keys(data.expressions));
    for (const track of data.tracks) for (const descriptor of track.track_expressions || []) expressions.add(descriptor.abbr);
    const sourceSha256 = await sha256(source);
    const model = freeze({data, sourceSha256, sourceBytes: source.byteLength,
      counts: {tracks: data.tracks.length, parts: data.voice_parts.length,
        notes: data.voice_parts.reduce((sum, part) => sum + part.notes.length, 0)},
      available: {phonemeOverrideFields: OVERRIDE_FIELDS.slice(), phonemeExpressions: [...expressions], curves: [...expressions]}});
    models.set(model, {source, data, sourceSha256});
    return model;
  }

  function review(model, policy = {}) {
    const original = models.get(model);
    if (!original) fail('Inspect the source before reviewing or converting');
    const selected = checkedPolicy(policy, original.data);
    const project = clone(original.data);
    const changes = [];
    function remove(object, key, path) {
      if (own(object, key)) {
        changes.push({path: [...path, key], before: clone(object[key]), operation: 'remove'});
        delete object[key];
      }
    }
    project.tracks.forEach((track, ti) => {
      const path = ['tracks', ti];
      if (selected.singer) remove(track, 'singer', path);
      if (selected.render) for (const key of ['renderer', 'resampler', 'wavtool']) remove(track.renderer_settings || {}, key, [...path, 'renderer_settings']);
      if (selected.trackColor && track.track_color !== 'Blue') {
        changes.push({path: [...path, 'track_color'], before: own(track, 'track_color') ? track.track_color : null, after: 'Blue', operation: 'set'});
        track.track_color = 'Blue';
      }
    });
    project.voice_parts.forEach((part, pi) => {
      const path = ['voice_parts', pi];
      part.notes.forEach((note, ni) => {
        const notePath = [...path, 'notes', ni];
        (note.phoneme_overrides || []).forEach((override, oi) => {
          for (const key of selected.phonemeOverrideFields) remove(override, key, [...notePath, 'phoneme_overrides', oi]);
        });
        if (own(note, 'phoneme_expressions')) {
          note.phoneme_expressions = note.phoneme_expressions.filter((expression, ei) => {
            if (!selected.phonemeExpressions.includes(expression.abbr)) return true;
            changes.push({path: [...notePath, 'phoneme_expressions', ei], before: clone(expression), operation: 'remove'});
            return false;
          });
        }
      });
      if (own(part, 'curves')) {
        part.curves = part.curves.filter((curve, ci) => {
          if (!selected.curves.includes(curve.abbr)) return true;
          changes.push({path: [...path, 'curves', ci], before: clone(curve), operation: 'remove'});
          return false;
        });
      }
    });
    const tracks = new Set(), parts = new Set(), notes = new Set();
    for (const {path} of changes) {
      if (path[0] === 'tracks') tracks.add(path[1]);
      else if (path[0] === 'voice_parts') {
        parts.add(path[1]); tracks.add(project.voice_parts[path[1]].track_no);
        if (path[2] === 'notes') notes.add(path[1] + ':' + path[3]);
      }
    }
    const counts = {changes: changes.length, tracks: tracks.size, parts: parts.size, notes: notes.size};
    const report = {format: 'VoiceSlate review 1', scope: 'USTX 0.10 voice-only selective settings copy',
      sourceSha256: original.sourceSha256, acknowledged: false, policy: selected,
      changes, counts, countScope: 'Distinct affected tracks, parts and notes; these are not project totals.',
      retained: RETAINED, limitations: LIMITATIONS.slice()};
    return freeze({outputData: project, policy: selected, changes, counts, report,
      sourceSha256: original.sourceSha256, retained: RETAINED, limitations: LIMITATIONS.slice()});
  }

  async function convert(model, policy = {}, options = {}) {
    if (!options || options.acknowledged !== true) fail('Explicit review acknowledgment is required');
    const preview = review(model, policy);
    const original = models.get(model);
    let output;
    if (!preview.changes.length) output = new Uint8Array(original.source);
    else {
      let serialized;
      try {
        serialized = yaml.dump(preview.outputData, {schema: yaml.CORE_SCHEMA, noRefs: true,
          sortKeys: false, lineWidth: 1000, forceQuotes: true, quoteStyle: 'double'});
      } catch (_) { fail('The selected copy could not be serialized'); }
      output = new TextEncoder().encode(serialized);
      if (output.byteLength > LIMITS.bytes) fail('Output size limit exceeded');
      if (!equal(parse(output), preview.outputData)) fail('Output verification failed; no copy was produced');
    }
    const report = freeze({...preview.report, acknowledged: true, outputSha256: await sha256(output)});
    return {output, report};
  }

  return Object.freeze({inspect, review, convert, InvalidProject, LIMITS, OVERRIDE_FIELDS});
});
