/**
 * SMT Tech Gym -- Google Apps Script endpoint.
 *
 * SETUP
 *  1. Create a Google Sheet. Copy its ID from the URL and paste it below.
 *  2. script.google.com > New project > paste this file in.
 *  3. Set SUBMIT_TOKEN to the same value as VITE_SUBMIT_TOKEN in .env.local.
 *  4. Deploy > New deployment > type "Web app".
 *       Execute as:      Me
 *       Who has access:  Anyone
 *  5. Copy the /exec URL into VITE_SHEETS_ENDPOINT in .env.local.
 *  6. Re-deploy (new version) after ANY edit to this file. Apps Script serves
 *     the last deployed version, not the last saved one.
 *
 * The game posts text/plain on purpose: it dodges the CORS preflight that
 * Apps Script cannot answer.
 */

var SHEET_ID = 'PASTE_YOUR_SHEET_ID_HERE';
var SUBMIT_TOKEN = 'change-me';

var APPLICATION_HEADERS = [
  'timestamp', 'email', 'name', 'nickname', 'year', 'link', 'builtWhat',
  'starter', 'minutesPlayed', 'npcsTalkedTo', 'puzzleMoves', 'puzzleSolvedSec',
  'battleTurns', 'mathAttempts', 'sessionId', 'events',
];

var ABANDONED_HEADERS = [
  'timestamp', 'stage', 'nickname', 'starter', 'minutesPlayed', 'npcsTalkedTo',
  'puzzleMoves', 'battleTurns', 'mathAttempts', 'sessionId', 'events',
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
    app.year || '',
    app.link || '',
    app.built || '',
    t.starter || '',
    minutes(t.msElapsed),
    (t.npcsTalkedTo || []).join(', '),
    t.puzzleMoves || 0,
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
    t.puzzleMoves || 0,
    t.battleTurns || 0,
    t.mathAttempts || 0,
    t.sessionId || '',
    (t.events || []).join(' | '),
  ]);
}

function sheetFor(name, headers) {
  var book = SpreadsheetApp.openById(SHEET_ID);
  var sheet = book.getSheetByName(name);
  if (!sheet) {
    sheet = book.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function minutes(ms) {
  return ms ? Math.round((ms / 60000) * 10) / 10 : 0;
}

/** Run this once from the editor to confirm the sheet wiring works. */
function testAppend() {
  appendApplication({
    application: { email: 'test@stanford.edu', name: 'Test', year: '', link: '', built: '' },
    telemetry: { playerName: 'TEST', starter: 'francis', msElapsed: 540000, npcsTalkedTo: ['greeter'],
      puzzleMoves: 9, puzzleSolvedMs: 240000, battleTurns: 12, mathAttempts: 1,
      sessionId: 'local-test', events: ['0s session:started'] },
  });
}
