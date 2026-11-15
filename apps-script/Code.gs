/**
 * Dispatcher Pro v2 · Results backend (Google Apps Script web app)
 * Port Virtual Lab · Escola Europea – Intermodal Transport
 *
 * Bind this script to a Google Sheet (Extensions → Apps Script),
 * run setup() once, then deploy as a Web app (Execute as: Me, Who has access: Anyone).
 *
 * Students no longer join with a class code: they give their school, name and
 * e-mail and play. The leaderboard is public and never exposes an e-mail; the
 * full table, e-mail included, needs the teacher password kept in SETTINGS.
 *
 * Endpoints
 *   GET  ?action=ping
 *   GET  ?action=leaderboard&window=hour|day|week|month|all[&level=beginner]
 *   GET  ?action=results&pin=...                         → every row, e-mail included (teacher)
 *   POST {"action":"submit","school","name","email","level","shift","met","stars","score","acc","time","errors":{}}
 *   POST {"action":"reset","pin","window":"hour|day|week|month|all"}
 *
 * POST bodies are sent as text/plain so the browser does not need a CORS preflight.
 */

var SHEET_RESULTS = 'RESULTS';
var SHEET_SETTINGS = 'SETTINGS';
var LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
var RULES = ['BASE', 'SIZE', 'REEFER', 'ADR', 'INTL', 'OVERNIGHT', 'HOURS', 'UNASSIGNED', 'CUSTOMS'];
var RESULT_HEADERS = ['Timestamp', 'School', 'Student', 'Email', 'Level', 'Shift', 'ObjectiveMet', 'Stars', 'Points', 'AccuracyPct', 'TimeSec'].concat(RULES);
var SETTINGS_HEADERS = ['KEY', 'VALUE', 'NOTE'];
var LEADERBOARD_MAX = 100;

/** Minutes covered by each leaderboard window. 0 means "everything". */
var WINDOWS = { hour: 60, day: 60 * 24, week: 60 * 24 * 7, month: 60 * 24 * 30, all: 0 };

/** Run once from the editor: creates the tabs and the settings row. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSheet_(ss, SHEET_RESULTS, RESULT_HEADERS);
  var st = ensureSheet_(ss, SHEET_SETTINGS, SETTINGS_HEADERS);
  if (st.getLastRow() < 2) {
    st.appendRow(['TEACHER_PIN', 'changeme', 'Password for the teacher panel. Change it here; 8+ characters recommended.']);
    st.setColumnWidth(3, 460);
  }
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
    if (p.action === 'leaderboard') return json_(leaderboard_(p.window, p.level));
    if (p.action === 'results') return json_(allResults_(p.pin));
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
    if (body.action === 'reset') return json_(reset_(body));
    return json_({ ok: false, error: 'UNKNOWN_ACTION' });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

/* ---------- actions ---------- */

function submit_(b) {
  var level = String(b.level || '');
  if (LEVELS.indexOf(level) < 0) return { ok: false, error: 'BAD_LEVEL' };
  var name = text_(b.name, 60);
  var school = text_(b.school, 90);
  if (!name) return { ok: false, error: 'NAME_REQUIRED' };
  if (!school) return { ok: false, error: 'SCHOOL_REQUIRED' };
  var email = email_(b.email);
  if (!email) return { ok: false, error: 'BAD_EMAIL' };
  var errors = b.errors || {};
  var row = [
    new Date(), school, name, email, level,
    int_(b.shift, 1, 9999), b.met === true, int_(b.stars, 0, 3),
    int_(b.score, 0, 5000), int_(b.acc, 0, 100), int_(b.time, 0, 3600)
  ].concat(RULES.map(function (k) { return int_(errors[k], 0, 99); }));
  ensureSheet_(SpreadsheetApp.getActiveSpreadsheet(), SHEET_RESULTS, RESULT_HEADERS).appendRow(row);
  return { ok: true };
}

/** Public board. Never returns an e-mail: it is shown to the whole class. */
function leaderboard_(windowKey, levelKey) {
  var rows = readRows_(windowKey);
  if (levelKey && LEVELS.indexOf(String(levelKey)) >= 0) {
    rows = rows.filter(function (r) { return r.level === levelKey; });
  }
  rows.sort(function (a, b) { return b.score - a.score || a.time - b.time; });
  return {
    ok: true,
    window: windowFor_(windowKey),
    count: rows.length,
    results: rows.slice(0, LEADERBOARD_MAX).map(function (r) {
      return {
        at: r.at, school: r.school, name: r.name, level: r.level, shift: r.shift,
        met: r.met, stars: r.stars, score: r.score, acc: r.acc, time: r.time
      };
    })
  };
}

/** Teacher view: every column, e-mail and mistake breakdown included. */
function allResults_(pin) {
  if (!checkPin_(pin)) return { ok: false, error: 'BAD_PIN' };
  return { ok: true, results: readRows_('all') };
}

function reset_(b) {
  if (!checkPin_(b.pin)) return { ok: false, error: 'BAD_PIN' };
  var key = windowFor_(b.window);
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return { ok: true, deleted: 0 };
  var cutoff = cutoff_(key);
  var stamps = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var deleted = 0;
  // Walk upwards so deleting a row does not shift the ones still to check.
  for (var i = stamps.length - 1; i >= 0; i--) {
    if (!cutoff || toDate_(stamps[i][0]) >= cutoff) { sh.deleteRow(i + 2); deleted++; }
  }
  return { ok: true, deleted: deleted, window: key };
}

/* ---------- helpers ---------- */

function readRows_(windowKey) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_RESULTS);
  if (!sh || sh.getLastRow() < 2) return [];
  var cutoff = cutoff_(windowFor_(windowKey));
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, RESULT_HEADERS.length).getValues();
  var out = [];
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var at = toDate_(r[0]);
    if (cutoff && at < cutoff) continue;
    var errors = {};
    RULES.forEach(function (k, j) { var v = Number(r[11 + j]) || 0; if (v) errors[k] = v; });
    out.push({
      at: at ? at.toISOString() : String(r[0]),
      school: String(r[1]), name: String(r[2]), email: String(r[3]), level: String(r[4]),
      shift: Number(r[5]) || 1, met: r[6] === true, stars: Number(r[7]) || 0,
      score: Number(r[8]) || 0, acc: Number(r[9]) || 0, time: Number(r[10]) || 0, errors: errors
    });
  }
  return out;
}

function windowFor_(k) {
  var s = String(k || 'all').toLowerCase();
  return WINDOWS.hasOwnProperty(s) ? s : 'all';
}

/** Start of the requested window, or null for "everything". */
function cutoff_(key) {
  var mins = WINDOWS[key];
  return mins ? new Date(Date.now() - mins * 60 * 1000) : null;
}

function toDate_(v) {
  if (v instanceof Date) return v;
  var d = new Date(v);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function checkPin_(pin) {
  var given = String(pin == null ? '' : pin).trim();
  if (!given) return false;
  var stored = setting_('TEACHER_PIN');
  return !!stored && given === stored;
}

function setting_(key) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SETTINGS);
  if (!sh || sh.getLastRow() < 2) return '';
  var data = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).trim().toUpperCase() === key) return String(data[i][1]).trim();
  }
  return '';
}

function text_(v, max) {
  // Strip characters that a spreadsheet could read as a formula
  return String(v == null ? '' : v).replace(/^[=+\-@]+/, '').slice(0, max).trim();
}

function email_(v) {
  var s = text_(v, 120).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : '';
}

function int_(v, min, max) {
  var n = Math.round(Number(v));
  if (!isFinite(n)) n = min;
  return Math.max(min, Math.min(max, n));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
