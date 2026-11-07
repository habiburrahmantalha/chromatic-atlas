'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../src/theme-core.js');
const sourcePath = fs.existsSync(path.join(__dirname, '../theme-tokens.json')) ? path.join(__dirname, '../theme-tokens.json') : path.join(__dirname, '../../theme-data.json');
const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));
function preset(palette = data.palettes[0]) {
  return {version: 1, id: 'test-theme', name: 'My theme', basePaletteId: palette.id, font: 'inter', template: 'dashboard', light: clone(palette.light), dark: clone(palette.dark)};
}
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

test('Opaque hex normalization rejects alpha, CSS, and coercible objects', () => {
  assert.equal(core.normalizeHex(' #aBc '), '#AABBCC');
  for (const bad of ['#FFFF', '#12345678', 'red', 'rgb(1,2,3)', '#12zz34', null, {}, 123]) assert.equal(core.normalizeHex(bad), null);
  assert.throws(() => core.contrast('red', '#fff'));
});

test('Contrast thresholds use unrounded values', () => {
  assert.equal(core.contrast('#000', '#fff'), 21);
  assert.equal(core.contrast('#777', '#777'), 1);
  const ratio = core.contrast('#4A5C6A', '#CCD0CF');
  assert.equal(ratio.toFixed(2), '4.45');
  assert.ok(ratio < 4.5);
  assert.ok(core.contrast('#536684', '#DCE3EF') >= 4.5);
});

test('All original themes pass every automatic audit relationship', () => {
  for (const palette of data.palettes) {
    const rows = core.audit(palette);
    assert.equal(rows.length, 66);
    assert.equal(new Set(rows.map(row => row.id)).size, rows.length);
    assert.equal(rows.filter(row => !row.pass).length, 0, palette.id);
  }
});

test('Actions and focus are audited against the mobile contextual fill', () => {
  const theme = preset();
  theme.light.subtle = theme.light.primary;
  const rows = core.audit(theme);
  const contextual = rows.filter(row => row.background === 'subtle' && ['primary', 'hover', 'pressed', 'focus'].includes(row.foreground));
  assert.equal(contextual.length, 8);
  assert.ok(contextual.every(row => row.threshold === 3));
  const issue = rows.find(row => row.id === 'light:primary:subtle');
  assert.equal(issue.ratio, 1);
  assert.equal(issue.pass, false);
});

test('Suggestions meet every same-token surface check and change only that token', () => {
  const theme = preset();
  theme.light.text = '#777777';
  theme.light.canvas = '#FFFFFF';
  theme.light.surface = '#EEEEEE';
  theme.light.raised = '#F1EBDD';
  const before = clone(theme);
  const issue = core.audit(theme).find(row => row.foreground === 'text' && !row.pass);
  const fix = core.suggestion(theme, issue);
  assert.ok(fix);
  assert.deepEqual(theme, before, 'Suggestion must not mutate input');
  assert.equal(fix.token, 'text');
  assert.ok(fix.afterRatio >= issue.threshold);
  theme[issue.mode][fix.token] = fix.color;
  assert.ok(core.audit(theme).filter(row => row.mode === issue.mode && row.foreground === 'text').every(row => row.pass));
  assert.deepEqual(fix.unresolved, []);
});

test('Suggestions preserve onPrimary labels when modifying a primary fill', () => {
  const theme = preset();
  theme.light.primary = '#EEEEEE';
  theme.light.hover = '#17251F';
  theme.light.pressed = '#17251F';
  theme.light.onPrimary = '#FFFFFF';
  const issue = core.audit(theme).find(row => row.mode === 'light' && row.foreground === 'primary' && !row.pass);
  const fix = core.suggestion(theme, issue);
  assert.ok(fix);
  theme.light[fix.token] = fix.color;
  assert.ok(core.audit(theme).filter(row => row.mode === 'light' && (row.foreground === 'primary' || row.background === 'primary')).every(row => row.pass));
});

test('Suggested focus fixes also pass on the contextual fill', () => {
  const theme = preset();
  theme.light.focus = '#BBBBBB';
  const issue = core.audit(theme).find(row => row.id === 'light:focus:canvas');
  assert.equal(issue.pass, false);
  const fix = core.suggestion(theme, issue);
  assert.ok(fix);
  theme.light.focus = fix.color;
  const affected = core.audit(theme).filter(row => row.mode === 'light' && row.foreground === 'focus');
  assert.equal(affected.length, 4);
  assert.ok(affected.every(row => row.pass));
  assert.ok(core.contrast(fix.color, theme.light.subtle) >= 3);
});

