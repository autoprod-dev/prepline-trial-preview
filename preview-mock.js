// TEST PREVIEW ONLY. Answers the access endpoint inside the browser, using the same Code.gs logic
// against a fake sheet kept in this browser's localStorage. Nothing is sent anywhere.
(function () {
  'use strict';
  var SK = 'preview.sheet.v1', DK = 'preview.day.v1', OK = 'preview.override.v1', DEMO_CODE = 'PL-5VT4-CMV2-HR8B-DWM3-G';
  var EP = (window.PREPLINE_GATE || {}).endpoint;
  function g(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function s(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var sheets = JSON.parse(g(SK) || '{}');
  function save() { s(SK, JSON.stringify(sheets)); }
  function day() { return Math.max(1, +(g(DK) || 1)); }
  function signupYmd() { var a = (sheets.Accounts || [])[1]; return a ? String(a[3]) : ''; }
  var RealDate = Date;
  // "Pretend it's day N": the clock is set to sign-up day + (N-1).
  function fakeNow() {
    var su = signupYmd(); if (!su) return RealDate.now();
    var p = su.split('-'); var base = new RealDate(+p[0], +p[1] - 1, +p[2], 12).getTime();
    return base + (day() - 1) * 864e5;
  }
  function FakeDate() { var a = Array.prototype.slice.call(arguments); if (!a.length) return new RealDate(fakeNow()); return new (Function.prototype.bind.apply(RealDate, [null].concat(a)))(); }
  FakeDate.UTC = RealDate.UTC; FakeDate.parse = RealDate.parse; FakeDate.now = fakeNow; FakeDate.prototype = RealDate.prototype;
  function sheet(n) {
    var rows = sheets[n] = sheets[n] || [];
    return {
      getDataRange: function () { return { getValues: function () { return rows.map(function (r) { return r.slice(); }); } }; },
      appendRow: function (r) { rows.push(r.slice()); save(); },
      getRange: function (r, c) { return {
        setValues: function (v) { v.forEach(function (row, i) { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach(function (x, j) { rows[r - 1 + i][c - 1 + j] = x; }); }); save(); },
        setValue: function (x) { rows[r - 1] = rows[r - 1] || []; rows[r - 1][c - 1] = x; save(); },
        getValue: function () { return (rows[r - 1] || [])[c - 1]; } }; }
    };
  }
  var SpreadsheetApp = { getActiveSpreadsheet: function () { return { getSheetByName: function (n) { return sheets[n] ? sheet(n) : null; }, insertSheet: function (n) { sheets[n] = []; return sheet(n); } }; } };
  var Utilities = { formatDate: function (d, tz, f) { var x = new RealDate(d.getTime()), p = function (n) { return ('0' + n).slice(-2); };
      var ymd = x.getFullYear() + '-' + p(x.getMonth() + 1) + '-' + p(x.getDate()); return f === 'yyyy-MM-dd' ? ymd : ymd + ' ' + p(x.getHours()) + ':' + p(x.getMinutes()) + ':' + p(x.getSeconds()); },
    getUuid: function () { return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + RealDate.now()); } };
  var ContentService = { createTextOutput: function (t) { return { t: t, setMimeType: function () { return this; } }; }, MimeType: { JSON: 'json' } };
  var LockService = { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } };
  var GAS = (function (Date, SpreadsheetApp, Utilities, ContentService, LockService) {
// Prepline Access Log — trial + accounts version (4.3.0-trial). Bind to the sheet: Extensions > Apps Script, paste this file.
// Tabs: Attempts (log), Accounts (one row per person, written by this script), Access (Gerard's overrides), Codes (activation codes).
// No secrets in this file.
var TZ = 'Australia/Sydney', TRIAL_DAYS = 7;
function sh_(n) { var s = SpreadsheetApp.getActiveSpreadsheet(); return s.getSheetByName(n) || s.insertSheet(n); }
function now_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm:ss'); }
function day_(d) { return Utilities.formatDate(d || new Date(), TZ, 'yyyy-MM-dd'); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function clean_(v) { v = String(v == null ? '' : v).slice(0, 200); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function str_(v) { return v instanceof Date ? day_(v) : String(v == null ? '' : v).trim(); }
function addDays_(ymd, n) { var p = ymd.split('-'); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
function diff_(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 864e5); }

var ATT_H = ['Login time (Sydney)','Full name','Workplace / company','Email','City/region','Access status','Reason'];
var ACCT_H = ['email','Full name','Workplace / company','signup_date (YYYY-MM-DD)','device_tokens','last_seen','activation_code'];
var ACC_H = ['email','status (allow/block/unlimited)','until_date (YYYY-MM-DD)','Full access (yes/no)','Duration (e.g. 1y, 6m, 30d — from sign-up)','notes','updated_at'];
var CODE_H = ['code','email (optional)','status (active/revoked)','notes'];
function setup() {
  sh_('Attempts').getRange(1,1,1,ATT_H.length).setValues([ATT_H]);
  sh_('Accounts').getRange(1,1,1,ACCT_H.length).setValues([ACCT_H]);
  sh_('Access').getRange(1,1,1,ACC_H.length).setValues([ACC_H]);
  sh_('Codes').getRange(1,1,1,CODE_H.length).setValues([CODE_H]);
}

// ---- accounts ----
function findAcct_(email, token) {
  var sh = sh_('Accounts'), rows = sh.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var e = String(rows[i][0]).trim().toLowerCase(), toks = String(rows[i][4] || '').split(/\s+/);
    if ((email && e === email) || (token && toks.indexOf(token) >= 0)) return { row: i + 1, email: e, name: rows[i][1], workplace: rows[i][2], signup: str_(rows[i][3]), tokens: toks.filter(String), code: str_(rows[i][6]) };
  }
  return null;
}
function newToken_() { return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8); }
function addToken_(a, tok) { if (a.tokens.indexOf(tok) < 0) a.tokens.push(tok); a.tokens = a.tokens.slice(-10); sh_('Accounts').getRange(a.row, 5).setValue(a.tokens.join(' ')); }

// ---- Access tab overrides (last matching row wins) ----
function durationEnd_(signup, dur) {
  var m = String(dur || '').trim().toLowerCase().match(/^(\d+)\s*([dwmy])$/); if (!m || !signup) return '';
  var n = +m[1], p = signup.split('-'), y = +p[0], mo = +p[1] - 1, d = +p[2];
  if (m[2] === 'd') d += n; else if (m[2] === 'w') d += 7 * n; else if (m[2] === 'm') mo += n; else y += n;
  return new Date(Date.UTC(y, mo, d)).toISOString().slice(0, 10);
}
function override_(email, signup) {
  var rows = sh_('Access').getDataRange().getValues();
  for (var i = rows.length - 1; i >= 1; i--) {
    if (String(rows[i][0]).trim().toLowerCase() !== email) continue;
    var s = str_(rows[i][1]).toLowerCase(), u = str_(rows[i][2]), full = /^(y|yes|true)$/i.test(str_(rows[i][3])), dur = str_(rows[i][4]);
    if (s === 'block' || s === 'blocked') return { status: 'blocked', reason: 'blocked_in_sheet' };
    if (s === 'unlimited') return { status: 'unlimited', reason: 'unlimited' };
    if (full) {
      var end = /^\d{4}-\d{2}-\d{2}$/.test(u) ? u : durationEnd_(signup || day_(), dur);
      if (!end) return { status: 'unlimited', reason: 'full_access_no_end' };
      return { status: 'until', until: end, reason: end < day_() ? 'access_expired' : 'full_access' };
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(u)) return { status: 'until', until: u, reason: u < day_() ? 'access_expired' : 'within_until' };
    return null; // plain "allow" row: falls through to trial
  }
  return null;
}
function codeOk_(code) {
  var rows = sh_('Codes').getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) if (str_(rows[i][0]).toUpperCase() === code) return str_(rows[i][2]).toLowerCase() !== 'revoked';
  return false;
}
function status_(a) {
  var o = override_(a.email, a.signup); if (o) return o;
  if (a.code && codeOk_(a.code)) return { status: 'paid', reason: 'activation_code' };
  var end = addDays_(a.signup, TRIAL_DAYS), left = diff_(day_(), end);
  return left > 0 ? { status: 'trial', daysLeft: left, trialEnds: end, reason: 'trial' } : { status: 'expired', trialEnds: end, reason: 'trial_ended' };
}

function doPost(e) {
  var b = {}; try { b = JSON.parse(e.postData.contents); } catch (x) {}
  var act = String(b.action || 'check'), email = String(b.email || '').trim().toLowerCase(), tok = String(b.token || ''), r, a;
  var lock = LockService.getScriptLock(); lock.waitLock(8000);
  try {
    if (act === 'signup') {
      if (!String(b.name||'').trim() || !String(b.establishment||'').trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) r = { status: 'invalid', reason: 'missing_details' };
      else {
        a = findAcct_(email, null);
        if (!a) { sh_('Accounts').appendRow([clean_(email), clean_(b.name), clean_(b.establishment), day_(), '', now_(), '']); a = findAcct_(email, null); }
        tok = newToken_(); addToken_(a, tok); r = status_(a); r.token = tok;
      }
    } else if (act === 'login') {
      a = findAcct_(email, null);
      if (!a) r = { status: 'not_found', reason: 'no_account' }; else { tok = newToken_(); addToken_(a, tok); r = status_(a); r.token = tok; }
    } else if (act === 'activate') {
      a = findAcct_(null, tok); var code = String(b.code || '').trim().toUpperCase();
      if (!a) r = { status: 'not_found', reason: 'no_account' };
      else if (!codeOk_(code)) r = { status: 'bad_code', reason: 'code_not_found' };
      else { sh_('Accounts').getRange(a.row, 7).setValue(code); a.code = code; r = status_(a); }
    } else {
      a = findAcct_(null, tok);
      r = a ? status_(a) : { status: 'not_found', reason: 'unknown_device' };
    }
    if (a) sh_('Accounts').getRange(a.row, 6).setValue(now_());
    sh_('Attempts').appendRow([now_(), clean_(a ? a.name : b.name), clean_(a ? a.workplace : b.establishment), clean_(a ? a.email : email), clean_(b.region), r.status, act + ':' + r.reason + (b.page ? ' (' + clean_(b.page) + ')' : '')]);
  } finally { lock.releaseLock(); }
  return json_(r);
}
function doGet() { return json_({ ok: true }); }

    return { doPost: doPost, setup: setup };
  })(FakeDate, SpreadsheetApp, Utilities, ContentService, LockService);
  if (!sheets.Accounts) { GAS.setup(); }
  function seed() {
    var c = sheets.Codes = sheets.Codes || [];
    if (!c.some(function (r) { return r[0] === DEMO_CODE; })) { c.push([DEMO_CODE, '', 'active', 'demo code for the test preview']); save(); }
    var a = sheets.Accounts[1], email = a ? String(a[0]) : '', o = g(OK) || 'none';
    sheets.Access = [sheets.Access[0]];
    if (email && o === 'unlimited') sheets.Access.push([email, 'unlimited', '', '', '', 'preview toggle', '']);
    if (email && o === 'block') sheets.Access.push([email, 'block', '', '', '', 'preview toggle', '']);
    if (email && o === 'full1y') sheets.Access.push([email, '', '', 'yes', '1y', 'preview toggle', '']);
    save();
  }
  seed();
  var realFetch = window.fetch.bind(window);
  window.fetch = function (url, opt) {
    var u = typeof url === 'string' ? url : (url && url.url) || '';
    if (EP && u.indexOf(EP) === 0) {
      seed(); var out = GAS.doPost({ postData: { contents: (opt && opt.body) || '{}' } }).t;
      return new Promise(function (r) { setTimeout(function () { r(new Response(out, { status: 200, headers: { 'Content-Type': 'application/json' } })); }, 250); });
    }
    if (/script\.google(usercontent)?\.com/.test(u)) return Promise.reject(new TypeError('blocked in test preview'));
    return realFetch(url, opt);
  };
  if (navigator.sendBeacon) { var sb = navigator.sendBeacon.bind(navigator); navigator.sendBeacon = function (u, d) { return /script\.google/.test(String(u)) ? false : sb(u, d); }; }
  // ---- banner ----
  function banner() {
    var b = document.createElement('div'); b.id = 'apPreviewBar';
    b.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:2147483647;background:#7c2d12;color:#fff;font:13px/1.4 system-ui,sans-serif;padding:6px 10px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.2)';
    var d = day(), o = g(OK) || 'none';
    b.innerHTML = '<b style="background:#fff;color:#7c2d12;padding:1px 8px;border-radius:4px">TEST PREVIEW</b>' +
      '<span>No real data \u2014 everything stays in this browser.</span>' +
      '<label>Pretend it\u2019s day <select id="pvDay">' + [1, 3, 7, 8, 30, 400].map(function (n) { return '<option' + (n === d ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label>Override <select id="pvOv">' + [['none', 'none (trial)'], ['unlimited', 'unlimited'], ['block', 'block'], ['full1y', 'full access 1y']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === o ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label>' +
      '<span>Demo code: <code id="pvCode" style="background:#fff;color:#111;padding:1px 6px;border-radius:4px;user-select:all">' + DEMO_CODE + '</code></span>' +
      '<button id="pvReset" style="margin-left:auto;cursor:pointer">Reset preview</button>';
    document.documentElement.appendChild(b);
    b.querySelector('#pvDay').onchange = function (e) { s(DK, e.target.value); location.reload(); };
    b.querySelector('#pvOv').onchange = function (e) { s(OK, e.target.value); location.reload(); };
    b.querySelector('#pvReset').onclick = function () { try { Object.keys(localStorage).forEach(function (k) { if (/^(preview\.|prepline)/.test(k)) localStorage.removeItem(k); }); } catch (e) {} location.reload(); };
    var st = document.createElement('style'); st.textContent = 'body{padding-top:44px!important}#apTrialNote{top:52px!important}#apGate{padding-top:60px!important}';
    document.documentElement.appendChild(st);
  }
  if (document.body) banner(); else document.addEventListener('DOMContentLoaded', banner);
})();
