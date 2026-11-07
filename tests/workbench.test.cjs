'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const dataFile = fs.existsSync(path.join(root, 'theme-tokens.json')) ? path.join(root, 'theme-tokens.json') : path.resolve(root, '../theme-data.json');
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
const source = ['const DATA=' + JSON.stringify(data) + '; const FONT_FILES=[];', ...['theme-core.js', 'screens.js', 'app.js', 'workbench.js'].map(name => fs.readFileSync(path.join(root, 'src', name), 'utf8'))].join('\n');

function memoryStorage() {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, String(value))};
}

// These tests exercise state and real event handlers, not layout or a simulated browser.
function boot(storage = memoryStorage(), denyStorageGetter = false) {
  const elements = new Map();
  function element(selector) {
    if (elements.has(selector)) return elements.get(selector);
    const listeners = new Map();
    const attributes = new Map();
    const classes = new Set();
    const el = {
      value: selector === '#audit-mode' ? 'all' : '', checked: false, hidden: false,
      disabled: false, textContent: '', innerHTML: '', className: '', dataset: {}, style: {},
      classList: {toggle(name, force) { const on = force === undefined ? !classes.has(name) : force; if (on) classes.add(name); else classes.delete(name); return on; }},
      setAttribute(name, value) { attributes.set(name, String(value)); },
      getAttribute(name) { return attributes.get(name) ?? null; },
      addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
      querySelectorAll() { return []; },
      focus() {}, scrollIntoView() {},
      fire(type) { for (const handler of listeners.get(type) || []) handler({target: el, currentTarget: el, preventDefault() {}}); },
      click() { el.fire('click'); }
    };
    elements.set(selector, el);
    return el;
  }
  const window = {};
  if (denyStorageGetter) Object.defineProperty(window, 'localStorage', {get() { throw new Error('SecurityError'); }});
  else window.localStorage = storage;
  const context = {window, document: {querySelector: element, querySelectorAll: () => []}, console, TextEncoder, setTimeout: () => 0, clearTimeout() {}};
  vm.createContext(context);
  vm.runInContext(source, context, {filename: 'compiled-workbench.js'});
  return {
    storage, element,
    run: expression => vm.runInContext(expression, context),
    read: expression => JSON.parse(vm.runInContext('JSON.stringify(' + expression + ')', context))
  };
}

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS', name); }

test('Undo after Save as new preserves the new loaded preset across reload', () => {
  const app = boot();
  app.element('#theme-name').value = 'Preset A'; app.element('#theme-name').fire('input');
  app.element('#save-preset').click();
  const firstId = app.read('state.activePresetId');
  app.run("changeToken('text', '#123456')");
  app.element('#theme-name').value = 'Preset B'; app.element('#theme-name').fire('input');
  app.element('#save-preset').click();
  const newId = app.read('state.activePresetId');
  assert.notEqual(newId, firstId);
  assert.equal(app.read('library.length'), 2);
  app.element('#undo-edit').click();
  assert.equal(app.read('draft.id'), newId);
  assert.equal(app.read('state.activePresetId'), newId);
  assert.equal(app.read('draft.light.text'), data.palettes[0].light.text);
  assert.equal(app.read(`library.find(p => p.id === ${JSON.stringify(newId)}).light.text`), '#123456', 'Undoing the draft must not rewrite a saved snapshot');
  const resumed = boot(app.storage);
  assert.equal(resumed.read('draft.id'), newId);
  assert.equal(resumed.read('state.activePresetId'), newId);
  assert.equal(resumed.read('draft.light.text'), data.palettes[0].light.text);
});

test('Undo cannot resurrect a deleted preset association', () => {
  const app = boot();
  app.element('#save-preset').click();
  app.run("changeToken('text', '#123456')");
  app.element('#delete-preset').click();
  app.element('#confirm-delete').click();
  assert.equal(app.read('library.length'), 0);
  app.element('#undo-edit').click();
  assert.equal(app.read('state.activePresetId'), null);
  assert.equal(app.run("Object.prototype.hasOwnProperty.call(draft, 'id')"), false);
  const resumed = boot(app.storage);
  assert.equal(resumed.read('state.activePresetId'), null);
  assert.equal(resumed.read('library.length'), 0);
});