test('Suggestions choose the nearest passing gray candidate and handle impossible surfaces', () => {
  const theme = preset();
  theme.light.text = '#777777';
  theme.light.canvas = '#FFFFFF';
  theme.light.surface = '#000000';
  theme.light.raised = '#FFFFFF';
  let issue = core.audit(theme).find(row => row.mode === 'light' && row.foreground === 'text' && !row.pass);
  assert.equal(core.suggestion(theme, issue).color, '#767676');
  theme.light.raised = '#777777';
  issue = core.audit(theme).find(row => row.mode === 'light' && row.foreground === 'text' && !row.pass);
  assert.equal(core.suggestion(theme, issue), null);
  assert.equal(core.suggestion(theme, {id: 'unknown'}), null);
});

test('Preset validation creates a canonical independent copy', () => {
  const input = preset();
  input.name = '  New theme  ';
  input.light.text = '#123';
  const result = core.validatePreset(input);
  assert.equal(result.name, 'New theme');
  assert.equal(result.light.text, '#112233');
  result.light.text = '#000000';
  assert.equal(input.light.text, '#123');
});

test('Malformed and unsupported presets are rejected at the trust boundary', () => {
  for (const bad of [null, [], new Date(), 'text']) assert.throws(() => core.validatePreset(bad));
  for (const patch of [{version: 2}, {font: 'url(evil)'}, {template: 'anything'}, {basePaletteId: 'unknown'}, {id: '../a'}, {name: ''}, {name: 'a'.repeat(61)}, {name: 'line\nbreak'}, {extra: '#fff'}]) {
    assert.throws(() => core.validatePreset({...preset(), ...patch}));
  }
  const missing = preset(); delete missing.dark;
  assert.throws(() => core.validatePreset(missing));
  const partial = preset(); delete partial.light.text;
  assert.throws(() => core.validatePreset(partial));
  const css = preset(); css.light.text = 'url(javascript:alert(1))';
  assert.throws(() => core.validatePreset(css));
  const inherited = Object.create(preset());
  assert.throws(() => core.validatePreset(inherited));
  const accessor = preset(); Object.defineProperty(accessor, 'name', {enumerable: true, get() { throw new Error('Should not invoke getter'); }});
  assert.throws(() => core.validatePreset(accessor), /unsupported property/);
});

test('Import rejects prototype pollution, invalid wrappers, excessive size and duplicates', () => {
  const base = JSON.stringify(preset());
  assert.throws(() => core.parseImport(base.slice(0, -1) + ',"__proto__":{"polluted":true}}'));
  const nested = preset(); nested.light = JSON.parse(JSON.stringify(nested.light).slice(0, -1) + ',"constructor":{}}');
  assert.throws(() => core.parseImport(JSON.stringify(nested)));
  assert.equal({}.polluted, undefined);
  for (const bad of ['', '{', '[]', '{"version":2,"presets":[]}', '{"version":1,"presets":[],"extra":true}']) assert.throws(() => core.parseImport(bad));
  assert.throws(() => core.parseImport(' '.repeat(core.MAX_IMPORT_BYTES + 1)));
  assert.throws(() => core.parseImport(JSON.stringify({version: 1, presets: Array(51).fill(preset())})));
  assert.throws(() => core.parseImport(JSON.stringify({version: 1, presets: [preset(), preset()]})), /duplicate IDs/);
  assert.equal(core.parseImport(base).length, 1);
  assert.equal(core.parseImport(JSON.stringify({version: 1, presets: []})).length, 0);
});

test('Library persistence round-trips with independent validated values', () => {
  const values = new Map();
  const storage = {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value)};
  assert.deepEqual(core.loadLibrary(storage), {presets: [], error: null});
  const saved = core.saveLibrary(storage, [preset()]);
  assert.equal(saved.error, null);
  assert.deepEqual(core.loadLibrary(storage).presets, saved.presets);
  assert.equal(JSON.parse(values.get(core.STORAGE_KEY)).version, 1);
  const previous = values.get(core.STORAGE_KEY);
  assert.ok(core.saveLibrary(storage, [{invalid: true}]).error);
  assert.equal(values.get(core.STORAGE_KEY), previous, 'Invalid data cannot overwrite a library');
});

test('Denied, quota-limited and corrupt storage degrade without throwing', () => {
  const denied = {getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); }};
  assert.ok(core.loadLibrary(denied).error);
  const save = core.saveLibrary(denied, [preset()]);
  assert.ok(save.error);
  assert.equal(save.presets.length, 1, 'Keep canonical presets available for download');
  const corrupt = {getItem: () => '{broken', setItem() { throw new Error('Must not write during load'); }};
  assert.ok(core.loadLibrary(corrupt).error);
  assert.ok(core.loadLibrary(null).error);
  const context = {TextEncoder};
  Object.defineProperty(context, 'localStorage', {get() { throw new Error('SecurityError'); }});
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/theme-core.js'), 'utf8'), context);
  assert.ok(context.AtlasCore.loadLibrary().error, 'Accessing localStorage itself can throw');
});

console.log(`${passed} theme core checks passed.`);
