(function (root) {
  'use strict';

  const TOKENS = Object.freeze(['canvas', 'surface', 'raised', 'text', 'secondary', 'primary', 'onPrimary', 'hover', 'pressed', 'borderStrong', 'borderSubtle', 'focus', 'selected', 'onSelected', 'subtle', 'onSubtle', 'link']);
  const PALETTE_IDS = Object.freeze(['olive', 'berry', 'caramel', 'lagoon', 'clay', 'slate', 'cocoa', 'lavender', 'forest', 'rose', 'midnight', 'plum']);
  const FONT_IDS = Object.freeze(['inter', 'manrope', 'jakarta', 'editorial', 'plex', 'system']);
  const TEMPLATE_IDS = Object.freeze(['dashboard', 'shopping', 'reading', 'mobile']);
  const STORAGE_KEY = 'chromatic-atlas-presets-v1';
  const MAX_PRESETS = 50;
  const MAX_IMPORT_BYTES = 250000;
  const MODES = ['light', 'dark'];
  const SURFACES = ['canvas', 'surface', 'raised'];

  function normalizeHex(value) {
    if (typeof value !== 'string') return null;
    let hex = value.trim();
    if (/^#[0-9a-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
    return /^#[0-9a-f]{6}$/i.test(hex) ? hex.toUpperCase() : null;
  }

  function luminance(value) {
    const hex = normalizeHex(value);
    if (!hex) throw new Error('Contrast requires opaque #RGB or #RRGGBB colors.');
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  }

  function contrast(foreground, background) {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  function record(value, label) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object.');
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new Error(label + ' must be a plain object.');
    for (const key of Reflect.ownKeys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (typeof key !== 'string' || descriptor.get || descriptor.set || !descriptor.enumerable) throw new Error(label + ' contains an unsupported property.');
    }
    return value;
  }

  function exactKeys(value, allowed, required, label) {
    record(value, label);
    if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(label + ' contains an unsupported field.');
    if (required.some(key => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error(label + ' is missing a required field.');
  }

  function modeValues(value, label) {
    exactKeys(value, TOKENS, TOKENS, label);
    const result = {};
    for (const token of TOKENS) {
      const hex = normalizeHex(value[token]);
      if (!hex) throw new Error(label + '.' + token + ' must be an opaque hex color.');
      result[token] = hex;
    }
    return result;
  }

  function audit(theme) {
    record(theme, 'Theme');
    const rows = [];
    for (const mode of MODES) {
      const colors = modeValues(theme[mode], mode);
      function check(foreground, background, threshold, label) {
        const ratio = contrast(colors[foreground], colors[background]);
        rows.push({id: mode + ':' + foreground + ':' + background, mode, foreground, background, threshold, ratio, pass: ratio >= threshold, label});
      }
      for (const token of ['text', 'secondary', 'link']) {
        for (const surface of SURFACES) check(token, surface, 4.5, token + ' on ' + surface);
      }
      for (const fill of ['primary', 'hover', 'pressed']) check('onPrimary', fill, 4.5, 'Button label on ' + fill);
      check('onSelected', 'selected', 4.5, 'Selected text');
      check('onSubtle', 'subtle', 4.5, 'Text on contextual fill');
      for (const token of ['borderStrong', 'focus']) {
        for (const surface of SURFACES) check(token, surface, 3, token + ' against ' + surface);
      }
      check('focus', 'subtle', 3, 'Focus against contextual fill');
      for (const fill of ['primary', 'hover', 'pressed']) {
        for (const surface of SURFACES) check(fill, surface, 3, 'Button ' + fill + ' against ' + surface);
        check(fill, 'subtle', 3, 'Button ' + fill + ' against contextual fill');
      }
    }
    return rows;
  }

  function channels(hex) {
    return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  }

  function suggestion(theme, requestedIssue) {
    const rows = audit(theme);
    const issue = requestedIssue && rows.find(row => row.id === requestedIssue.id);
    if (!issue || issue.pass) return null;
    const token = issue.foreground;
    const mode = issue.mode;
    const colors = modeValues(theme[mode], mode);
    const original = channels(colors[token]);
    const affected = rows.filter(row => row.mode === mode && (row.foreground === token || row.background === token));
    const candidates = new Set();
    // Keep the search on the original color's paths toward black and white.
    for (const end of [0, 255]) {
      for (let step = 0; step <= 255; step++) {
        const next = original.map(c => Math.round(c + (end - c) * step / 255));
        candidates.add('#' + next.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase());
      }
    }
    let best = null;
    let bestDistance = Infinity;
    for (const candidate of candidates) {
      const candidateChannels = channels(candidate);
      const distance = original.reduce((sum, c, i) => sum + (c - candidateChannels[i]) ** 2, 0);
      if (distance >= bestDistance) continue;
      const ratioFor = row => contrast(row.foreground === token ? candidate : colors[row.foreground], row.background === token ? candidate : colors[row.background]);
      // A foreground fix must also preserve the labels when that token is a fill.
      if (!affected.every(row => ratioFor(row) >= row.threshold)) continue;
      best = {token, color: candidate, beforeRatio: issue.ratio, afterRatio: ratioFor(issue), affectedPasses: affected.length, unresolved: []};
      bestDistance = distance;
    }
    return best;
  }

  function validatePreset(input) {
    const required = ['version', 'name', 'basePaletteId', 'font', 'light', 'dark', 'template'];
    exactKeys(input, [...required, 'id'], required, 'Preset');
    if (input.version !== 1) throw new Error('Unsupported preset version. Expected version 1.');
    if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 60 || /[\u0000-\u001F\u007F]/.test(input.name)) throw new Error('Preset name must contain 1–60 characters without control characters.');
    if (!PALETTE_IDS.includes(input.basePaletteId)) throw new Error('Preset has an unknown base palette.');
    if (!FONT_IDS.includes(input.font)) throw new Error('Preset has an unknown typography choice.');
    if (!TEMPLATE_IDS.includes(input.template)) throw new Error('Preset has an unknown screen template.');
    const result = {version: 1, name: input.name.trim(), basePaletteId: input.basePaletteId, font: input.font, light: modeValues(input.light, 'light'), dark: modeValues(input.dark, 'dark'), template: input.template};
    if (Object.prototype.hasOwnProperty.call(input, 'id')) {
      if (typeof input.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(input.id)) throw new Error('Preset ID must contain 1–80 letters, numbers, underscores or hyphens.');
      result.id = input.id;
    }
    return result;
  }

  function validatedList(values) {
    if (!Array.isArray(values) || values.length > MAX_PRESETS) throw new Error('A preset library can contain at most 50 presets.');
    const presets = values.map(validatePreset);
    const ids = new Set();
    for (const preset of presets) {
      if (!preset.id) continue;
      if (ids.has(preset.id)) throw new Error('The preset library contains duplicate IDs.');
      ids.add(preset.id);
    }
    return presets;
  }

  function parseImport(text) {
    if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_IMPORT_BYTES) throw new Error('Choose a preset JSON file smaller than 250 KB.');
    let value;
    try { value = JSON.parse(text); } catch (_) { throw new Error('The file is not valid JSON.'); }
    record(value, 'Preset file');
    if (Object.prototype.hasOwnProperty.call(value, 'presets')) {
      exactKeys(value, ['version', 'presets'], ['version', 'presets'], 'Preset library');
      if (value.version !== 1) throw new Error('Unsupported preset library version.');
      return validatedList(value.presets);
    }
    return [validatePreset(value)];
  }

  function storageOrDefault(storage) {
    const resolved = storage === undefined ? root.localStorage : storage;
    if (!resolved || typeof resolved.getItem !== 'function' || typeof resolved.setItem !== 'function') throw new Error('Storage unavailable');
    return resolved;
  }

  function loadLibrary(storage) {
    let text;
    try { text = storageOrDefault(storage).getItem(STORAGE_KEY); }
    catch (_) { return {presets: [], error: 'Browser storage is unavailable. Presets can still be exported as JSON.'}; }
    if (text === null) return {presets: [], error: null};
    try { return {presets: parseImport(text), error: null}; }
    catch (_) { return {presets: [], error: 'Saved presets could not be read. Import a backup or save a new preset library.'}; }
  }

  function saveLibrary(storage, values) {
    let presets;
    try { presets = validatedList(values); }
    catch (error) { return {presets: [], error: error.message}; }
    try {
      storageOrDefault(storage).setItem(STORAGE_KEY, JSON.stringify({version: 1, presets}));
      return {presets, error: null};
    } catch (_) {
      return {presets, error: 'Presets remain in this tab, but browser storage could not save them. Export a JSON backup.'};
    }
  }

  const api = Object.freeze({TOKENS, PALETTE_IDS, FONT_IDS, TEMPLATE_IDS, STORAGE_KEY, MAX_PRESETS, MAX_IMPORT_BYTES, normalizeHex, contrast, audit, suggestion, validatePreset, parseImport, loadLibrary, saveLibrary});
  root.AtlasCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
