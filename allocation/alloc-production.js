/* Prepline: shared Production-template layout for Sauce + Plated allocation sheets.
   Matches Gerard's sample outcome workbooks (date → Production → Dishes… → coloured sections + am/pm matrix). */
(function (root) {
  'use strict';

  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function iso(d) {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    var x = d instanceof Date ? d : new Date(d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function addDays(isoD, n) {
    var p = isoD.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] + n);
    return iso(d);
  }
  function dow(isoD) {
    var p = isoD.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]).getDay();
  }
  function dayWord(isoD, style) {
    var w = DAYS[dow(isoD)].toLowerCase();
    if (style === 'short3') return w.slice(0, 3);
    if (style === 'wed') return w === 'wednesday' ? 'wed' : w === 'thursday' ? 'thursday' : w;
    return w;
  }
  function daysBetween(a, b) {
    var pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 864e5);
  }

  /** Join numeric pax parts as "a+b+c" (preserving order). Non-numbers kept as-is. */
  function joinPax(parts) {
    if (!parts || !parts.length) return null;
    if (parts.length === 1) return parts[0];
    return parts.map(function (p) { return p == null ? '' : String(p); }).filter(Boolean).join('+');
  }

  function staffGuess(pax) {
    var n = 0;
    if (typeof pax === 'number') n = pax;
    else if (typeof pax === 'string') {
      if (/retail|tbc/i.test(pax)) return 1;
      var m = pax.match(/\d+/g);
      if (m) n = m.reduce(function (a, x) { return a + Number(x); }, 0);
    }
    if (n >= 2500) return 4;
    if (n >= 1500) return 3;
    if (n >= 500) return 2;
    if (n >= 50) return 1;
    if (n > 0) return 1;
    return null;
  }

  /**
   * Production sheet AOA-style cells for one day.
   * sh = { date, dayName, sections:[{key,fill,label,am,pm,lines:[{dish,paxValue,dayWord,staff,notes}]}] }
   */
  function productionSheetLayout(sh) {
    var C = [];
    var merges = [];
    var put = function (row, col, v, st) { C.push([row, col, v, st || 'body']); };
    var iRefs = [];
    put(0, 0, new Date(sh.date + 'T00:00'), 'date');
    merges.push([0, 0, 0, 5]);
    put(1, 0, 'Production', 'title');
    merges.push([1, 0, 1, 5]);
    ['Dishes', 'No. of pax', 'Date of Function', 'Staff Required', 'Notes', 'allocated Staff']
      .forEach(function (h, i) { put(2, i, h, 'head'); });
    var r = 3;
    (sh.sections || []).forEach(function (sec) {
      put(r, 0, sec.key, 'sec:' + (sec.fill || 'CCCCCC'));
      if (sec.label) put(r, 6, sec.label, 'body');
      put(r, 7, 'am', 'center');
      if (sec.am != null && sec.am !== '') put(r, 8, Number(sec.am) || sec.am, 'count');
      iRefs.push('I' + (r + 1));
      var amRow = r;
      r++;
      put(r, 7, 'pm', 'center');
      if (sec.pm != null && sec.pm !== '') put(r, 8, Number(sec.pm) || sec.pm, 'count');
      var lines = sec.lines && sec.lines.length ? sec.lines : [];
      /* first dish can share the am row visually in samples; we put dishes starting at am row */
      var dishStart = amRow;
      if (lines.length) {
        lines.forEach(function (l, idx) {
          var rr = dishStart + idx;
          while (r <= rr) { r++; }
          put(rr, 0, l.dish || '', 'dish');
          if (l.paxValue != null && l.paxValue !== '') {
            var pv = l.paxValue;
            if (typeof pv === 'string' && /^=/.test(pv)) put(rr, 1, pv, 'formula');
            else if (typeof pv === 'number') put(rr, 1, pv, 'num');
            else put(rr, 1, pv, 'center');
          }
          if (l.dayWord) put(rr, 2, l.dayWord, 'center');
          if (l.staff != null && l.staff !== '') put(rr, 3, l.staff, 'center');
          if (l.notes) put(rr, 4, l.notes, 'body');
          if (l.alloc) put(rr, 5, l.alloc, 'body');
        });
        r = Math.max(r, dishStart + lines.length);
      }
      /* blank spacer after section */
      r++;
      if (r === amRow + 1) r++; /* ensure pm row exists */
      r = Math.max(r, amRow + 2 + 1);
    });
    /* foot formulas */
    var footStart = r;
    put(r, 0, 'AM Staff', 'foot');
    put(r, 5, iRefs.length ? '=' + iRefs.join('+') : '', 'formula');
    r++;
    put(r, 0, 'PM staff', 'foot');
    r++;
    put(r, 0, 'Total staffs', 'foot');
    put(r, 5, '=F' + (footStart + 1), 'formula');
    r++;
    return { cells: C, merges: merges, rows: r, mode: 'production' };
  }

  /**
   * Expand function-dated items onto prep day sheets.
   * opts.includeFunctionDay: Plated=true, Sauce=false
   * opts.ahead: max days ahead to look (default 3)
   * opts.extraAhead: {Thursday:5,...} optional
   */
  function placeOnPrepDays(items, week, opts) {
    opts = opts || {};
    var ahead = opts.ahead != null ? opts.ahead : 3;
    var includeFn = !!opts.includeFunctionDay;
    var extra = opts.extraAhead || {};
    var out = [];
    items.forEach(function (it) {
      var fd = it.functionDate;
      if (!fd) return;
      week.forEach(function (D) {
        var gap = daysBetween(D, fd);
        var dn = DAYS[dow(D)];
        var maxA = extra[dn] != null ? extra[dn] : ahead;
        var ok;
        if (includeFn) ok = gap >= 0 && gap <= maxA;
        else ok = gap >= 1 && gap <= maxA;
        if (!ok) return;
        out.push(Object.assign({}, it, { prepDate: D, date: fd }));
      });
    });
    return out;
  }

  var API = {
    DAYS: DAYS,
    iso: iso,
    addDays: addDays,
    dow: dow,
    dayWord: dayWord,
    daysBetween: daysBetween,
    joinPax: joinPax,
    staffGuess: staffGuess,
    productionSheetLayout: productionSheetLayout,
    placeOnPrepDays: placeOnPrepDays
  };
  root.AllocProduction = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
