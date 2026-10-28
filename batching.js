/* Prepline 4.6.0 — cross-dish / cross-day batching + day filter bar.
 * Batch key: normalised ingredient name + prep method + unit.
 * Valid batch prep day D:
 *   - never Sat/Sun; respect day-omit (blockedDays)
 *   - D <= earliest member function day minus category min lead
 *     (fish/micro min lead 1; longer-lead cats use 0 so the 3-day expiry can merge Mon–Wed)
 *   - (latest member function day − D) <= EXPIRY_MAX (3), regardless of 4-day lead
 * If no single D fits all members, greedy-split into largest valid groups.
 * Every merged line carries prep day + reason (e.g. "Merged: Mon/Tue/Wed uses all within 3-day expiry window").
 */
(function (root) {
  'use strict';
  var EXPIRY_MAX = 3;
  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

  // Default: batch these prepCat keys (protein / veg / dry / oils / jus-sauces / starch / dairy / dressing / crab).
  var DEFAULT_BATCHABLE = {
    poultry: true, redmeat: true, seafood: true, veg: true, dry: true, oil: true,
    gels: true, dressing: true, dairy: true, starch: true, crabcroq: true,
    garnish: false, micro: false
  };

  var state = {
    batchAcrossOn: true,
    unbatched: {},       // batchKey -> true (user unbatched this key)
    dayFilter: 'all',    // 'all' | weekday name
    sectionFilter: 'all',
    listAnchor: 'prep',  // 'prep' | 'function' — group/filter by prep day vs function day
    batchable: Object.assign({}, DEFAULT_BATCHABLE)
  };

  function dayIdx(d) { return WEEKDAYS.indexOf(d); }
  function shortDay(d) { return SHORT[d] || (d ? String(d).slice(0, 3) : '—'); }
  function forwardDays(from, to) {
    var a = dayIdx(from), b = dayIdx(to);
    if (a < 0 || b < 0) return null;
    return (b - a + 7) % 7;
  }
  /** Shift a weekday back by `n` days (n>=0). */
  function shiftBack(day, n) {
    var i = dayIdx(day);
    if (i < 0) return '';
    return WEEKDAYS[((i - n) % 7 + 7) % 7];
  }

  function normText(s) {
    return String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  var METHOD_VERBS = [
    'trim', 'wash', 'blanch', 'steam', 'roast', 'grill', 'sear', 'dice', 'slice', 'peel',
    'julienne', 'brunoise', 'chiffonade', 'portion', 'crumb', 'bread', 'marinate', 'brine',
    'confit', 'braise', 'poach', 'fry', 'deep fry', 'sous vide', 'puree', 'reduce', 'glaze',
    'pickle', 'pick', 'chop', 'mince', 'grate', 'zest', 'segment', 'debone', 'butterfly',
    'tie', 'roll', 'press', 'chill', 'freeze', 'thaw', 'defrost', 'strain', 'whisk', 'blend',
    'emulsify', 'infuse', 'render', 'clarify', 'skim', 'toast', 'char', 'smoke', 'cure',
    'ferment', 'proof', 'bake', 'cook', 'make', 'prep', 'collect', 'weigh', 'drain', 'pat dry'
  ];

  /** Parse "Trim chicken breast" / "Chicken breast / trim" → {name, method, label}. */
  function parseTaskParts(task) {
    var raw = String(task || '').trim();
    var t = normText(raw);
    var method = '', name = t;
    var slash = t.split(/\s*\/\s*/);
    if (slash.length >= 2) {
      // "chicken breast / trim" or "trim / chicken breast"
      var a = slash[0], b = slash.slice(1).join(' ');
      if (METHOD_VERBS.indexOf(a) >= 0) { method = a; name = b; }
      else if (METHOD_VERBS.indexOf(b) >= 0) { method = b; name = a; }
      else { method = b; name = a; }
    } else {
      for (var i = 0; i < METHOD_VERBS.length; i++) {
        var v = METHOD_VERBS[i];
        var re = new RegExp('^' + v.replace(/ /g, '\\s+') + '\\b\\s*(?:of\\s+|the\\s+)?');
        if (re.test(t)) { method = v; name = t.replace(re, '').trim(); break; }
        var re2 = new RegExp('\\b' + v.replace(/ /g, '\\s+') + '$');
        if (re2.test(t)) { method = v; name = t.replace(re2, '').trim(); break; }
      }
    }
    name = name.replace(/^(the|a|an)\s+/, '').trim();
    if (!name) name = t || 'item';
    var label = method ? (cap(name) + ' / ' + method) : cap(name);
    return { name: name, method: method || 'prep', label: label };
  }
  function cap(s) {
    return String(s || '').replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); });
  }

  function unitKey(unit, toBaseQty) {
    if (typeof toBaseQty === 'function') {
      try { return toBaseQty(1, unit).key || String(unit || '').toLowerCase(); } catch (e) {}
    }
    var u = String(unit || '').toLowerCase().trim();
    if (/^(g|gm|gms|gram|grams|kg|kgs|kilo|kilos)$/.test(u)) return 'g';
    if (/^(ml|millilitre|millilitres|l|lt|ltr|litre|litres)$/.test(u)) return 'ml';
    return u;
  }

  function batchKey(row, deps) {
    var parts = parseTaskParts(row.task || row.item);
    var uk = unitKey(row.unit, deps && deps.toBaseQty);
    return parts.name + '|' + parts.method + '|' + uk;
  }

  function minLeadForBatch(lead) {
    var L = Number(lead);
    if (!Number.isFinite(L)) return 0;
    // Fish / micro (lead 1): must start at least 1 day before earliest function.
    // Longer leads: upper bound is the earliest function day itself; the 3-day
    // expiry window is what limits how early/late the shared batch can sit.
    return L <= 1 ? L : 0;
  }

  function isWeekend(d) { return d === 'Saturday' || d === 'Sunday'; }

  /**
   * Latest acceptable D (closest to events) and earliest acceptable D for a set of
   * function days + category lead. Returns null if empty.
   * deps: { blockedDays: Set, weekendShift profile unused here — hard never Sat/Sun }
   */
  function validDayWindow(funcDays, lead, blocked) {
    var idxs = funcDays.map(dayIdx).filter(function (i) { return i >= 0; });
    if (!idxs.length) return null;
    var earliestIdx = Math.min.apply(null, idxs);
    var latestIdx = Math.max.apply(null, idxs);
    var earliestFunc = WEEKDAYS[earliestIdx];
    var latestFunc = WEEKDAYS[latestIdx];
    var span = latestIdx - earliestIdx;
    if (span > EXPIRY_MAX) return null; // cannot cover in one batch even at earliestFunc

    var ml = minLeadForBatch(lead);
    // D_max: earliestFunc shifted back by min lead (and earlier if that lands on weekend/omit)
    var dMax = shiftBack(earliestFunc, ml);
    var guard = 0;
    while (guard++ < 7 && (isWeekend(dMax) || (blocked && blocked.has && blocked.has(dMax)))) {
      dMax = shiftBack(dMax, 1);
    }
    // D_min: latestFunc - EXPIRY_MAX (may be weekend — candidates skip those)
    var dMinAbs = latestIdx - EXPIRY_MAX; // may be negative (= previous week)
    // Enumerate candidates: absolute offsets from earliestFunc
    // Represent D as days-before earliestFunc: leadFrom(D, earliestFunc) = k, k >= ml
    // and leadFrom(D, latestFunc) = k + span <= EXPIRY_MAX → k <= EXPIRY_MAX - span
    var kMin = ml; // at least min lead before earliest
    var kMax = EXPIRY_MAX - span; // expiry against latest
    if (kMin > kMax) return null;

    var candidates = [];
    for (var k = kMin; k <= kMax; k++) {
      var d = shiftBack(earliestFunc, k);
      if (isWeekend(d)) continue;
      if (blocked && blocked.has && blocked.has(d)) continue;
      candidates.push({ day: d, k: k });
    }
    if (!candidates.length) return null;
    // Prefer latest possible (smallest k) — closest to service
    candidates.sort(function (a, b) { return a.k - b.k; });
    return {
      day: candidates[0].day,
      candidates: candidates.map(function (c) { return c.day; }),
      earliestFunc: earliestFunc,
      latestFunc: latestFunc,
      span: span
    };
  }

  function coversPhrase(members, deps) {
    // "Mon Dish A, Tue Dish B, Wed Dish C"
    var getEventDay = deps.getEventDay || function () { return ''; };
    var cleanDish = deps.cleanDishName || function (d) { return d; };
    return members.map(function (r) {
      var ed = getEventDay(r.dish) || r.eventDay || '';
      return shortDay(ed) + ' ' + cleanDish(r.dish);
    }).join(', ');
  }

  function reasonFor(win, members, deps) {
    if (!win) return '';
    var days = [];
    var seen = {};
    var getEventDay = deps.getEventDay || function () { return ''; };
    members.forEach(function (r) {
      var ed = getEventDay(r.dish) || '';
      if (ed && !seen[ed]) { seen[ed] = true; days.push(shortDay(ed)); }
    });
    days.sort(function (a, b) {
      var order = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return order.indexOf(a) - order.indexOf(b);
    });
    if (members.length === 1) {
      return 'Solo: prep ' + shortDay(win.day) + ' for ' + (days[0] || 'event');
    }
    return 'Merged: ' + days.join('/') + ' uses all within ' + EXPIRY_MAX + '-day expiry window';
  }

  function isBatchableRow(row) {
    var cat = row.prepCat || '';
    if (!cat) return false;
    if (state.unbatched[batchKey(row, {})]) return false;
    if (state.batchable[cat] === false) return false;
    if (state.batchable[cat] === true) return true;
    return !!DEFAULT_BATCHABLE[cat];
  }

  /**
   * Build batch groups from rows. Non-batchable / unbatched stay as singletons.
   * deps: { getEventDay, computeTotal, toBaseQty, cleanDishName, blockedDays }
   */
  function buildBatches(rows, deps) {
    deps = deps || {};
    var blocked = deps.blockedDays || new Set();
    var getEventDay = deps.getEventDay || function () { return ''; };
    var computeTotal = deps.computeTotal || function () { return null; };
    var toBaseQty = deps.toBaseQty || function (n, u) { return { n: n, u: u, key: String(u || '').toLowerCase() }; };

    if (!state.batchAcrossOn) {
      return rows.map(function (r) { return singleton(r, deps); });
    }

    // Bucket by batch key among batchable rows; others stay solo.
    var buckets = {};
    var order = [];
    var solos = [];
    rows.forEach(function (r, idx) {
      if (!isBatchableRow(r)) {
        solos.push({ row: r, idx: idx });
        return;
      }
      var key = batchKey(r, deps);
      // Per-key unbatch
      if (state.unbatched[key]) {
        solos.push({ row: r, idx: idx });
        return;
      }
      var ed = getEventDay(r.dish);
      if (!ed) {
        solos.push({ row: r, idx: idx });
        return;
      }
      if (!buckets[key]) { buckets[key] = []; order.push(key); }
      buckets[key].push({ row: r, idx: idx, eventDay: ed });
    });

    var groups = [];
    order.forEach(function (key) {
      var members = buckets[key].slice();
      // Sort by event day Mon→Sun then dish
      members.sort(function (a, b) {
        var da = dayIdx(a.eventDay), db = dayIdx(b.eventDay);
        if (da !== db) return da - db;
        return String(a.row.dish).localeCompare(String(b.row.dish));
      });
      // Greedy pack into valid windows
      var packs = greedyPack(members, blocked);
      packs.forEach(function (pack) {
        groups.push(makeGroup(key, pack, deps));
      });
    });

    solos.forEach(function (s) {
      groups.push(singleton(s.row, deps));
    });

    // Stable-ish order by prep day then label
    groups.sort(function (a, b) {
      var da = dayIdx(a.day) < 0 ? 99 : dayIdx(a.day);
      var db = dayIdx(b.day) < 0 ? 99 : dayIdx(b.day);
      if (da !== db) return da - db;
      return String(a.taskLabel).localeCompare(String(b.taskLabel));
    });
    return groups;
  }

  function greedyPack(members, blocked) {
    // members: [{row, idx, eventDay}]
    var remaining = members.slice();
    var packs = [];
    while (remaining.length) {
      // Grow largest prefix (already sorted by event day) that has a valid D
      var best = null;
      for (var len = remaining.length; len >= 1; len--) {
        var slice = remaining.slice(0, len);
        // Same lead/cat: use first row's
        var lead = Number.isFinite(slice[0].row.leadDays) ? slice[0].row.leadDays : 4;
        var funcDays = slice.map(function (m) { return m.eventDay; });
        var win = validDayWindow(funcDays, lead, blocked);
        if (win) { best = { slice: slice, win: win }; break; }
      }
      if (!best) {
        // Shouldn't happen for len=1 with lead<=1 quirks; force singleton on its own prep day
        var one = remaining.shift();
        packs.push({ members: [one], win: { day: one.row.day || one.eventDay || '', earliestFunc: one.eventDay, latestFunc: one.eventDay, span: 0 } });
        continue;
      }
      packs.push({ members: best.slice, win: best.win });
      remaining = remaining.slice(best.slice.length);
      // Re-sort remaining in case we need different order — keep event-day order
    }
    return packs;
  }

  function makeGroup(key, pack, deps) {
    var members = pack.members.map(function (m) { return m.row; });
    var win = pack.win;
    var parts = parseTaskParts(members[0].task);
    var computeTotal = deps.computeTotal || function () { return null; };
    var toBaseQty = deps.toBaseQty || function (n, u) { return { n: n, u: u, key: String(u || '').toLowerCase() }; };
    var total = 0, hasTotal = false, unit = members[0].unit || '';
    var dishes = [];
    members.forEach(function (r) {
      if (dishes.indexOf(r.dish) < 0) dishes.push(r.dish);
      var raw = computeTotal(r);
      if (raw === null || raw === undefined) return;
      var based = toBaseQty(raw, r.unit);
      total += based.n;
      hasTotal = true;
      unit = based.u || unit;
      // display unit via key
      if (based.key === 'g') unit = 'g';
      if (based.key === 'ml') unit = 'ml';
    });
    var merged = members.length > 1;
    return {
      batchKey: key,
      taskLabel: parts.label,
      name: parts.name,
      method: parts.method,
      unit: unit,
      total: total,
      hasTotal: hasTotal,
      day: win.day || members[0].day || '',
      section: members[0].section,
      prepCat: members[0].prepCat,
      rows: members,
      dishes: dishes,
      merged: merged,
      covers: coversPhrase(members, deps),
      reason: reasonFor(win, members, deps),
      window: win
    };
  }

  function singleton(row, deps) {
    var parts = parseTaskParts(row.task);
    var computeTotal = deps.computeTotal || function () { return null; };
    var toBaseQty = deps.toBaseQty || function (n, u) { return { n: n, u: u, key: String(u || '').toLowerCase() }; };
    var raw = computeTotal(row);
    var based = raw === null || raw === undefined ? null : toBaseQty(raw, row.unit);
    var getEventDay = deps.getEventDay || function () { return ''; };
    var ed = getEventDay(row.dish) || '';
    var day = row.day || '';
    var win = day ? { day: day, earliestFunc: ed, latestFunc: ed, span: 0 } : null;
    return {
      batchKey: batchKey(row, deps),
      taskLabel: parts.label,
      name: parts.name,
      method: parts.method,
      unit: based ? based.u : (row.unit || ''),
      total: based ? based.n : 0,
      hasTotal: !!based,
      day: day,
      section: row.section,
      prepCat: row.prepCat,
      rows: [row],
      dishes: [row.dish],
      merged: false,
      covers: coversPhrase([row], deps),
      reason: win ? reasonFor(win, [row], deps) : '',
      window: win
    };
  }

  // ----- UI state -----
  function setBatchAcross(on) { state.batchAcrossOn = !!on; }
  function toggleUnbatch(key) {
    if (state.unbatched[key]) delete state.unbatched[key];
    else state.unbatched[key] = true;
  }
  function isUnbatched(key) { return !!state.unbatched[key]; }
  function setDayFilter(d) { state.dayFilter = d || 'all'; }
  function setSectionFilter(s) { state.sectionFilter = s || 'all'; }
  function setListAnchor(a) { state.listAnchor = (a === 'function') ? 'function' : 'prep'; }
  function setBatchable(cat, on) { state.batchable[cat] = !!on; }
  function getState() { return state; }
  function loadState(s) {
    if (!s || typeof s !== 'object') return;
    if (typeof s.batchAcrossOn === 'boolean') state.batchAcrossOn = s.batchAcrossOn;
    if (s.unbatched && typeof s.unbatched === 'object') state.unbatched = Object.assign({}, s.unbatched);
    if (typeof s.dayFilter === 'string') state.dayFilter = s.dayFilter;
    if (typeof s.sectionFilter === 'string') state.sectionFilter = s.sectionFilter;
    if (s.listAnchor === 'prep' || s.listAnchor === 'function') state.listAnchor = s.listAnchor;
    if (s.batchable && typeof s.batchable === 'object') state.batchable = Object.assign({}, DEFAULT_BATCHABLE, s.batchable);
  }
  function exportState() {
    return {
      batchAcrossOn: state.batchAcrossOn,
      unbatched: Object.assign({}, state.unbatched),
      dayFilter: state.dayFilter,
      sectionFilter: state.sectionFilter,
      listAnchor: state.listAnchor,
      batchable: Object.assign({}, state.batchable)
    };
  }

  /** Filter rows by sticky bar (day chip + section). Search stays separate. */
  function filterRows(rows, deps) {
    deps = deps || {};
    var getEventDay = deps.getEventDay || function () { return ''; };
    var dayF = state.dayFilter;
    var secF = state.sectionFilter;
    var anchor = state.listAnchor;
    return rows.filter(function (r) {
      if (secF && secF !== 'all' && r.section !== secF) return false;
      if (!dayF || dayF === 'all') return true;
      var d = anchor === 'function' ? (getEventDay(r.dish) || '') : (r.day || '');
      return d === dayF;
    });
  }

  /** Counts per day for chips, based on anchor. */
  function dayCounts(rows, deps) {
    deps = deps || {};
    var getEventDay = deps.getEventDay || function () { return ''; };
    var counts = { all: rows.length };
    WEEKDAYS.forEach(function (d) { counts[d] = 0; });
    rows.forEach(function (r) {
      var d = state.listAnchor === 'function' ? (getEventDay(r.dish) || '') : (r.day || '');
      if (d && counts[d] !== undefined) counts[d]++;
    });
    return counts;
  }

  function stickyBarHtml(opts) {
    opts = opts || {};
    var counts = opts.counts || {};
    var sections = opts.sections || [];
    var esc = opts.escapeHtml || function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    var chips = ['all'].concat(WEEKDAYS).map(function (d) {
      var label = d === 'all' ? 'All' : shortDay(d);
      var n = counts[d] || 0;
      var on = state.dayFilter === d;
      var dim = d !== 'all' && n === 0;
      return '<button type="button" class="pb-chip' + (on ? ' on' : '') + (dim ? ' dim' : '') + '" data-pb-day="' + d + '"' +
        (dim ? ' disabled' : '') + '>' + label + (d === 'all' ? ' (' + (counts.all || 0) + ')' : (n ? ' · ' + n : '')) + '</button>';
    }).join('');
    var secOpts = '<option value="all"' + (state.sectionFilter === 'all' ? ' selected' : '') + '>All sections</option>' +
      sections.map(function (s) {
        return '<option value="' + esc(s) + '"' + (state.sectionFilter === s ? ' selected' : '') + '>' + esc(s) + '</option>';
      }).join('');
    return '<div class="pb-sticky no-print" id="pbSticky">' +
      '<div class="pb-row">' +
        '<div class="pb-chips" role="toolbar" aria-label="Day filter">' + chips + '</div>' +
        '<label class="pb-sec">Section <select id="pbSection">' + secOpts + '</select></label>' +
        '<div class="pb-anchor">' +
          '<button type="button" class="pb-chip' + (state.listAnchor === 'prep' ? ' on' : '') + '" data-pb-anchor="prep">By prep day</button>' +
          '<button type="button" class="pb-chip' + (state.listAnchor === 'function' ? ' on' : '') + '" data-pb-anchor="function">By function</button>' +
        '</div>' +
        '<label class="pb-batch"><input type="checkbox" id="pbBatchAcross"' + (state.batchAcrossOn ? ' checked' : '') + '> Batch across dishes</label>' +
      '</div>' +
    '</div>';
  }

  function batchReasonHtml(g, esc) {
    esc = esc || function (s) { return String(s); };
    if (!g) return '';
    var day = g.day ? shortDay(g.day) : '—';
    var reason = g.reason || '';
    var covers = g.merged ? ('Covers: ' + (g.covers || '')) : '';
    return '<div class="pb-reason"><span class="pb-daypill">Prep ' + esc(day) + '</span> ' +
      esc(reason) + (covers ? ' · <span class="pb-covers">' + esc(covers) + '</span>' : '') + '</div>';
  }

  function css() {
    return [
      '.pb-sticky{position:sticky;top:0;z-index:30;background:var(--paper,#F7F4EC);border:1px solid var(--line,#D9D3C3);border-radius:8px;padding:10px 12px;margin:0 0 14px;box-shadow:0 1px 0 rgba(0,0,0,.04);}',
      '.pb-row{display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center;}',
      '.pb-chips{display:flex;flex-wrap:wrap;gap:6px;}',
      '.pb-chip{font:12px/1.2 "IBM Plex Sans",system-ui,sans-serif;padding:6px 10px;border:1px solid var(--line,#D9D3C3);border-radius:999px;background:#fff;color:var(--ink,#1C1B16);cursor:pointer;}',
      '.pb-chip.on{background:var(--ink,#1C1B16);color:#fff;border-color:var(--ink,#1C1B16);}',
      '.pb-chip.dim{opacity:.35;cursor:not-allowed;}',
      '.pb-sec select{font:12.5px "IBM Plex Mono",monospace;padding:5px 8px;border:1px solid var(--line);border-radius:4px;}',
      '.pb-batch{font-size:12.5px;color:var(--ink-soft,#5C5A52);display:inline-flex;align-items:center;gap:6px;cursor:pointer;}',
      '.pb-batch input{width:auto;}',
      '.pb-reason{font-size:11.5px;color:var(--ink-soft,#5C5A52);margin-top:2px;}',
      '.pb-daypill{display:inline-block;background:var(--day1-bg,#E8F0FE);color:var(--day1,#1A56DB);font-weight:600;padding:1px 7px;border-radius:999px;margin-right:4px;}',
      '.pb-covers{font-style:italic;}',
      '.pb-unbatch{font-size:10px;margin-left:6px;}'
    ].join('');
  }

  // Ensure CSS once
  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('pbBatchCss')) return;
    var s = document.createElement('style');
    s.id = 'pbBatchCss';
    s.textContent = css();
    document.head.appendChild(s);
  }

  root.PreplineBatch = {
    EXPIRY_MAX: EXPIRY_MAX,
    DEFAULT_BATCHABLE: DEFAULT_BATCHABLE,
    parseTaskParts: parseTaskParts,
    batchKey: batchKey,
    validDayWindow: validDayWindow,
    buildBatches: buildBatches,
    filterRows: filterRows,
    dayCounts: dayCounts,
    stickyBarHtml: stickyBarHtml,
    batchReasonHtml: batchReasonHtml,
    ensureCss: ensureCss,
    setBatchAcross: setBatchAcross,
    toggleUnbatch: toggleUnbatch,
    isUnbatched: isUnbatched,
    setDayFilter: setDayFilter,
    setSectionFilter: setSectionFilter,
    setListAnchor: setListAnchor,
    setBatchable: setBatchable,
    getState: getState,
    loadState: loadState,
    exportState: exportState,
    isBatchableRow: isBatchableRow,
    shortDay: shortDay,
    minLeadForBatch: minLeadForBatch
  };
})(typeof window !== 'undefined' ? window : globalThis);
