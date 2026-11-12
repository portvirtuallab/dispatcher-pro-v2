/**
 * Dispatcher Pro v2 · Results backend (Google Apps Script web app)
 * Port Virtual Lab · Escola Europea – Intermodal Transport
 *
 * Bind this script to a Google Sheet (Extensions → Apps Script),
 * run setup() once, then deploy as a Web app (Execute as: Me, Who has access: Anyone).
 *
 * Endpoints
 *   GET  ?action=ping
 *   GET  ?action=results&classCode=PVL-XXXX&pin=1234      → results of one class (teacher)
 *   POST {"action":"createClass","classCode","school","teacher","pin"}
 *   POST {"action":"submit","classCode","alias","level","shift","met","stars","score","acc","time","errors":{}}
 *
 * POST bodies are sent as text/plain so the browser does not need a CORS preflight.
 */

var SHEET_CLASSES = 'CLASSES';
var SHEET_RESULTS = 'RESULTS';
var LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
var RULES = ['BASE', 'SIZE', 'REEFER', 'ADR', 'INTL', 'OVERNIGHT', 'HOURS', 'UNASSIGNED', 'CUSTOMS'];
var CLASS_HEADERS = ['ClassCode', 'School', 'Teacher', 'PinHash', 'Created', 'Active'];
var RESULT_HEADERS = ['Timestamp', 'ClassCode', 'Nickname', 'Level', 'Shift', 'ObjectiveMet', 'Stars', 'Points', 'AccuracyPct', 'TimeSec'].concat(RULES);

/** Run once from the editor: creates the two tabs with headers. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_CLASSES, CLASS_HEADERS);
  ensureSheet_(ss, SHEET_RESULTS, RESULT_HEADERS);
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === 'ping') return json_({ ok: true, service: 'dispatcher-pro-v2' });
    if (p.action === 'results') return json_(getResults_(p.classCode, p.pin));
    return json_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'submit') return json_(submit_(body));
    if (body.action === 'createClass') return json_(createClass_(body));
    return json_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------- actions ---------- */

function createClass_(b) {
  var code = cleanCode_(b.classCode);
  var pin = String(b.pin || '').trim();
  if (!code) return { ok: false, error: 'BAD_CODE' };
  if (!/^[0-9]{4,8}$/.test(pin)) return { ok: false, error: 'PIN_MUST_BE_4_TO_8_DIGITS' };
  if (findClass_(code)) return { ok: false, error: 'CLASS_EXISTS' };
  var sh = ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_CLASSES, CLASS_HEADERS);
  sh.appendRow([code, text_(b.school, 120), text_(b.teacher, 120), hash_(code + ':' + pin), new Date(), true]);
  return { ok: true, classCode: code };
}

function submit_(b) {
  var code = cleanCode_(b.classCode);
  var cls = findClass_(code);
  if (!cls) return { ok: false, error: 'UNKNOWN_CLASS' };
  if (cls.active === false) return { ok: false, error: 'CLASS_CLOSED' };
  var level = String(b.level || '');
  if (LEVELS.indexOf(level) < 0) return { ok: false, error: 'BAD_LEVEL' };
  var errors = b.errors || {};
  var row = [
    new Date(), code, text_(b.alias, 40) || 'Anonymous', level,
    int_(b.shift, 1, 9999), b.met === true, int_(b.stars, 0, 3),
    int_(b.score, 0, 5000), int_(b.acc, 0, 100), int_(b.time, 0, 3600)
  ].concat(RULES.map(function (k) { return int_(errors[k], 0, 99); }));
  ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_RESULTS, RESULT_HEADERS).appendRow(row);
  return { ok: true };
}

function getResults_(classCode, pin) {
  var code = cleanCode_(classCode);
  var cls = findClass_(code);
  if (!cls || cls.pinHash !== hash_(code + ':' + String(pin || '').trim())) return { ok: false, error: 'BAD_PIN' };
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return { ok: true, results: [] };
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, RESULT_HEADERS.length).getValues();
  var out = data.filter(function (r) { return r[1] === code; }).map(function (r) {
    var errors = {};
    RULES.forEach(function (k, i) { var v = Number(r[10 + i]) || 0; if (v) errors[k] = v; });
    return {
      at: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      alias: r[2], level: r[3], shift: Number(r[4]) || 1, met: r[5] === true,
      stars: Number(r[6]) || 0, score: Number(r[7]) || 0, acc: Number(r[8]) || 0,
      time: Number(r[9]) || 0, errors: errors
    };
  });
  return { ok: true, results: out };
}

/* ---------- helpers ---------- */

function findClass_(code) {
  if (!code) return null;
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_CLASSES);
  if (!sh || sh.getLastRow() < 2) return null;
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, CLASS_HEADERS.length).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === code) {
      return { code: code, pinHash: String(data[i][3]), active: data[i][5] !== false };
    }
  }
  return null;
}

function cleanCode_(c) {
  var s = String(c || '').toUpperCase().trim();
  return /^[A-Z0-9-]{4,16}$/.test(s) ? s : '';
}

function text_(v, max) {
  // Strip characters that a spreadsheet could read as a formula
  return String(v == null ? '' : v).replace(/^[=+\-@]+/, '').slice(0, max).trim();
}

function int_(v, min, max) {
  var n = Math.round(Number(v));
  if (!isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function hash_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
