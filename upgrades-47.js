/* Prepline 4.7.x upgrades (trial copy only). Autoprod.
 * 1 Week view  2 Tick-off  3 Change check  4 Order-from-batches
 * 5 Recipe/yield lib  6 Station sheets  7 Voice input  8 Auto-section
 * 10 Organised yellow-header xlsx export
 * Shared row builder used by screen + export where noted.
 */
(function (root) {
  'use strict';

  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var SHORT = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
  var SECTION_ORDER = [
    'Sauce, Purees and Gels',
    'Vegetables',
    'Garnishes, Herbs, Powders, Oils Etc.',
    'Starch',
    'Proteins',
    'Box off/ Trolley organising team'
  ];
  var SHELF_DAYS = {
    poultry: 4, redmeat: 4, crabcroq: 4, seafood: 1, fish: 1,
    veg: 4, dry: 4, oil: 4, gels: 3, dressing: 4, dairy: 4, starch: 3,
    garnish: 2, micro: 1
  };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function wrapEsc(fn) {
    return function (s) {
      try { return (fn || esc)(String(s == null ? '' : s)); }
      catch (e) { return esc(s); }
    };
  }
  function shortDay(d) { return SHORT[d] || (d ? String(d).slice(0, 3) : '—'); }
  function dayIdx(d) { return WEEKDAYS.indexOf(d); }
  function shiftBack(day, n) {
    var i = dayIdx(day);
    if (i < 0) return '';
    return WEEKDAYS[((i - n) % 7 + 7) % 7];
  }
  function normKey(s) {
    return String(s || '').toLowerCase().replace(/\([^)]*\)/g, ' ')
      .replace(/[^a-z0-9\s/]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function lsGet(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function downloadText(name, text, mime) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime || 'text/plain' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
  }

  /* ---------- 1) Week view ---------- */
  function buildWeekGroups(rows, deps) {
    deps = deps || {};
    var batches = (root.PreplineBatch && root.PreplineBatch.buildBatches)
      ? root.PreplineBatch.buildBatches(rows, deps)
      : (rows || []).map(function (r) {
          return {
            taskLabel: r.task, day: r.day || '', section: r.section || '',
            total: 0, hasTotal: false, unit: r.unit || '', rows: [r],
            dishes: [r.dish], merged: false, covers: '', reason: '', batchKey: r.task
          };
        });
    var byDay = {};
    WEEKDAYS.forEach(function (d) { if (d !== 'Sunday') byDay[d] = {}; });
    byDay.Unscheduled = {};
    batches.forEach(function (g) {
      var day = g.day && dayIdx(g.day) >= 0 && g.day !== 'Sunday' ? g.day : 'Unscheduled';
      var sec = g.section || 'Uncategorised';
      if (!byDay[day]) byDay[day] = {};
      if (!byDay[day][sec]) byDay[day][sec] = [];
      byDay[day][sec].push(g);
    });
    return byDay;
  }

  function renderWeekView(rows, deps, helpers) {
    helpers = helpers || {};
    var escH = wrapEsc(helpers.escapeHtml);
    var qN = helpers.qN || function (n) { return String(n); };
    var qU = helpers.qU || function (n, u) { return u || ''; };
    var clean = helpers.cleanDishName || function (d) { return d; };
    var byDay = buildWeekGroups(rows, deps);
    var days = WEEKDAYS.filter(function (d) { return d !== 'Sunday'; }).concat(['Unscheduled']);
    var html = '<div class="u47-week" id="u47Week">';
    html += '<div class="u47-note no-print">Week view: one list per day, grouped by section. Uses the same batching rules as By prep day.</div>';
    days.forEach(function (day) {
      var secs = byDay[day] || {};
      var keys = Object.keys(secs);
      if (!keys.length) return;
      keys.sort(function (a, b) {
        var ia = SECTION_ORDER.indexOf(a), ib = SECTION_ORDER.indexOf(b);
        if (ia < 0) ia = 99; if (ib < 0) ib = 99;
        return ia !== ib ? ia - ib : a.localeCompare(b);
      });
      var n = keys.reduce(function (s, k) { return s + secs[k].length; }, 0);
      html += '<div class="panel u47-daypanel"><h3 class="u47-dayhead">' + escH(day === 'Unscheduled' ? 'Unscheduled' : day) +
        ' <span class="meta">' + n + ' line' + (n === 1 ? '' : 's') + '</span></h3>';
      keys.forEach(function (sec) {
        html += '<h4 class="u47-sechead">' + escH(sec) + '</h4>';
        html += '<div class="section-table-wrap"><table><thead><tr><th>Task</th><th>For</th><th>Qty</th><th>Covers</th></tr></thead><tbody>';
        secs[sec].forEach(function (g) {
          var total = g.hasTotal ? ('<b>' + escH(qN(g.total, g.unit)) + '</b> ' + escH(qU(g.total, g.unit))) : '—';
          var dishes = (g.dishes || []).map(clean).join(', ');
          var sub = mergedSubtitleHtml(g, escH);
          var tick = tickControlsHtml(g, escH);
          html += '<tr><td class="task">' + escH(g.taskLabel) + sub + tick + '</td><td class="dish">' +
            escH(dishes) + '</td><td class="qty">' + total + '</td><td>' + escH(g.covers || '—') + '</td></tr>';
        });
        html += '</tbody></table></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ---------- Merged subtitle (shared screen + export) ---------- */
  function functionNamesForGroup(g, cleanFn) {
    cleanFn = cleanFn || function (d) { return d; };
    var names = [], seen = {};
    (g.dishes || []).forEach(function (d) {
      var c = cleanFn(d) || d;
      if (!c || seen[c]) return;
      seen[c] = true;
      names.push(c);
    });
    return names;
  }

  function mergedSubtitleText(g, opts) {
    opts = opts || {};
    if (!g || !g.merged) return '';
    var names = functionNamesForGroup(g, opts.cleanDishName);
    if (!names.length) return 'Merged';
    var max = opts.maxNames != null ? opts.maxNames : 99;
    var shown = names.slice(0, max);
    var extra = names.length - shown.length;
    var body = shown.join(' + ') + (extra > 0 ? ' +' + extra + ' more' : '');
    return 'Merged: ' + body;
  }

  function mergedSubtitleHtml(g, escH, opts) {
    opts = opts || {};
    if (!g || !g.merged) return '';
    escH = wrapEsc(escH);
    var full = mergedSubtitleText(g, Object.assign({}, opts, { maxNames: 99 }));
    var short = mergedSubtitleText(g, Object.assign({}, opts, { maxNames: opts.phoneMax || 2 }));
    var days = g.covers ? ('<span class="pb-covers">' + escH(g.covers) + '</span> · ') : '';
    return '<div class="pb-reason u47-merged" title="' + escH(full) + '">' +
      days + '<span class="u47-merged-full">' + escH(full) + '</span>' +
      '<span class="u47-merged-short">' + escH(short) + '</span></div>';
  }

  /* ---------- 2) Tick-off (local + share code) ---------- */
  var TICK_KEY = 'prepline.tickoff.v1';
  function tickStore() { return lsGet(TICK_KEY, { lines: {}, listId: '', updated: 0 }) || { lines: {}, listId: '', updated: 0 }; }
  function tickSave(st) { st.updated = Date.now(); lsSet(TICK_KEY, st); }
  function tickLineKey(g) {
    return normKey((g.batchKey || g.taskLabel || '') + '|' + (g.day || '') + '|' + (g.section || ''));
  }
  function getTick(g) {
    var st = tickStore();
    return st.lines[tickLineKey(g)] || { status: 'todo', pct: 0, qtyDone: '', note: '' };
  }
  function setTick(g, patch) {
    var st = tickStore();
    var k = tickLineKey(g);
    st.lines[k] = Object.assign({ status: 'todo', pct: 0, qtyDone: '', note: '' }, st.lines[k] || {}, patch || {});
    tickSave(st);
    return st.lines[k];
  }
  function tickControlsHtml(g, escH) {
    escH = wrapEsc(escH);
    var t = getTick(g);
    var k = encodeURIComponent(tickLineKey(g));
    var cls = 'u47-tick u47-tick-' + (t.status || 'todo');
    return '<div class="u47-tickbar no-print ' + cls + '" data-tick-key="' + k + '">' +
      '<button type="button" class="u47-tickbtn" data-tick="todo" aria-label="Not done">○</button>' +
      '<button type="button" class="u47-tickbtn" data-tick="part" aria-label="Part done">◐</button>' +
      '<button type="button" class="u47-tickbtn" data-tick="done" aria-label="Done">●</button>' +
      (t.status === 'part' ? '<input class="u47-tickpct" type="number" min="0" max="100" value="' + escH(t.pct || 50) + '" aria-label="Percent done">%' : '') +
      (t.status === 'done' ? '<span class="u47-ticklab">Done</span>' : (t.status === 'part' ? '<span class="u47-ticklab">Part</span>' : '')) +
      '</div>';
  }
  function progressSummaryHtml(groups) {
    var total = 0, done = 0, part = 0;
    (groups || []).forEach(function (g) {
      total++;
      var t = getTick(g);
      if (t.status === 'done') done++;
      else if (t.status === 'part') part++;
    });
    var pct = total ? Math.round((done + part * 0.5) / total * 100) : 0;
    return '<div class="u47-progress no-print panel" id="u47Progress">' +
      '<b>Progress</b> ' + done + ' done · ' + part + ' part · ' + (total - done - part) + ' left · ~' + pct + '%' +
      '<div class="u47-progbar"><div style="width:' + pct + '%"></div></div>' +
      '<div class="meta">Saved on this phone only. For another device, use Share progress code below. True live multi-device sync needs a backend — ask Gerard.</div>' +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap;">' +
      '<button type="button" class="secondary" id="u47ShareProg">Copy progress code</button>' +
      '<button type="button" class="ghost" id="u47LoadProg">Paste progress code</button>' +
      '<button type="button" class="ghost" id="u47ClearProg">Clear ticks</button>' +
      '</div></div>';
  }
  function exportProgressCode() {
    var st = tickStore();
    var raw = JSON.stringify({ v: 1, t: st.updated, lines: st.lines });
    try { return btoa(unescape(encodeURIComponent(raw))); } catch (e) { return ''; }
  }
  function importProgressCode(code) {
    try {
      var raw = decodeURIComponent(escape(atob(String(code || '').trim())));
      var o = JSON.parse(raw);
      if (!o || !o.lines) return false;
      var st = tickStore();
      st.lines = Object.assign({}, st.lines, o.lines);
      tickSave(st);
      return true;
    } catch (e) { return false; }
  }
  function bindTickControls(rootEl, onChange) {
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-tick-key]').forEach(function (bar) {
      var key = decodeURIComponent(bar.getAttribute('data-tick-key') || '');
      bar.querySelectorAll('[data-tick]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var status = btn.getAttribute('data-tick');
          var st = tickStore();
          st.lines[key] = Object.assign({ status: 'todo', pct: 0 }, st.lines[key] || {}, {
            status: status,
            pct: status === 'part' ? (st.lines[key] && st.lines[key].pct) || 50 : (status === 'done' ? 100 : 0)
          });
          tickSave(st);
          if (onChange) onChange();
        });
      });
      var pct = bar.querySelector('.u47-tickpct');
      if (pct) pct.addEventListener('change', function () {
        var st = tickStore();
        st.lines[key] = Object.assign({}, st.lines[key] || {}, { status: 'part', pct: Number(pct.value) || 0 });
        tickSave(st);
        if (onChange) onChange();
      });
    });
    var share = rootEl.querySelector('#u47ShareProg');
    if (share) share.addEventListener('click', function () {
      var c = exportProgressCode();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(c).then(function () { alert('Progress code copied. Paste it on another phone to sync ticks.'); });
      } else { prompt('Copy this progress code:', c); }
    });
    var load = rootEl.querySelector('#u47LoadProg');
    if (load) load.addEventListener('click', function () {
      var c = prompt('Paste progress code:');
      if (c && importProgressCode(c)) { if (onChange) onChange(); }
      else if (c) alert('Could not read that code.');
    });
    var clr = rootEl.querySelector('#u47ClearProg');
    if (clr) clr.addEventListener('click', function () {
      if (!confirm('Clear all tick-off progress on this device?')) return;
      lsSet(TICK_KEY, { lines: {}, listId: '', updated: Date.now() });
      if (onChange) onChange();
    });
  }

  /* ---------- 3) Change check ---------- */
  var SNAP_KEY = 'prepline.wo.snapshot.v1';
  function rowSig(r) {
    return normKey(r.dish) + '|' + normKey(r.task) + '|' + String(r.qty) + '|' + String(r.unit || '');
  }
  function snapshotFromRows(rows, meta) {
    return {
      at: Date.now(),
      name: (meta && meta.name) || '',
      rows: (rows || []).map(function (r) {
        return { dish: r.dish, task: r.task, qty: r.qty, unit: r.unit, section: r.section, day: r.day };
      })
    };
  }
  function rememberSnapshot(rows, meta) {
    var prev = lsGet(SNAP_KEY, null);
    var next = snapshotFromRows(rows, meta);
    var diff = prev ? diffSnapshots(prev, next) : null;
    lsSet(SNAP_KEY, next);
    lsSet(SNAP_KEY + '.lastDiff', diff);
    return diff;
  }
  function peekLastDiff() { return lsGet(SNAP_KEY + '.lastDiff', null); }
  function diffSnapshots(prev, next) {
    var oldMap = {}, neuMap = {};
    (prev.rows || []).forEach(function (r) { oldMap[rowSig(r)] = r; });
    (next.rows || []).forEach(function (r) { neuMap[rowSig(r)] = r; });
    // Quantity-aware: match by dish+task, compare qty
    function keyDT(r) { return normKey(r.dish) + '|' + normKey(r.task); }
    var oldDT = {}, neuDT = {};
    (prev.rows || []).forEach(function (r) { oldDT[keyDT(r)] = r; });
    (next.rows || []).forEach(function (r) { neuDT[keyDT(r)] = r; });
    var added = [], removed = [], changed = [];
    Object.keys(neuDT).forEach(function (k) {
      if (!oldDT[k]) added.push(neuDT[k]);
      else {
        var a = oldDT[k], b = neuDT[k];
        if (String(a.qty) !== String(b.qty) || String(a.unit || '') !== String(b.unit || '')) {
          changed.push({ before: a, after: b });
        }
      }
    });
    Object.keys(oldDT).forEach(function (k) {
      if (!neuDT[k]) removed.push(oldDT[k]);
    });
    return {
      prevName: prev.name || '', nextName: next.name || '',
      added: added, removed: removed, changed: changed,
      summary: added.length + ' added, ' + removed.length + ' removed, ' + changed.length + ' qty changed'
    };
  }
  function changeCheckHtml(diff, escH) {
    escH = wrapEsc(escH);
    if (!diff) return '';
    if (!diff.added.length && !diff.removed.length && !diff.changed.length) {
      return '<div class="panel u47-diff no-print" id="u47Diff"><b>Change check</b> — same as last upload (no line changes).</div>';
    }
    function line(r) { return escH(String(r.task == null ? '' : r.task)) + ' · ' + escH(String(r.dish == null ? '' : r.dish)) + ' · ' + escH(String(r.qty == null ? '' : r.qty)) + ' ' + escH(String(r.unit || '')); }
    var html = '<div class="panel u47-diff no-print" id="u47Diff"><b>Change check</b> — ' + escH(String(diff.summary || ''));
    if (diff.added.length) {
      html += '<details open><summary>Added (' + diff.added.length + ')</summary><ul>' +
        diff.added.slice(0, 40).map(function (r) { return '<li class="u47-add">' + line(r) + '</li>'; }).join('') + '</ul></details>';
    }
    if (diff.removed.length) {
      html += '<details open><summary>Removed (' + diff.removed.length + ')</summary><ul>' +
        diff.removed.slice(0, 40).map(function (r) { return '<li class="u47-rem">' + line(r) + '</li>'; }).join('') + '</ul></details>';
    }
    if (diff.changed.length) {
      html += '<details open><summary>Qty changed (' + diff.changed.length + ')</summary><ul>' +
        diff.changed.slice(0, 40).map(function (c) {
          return '<li class="u47-chg">' + escH(String(c.after.task||'')) + ' · ' + escH(String(c.after.dish||'')) + ': ' +
            escH(String(c.before.qty==null?'':c.before.qty)) + ' → <b>' + escH(String(c.after.qty==null?'':c.after.qty)) + '</b> ' + escH(String(c.after.unit || '')) + '</li>';
        }).join('') + '</ul></details>';
    }
    html += '<button type="button" class="ghost" onclick="document.getElementById(\'u47Diff\').remove()">Dismiss</button></div>';
    return html;
  }

  /* ---------- 4) Order list from batches ---------- */
  function latestDeliveryDay(prepDay) {
    if (!prepDay || dayIdx(prepDay) < 0) return '';
    // Delivery the day before prep start (never Sunday → Saturday)
    var d = shiftBack(prepDay, 1);
    if (d === 'Sunday') d = 'Saturday';
    return d;
  }
  function buildOrderFromBatches(rows, deps, helpers) {
    helpers = helpers || {};
    var batches = (root.PreplineBatch && root.PreplineBatch.buildBatches)
      ? root.PreplineBatch.buildBatches(rows, deps) : [];
    var applyY = helpers.applyYield || function (n) { return n; };
    var map = {}, order = [];
    batches.forEach(function (g) {
      var name = (g.name || g.taskLabel || '').toLowerCase();
      var uk = String(g.unit || '').toLowerCase();
      if (/^(g|gm|grams?)$/.test(uk)) uk = 'g';
      if (/^(kg|kgs|kilos?)$/.test(uk)) uk = 'g';
      if (/^(ml|millilitres?)$/.test(uk)) uk = 'ml';
      if (/^(l|lt|ltr|litres?)$/.test(uk)) uk = 'ml';
      var key = name + '|' + uk;
      if (!map[key]) {
        map[key] = {
          name: g.name || g.taskLabel, unitKey: uk, total: 0, hasTotal: false,
          unit: g.unit || '', prepDays: [], deliveryDays: [], dishes: []
        };
        order.push(key);
      }
      var o = map[key];
      if (g.hasTotal) {
        var n = applyY(g.total, g);
        // normalise to g/ml base if possible
        if (/^kg/.test(String(g.unit || '').toLowerCase())) n = n * 1000;
        if (/^l$|^lt|^ltr|^litre/.test(String(g.unit || '').toLowerCase())) n = n * 1000;
        o.total += n; o.hasTotal = true;
        if (uk === 'g') o.unit = 'g';
        if (uk === 'ml') o.unit = 'ml';
      }
      if (g.day && o.prepDays.indexOf(g.day) < 0) o.prepDays.push(g.day);
      var del = latestDeliveryDay(g.day);
      if (del && o.deliveryDays.indexOf(del) < 0) o.deliveryDays.push(del);
      (g.dishes || []).forEach(function (d) { if (o.dishes.indexOf(d) < 0) o.dishes.push(d); });
    });
    return order.map(function (k) {
      var o = map[k];
      o.prepDays.sort(function (a, b) { return dayIdx(a) - dayIdx(b); });
      o.deliveryDays.sort(function (a, b) { return dayIdx(a) - dayIdx(b); });
      // Latest delivery = latest among needed delivery days
      o.latestDelivery = o.deliveryDays.length ? o.deliveryDays[o.deliveryDays.length - 1] : '';
      if (o.unit === 'g' && o.total >= 1000) { o.displayN = Math.round(o.total) / 1000; o.displayU = 'kg'; }
      else if (o.unit === 'ml' && o.total >= 1000) { o.displayN = Math.round(o.total) / 1000; o.displayU = 'L'; }
      else { o.displayN = Math.round(o.total * 100) / 100; o.displayU = o.unit || ''; }
      return o;
    });
  }
  function renderOrderFromBatches(rows, deps, helpers) {
    helpers = helpers || {};
    var escH = wrapEsc(helpers.escapeHtml);
    var lines = buildOrderFromBatches(rows, deps, helpers);
    var html = '<div class="u47-order" id="u47Order"><div class="panel">' +
      '<div class="row" style="justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">' +
      '<h3 style="margin:0;">Order list (from batches)</h3>' +
      '<div class="row" style="gap:8px;"><button type="button" class="secondary" id="u47OrderCsv">Export CSV</button>' +
      '<button type="button" class="secondary" id="u47OrderPrint">Print</button></div></div>' +
      '<div class="meta">Totals from batched prep. Latest delivery = day before prep start (Sunday → Saturday).</div>';
    if (!lines.length) {
      html += '<div class="empty"><div class="big">Nothing to order yet</div>Load a list and turn batching on.</div></div></div>';
      return html;
    }
    html += '<div class="section-table-wrap"><table><thead><tr><th>Ingredient</th><th>Total</th><th>Latest delivery</th><th>Prep days</th><th>Used in</th></tr></thead><tbody>';
    lines.forEach(function (L) {
      html += '<tr><td class="task">' + escH(L.name) + '</td><td class="qty"><b>' +
        (L.hasTotal ? escH(L.displayN) + ' ' + escH(L.displayU) : '—') + '</b></td><td>' +
        escH(L.latestDelivery || '—') + '</td><td>' + escH(L.prepDays.map(shortDay).join(', ') || '—') +
        '</td><td class="dish">' + escH(L.dishes.join(', ')) + '</td></tr>';
    });
    html += '</tbody></table></div></div></div>';
    return html;
  }
  function orderCsv(rows, deps, helpers) {
    var lines = buildOrderFromBatches(rows, deps, helpers);
    var out = ['Ingredient,Total,Unit,Latest delivery,Prep days,Used in'];
    lines.forEach(function (L) {
      out.push([
        '"' + String(L.name).replace(/"/g, '""') + '"',
        L.hasTotal ? L.displayN : '',
        L.hasTotal ? L.displayU : '',
        L.latestDelivery || '',
        L.prepDays.join(' '),
        '"' + L.dishes.join('; ').replace(/"/g, '""') + '"'
      ].join(','));
    });
    return out.join('\n');
  }

  /* ---------- 5) Recipe & yield library ---------- */
  var RECIPE_KEY = 'prepline.recipes.v1';
  function recipeLib() { return lsGet(RECIPE_KEY, { items: [] }) || { items: [] }; }
  function saveRecipes(lib) { lsSet(RECIPE_KEY, lib); }
  function findYield(task) {
    var lib = recipeLib();
    var k = normKey(task);
    for (var i = 0; i < lib.items.length; i++) {
      var it = lib.items[i];
      if (normKey(it.name) === k || (k && normKey(it.name) && k.indexOf(normKey(it.name)) >= 0)) return it;
    }
    return null;
  }
  function applyYieldToQty(n, taskOrGroup) {
    if (!Number.isFinite(n)) return n;
    var task = typeof taskOrGroup === 'string' ? taskOrGroup : (taskOrGroup && (taskOrGroup.name || taskOrGroup.taskLabel || ''));
    var y = findYield(task);
    if (!y || !Number.isFinite(y.yieldPct) || y.yieldPct <= 0) return n;
    // raw needed = cooked / (yield/100)
    return Math.round(n / (y.yieldPct / 100) * 1000) / 1000;
  }
  function recipeLibHtml(escH) {
    escH = wrapEsc(escH);
    var lib = recipeLib();
    var html = '<div class="panel u47-recipes no-print" id="u47Recipes"><h3 style="margin:0 0 6px;">Recipe &amp; yield library</h3>' +
      '<div class="meta">Saved on this device. Yield % = usable weight ÷ raw weight × 100. Applied to order list totals (raw needed).</div>' +
      '<div class="section-table-wrap"><table><thead><tr><th>Ingredient</th><th>Yield %</th><th>Note</th><th></th></tr></thead><tbody>';
    lib.items.forEach(function (it, i) {
      html += '<tr><td><input data-ri="' + i + '" data-f="name" value="' + escH(it.name) + '"></td>' +
        '<td><input data-ri="' + i + '" data-f="yieldPct" type="number" min="1" max="100" step="0.1" value="' + escH(it.yieldPct) + '" style="width:80px"></td>' +
        '<td><input data-ri="' + i + '" data-f="note" value="' + escH(it.note || '') + '"></td>' +
        '<td><button type="button" class="ghost" data-rdel="' + i + '">Remove</button></td></tr>';
    });
    html += '</tbody></table></div>' +
      '<div class="row" style="gap:8px;margin-top:8px;flex-wrap:wrap;">' +
      '<button type="button" class="secondary" id="u47RecAdd">Add row</button>' +
      '<button type="button" class="secondary" id="u47RecExport">Export JSON</button>' +
      '<button type="button" class="ghost" id="u47RecImport">Import JSON</button>' +
      '<button type="button" class="ghost" id="u47RecSeed">Add chicken/beef examples</button>' +
      '</div></div>';
    return html;
  }
  function bindRecipeLib(rootEl, onChange) {
    if (!rootEl) return;
    function refreshFromInputs() {
      var lib = { items: [] };
      rootEl.querySelectorAll('[data-ri][data-f="name"]').forEach(function (inp) {
        var i = +inp.getAttribute('data-ri');
        var row = rootEl.querySelector('[data-ri="' + i + '"][data-f="yieldPct"]');
        var note = rootEl.querySelector('[data-ri="' + i + '"][data-f="note"]');
        lib.items[i] = {
          name: inp.value,
          yieldPct: row ? Number(row.value) : 100,
          note: note ? note.value : ''
        };
      });
      lib.items = lib.items.filter(Boolean);
      saveRecipes(lib);
    }
    rootEl.querySelectorAll('[data-ri]').forEach(function (inp) {
      inp.addEventListener('change', function () { refreshFromInputs(); if (onChange) onChange(); });
    });
    rootEl.querySelectorAll('[data-rdel]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lib = recipeLib();
        lib.items.splice(+btn.getAttribute('data-rdel'), 1);
        saveRecipes(lib);
        if (onChange) onChange();
      });
    });
    var add = rootEl.querySelector('#u47RecAdd');
    if (add) add.addEventListener('click', function () {
      var lib = recipeLib();
      lib.items.push({ name: '', yieldPct: 70, note: '' });
      saveRecipes(lib);
      if (onChange) onChange();
    });
    var exp = rootEl.querySelector('#u47RecExport');
    if (exp) exp.addEventListener('click', function () {
      downloadText('prepline-recipes.json', JSON.stringify(recipeLib(), null, 2), 'application/json');
    });
    var imp = rootEl.querySelector('#u47RecImport');
    if (imp) imp.addEventListener('click', function () {
      var t = prompt('Paste recipes JSON:');
      if (!t) return;
      try {
        var o = JSON.parse(t);
        if (o && Array.isArray(o.items)) { saveRecipes(o); if (onChange) onChange(); }
        else alert('JSON needs an items array.');
      } catch (e) { alert('Invalid JSON'); }
    });
    var seed = rootEl.querySelector('#u47RecSeed');
    if (seed) seed.addEventListener('click', function () {
      var lib = recipeLib();
      [
        { name: 'chicken breast', yieldPct: 70, note: 'raw → trimmed' },
        { name: 'beef short rib', yieldPct: 65, note: 'raw → trimmed' },
        { name: 'salmon', yieldPct: 80, note: 'raw → portioned' }
      ].forEach(function (ex) {
        if (!lib.items.some(function (x) { return normKey(x.name) === normKey(ex.name); })) lib.items.push(ex);
      });
      saveRecipes(lib);
      if (onChange) onChange();
    });
  }

  /* ---------- 6) Station sheets (allocation + main) ---------- */
  function useByFromPrep(prepDay, prepCat) {
    var life = SHELF_DAYS[prepCat] != null ? SHELF_DAYS[prepCat] : 3;
    if (!prepDay || dayIdx(prepDay) < 0) return '';
    var i = dayIdx(prepDay);
    // use-by = prep day + (life-1), cap before next week conceptually
    return WEEKDAYS[(i + Math.max(life - 1, 0)) % 7];
  }
  function buildStationSheetsFromAlloc(state) {
    // Group allocation lines by allocated Staff / staff field
    if (!state || !state.res || !state.res.sheets) return [];
    var byChef = {};
    state.res.sheets.forEach(function (sh) {
      ['service', 'prep'].forEach(function (blk) {
        (sh[blk] || []).forEach(function (sec) {
          (sec.lines || []).forEach(function (l) {
            var chef = String(l.alloc || l.staff || 'Unallocated').trim() || 'Unallocated';
            if (!byChef[chef]) byChef[chef] = [];
            byChef[chef].push({
              dish: l.dish || '',
              pax: l.paxValue,
              day: l.dayWord || sh.dayName || '',
              section: sec.key || sec.title || '',
              prepDay: sh.dayName || '',
              notes: l.notes || '',
              block: blk
            });
          });
        });
      });
    });
    return Object.keys(byChef).sort().map(function (chef) {
      return { chef: chef, lines: byChef[chef] };
    });
  }
  function stationSheetHtml(sheets, opts) {
    opts = opts || {};
    var escH = wrapEsc(opts.escapeHtml);
    var html = '<div class="u47-stations" id="u47Stations">';
    (sheets || []).forEach(function (s, idx) {
      html += '<section class="u47-station-sheet" data-chef="' + escH(s.chef) + '">' +
        '<header><div class="u47-brand">Prepline by Autoprod</div>' +
        '<h2>Station sheet — ' + escH(s.chef) + '</h2>' +
        '<div class="meta">Printed ' + escH(new Date().toLocaleDateString('en-AU')) + '</div></header>' +
        '<table><thead><tr><th>Dish / line</th><th>Section</th><th>Function day</th><th>Prep day</th><th>Use-by</th><th>Pax</th><th>Notes</th></tr></thead><tbody>';
      s.lines.forEach(function (l) {
        var useBy = useByFromPrep(l.prepDay, opts.prepCat || '');
        html += '<tr><td>' + escH(l.dish) + '</td><td>' + escH(l.section) + '</td><td>' +
          escH(l.day) + '</td><td>' + escH(l.prepDay) + '</td><td>' + escH(useBy || '—') +
          '</td><td>' + escH(l.pax == null ? '' : l.pax) + '</td><td>' + escH(l.notes) + '</td></tr>';
      });
      html += '</tbody></table></section>';
      if (idx < sheets.length - 1) html += '<div class="u47-page-break"></div>';
    });
    html += '</div>';
    return html;
  }
  function stationPrintCss() {
    return [
      '@media print{',
      '  body *{visibility:hidden;}',
      '  .u47-stations,.u47-stations *{visibility:visible;}',
      '  .u47-stations{position:absolute;left:0;top:0;width:100%;}',
      '  .u47-page-break{page-break-after:always;}',
      '  .noprint,.no-print{display:none!important;}',
      '}',
      '.u47-station-sheet{font:12px/1.35 Arial,Helvetica,sans-serif;color:#111;padding:12mm;max-width:210mm;margin:0 auto 16px;background:#fff;border:1px solid #ddd;}',
      '.u47-station-sheet h2{margin:4px 0 8px;font-size:18px;}',
      '.u47-brand{font-size:10px;letter-spacing:.04em;text-transform:uppercase;color:#555;}',
      '.u47-station-sheet table{width:100%;border-collapse:collapse;}',
      '.u47-station-sheet th,.u47-station-sheet td{border:1px solid #333;padding:5px 6px;text-align:left;}',
      '.u47-station-sheet th{background:#FFFF00;font-weight:700;}'
    ].join('');
  }

  /* ---------- 7) Voice input ---------- */
  function parseVoiceUtterance(text) {
    var t = String(text || '').trim();
    if (!t) return null;
    var day = '';
    WEEKDAYS.forEach(function (d) {
      var re = new RegExp('\\b(for\\s+)?' + d + '\\b', 'i');
      var re2 = new RegExp('\\b(for\\s+)?' + shortDay(d) + '\\b', 'i');
      if (re.test(t) || re2.test(t)) day = d;
    });
    t = t.replace(/\b(for\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b/ig, ' ').trim();
    var qty = '', unit = '', item = t;
    var m = t.match(/^(\d+(?:\.\d+)?)\s*(kilos?|kilograms?|kg|grams?|g|gms?|litres?|liters?|l|lt|ml|millilitres?|cups?|bunches?|bunch|each|pcs?|pieces?)?\s+(?:of\s+)?(.+)$/i);
    if (m) {
      qty = m[1];
      unit = (m[2] || '').toLowerCase();
      item = m[3];
      if (/^kilos?$|^kilograms?$/.test(unit)) unit = 'kg';
      if (/^grams?$|^gms?$/.test(unit)) unit = 'g';
      if (/^litres?$|^liters?$|^lt$/.test(unit)) unit = 'L';
      if (/^bunches?$/.test(unit)) unit = 'bunch';
      if (/^pieces?$|^pcs?$/.test(unit)) unit = 'pc';
    }
    item = item.replace(/\s+/g, ' ').trim();
    if (!item) return null;
    return { qty: qty, unit: unit, task: item, day: day, raw: text };
  }
  function voiceSupported() {
    return !!(root.SpeechRecognition || root.webkitSpeechRecognition);
  }
  function voicePanelHtml() {
    var ok = voiceSupported();
    return '<div class="panel u47-voice no-print" id="u47Voice">' +
      '<h3 style="margin:0 0 6px;">Voice add</h3>' +
      (ok
        ? '<button type="button" class="u47-mic" id="u47Mic" aria-label="Start dictation">🎤 Tap to dictate</button>' +
          '<div class="meta">Example: “5 kilo diced chicken for Wednesday”. Confirm before it is added.</div>'
        : '<div class="meta">Voice input is not supported in this browser. Use Chrome or Edge on Android/desktop, or type the line below.</div>') +
      '<div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap;align-items:end;">' +
      '<div class="field"><label>Qty</label><input id="u47VQty" style="width:70px"></div>' +
      '<div class="field"><label>Unit</label><input id="u47VUnit" style="width:70px"></div>' +
      '<div class="field" style="flex:1"><label>Item</label><input id="u47VItem" style="width:100%"></div>' +
      '<div class="field"><label>Day</label><select id="u47VDay"><option value="">—</option>' +
      WEEKDAYS.filter(function (d) { return d !== 'Sunday'; }).map(function (d) {
        return '<option value="' + d + '">' + d + '</option>';
      }).join('') + '</select></div>' +
      '<button type="button" class="secondary" id="u47VAdd">Add line</button>' +
      '</div><div class="meta" id="u47VStatus"></div></div>';
  }
  function bindVoice(rootEl, handlers) {
    handlers = handlers || {};
    if (!rootEl) return;
    var qty = rootEl.querySelector('#u47VQty');
    var unit = rootEl.querySelector('#u47VUnit');
    var item = rootEl.querySelector('#u47VItem');
    var day = rootEl.querySelector('#u47VDay');
    var status = rootEl.querySelector('#u47VStatus');
    function fill(p) {
      if (!p) return;
      if (qty) qty.value = p.qty || '';
      if (unit) unit.value = p.unit || '';
      if (item) item.value = p.task || '';
      if (day && p.day) day.value = p.day;
      if (status) status.textContent = 'Heard: ' + (p.raw || '') + ' — check, then Add line.';
    }
    var mic = rootEl.querySelector('#u47Mic');
    if (mic && voiceSupported()) {
      mic.addEventListener('click', function () {
        var SR = root.SpeechRecognition || root.webkitSpeechRecognition;
        var rec = new SR();
        rec.lang = 'en-AU';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        if (status) status.textContent = 'Listening…';
        mic.classList.add('u47-mic-on');
        rec.onresult = function (ev) {
          var said = ev.results[0][0].transcript;
          fill(parseVoiceUtterance(said));
          mic.classList.remove('u47-mic-on');
        };
        rec.onerror = function () {
          if (status) status.textContent = 'Could not hear that. Try again or type the line.';
          mic.classList.remove('u47-mic-on');
        };
        rec.onend = function () { mic.classList.remove('u47-mic-on'); };
        try { rec.start(); } catch (e) {
          if (status) status.textContent = 'Mic busy — try again.';
          mic.classList.remove('u47-mic-on');
        }
      });
    }
    // Test hook: simulate recognition
    root.PreplineUpgrades47.simulateVoice = function (text) {
      fill(parseVoiceUtterance(text));
      return parseVoiceUtterance(text);
    };
    var add = rootEl.querySelector('#u47VAdd');
    if (add) add.addEventListener('click', function () {
      var payload = {
        qty: qty && qty.value, unit: unit && unit.value,
        task: item && item.value, day: day && day.value
      };
      if (!payload.task) { if (status) status.textContent = 'Enter an item first.'; return; }
      if (handlers.onAdd) handlers.onAdd(payload);
      if (status) status.textContent = 'Added.';
      if (item) item.value = '';
      if (qty) qty.value = '';
    });
  }

  /* ---------- 8) Auto-assign section ---------- */
  var SEC_MAP_KEY = 'prepline.sectionMap.v1';
  function sectionMap() { return lsGet(SEC_MAP_KEY, { byIngredient: {} }) || { byIngredient: {} }; }
  function saveSectionMap(m) { lsSet(SEC_MAP_KEY, m); }
  function learnSectionsFromRows(rows) {
    var m = sectionMap();
    (rows || []).forEach(function (r) {
      if (!r || !r.task || !r.section) return;
      var parts = root.PreplineBatch && root.PreplineBatch.parseTaskParts
        ? root.PreplineBatch.parseTaskParts(r.task) : { name: normKey(r.task) };
      var k = normKey(parts.name || r.task);
      if (!k) return;
      if (!m.byIngredient[k]) m.byIngredient[k] = {};
      m.byIngredient[k][r.section] = (m.byIngredient[k][r.section] || 0) + 1;
    });
    saveSectionMap(m);
    return m;
  }
  function suggestSection(task, fallback) {
    var parts = root.PreplineBatch && root.PreplineBatch.parseTaskParts
      ? root.PreplineBatch.parseTaskParts(task) : { name: normKey(task) };
    var k = normKey(parts.name || task);
    var m = sectionMap().byIngredient[k];
    if (!m) return { section: fallback || '', source: 'fallback', key: k };
    var best = '', n = 0;
    Object.keys(m).forEach(function (s) { if (m[s] > n) { n = m[s]; best = s; } });
    return { section: best || fallback || '', source: best ? 'learned' : 'fallback', key: k, count: n };
  }
  function sectionBadgeHtml(suggestion, escH) {
    escH = wrapEsc(escH);
    if (!suggestion || !suggestion.section) return '';
    var tip = suggestion.source === 'learned'
      ? ('Usually goes to ' + suggestion.section + ' (' + (suggestion.count || 0) + ' prior lines)')
      : 'Suggested from rules';
    return '<span class="u47-secbadge" title="' + escH(tip) + '">→ ' + escH(suggestion.section) + '</span>';
  }

  /* ---------- 10) Organised yellow-header xlsx ---------- */
  function buildExportRows(rows, deps, helpers) {
    helpers = helpers || {};
    var clean = helpers.cleanDishName || function (d) { return d; };
    var computeTotal = (deps && deps.computeTotal) || function () { return null; };
    var toBaseQty = (deps && deps.toBaseQty) || function (n, u) { return { n: n, u: u }; };
    var batches = (root.PreplineBatch && root.PreplineBatch.buildBatches)
      ? root.PreplineBatch.buildBatches(rows, deps) : [];
    var staffBySection = helpers.staffBySection || {};
    var out = [];
    var batchNo = 0;
    batches.forEach(function (g) {
      batchNo += 1;
      var dishName = g.merged
        ? mergedSubtitleText(g, { cleanDishName: clean, maxNames: 99 })
        : clean((g.dishes && g.dishes[0]) || '');
      if (!dishName) dishName = clean((g.dishes && g.dishes[0]) || '') || '—';
      // For merged, Function name cell gets "Merged: A + B"; also keep plain join as fallback note
      if (g.merged && dishName.indexOf('Merged:') !== 0) {
        dishName = mergedSubtitleText(g, { cleanDishName: clean });
      }
      if (!g.merged) {
        dishName = (g.dishes || []).map(clean).filter(Boolean).join(' + ') || '—';
      }
      var qtyEach = '';
      if (g.rows && g.rows[0] && g.rows[0].qty !== '' && g.rows[0].qty != null) {
        qtyEach = String(g.rows[0].qty) + (g.rows[0].unit ? ' ' + g.rows[0].unit : '');
      } else {
        qtyEach = '—';
      }
      var qtyTotal = g.hasTotal
        ? (String(Math.round(g.total * 1000) / 1000) + ' ' + (g.unit || '')).trim()
        : 'set pax';
      var staff = staffBySection[g.section] || helpers.defaultStaff || 'Unallocated';
      out.push({
        dishName: dishName || '—',
        itemName: g.taskLabel || '—',
        qtyEach: qtyEach || '—',
        qtyTotal: qtyTotal || '—',
        batchNo: String(batchNo),
        staff: staff || 'Unallocated',
        merged: !!g.merged,
        group: g
      });
    });
    return out;
  }

  function exportOrganisedXlsx(rows, deps, helpers) {
    if (typeof XLSX === 'undefined' || !XLSX.utils) {
      throw new Error('XLSX not loaded');
    }
    var data = buildExportRows(rows, deps, helpers);
    var headers = ['Dish name', 'Item name', 'Qty each', 'Qty total needed', 'Batch no.', 'Staff allocated'];
    var aoa = [headers];
    data.forEach(function (r) {
      aoa.push([r.dishName, r.itemName, r.qtyEach, r.qtyTotal, r.batchNo, r.staff]);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    // Yellow header + bold via cell styles when xlsx-js-style present; else mark and rely on openpyxl verify path
    var yellow = { patternType: 'solid', fgColor: { rgb: 'FFFF00' } };
    var bold = { bold: true, name: 'Arial', sz: 11 };
    headers.forEach(function (_, c) {
      var addr = XLSX.utils.encode_cell({ r: 0, c: c });
      if (!ws[addr]) ws[addr] = { t: 's', v: headers[c] };
      ws[addr].s = { fill: yellow, font: bold, alignment: { vertical: 'center' } };
    });
    // Ensure no blank data cells
    for (var r = 1; r < aoa.length; r++) {
      for (var c = 0; c < 6; c++) {
        var a = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[a] || ws[a].v === '' || ws[a].v == null) {
          ws[a] = { t: 's', v: '—' };
        }
      }
    }
    ws['!cols'] = [
      { wch: 36 }, { wch: 32 }, { wch: 14 }, { wch: 18 }, { wch: 12 }, { wch: 16 }
    ];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    // SheetJS community: freeze via workbook view / !rows sometimes ignored — set workbook sheet views
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Prep list');
    if (!wb.Workbook) wb.Workbook = {};
    if (!wb.Workbook.Views) wb.Workbook.Views = [{}];
    wb.Workbook.Views[0].activeTab = 0;
    // panes
    if (!ws['!views']) ws['!views'] = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }];
    var name = 'Prepline_Organised_' + (new Date().toISOString().slice(0, 10)) + '.xlsx';
    XLSX.writeFile(wb, name);
    return { name: name, rows: data.length, headers: headers, data: data };
  }

  /* ---------- CSS ---------- */
  function css() {
    return [
      '.u47-note{font-size:12.5px;color:var(--ink-soft,#5C5A52);margin:0 0 12px;}',
      '.u47-dayhead{margin:0 0 8px;}',
      '.u47-sechead{margin:12px 0 6px;font-size:14px;color:var(--ink-soft,#5C5A52);}',
      '.u47-tickbar{display:inline-flex;align-items:center;gap:6px;margin-top:6px;}',
      '.u47-tickbtn{width:44px;height:44px;border-radius:10px;border:1px solid var(--line,#D9D3C3);background:#fff;font-size:20px;cursor:pointer;}',
      '.u47-tick-done .u47-tickbtn[data-tick=done],.u47-tick-part .u47-tickbtn[data-tick=part]{background:#1C1B16;color:#fff;border-color:#1C1B16;}',
      '.u47-tickpct{width:64px;height:40px;font-size:16px;}',
      '.u47-progbar{height:8px;background:#E8E4D8;border-radius:99px;margin:8px 0;overflow:hidden;}',
      '.u47-progbar>div{height:100%;background:#2F6B3A;}',
      '.u47-diff ul{margin:6px 0;padding-left:18px;}',
      '.u47-add{color:#2F6B3A;}',
      '.u47-rem{color:#9B2C2C;}',
      '.u47-chg{color:#7A5A00;}',
      '.u47-mic{width:100%;max-width:320px;height:64px;font-size:18px;border-radius:12px;border:2px solid #1C1B16;background:#fff;cursor:pointer;}',
      '.u47-mic-on{background:#FFF4C2;border-color:#C9A227;}',
      '.u47-secbadge{display:inline-block;margin-left:6px;font-size:11px;padding:2px 7px;border-radius:999px;background:#E8F0FE;color:#1A56DB;}',
      '.u47-merged-short{display:none;}',
      '@media (max-width:520px){.u47-merged-full{display:none;}.u47-merged-short{display:inline;}}',
      '.u47-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px;}'
    ].join('');
  }
  function ensureCss() {
    if (typeof document === 'undefined') return;
    if (document.getElementById('u47Css')) return;
    var s = document.createElement('style');
    s.id = 'u47Css';
    s.textContent = css() + stationPrintCss();
    document.head.appendChild(s);
  }

  root.PreplineUpgrades47 = {
    VERSION: '4.7.0',
    buildWeekGroups: buildWeekGroups,
    renderWeekView: renderWeekView,
    mergedSubtitleText: mergedSubtitleText,
    mergedSubtitleHtml: mergedSubtitleHtml,
    functionNamesForGroup: functionNamesForGroup,
    getTick: getTick,
    setTick: setTick,
    tickControlsHtml: tickControlsHtml,
    progressSummaryHtml: progressSummaryHtml,
    exportProgressCode: exportProgressCode,
    importProgressCode: importProgressCode,
    bindTickControls: bindTickControls,
    rememberSnapshot: rememberSnapshot,
    peekLastDiff: peekLastDiff,
    diffSnapshots: diffSnapshots,
    changeCheckHtml: changeCheckHtml,
    buildOrderFromBatches: buildOrderFromBatches,
    renderOrderFromBatches: renderOrderFromBatches,
    orderCsv: orderCsv,
    recipeLib: recipeLib,
    saveRecipes: saveRecipes,
    applyYieldToQty: applyYieldToQty,
    recipeLibHtml: recipeLibHtml,
    bindRecipeLib: bindRecipeLib,
    useByFromPrep: useByFromPrep,
    buildStationSheetsFromAlloc: buildStationSheetsFromAlloc,
    stationSheetHtml: stationSheetHtml,
    stationPrintCss: stationPrintCss,
    parseVoiceUtterance: parseVoiceUtterance,
    voiceSupported: voiceSupported,
    voicePanelHtml: voicePanelHtml,
    bindVoice: bindVoice,
    simulateVoice: function (text) {
      var p = parseVoiceUtterance(text);
      if (p && typeof document !== 'undefined') {
        var qty = document.getElementById('u47VQty');
        var unit = document.getElementById('u47VUnit');
        var item = document.getElementById('u47VItem');
        var day = document.getElementById('u47VDay');
        var status = document.getElementById('u47VStatus');
        if (qty) qty.value = p.qty || '';
        if (unit) unit.value = p.unit || '';
        if (item) item.value = p.task || '';
        if (day && p.day) day.value = p.day;
        if (status) status.textContent = 'Heard: ' + (p.raw || '') + ' — check, then Add line.';
      }
      return p;
    },
    learnSectionsFromRows: learnSectionsFromRows,
    suggestSection: suggestSection,
    sectionBadgeHtml: sectionBadgeHtml,
    buildExportRows: buildExportRows,
    exportOrganisedXlsx: exportOrganisedXlsx,
    ensureCss: ensureCss,
    latestDeliveryDay: latestDeliveryDay,
    SHELF_DAYS: SHELF_DAYS
  };
})(typeof window !== 'undefined' ? window : globalThis);
