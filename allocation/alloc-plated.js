/* Prepline: Plated kitchen work-order extraction.
   Same day/event/room/qty/item columns as Larder; Colour Codes legend is Plated (FFFF00) + Cutaway.
   Builds Entree / Main / Dessert allocation sheets. No real guest data in here. */
(function (root) {
  'use strict';
  const DW = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const FILL = { Entree: 'FFFF00', Main: 'F4B183', Dessert: 'D5A6BD', Other: 'CFE2F3' };
  const HEADER = /^(entree|entr[eé]e|main\s*course|dessert|plated\s*menu|breakfast|alternate\s*serve)\b/i;
  const COURSE_ENTREE = /\bentr[eé]e\b/i;
  const COURSE_MAIN = /\bmain\s*course\b/i;
  const COURSE_DESSERT = /\bdessert\b/i;
  const COURSE_BF = /\bbreakfast\b|seated\s*breakfast/i;
  const DIETARY_LABEL = /^dietary\s*option\b/i;
  const SKIP_ITEM = /^(no\s*signature\s*dishes|table\s*service|filter\s*coffee|\bteas?\b|botanical\s*water|additional\s*hours|hire\b|service\s*fee)\b/i;
  const CREW = /\bcrew\s*(main\s*)?meal\b|icc\s*av\s*crew/i;
  const GENERIC = /generic\s*menu\s*item|two\s*course\s*plated|sydneysider\s*seated|dish\s*selection\s*missing/i;
  const TAGS = /\s+\b(GF|VE|V|DF|LC|contains\b.*)(\s+(GF|VE|V|DF|LC))*\s*$/i;

  const clean = (v) => (v == null ? '' : String(v).replace(/\u00a0/g, ' ').trim());
  const lc = (s) => String(s || '').toLowerCase();

  function shortDish(t) {
    t = clean(t).split('\n')[0].replace(/^["'\-\s•]+/, '');
    t = t.replace(/\((serves|pfd|ge|v|gf)[^)]*\)/gi, '');
    let seg = t.split(/,| with | served | – | - /i);
    let s = (seg[0] || '').trim();
    if (s.split(/\s+/).length < 2 && seg[1]) s += ' ' + seg[1].trim();
    return lc(s.replace(TAGS, '').replace(/\s+/g, ' ').trim());
  }

  function courseFromHeader(item) {
    const s = lc(item);
    if (COURSE_ENTREE.test(s)) return 'Entree';
    if (COURSE_MAIN.test(s)) return 'Main';
    if (COURSE_DESSERT.test(s)) return 'Dessert';
    if (COURSE_BF.test(s)) return 'Other';
    if (/^plated\s*menu/i.test(s)) return 'Other';
    return 'Other';
  }

  /** Detect Larder vs Plated from Colour Codes legend and sheet names. */
  function detectSection(legend, sheetNames) {
    const names = (legend || []).map((l) => lc(l.name || l));
    const sheets = (sheetNames || []).map((n) => lc(n));
    // Sheet tab names are authoritative when present
    if (sheets.some((n) => /plated\s*tally|^plated$/.test(n))) return 'Plated';
    if (sheets.some((n) => /larder\s*tally|^larder$/.test(n))) return 'Larder';
    const hasPlated = names.some((n) => /^plated$/.test(n.trim()));
    const hasLarder = names.some((n) =>
      /^(sandwich|canap[eé]s?|salad|fruit|fruits|kiosk|platters?|green\s*room|syd\s*eats|retail)$/.test(n.trim())
    );
    if (hasPlated && !hasLarder) return 'Plated';
    if (hasLarder && !hasPlated) return 'Larder';
    if (hasPlated) return 'Plated';
    return 'Larder';
  }

  function buildCourses(wo, S) {
    const L = wo.lines || [];
    const skipped = [];
    const trace = [];
    const out = new Map();
    const functions = new Map();
    let course = 'Other';
    let dietaryNext = false;
    let lastEk = '';

    const put = (sec, date, dish, pax, o) => {
      const key = sec + '|' + date + '|' + dish;
      let g = out.get(key);
      if (!g) {
        g = {
          section: sec,
          date,
          dates: [date],
          dish,
          parts: [],
          rows: [],
          first: o.r,
          kind: o.kind || 'dish',
          fill: FILL[sec] || FILL.Other,
          flags: new Set(),
          dietary: !!o.dietary,
          events: new Set(),
          rooms: new Set()
        };
        out.set(key, g);
      }
      if (pax != null && pax !== '') {
        const q = typeof pax === 'number' ? pax : Number(pax);
        if (Number.isFinite(q)) g.parts.push({ r: o.r, q });
        else g.raw = pax;
      }
      g.rows.push(o.r);
      g.first = Math.min(g.first, o.r);
      if (o.event) g.events.add(o.event);
      if (o.room) g.rooms.add(o.room);
      if (o.flag) g.flags.add(o.flag);
      if (o.dietary) g.dietary = true;
      trace.push({ woRow: o.r, dish, section: sec });
      return g;
    };

    for (const l of L) {
      const it = clean(l.item);
      const its = lc(it);
      const ek = l.date + '|' + l.event;
      if (ek !== lastEk) {
        course = 'Other';
        dietaryNext = false;
        lastEk = ek;
      }
      if (!functions.has(ek)) {
        functions.set(ek, {
          date: l.date,
          event: l.event,
          eventNo: l.eventNo || '',
          rooms: new Set(),
          dishes: 0,
          paxMax: 0
        });
      }
      const fn = functions.get(ek);
      if (l.room) fn.rooms.add(l.room);

      // Only Plated / cutaway-coloured rows (and uncoloured parents are already filtered by parse)
      if (l.colour && l.colour !== 'FFFF00' && l.colour !== 'FF0000') {
        // non-plated colours on a plated sheet — skip
        skipped.push({ r: l.r, item: it, why: 'colour ' + l.colour + ' not Plated yellow' });
        continue;
      }
      if (!l.colour) {
        skipped.push({ r: l.r, item: it, why: 'uncoloured (not Plated)' });
        continue;
      }

      if (DIETARY_LABEL.test(its)) {
        dietaryNext = true;
        skipped.push({ r: l.r, item: it, why: 'dietary label (marks following dish)' });
        continue;
      }
      if (HEADER.test(its) || /alternate\s*serve\s*:?\s*$/i.test(its)) {
        course = courseFromHeader(it);
        dietaryNext = false;
        if (l.qty > 1) fn.paxMax = Math.max(fn.paxMax, l.qty);
        skipped.push({ r: l.r, item: it, why: 'course / menu header (pax context only)' });
        continue;
      }
      if (SKIP_ITEM.test(its)) {
        skipped.push({ r: l.r, item: it, why: 'service / non-dish row' });
        continue;
      }
      if (CREW.test(its)) {
        skipped.push({ r: l.r, item: it, why: 'crew meal (not plated guest dish — confirm)' });
        continue;
      }
      if (l.qty <= 0) {
        skipped.push({ r: l.r, item: it, why: 'qty 0' });
        continue;
      }

      let sec = course;
      if (COURSE_BF.test(its) || /^plated\s*item:/i.test(its)) sec = 'Other';
      const dish = shortDish(it) || its.slice(0, 40);
      const dietary = dietaryNext;
      dietaryNext = false;
      const flag = GENERIC.test(its) ? 'Dish / menu selection may be missing — confirm' : null;
      put(sec, l.date, dish, l.qty, {
        r: l.r,
        event: l.event,
        room: l.room,
        dietary,
        flag,
        kind: 'dish'
      });
      fn.dishes += 1;
      fn.paxMax = Math.max(fn.paxMax, l.qty || 0);
    }

    const lines = [];
    for (const g of out.values()) {
      const total = g.parts.reduce((a, p) => a + p.q, 0);
      const pv =
        g.raw != null
          ? g.raw
          : g.parts.length > 1
            ? '=' + g.parts.map((p) => p.q).join('+')
            : g.parts.length
              ? total
              : null;
      const notesBits = [];
      if (g.dietary) notesBits.push('dietary');
      if (g.events.size === 1) notesBits.push([...g.events][0]);
      else if (g.events.size > 1) notesBits.push(g.events.size + ' functions');
      if (g.rooms.size > 1) notesBits.push(g.rooms.size + ' rooms');
      lines.push({
        section: g.section,
        date: g.date,
        dates: g.dates,
        dish: g.dish,
        paxValue: pv,
        paxTotal: typeof pv === 'number' ? pv : total,
        dayWord: null,
        fill: g.fill,
        flag: [...g.flags].join(' · ') || null,
        notes: notesBits.join(' · ') || null,
        woRows: [...new Set(g.rows)],
        first: g.first,
        kind: g.kind,
        dietary: g.dietary,
        syd: false,
        startMin: null
      });
    }
    lines.sort(
      (a, b) =>
        (a.date || '').localeCompare(b.date || '') ||
        ['Entree', 'Main', 'Dessert', 'Other'].indexOf(a.section) -
          ['Entree', 'Main', 'Dessert', 'Other'].indexOf(b.section) ||
        (a.first || 0) - (b.first || 0)
    );

    const fnList = [...functions.values()]
      .map((f) => ({
        date: f.date,
        event: f.event,
        eventNo: f.eventNo,
        rooms: [...f.rooms],
        dishes: f.dishes,
        paxMax: f.paxMax
      }))
      .sort((a, b) => a.date.localeCompare(b.date) || a.event.localeCompare(b.event));

    return { lines, skipped, trace, functions: fnList, kitchenSection: 'Plated' };
  }


  var P = typeof AllocProduction !== 'undefined' ? AllocProduction
    : (typeof require === 'function' ? (function () { try { return require('./alloc-production.js'); } catch (e) { return null; } })() : null);

  var PROD_SEC = [{ key: 'Plated', fill: 'FFFF00', label: 'plated', amDefault: null }];

  /** Curated short names matching Gerard's plated-a.xlsx outcome. */
  function prodShort(item) {
    var t = lc(clean(item));
    if ((/pea/.test(t) && /parfait/.test(t)) || (/parfait/.test(t) && /coconut|umami/.test(t))) return 'pea parfait';
    if (/cod/.test(t) && /pea/.test(t)) return 'cod, pea valoute';
    if (/eye\s*fillet\s*parsnip|parsnip\s*silk/.test(t)) return 'eye fillet parsnip';
    if (/chargrilled.*eye\s*fillet|beef\s*eye\s*fillet/.test(t) && !/aubergine|parsnip/.test(t)) return 'eye fillet';
    if (/aubergine\s*eye\s*fillet|native\s*spiced\s*aubergine/.test(t)) return 'aubergine';
    if (/lamb\s*two\s*ways/.test(t)) return 'lamb two ways';
    if (/cabbage\s*brik|cannonball\s*cabbage/.test(t)) return 'cabbage brik';
    if (/wild\s*caught\s*prawn|mooloolaba\s*prawn/.test(t)) return 'wild caught prawns';
    if (/\bprawns?\b/.test(t) && !/wild/.test(t)) return 'prawns';
    if (/burrata/.test(t)) return 'burrata';
    if (/beef\s*cheek|braised\s*riverina\s*beef\s*cheek/.test(t)) return 'beef cheek';
    if (/\bsalmon\b/.test(t)) return 'salmon';
    if (/ravioli|butternut\s*squash/.test(t)) return 'ravioli';
    if (/byron\s*bay|berkshire\s*pork/.test(t)) return 'byron bay pork';
    if (/hawkesbury\s*duck|\bduck\s*breast|\bduck\b/.test(t)) return 'duck';
    if (/chicken\s*mosaic|girraween|\bmosaic\b/.test(t)) return 'mosaic';
    if (/beetroot|textures\s*of\s*beetroot/.test(t)) return 'beetroot terrine';
    if (/lamb\s*rump/.test(t)) return 'lamb rump';
    if (/potato\s*and\s*leek\s*pave|\bpave\b/.test(t)) return 'pave';
    if (/pea\s*parfait/.test(t)) return 'pea parfait';
    if (/breakfast|bfast|seated\s*breakfast/.test(t)) return 'bfast';
    if (/aubergine/.test(t)) return 'aubergine fillet';
    return shortDish(item) || t.slice(0, 40);
  }

  function dayWordPlated(isoD) {
    if (P && P.dayWord) {
      var w = P.dayWord(isoD);
      if (w === 'wednesday') return 'Wed';
      if (w === 'thursday') return 'thursday';
      if (w === 'friday') return 'Fri';
      if (w === 'monday') return 'Monday';
      if (w === 'tuesday') return 'Tue';
      return w.charAt(0).toUpperCase() + w.slice(1, 3);
    }
    return isoD;
  }

  /** Production-template Plated allocation matching plated-a.xlsx (single Plated section). */
  function buildProduction(wo, S) {
    S = S || {};
    var skipped = [];
    var trace = [];
    var byKey = {};
    var functions = new Map();
    var dietaryNext = false;
    var lastEk = '';

    (wo.lines || []).forEach(function (l) {
      var it = clean(l.item);
      var its = lc(it);
      var ek = l.date + '|' + l.event;
      if (ek !== lastEk) { dietaryNext = false; lastEk = ek; }
      if (!functions.has(ek)) {
        functions.set(ek, { date: l.date, event: l.event, eventNo: l.eventNo || '', rooms: new Set(), dishes: 0, paxMax: 0 });
      }
      var fn = functions.get(ek);
      if (l.room) fn.rooms.add(l.room);

      var col = String(l.colour || '').toUpperCase();
      if (col.length === 8) col = col.slice(-6);
      if (col && col !== 'FFFF00') {
        skipped.push({ r: l.r, item: it, why: 'colour ' + col + ' not Plated yellow' });
        return;
      }
      if (!col) {
        skipped.push({ r: l.r, item: it, why: 'uncoloured (not Plated)' });
        return;
      }
      if (DIETARY_LABEL.test(its)) { dietaryNext = true; return; }
      if (/salted\s*crisp|dried\s*fruit\s*and\s*nuts|farmhouse\s*scrambled|scrambled\s*free-range\s*eggs/i.test(its)) {
        skipped.push({ r: l.r, item: it, why: 'side/snack not on Production gold' });
        return;
      }
      if (HEADER.test(its) || /alternate\s*serve\s*:?\s*$/i.test(its)) {
        if (l.qty > 1) fn.paxMax = Math.max(fn.paxMax, l.qty);
        skipped.push({ r: l.r, item: it, why: 'course header' });
        return;
      }
      if (SKIP_ITEM.test(its) || CREW.test(its)) {
        skipped.push({ r: l.r, item: it, why: 'non-dish' });
        return;
      }
      if (!(l.qty > 0)) {
        skipped.push({ r: l.r, item: it, why: 'qty 0' });
        return;
      }
      var dish = prodShort(it);
      var k = l.date + '|' + dish;
      var g = byKey[k];
      if (!g) {
        g = { dish: dish, functionDate: l.date, paxParts: [], first: l.r, notes: null, events: [] };
        byKey[k] = g;
      }
      g.paxParts.push(l.qty);
      if (dietaryNext) g.notes = (g.notes ? g.notes + '; ' : '') + 'dietary';
      dietaryNext = false;
      if (l.event && g.events.indexOf(l.event) < 0) g.events.push(l.event);
      fn.dishes += 1;
      fn.paxMax = Math.max(fn.paxMax, l.qty || 0);
      trace.push({ r: l.r, dish: dish, date: l.date });
    });

    var items = Object.keys(byKey).map(function (k) {
      var g = byKey[k];
      var pax = g.paxParts.length === 1 ? g.paxParts[0] : g.paxParts.join('+');
      return {
        section: 'Plated',
        dish: g.dish,
        paxValue: pax,
        functionDate: g.functionDate,
        dayWord: dayWordPlated(g.functionDate),
        staff: P && P.staffGuess ? P.staffGuess(typeof pax === 'number' ? pax : g.paxParts.reduce(function (a, b) { return a + b; }, 0)) : null,
        notes: g.notes,
        first: g.first,
        kind: 'plated'
      };
    });

    var days = (wo.days || []).slice().sort();
    if (!days.length) days = items.map(function (i) { return i.functionDate; }).sort();
    var first = days[0];
    var addDays = P.addDays.bind(P);
    var monday = addDays(first, -((P.dow(first) + 6) % 7));
    var week = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(monday, i); });
    var ahead = S.prepDaysAhead != null ? Math.max(S.prepDaysAhead, 5) : 5;
    var extraAhead = S.extraAhead || { Monday: 7, Tuesday: 6, Wednesday: 5, Thursday: 5, Friday: 4, Saturday: 3 };
    var placed = P.placeOnPrepDays(items, week, { ahead: ahead, includeFunctionDay: true, extraAhead: extraAhead });

    var fnList = [...functions.values()].map(function (f) {
      return { date: f.date, event: f.event, eventNo: f.eventNo, rooms: [...f.rooms], dishes: f.dishes, paxMax: f.paxMax };
    }).sort(function (a, b) { return a.date.localeCompare(b.date); });

    return {
      lines: placed,
      items: items,
      skipped: skipped,
      trace: trace,
      functions: fnList,
      kitchenSection: 'Plated',
      mode: 'production',
      note: 'Plated Production allocation (yellow → Plated section). Day summary + sorter prep list unchanged.',
      week: week,
      sections: PROD_SEC
    };
  }

  /** Default build = Production template (Gerard sample). buildCourses keeps Entree/Main/Dessert. */
  function build(wo, S) {
    if (S && S.platedMode === 'courses') return buildCourses(wo, S);
    if (!P) return buildCourses(wo, S);
    return buildProduction(wo, S);
  }


  const API = {
    detectSection,
    build,
    buildCourses,
    buildProduction,
    shortDish,
    prodShort,
    FILL,
    SERVICE_SECTIONS: ['Plated'],
    PREP_SECTIONS: [
      { key: 'Plated', title: 'Plated', fill: 'FFFF00', matrix: [['plated', 'am'], [null, 'pm']] }
    ],
    SERVICE_FILL: { Plated: 'FFFF00' },
    SEC_META: PROD_SEC,
    MODE: 'production'
  };
  root.AllocPlated = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
