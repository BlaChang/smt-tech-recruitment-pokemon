/**
 * SMT Tech Gym -- Google Apps Script endpoint.
 *
 * SETUP
 *  1. Create a Google Sheet. Copy its ID from the URL and paste it below.
 *  2. script.google.com > New project > paste this file in.
 *  3. Set SUBMIT_TOKEN to the same value as SUBMIT_TOKEN in Vercel's
 *     environment variables. Note: no VITE_ prefix. The game never sees this
 *     token -- api/submit.ts attaches it server-side -- so it is not visible
 *     in the page source and can be rotated without a rebuild.
 *  4. Deploy > New deployment > type "Web app".
 *       Execute as:      Me
 *       Who has access:  Anyone
 *  5. Copy the /exec URL into SHEETS_ENDPOINT in Vercel's environment
 *     variables.
 *  6. Re-deploy (new version) after ANY edit to this file. Apps Script serves
 *     the last deployed version, not the last saved one.
 *
 * Requests arrive from api/submit.ts rather than from a browser, so CORS
 * does not apply; the text/plain content type is kept because it is what
 * Apps Script is happiest with.
 */

var SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
var SUBMIT_TOKEN = 'change-me';

/**
 * Column order. appendRow below must match this exactly.
 *
 * Add new columns at the END of the list, never in the middle: sheetFor
 * appends any heading a live tab is missing, but refuses to reorder one,
 * because that would relabel every row already collected.
 */
var APPLICATION_HEADERS = [
  'timestamp', 'email', 'name', 'nickname', 'kind', 'year', 'knowsAlready',
  'link', 'builtWhat', 'starter', 'minutesPlayed', 'npcsTalkedTo',
  'puzzleMoves', 'puzzleSolvedSec', 'battleTurns', 'mathAttempts',
  'sessionId', 'events',
];

var ABANDONED_HEADERS = [
  'timestamp', 'stage', 'nickname', 'starter', 'minutesPlayed',
  'npcsTalkedTo', 'puzzleMoves', 'battleTurns', 'mathAttempts', 'sessionId',
  'events',
  // Appended, not inserted. See sheetFor.
  'email',
];

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Obfuscation, not security: it only keeps drive-by junk out of the sheet.
    if (body.token !== SUBMIT_TOKEN) {
      return ContentService.createTextOutput('forbidden');
    }

    if (body.kind === 'application') {
      appendApplication(body);
    } else if (body.kind === 'abandoned') {
      appendAbandoned(body);
    } else {
      return ContentService.createTextOutput('unknown kind');
    }

    return ContentService.createTextOutput('ok');
  } catch (err) {
    console.error(err);
    return ContentService.createTextOutput('error');
  }
}

function appendApplication(body) {
  var app = body.application || {};
  var t = body.telemetry || {};
  sheetFor('applications', APPLICATION_HEADERS).appendRow([
    new Date(),
    app.email || '',
    app.name || '',
    t.playerName || '',
    app.kind || '',
    app.year || '',
    app.experience || '',
    app.link || '',
    app.built || '',
    t.starter || '',
    minutes(t.msElapsed),
    (t.npcsTalkedTo || []).join(', '),
    t.panelPresses || 0,
    t.puzzleSolvedMs ? Math.round(t.puzzleSolvedMs / 1000) : '',
    t.battleTurns || 0,
    t.mathAttempts || 0,
    t.sessionId || '',
    (t.events || []).join(' | '),
  ]);
}

/**
 * Rows for people who closed the tab without applying. The gym is hard-gated,
 * so this is the only way to see the drop-off that gate is costing you.
 */
function appendAbandoned(body) {
  var t = body.telemetry || {};
  sheetFor('abandoned', ABANDONED_HEADERS).appendRow([
    new Date(),
    t.stage || '',
    t.playerName || '',
    t.starter || '',
    minutes(t.msElapsed),
    (t.npcsTalkedTo || []).join(', '),
    t.panelPresses || 0,
    t.battleTurns || 0,
    t.mathAttempts || 0,
    t.sessionId || '',
    (t.events || []).join(' | '),
    t.playerEmail || '',
  ]);
}

/**
 * The tab, with its header row brought up to date.
 *
 * Headers used to be written only when the sheet was created, so adding a
 * column to the lists above did nothing to a tab that already existed -- new
 * values landed under the old headings, shifted by one, silently. That
 * caught us three times.
 *
 * The rule now is that columns may only ever be APPENDED. Any heading this
 * script expects but the sheet lacks is added on the right, and rows already
 * in the sheet simply have it blank. Insert a column in the middle of one of
 * the lists above and this throws instead, because doing that would silently
 * relabel every historical row.
 */
function sheetFor(name, headers) {
  var book = SpreadsheetApp.openById(SHEET_ID);
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    return sheet;
  }

  var width = sheet.getLastColumn();
  var existing = width ? sheet.getRange(1, 1, 1, width).getValues()[0] : [];
  if (existing.length === headers.length) return sheet;

  if (existing.length > headers.length) {
    throw new Error(
      'Sheet "' + name + '" has ' + existing.length + ' columns but the script '
      + 'expects ' + headers.length + '. Rename the tab to start a fresh one.');
  }

  for (var i = 0; i < existing.length; i++) {
    if (existing[i] !== headers[i]) {
      throw new Error(
        'Sheet "' + name + '" column ' + (i + 1) + ' is "' + existing[i]
        + '" but the script expects "' + headers[i] + '". Columns may only be '
        + 'appended, never inserted or reordered. Rename the tab to start a '
        + 'fresh one, or move the new heading to the end of the list.');
    }
  }

  var added = headers.slice(existing.length);
  sheet.getRange(1, existing.length + 1, 1, added.length).setValues([added]);
  sheet.setFrozenRows(1);
  return sheet;
}

function minutes(ms) {
  return ms ? Math.round((ms / 60000) * 10) / 10 : 0;
}

/** Run this once from the editor to confirm the sheet wiring works. */
function testAppend() {
  appendApplication({
    application: {
      email: 'test@stanford.edu', name: 'Test', kind: 'Wacky builder',
      year: 'Frosh', experience: 'some Python', link: '', built: '',
    },
    telemetry: { playerName: 'TEST', starter: 'francis', msElapsed: 540000, npcsTalkedTo: ['greeter'],
      puzzleMoves: 9, puzzleSolvedMs: 240000, battleTurns: 12, mathAttempts: 1,
      sessionId: 'local-test', events: ['0s session:started'] },
  });
}