test('Token exports describe the current failing audit and preserve source provenance', () => {
  const app = boot();
  app.run("draft.name = 'Low contrast test'; draft.light.text = draft.light.canvas");
  const exported = app.read('buildTokenExport()');
  assert.equal(exported.name, 'Low contrast test');
  assert.deepEqual(exported.source, {id: data.palettes[0].id, name: data.palettes[0].name, colors: data.palettes[0].colors});
  assert.equal(exported.contrast.checked, 66);
  assert.ok(exported.contrast.failed > 0);
  assert.equal(exported.contrast.passed + exported.contrast.failed, 66);
  const issue = exported.contrast.pairs.find(row => row.id === 'light:text:canvas');
  assert.equal(issue.ratio, 1);
  assert.equal(issue.pass, false);
  assert.ok(!JSON.stringify(exported.notes).includes('All exported role pairs pass'));
  assert.equal(exported.light.text, exported.light.canvas);
  assert.equal(app.run("const exported = buildTokenExport(); exported.light.text = '#000000'; draft.light.text !== exported.light.text"), true, 'Exported role maps must not alias the working draft');
  assert.deepEqual(app.read('palettes[0].light'), data.palettes[0].light);
});

test('Updating a loaded preset keeps its identity and restores both modes, font, and template', () => {
  const app = boot();
  app.element('#save-preset').click();
  const id = app.read('state.activePresetId');
  app.run("draft.name = 'Renamed theme'; draft.light.primary = '#123456'; draft.dark.primary = '#AABBCC'; state.font = 'editorial'; state.template = 'reading'");
  app.element('#update-preset').click();
  assert.equal(app.read('library.length'), 1);
  assert.equal(app.read('library[0].id'), id);
  app.run('selectPalette(1)');
  app.run('loadPreset(' + JSON.stringify(id) + ')');
  assert.equal(app.read('draft.name'), 'Renamed theme');
  assert.equal(app.read('draft.light.primary'), '#123456');
  assert.equal(app.read('draft.dark.primary'), '#AABBCC');
  assert.equal(app.read('state.font'), 'editorial');
  assert.equal(app.read('state.template'), 'reading');
  const resumed = boot(app.storage);
  assert.equal(resumed.read('state.activePresetId'), id);
  assert.equal(resumed.read('state.font'), 'editorial');
  assert.equal(resumed.read('state.template'), 'reading');
});

test('Denied browser storage keeps drafting, snapshot creation, and export usable', () => {
  const app = boot(null, true);
  app.run("changeToken('text', '#123456')");
  app.element('#save-preset').click();
  assert.equal(app.read('library.length'), 1);
  assert.equal(app.read('draft.light.text'), '#123456');
  assert.equal(app.read('buildTokenExport().light.text'), '#123456');
  assert.equal(app.element('#storage-notice').hidden, false);
  assert.match(app.element('#preset-message').textContent, /this tab only/);
  assert.deepEqual(app.read('palettes[0].light'), data.palettes[0].light);
});

test('All template and gallery instances use unique IDs with complete label/ARIA references', () => {
  const app = boot();
  const results = app.read(`['dashboard', 'shopping', 'reading', 'mobile'].map(template => {
    state.template = template;
    const markup = previewMarkup('light', 'preview-light') + previewMarkup('dark', 'preview-dark') + previewMarkup('light', 'builder-light') + wrapScreen('light', AtlasScreens.gallery(screenContext('light')), 'gallery-light') + wrapScreen('dark', AtlasScreens.gallery(screenContext('dark')), 'gallery-dark');
    const ids = [...markup.matchAll(/\\bid="([^"]+)"/g)].map(match => match[1]);
    const refs = [...markup.matchAll(/\\b(?:for|aria-labelledby|aria-describedby|aria-controls)="([^"]+)"/g)].flatMap(match => match[1].split(' '));
    return {template, count: ids.length, duplicates: ids.filter((id, i) => ids.indexOf(id) !== i), missing: refs.filter(id => !ids.includes(id))};
  })`);
  for (const result of results) {
    assert.ok(result.count > 0, result.template);
    assert.deepEqual(result.duplicates, [], result.template + ' duplicate IDs');
    assert.deepEqual(result.missing, [], result.template + ' missing label/ARIA references');
  }
});

console.log(`${passed} workbench integration checks passed.`);
