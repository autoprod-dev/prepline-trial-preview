/* Prepline 4.6.2 — cross-dish / cross-day batching + day filter bar.
 * Batch key: normalised ingredient name + prep method + unit (each ingredient own timeline).
 * Valid batch prep day D:
 *   - Sunday never; Saturday only if Rules allowSaturdayStarts (default off)
 *   - Weekend avoidance: Sat/Sun raw → forward Mon, or back Fri if Mon on/after function
 *   - (latest member function day − D) <= category batchWindow
 *     (4-day proteins poultry/redmeat/crabcroq = 4; fish/seafood = 1; gels/starch = 3; …)
 *   - Short-lead cats (fish/micro lead 1) keep min lead 1
 * Greedy split when no single D fits. Merged lines show prep day + reason.
 */
(function (root) {
  'use strict';
  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };

  var DEFAULT_BATCHABLE = {
    poultry: true, redmeat: true, seafood: true, veg: true, dry: true, oil: true,
    gels: true, dressing: true, dairy: true, starch: true, crabcroq: true,
    garnish: false, micro: false
  };

  // 4-day proteins share window 4; fish stays 1 (no cross-day merge beyond that).
  var DEFAULT_BATCH_WINDOW = {
    poultry: 4, redmeat: 4, seafood: 1, veg: 4, dry: 4, oil: 4,
    gels: 3, dressing: 4, dairy: 4, starch: 3, crabcroq: 4,
    garnish: 2, micro: 1
  };

  var state = {
    batchAcrossOn: true,
    unbatched: {},
    dayFilter: 'all',
    sectionFilter: 'all',
    listAnchor: 'prep',
    batchable: Object.assign({}, DEFAULT_BATCHABLE),
    allowSaturdayStarts: false,
    saturdayCap: 3,
    avoidWeekend: true
  };

  function dayIdx(d) { return WEEKDAYS.indexOf(d); }
  function shortDay(d) { return SHORT[d] || (d ? String(d).slice(0, 3) : '—'); }
  function forwardDays(from, to) {
    var a = dayIdx(from), b = dayIdx(to);
    if (a < 0 || b < 0) return null;
    return (b - a + 7) % 7;
  }
  function shiftBack(day, n) {
    var i = dayIdx(day);
    if (i < 0) return '';
    return WEEKDAYS[((i - n) % 7 + 7) % 7];
  }

  function batchWindowFor(cat, lead) {
    if (cat && Object.prototype.hasOwnProperty.call(DEFAULT_BATCH_WINDOW, cat)) {
      return DEFAULT_BATCH_WINDOW[cat];
    }
    // Vocab override if present
    try {
      var vocab = root.PREP_DAYS_VOCAB || [];
      for (var i = 0; i < vocab.length; i++) {
        if (vocab[i].key === cat && Number.isFinite(vocab[i].batchWindow)) return vocab[i].batchWindow;
      }
    } catch (e) {}
    var L = Number(lead);
    if (Number.isFinite(L) && L > 0) return L;
    return 4;
  }

  /**
   * Weekend avoidance (ALL categories when enabled):
   * Sunday never. Sat/Sun raw → Monday, unless Monday on/after function → Friday.
   * Saturday kept only when allowSaturdayStarts.
   */
  function weekendAdjust(rawDay, functionDay, opts) {
    opts = opts || {};
    var allowSat = opts.allowSaturday != null ? !!opts.allowSaturday : !!state.allowSaturdayStarts;
    var avoid = opts.avoidWeekend != null ? !!opts.avoidWeekend : (state.avoidWeekend !== false);
    var raw = rawDay;
    if (!raw) return { day: '', reason: '', raw: '' };

    if (raw === 'Saturday' && allowSat) {
      return { day: 'Saturday', reason: '', raw: raw };
    }
    if (raw !== 'Saturday' && raw !== 'Sunday') {
      return { day: raw, reason: '', raw: raw };
    }
    // Sunday always shifts; Saturday shifts when not allowed
    if (!avoid && raw === 'Sunday') {
      // Sunday never even if avoid off
    } else if (!avoid && raw === 'Saturday' && !allowSat) {
      // still shift Sat when disallowed
    } else if (!avoid) {
      return { day: raw, reason: '', raw: raw };
    }

    var leadFromRaw = forwardDays(raw, functionDay);
    if (leadFromRaw == null) {
      return { day: 'Friday', reason: 'Moved from ' + shortDay(raw) + ' to Fri (weekend)', raw: raw };
    }
    var forward = raw === 'Saturday' ? 2 : 1;
    var leadMon = leadFromRaw - forward;
    if (leadMon <= 0) {
      return { day: 'Friday', reason: 'Moved from ' + shortDay(raw) + ' to Fri (weekend)', raw: raw };
    }
    return { day: 'Monday', reason: 'Moved from ' + shortDay(raw) + ' to Mon (weekend)', raw: raw };
  }

  /** Compute prep start day from function + lead with weekend avoidance. */
  function prepStartFromLead(functionDay, lead, opts) {
    opts = opts || {};
    if (!functionDay || !Number.isFinite(Number(lead))) return { day: '', reason: '', raw: '' };
    var raw = shiftBack(functionDay, Number(lead));
    var adj = weekendAdjust(raw, functionDay, opts);
    var blocked = opts.blockedDays;
    var day = adj.day;
    var reason = adj.reason;
    var guard = 0;
    while (guard++ < 7 && day && blocked && blocked.has && blocked.has(day)) {
      // push earlier (more lead)
      var k = forwardDays(day, functionDay);
      if (k == null) break;
      var nextRaw = shiftBack(functionDay, k + 1);
      var next = weekendAdjust(nextRaw, functionDay, opts);
      day = next.day;
      if (next.reason) reason = next.reason;
    }
    if (day === 'Sunday') {
      var fix = weekendAdjust('Sunday', functionDay, opts);
      day = fix.day; reason = fix.reason || reason;
    }
    return { day: day, reason: reason, raw: raw };
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

  function parseTaskParts(task) {
    var raw = String(task || '').trim();
    var t = normText(raw);
    var method = '', name = t;
    var slash = t.split(/\s*\/\s*/);
    if (slash.length >= 2) {
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
    return L <= 1 ? L : 0;
  }

  function validDayWindow(funcDays, lead, blocked, cat) {
    var idxs = funcDays.map(dayIdx).filter(function (i) { return i >= 0; });
    if (!idxs.length) return null;
    var earliestIdx = Math.min.apply(null, idxs);
    var latestIdx = Math.max.apply(null, idxs);
    var earliestFunc = WEEKDAYS[earliestIdx];
    var latestFunc = WEEKDAYS[latestIdx];
    var span = latestIdx - earliestIdx;
    var winMax = batchWindowFor(cat, lead);
    if (span > winMax) return null;

    var ml = minLeadForBatch(lead);
    var kMin = ml;
    var kMax = winMax - span;
    if (kMin > kMax) return null;

    var candidates = [];
    for (var k = kMin; k <= kMax; k++) {
      var raw = shiftBack(earliestFunc, k);
      var adj = weekendAdjust(raw, earliestFunc, {});
      var d = adj.day;
      if (!d || d === 'Sunday') continue;
      if (d === 'Saturday' && !state.allowSaturdayStarts) continue;
      if (blocked && blocked.has && blocked.has(d)) continue;
      var leadLatest = forwardDays(d, latestFunc);
      if (leadLatest == null || leadLatest > winMax) continue;
      var leadEarliest = forwardDays(d, earliestFunc);
      if (leadEarliest == null) continue;
      candidates.push({ day: d, k: leadEarliest, reason: adj.reason, raw: raw, winMax: winMax });
    }
    if (!candidates.length) return null;
    candidates.sort(function (a, b) { return a.k - b.k; });
    var best = candidates[0];
    return {
      day: best.day,
      candidates: candidates.map(function (c) { return c.day; }),
      earliestFunc: earliestFunc,
      latestFunc: latestFunc,
      span: span,
      winMax: winMax,
      shiftReason: best.reason || '',
      rawDay: best.raw
    };
  }

  function coversPhrase(members, deps) {
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
    var parts = [];
    if (members.length === 1) {
      parts.push('Solo: prep ' + shortDay(win.day) + ' for ' + (days[0] || 'event'));
    } else {
      var w = win.winMax != null ? win.winMax : batchWindowFor(members[0] && members[0].prepCat, null);
      parts.push('Merged: ' + days.join('/') + ' uses all within ' + w + '-day expiry window');
    }
    if (win.shiftReason) parts.push(win.shiftReason);
    return parts.join(' · ');
  }

  function isBatchableRow(row) {
    var cat = row.prepCat || '';
    if (!cat) return false;
    if (state.unbatched[batchKey(row, {})]) return false;
    if (state.batchable[cat] === false) return false;
    if (state.batchable[cat] === true) return true;
    return !!DEFAULT_BATCHABLE[cat];
  }

  function buildBatches(rows, deps) {
    deps = deps || {};
    var blocked = deps.blockedDays || new Set();
    var getEventDay = deps.getEventDay || function () { return ''; };
    var computeTotal = deps.computeTotal || function () { return null; };
    var toBaseQty = deps.toBaseQty || function (n, u) { return { n: n, u: u, key: String(u || '').toLowerCase() }; };

    if (!state.batchAcrossOn) {
      return rows.map(function (r) { return singleton(r, deps); });
    }

    var buckets = {};
    var order = [];
    var solos = [];
    rows.forEach(function (r, idx) {
      if (!isBatchableRow(r)) {
        solos.push({ row: r, idx: idx });
        return;
      }
      var key = batchKey(r, deps);
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
      members.sort(function (a, b) {
        var da = dayIdx(a.eventDay), db = dayIdx(b.eventDay);
        if (da !== db) return da - db;
        return String(a.row.dish).localeCompare(String(b.row.dish));
      });
      greedyPack(members, blocked).forEach(function (pack) {
        groups.push(makeGroup(key, pack, deps));
      });
    });

    solos.forEach(function (s) {
      groups.push(singleton(s.row, deps));
    });

    groups.sort(function (a, b) {
      var da = dayIdx(a.day) < 0 ? 99 : dayIdx(a.day);
      var db = dayIdx(b.day) < 0 ? 99 : dayIdx(b.day);
      if (da !== db) return da - db;
      return String(a.taskLabel).localeCompare(String(b.taskLabel));
    });
    return groups;
  }

  function greedyPack(members, blocked) {
    var remaining = members.slice();
    var packs = [];
    while (remaining.length) {
      var best = null;
      for (var len = remaining.length; len >= 1; len--) {
        var slice = remaining.slice(0, len);
        var lead = Number.isFinite(slice[0].row.leadDays) ? slice[0].row.leadDays : 4;
        var cat = slice[0].row.prepCat || '';
        var funcDays = slice.map(function (m) { return m.eventDay; });
        var win = validDayWindow(funcDays, lead, blocked, cat);
        if (win) { best = { slice: slice, win: win }; break; }
      }
      if (!best) {
        var one = remaining.shift();
        var soloInfo = prepStartFromLead(one.eventDay, Number.isFinite(one.row.leadDays) ? one.row.leadDays : 4, { blockedDays: blocked });
        var soloDay = one.row.day || '';
        // Prefer weekend-adjusted day when stored day is Sat/Sun (or empty)
        if (!soloDay || soloDay === 'Saturday' || soloDay === 'Sunday') {
          soloDay = soloInfo.day || soloDay || one.eventDay || '';
        }
        packs.push({
          members: [one],
          win: {
            day: soloDay,
            earliestFunc: one.eventDay,
            latestFunc: one.eventDay,
            span: 0,
            winMax: batchWindowFor(one.row.prepCat, one.row.leadDays),
            shiftReason: one.row.dayReason || soloInfo.reason || ''
          }
        });
        continue;
      }
      packs.push({ members: best.slice, win: best.win });
      remaining = remaining.slice(best.slice.length);
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
    var shiftReason = row.dayReason || '';
    if (ed && Number.isFinite(row.leadDays) && (!day || day === 'Saturday' || day === 'Sunday')) {
      var si = prepStartFromLead(ed, row.leadDays, {});
      if (si.day) { day = si.day; if (si.reason) shiftReason = si.reason; }
    }
    var win = day ? {
      day: day,
      earliestFunc: ed,
      latestFunc: ed,
      span: 0,
      winMax: batchWindowFor(row.prepCat, row.leadDays),
      shiftReason: shiftReason
    } : null;
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
      reason: win ? reasonFor(win, [row], deps) : (row.dayReason || ''),
      window: win
    };
  }

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
  function setAllowSaturday(on) { state.allowSaturdayStarts = !!on; }
  function setSaturdayCap(n) {
    var v = Number(n);
    state.saturdayCap = Number.isFinite(v) && v > 0 ? v : 3;
  }
  function setAvoidWeekend(on) { state.avoidWeekend = !!on; }
  function getState() { return state; }
  function loadState(s) {
    if (!s || typeof s !== 'object') return;
    if (typeof s.batchAcrossOn === 'boolean') state.batchAcrossOn = s.batchAcrossOn;
    if (s.unbatched && typeof s.unbatched === 'object') state.unbatched = Object.assign({}, s.unbatched);
    if (typeof s.dayFilter === 'string') state.dayFilter = s.dayFilter;
    if (typeof s.sectionFilter === 'string') state.sectionFilter = s.sectionFilter;
    if (s.listAnchor === 'prep' || s.listAnchor === 'function') state.listAnchor = s.listAnchor;
    if (s.batchable && typeof s.batchable === 'object') state.batchable = Object.assign({}, DEFAULT_BATCHABLE, s.batchable);
    if (typeof s.allowSaturdayStarts === 'boolean') state.allowSaturdayStarts = s.allowSaturdayStarts;
    if (Number.isFinite(Number(s.saturdayCap))) state.saturdayCap = Number(s.saturdayCap);
    if (typeof s.avoidWeekend === 'boolean') state.avoidWeekend = s.avoidWeekend;
  }
  function exportState() {
    return {
      batchAcrossOn: state.batchAcrossOn,
      unbatched: Object.assign({}, state.unbatched),
      dayFilter: state.dayFilter,
      sectionFilter: state.sectionFilter,
      listAnchor: state.listAnchor,
      batchable: Object.assign({}, state.batchable),
      allowSaturdayStarts: state.allowSaturdayStarts,
      saturdayCap: state.saturdayCap,
      avoidWeekend: state.avoidWeekend
    };
  }

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

  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('pbBatchCss')) return;
    var s = document.createElement('style');
    s.id = 'pbBatchCss';
    s.textContent = css();
    document.head.appendChild(s);
  }

  root.PreplineBatch = {
    DEFAULT_BATCHABLE: DEFAULT_BATCHABLE,
    DEFAULT_BATCH_WINDOW: DEFAULT_BATCH_WINDOW,
    parseTaskParts: parseTaskParts,
    batchKey: batchKey,
    batchWindowFor: batchWindowFor,
    weekendAdjust: weekendAdjust,
    prepStartFromLead: prepStartFromLead,
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
    setAllowSaturday: setAllowSaturday,
    setSaturdayCap: setSaturdayCap,
    setAvoidWeekend: setAvoidWeekend,
    getState: getState,
    loadState: loadState,
    exportState: exportState,
    isBatchableRow: isBatchableRow,
    shortDay: shortDay,
    minLeadForBatch: minLeadForBatch,
    // Back-compat: protein window is now 4
    EXPIRY_MAX: 4
  };
})(typeof window !== 'undefined' ? window : globalThis);
