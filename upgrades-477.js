/* Prepline 4.7.7 (+… +4.8.15 week-ending title + DONE tick) — Paula Sorted layout (trial). Autoprod.
 * One sheet per kitchen section; WEEK ENDING title; section title; yellow header; flat item rows.
 * Columns: Item | Quantity per pax | Unit | PAX | Total needed (plain qty×pax) | BAT/PO # | Section |
 * Prep day | Source tab | STAFF ALLOCATED | DONE (☐/☑ tick). Print titles repeat WE+section+header every page.
 */
(function (root) {
  'use strict';

  var U = root.PreplineUpgrades47;
  if (!U) {
    console.warn('Prepline477: PreplineUpgrades47 missing — Organised Paula layout not applied');
    return;
  }

  var WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  /* Paula's tab order / names (Excel 31-char limit drops " Etc." from Garnishes). */
  var PAULA_TABS = [
    { sheet: 'Sauce, Purees and Gels', sections: ['Sauce, Purees and Gels'] },
    { sheet: 'Vegetables', sections: ['Vegetables'] },
    { sheet: 'Garnishes, Herbs, Powders, Oils', sections: ['Garnishes, Herbs, Powders, Oils Etc.', 'Garnishes, Herbs, Powders, Oils'] },
    { sheet: 'Starch', sections: ['Starch'] },
    { sheet: 'Proteins', sections: ['Proteins'] }
  ];
  var OTHER_SHEET = 'Other';

  var HEADERS = [
    'Item', 'Quantity per pax', 'Unit', 'PAX ', 'Total needed',
    'BAT/PO #', 'Section', 'Prep day', 'Source tab', 'STAFF ALLOCATED', 'DONE'
  ];

  var COL_WIDTHS = [38.75, 16.75, 8.75, 14.75, 13.75, 12.75, 24.75, 12.75, 34.75, 28.75, 8.5];
  var COL_COUNT = HEADERS.length;
  var DONE_COL = COL_COUNT; /* 1-based */
  var DONE_UNCHECKED = '\u2610'; /* ☐ */
  var DONE_CHECKED = '\u2611'; /* ☑ */
  /* Rows: 1=WEEK ENDING, 2=section title, 3=yellow headers, 4+=data */
  var TITLE_WE_ROW = 1;
  var TITLE_SECTION_ROW = 2;
  var HEADER_ROW = 3;
  var DATA_START_ROW = 4;

  function sheetForSection(sec) {
    var s = String(sec || '').trim();
    for (var i = 0; i < PAULA_TABS.length; i++) {
      if (PAULA_TABS[i].sections.indexOf(s) >= 0) return PAULA_TABS[i].sheet;
    }
    return OTHER_SHEET;
  }

  /* Canonical Section text for a Paula tab (Garnishes keeps the " Etc." Paula writes). */
  function sectionForSheet(sheet) {
    var s = String(sheet || '').trim();
    for (var i = 0; i < PAULA_TABS.length; i++) {
      if (PAULA_TABS[i].sheet === s) return PAULA_TABS[i].sections[0];
    }
    return s || '—';
  }

  function pad2(n) {
    n = Number(n);
    return (n < 10 ? '0' : '') + n;
  }

  /** Format as Paula-style DD.MM.YY */
  function formatWeLabel(dd, mm, yy) {
    var y = String(yy);
    if (y.length === 4) y = y.slice(2);
    return 'WEEK ENDING ' + pad2(dd) + '.' + pad2(mm) + '.' + y;
  }

  /** Parse WE-15.11.26 / WE 15.11.26 / week ending 15/11/2026 from text. */
  function parseWeFromText(text) {
    var s = String(text || '');
    var m = s.match(/\bWE[\s._-]*(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b/i);
    if (!m) m = s.match(/\bweek\s*ending\s*:?\s*(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})\b/i);
    if (!m) return null;
    return formatWeLabel(m[1], m[2], m[3]);
  }

  /** Parse dd/mm/yyyy or dd.mm.yy → Date (local). */
  function parseAussieDate(str) {
    var m = String(str || '').trim().match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})$/);
    if (!m) return null;
    var dd = Number(m[1]), mm = Number(m[2]), yy = Number(m[3]);
    if (yy < 100) yy += 2000;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var d = new Date(yy, mm - 1, dd);
    if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return d;
  }

  /** Paula convention: week ends on Sunday (WE-15.11.26 = Sunday). */
  function sundayOnOrAfter(d) {
    var day = d.getDay(); /* 0=Sun */
    if (day === 0) return d;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - day));
  }

  /**
   * Resolve WEEK ENDING label for organised export.
   * 1) Upload filename WE-xx.xx.xx
   * 2) Max BAT/function date → Sunday ending that week
   * 3) Fallback hand-entry placeholder
   */
  function resolveWeekEndingLabel(helpers, paulaRows) {
    helpers = helpers || {};
    var fromFile = parseWeFromText(helpers.sourceFileName || helpers.fileName || '');
    if (fromFile) return { label: fromFile, source: 'filename' };

    var dates = [];
    var getDs = helpers.getEventDateStr;
    (paulaRows || []).forEach(function (r) {
      var ds = null;
      if (typeof getDs === 'function') {
        try {
          var dish = r.sourceTab || r.dish || '';
          /* sourceTab is often the dish/tab name used for event lookup */
          ds = getDs(dish) || getDs(String(dish).replace(/^\d+\s+\w+\s+/, ''));
        } catch (e) {}
      }
      if (!ds && r.eventDateStr) ds = r.eventDateStr;
      var d = parseAussieDate(ds);
      if (d) dates.push(d);
    });
    if (dates.length) {
      dates.sort(function (a, b) { return a - b; });
      var latest = dates[dates.length - 1];
      var sun = sundayOnOrAfter(latest);
      return {
        label: formatWeLabel(sun.getDate(), sun.getMonth() + 1, sun.getFullYear()),
        source: 'event-dates'
      };
    }
    return { label: 'WEEK ENDING: ____', source: 'blank' };
  }


  /* Paula places rows on tabs by what the item is, not only by the colour-legend Section.
   * 4.8.7: Section column ALWAYS equals the tab the row is placed on (canonical label,
   * including " Etc." on Garnishes). Colour/keyword classification still drives the
   * fallback when no item-head heuristic matches; tab overrides then rewrite Section.
   * BAT/PO # is always blank (handwritten batch numbers) — never filled from upload.
   */
  function sheetForItem(item, sec) {
    var raw = String(item || '');
    /* Classify on the dish/item head (text before the first " / " method step) so
     * words buried in method notes (Jus, Oil, Cream) do not steal the tab.
     * Rules refined from Paula Sorted samples WE15 + WE-08 + WE-01 (see private RULES.md). */
    var head = raw.split(/\s+\/\s+/)[0];
    var t = head.toLowerCase();
    var full = raw.toLowerCase();
    /* 0) Vegetables that would otherwise match Butter/Sauce/Section fallbacks. */
    if (/\bbutter\s*poached\b/.test(t)
        || /\bpoached\s+onions?\b/.test(t)
        || /\bzucchini\s*blossoms?\b/.test(t)) {
      return 'Vegetables';
    }
    /* 1) Sauces / purees / gels / dressings / ragu — head only. */
    if (/\b(jus|puree|purée|ponzu|dressing|romesco|aioli|vinaigrette|chimichurri|salsa|ragu|rag[uù])\b/.test(t)
        || /\b(cashew\s*cream|flora\s*cream|cream\s*sauce|umami\s*cream|cauliflower\s*cream)\b/.test(t)
        || /\bsauce\b/.test(t)
        || /(?:^|\s)cream\s*$/.test(t.trim())
        || /\bgel\b/.test(t)
        || /^(butter|cream)$/.test(t.trim())
        || /\bparmesan\b/.test(t)) {
      return 'Sauce, Purees and Gels';
    }
    /* 2) Garnishes — head: roe, soils, pickles, microherbs, oils-as-product, tendrils, fine herbs, crisps. */
    if (/\b(croutons?|fennel\s*seed|burrata|raisin|microherbs?|micro\s*herbs?|powder|pickled|tapenade|pesto|roe|finger\s*lime|kibbled|ma[iî]tre)\b/.test(t)
        || /\b(soil|dukkah|gremolata|tendrils?|crisps?)\b/.test(t)
        || /\b(fine\s*dic(?:ed)?|chopped|chiffon|pluck(?:ed)?|picked)\b/.test(t)
        || /\boil\b/.test(t)
        || /maître\s*d/.test(t)) {
      return 'Garnishes, Herbs, Powders, Oils';
    }
    /* 3) Proteins — head: meat/seafood + cigar; seafood croquettes only. */
    if (/\b(prawn|shrimp|lobster|crab|barramundi|barra|salmon|cod|tuna|swordfish|snapper|whiting|flathead|mackerel|trout)\b/.test(t)
        || /\b(beef|eye\s*fillet|tenderloin|sirloin|scotch|lamb|pork|veal|duck|chicken|turkey|quail|kangaroo|venison|wagyu)\b/.test(t)
        || /\bcigar\b/.test(t)
        || (/\bcroquettes?\b/.test(t) && /\b(crab|prawn|shrimp|lobster|fish|salmon|cod|barra|tuna|whiting)\b/.test(t))) {
      return 'Proteins';
    }
    /* 4) Starch staples — head (incl. non-seafood croquettes, polenta, pasta, dumpling prep). */
    if (/\b(mash|pav[eé]|terrine|parfait|wellington|duxelle|puff\s*pastry|potato\s+and\s+leek|dairy\s*free\s*mash|smoked\s*mash)\b/.test(t)
        || /\b(polenta|fregola|gnocchi|ravioli|dumpling|risotto)\b/.test(t)
        || /\bcroquettes?\b/.test(t)
        || /\b(slice\s+potatoes|blanch\s+cabbage|braise\s+shredded\s+cabbage|cabbage\s+layers|cabbage\s+filling)\b/.test(t)) {
      return 'Starch';
    }
    /* 5) Vegetables — head (peas, radish, eggplant, remoulade, mushrooms). */
    if (/\b(asparagus|lettuce|onion|carrot|leek|zucchini|cucumber|chard|broccolini|mushroom|shimeji|warrigal|karkalla|samphire|blite|seablight|sea\s*blite|pencil\s*leek)\b/.test(t)
        || /\b(peas?|radish|celeriac\s*remoulade|remoulade|eggplant)\b/.test(t)
        || /\bbaby\s*gem\b/.test(t)) {
      return 'Vegetables';
    }
    return sheetForSection(sec);
  }

  function prepDayLabel(day, helpers) {
    if (helpers && typeof helpers.dayLabel === 'function') {
      var lab = helpers.dayLabel(day);
      if (lab) return lab;
    }
    var d = String(day || '').trim();
    if (!d) return '';
    var i = WEEKDAYS.indexOf(d);
    if (i >= 0) return (i + 1) + ' ' + d;
    return d;
  }

  function sourceTab(r, helpers) {
    if (helpers && typeof helpers.srcName === 'function') {
      try { return helpers.srcName(r) || ''; } catch (e) {}
    }
    if (r && typeof r.srcSheet === 'string' && r.srcSheet !== '') return r.srcSheet;
    return (r && r.dish) || '';
  }

  function staffAllocated(r, helpers) {
    /* 4.8.4: always blank - Paula writes in staff numbers herself. */
    return '';
    if (helpers && typeof helpers.allergenText === 'function') {
      try {
        var t = helpers.allergenText(r.task);
        if (t != null && String(t).trim() !== '') return String(t);
      } catch (e) {}
    }
    return '';
  }

  function parsePerPax(r, helpers) {
    if (helpers && typeof helpers.exportPerPax === 'function') {
      try {
        var pp = helpers.exportPerPax(r);
        if (pp && pp.n != null) return { n: pp.n, unit: pp.unit || r.unit || '' };
      } catch (e) {}
    }
    if (r && r.pdfFixedTotal !== undefined && r.pdfFixedTotal !== null) {
      return { n: '', unit: r.unit || '', fixedTotal: r.pdfFixedTotal };
    }
    var qty = r && r.qty;
    if (qty === undefined || qty === null || qty === '') return { n: '', unit: (r && r.unit) || '' };
    if (typeof qty === 'number' && isFinite(qty)) return { n: qty, unit: (r && r.unit) || '' };
    var s = String(qty).trim();
    if (/^[\d.,]+$/.test(s)) {
      var n = parseFloat(s.replace(',', ''));
      if (isFinite(n)) return { n: n, unit: (r && r.unit) || '' };
    }
    return { n: s, unit: (r && r.unit) || '', nonNumeric: true };
  }

  function paxFor(r, helpers) {
    var map = (helpers && helpers.paxByDish) || {};
    var dish = r && r.dish;
    var p = map[dish];
    if (typeof p === 'number' && isFinite(p)) return p;
    if (p != null && p !== '' && isFinite(Number(p))) return Number(p);
    return '';
  }

  function prepDaySortKey(label, rawDay) {
    var s = String(label || '').trim();
    var m = s.match(/^(\d+)\b/);
    if (m) return parseInt(m[1], 10);
    var d = String(rawDay || s).trim();
    d = d.replace(/^\d+\s+/, '');
    var i = WEEKDAYS.indexOf(d);
    if (i >= 0) return i + 1;
    var lower = d.toLowerCase();
    for (var wi = 0; wi < WEEKDAYS.length; wi++) {
      if (WEEKDAYS[wi].toLowerCase() === lower) return wi + 1;
    }
    return 99;
  }

  /** Weekday number 1=Mon … 7=Sun from a prep label or source-tab prefix. */
  function weekdayNum(text) {
    var s = String(text || '').trim();
    var m = s.match(/^(\d+)\b/);
    if (m) {
      var n = parseInt(m[1], 10);
      if (n >= 1 && n <= 7) return n;
    }
    var tok = s.replace(/^\d+\s+/, '').split(/\s+/)[0] || '';
    var map = {
      mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2,
      wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
      fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7
    };
    var k = tok.toLowerCase();
    if (map[k]) return map[k];
    for (var key in map) {
      if (k.indexOf(key) === 0) return map[key];
    }
    return 99;
  }

  function eventNumFromSource(src) {
    return weekdayNum(src);
  }

  /** Days before the event that prep falls on (Friday before Tuesday = 4). */
  function daysBeforeEvent(prepN, eventN) {
    if (prepN === 99 || eventN === 99) return 0;
    if (prepN <= eventN) return eventN - prepN;
    return eventN + 7 - prepN;
  }

  /**
   * Actual prep-date sort key (lower = earlier).
   * '5 Friday' for a '2 TUE' event → previous-week Friday (before Monday).
   * '5 Friday' for a '6 SAT' event → same-week Friday (near bottom).
   * When a real event calendar date is known, returns YYYYMMDD of the prep day.
   */
  function actualPrepSortKey(prepLab, source, dish, helpers) {
    var pn = weekdayNum(prepLab);
    var en = eventNumFromSource(source);
    var db = daysBeforeEvent(pn, en);
    if (helpers && typeof helpers.getEventDateStr === 'function' && dish) {
      try {
        var ds = helpers.getEventDateStr(dish);
        if (ds) {
          var m = String(ds).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (m) {
            var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
            if (yy < 100) yy += 2000;
            var dt = new Date(yy, mm - 1, dd);
            dt.setDate(dt.getDate() - db);
            return dt.getFullYear() * 10000 + (dt.getMonth() + 1) * 100 + dt.getDate();
          }
        }
      } catch (e) {}
    }
    /* Relative: event weekday as anchor; previous-week prep → negative / smaller. */
    if (en === 99 && pn === 99) return 9999;
    if (en === 99) return 100 + pn;
    return en - db;
  }

  /** Stable colour-group id: same weekday label on different calendar dates → different id. */
  function prepColourGroupId(prepLab, actualKey) {
    return String(actualKey) + '|' + String(prepLab || '');
  }

  /* Distinct pastel fills for Prep day cells (readable when printed). */
  var PREP_PASTELS = [
    'FFFFF2CC', /* soft yellow */
    'FFD9EAD3', /* soft green */
    'FFCFE2F3', /* soft blue */
    'FFFCE5CD', /* soft orange */
    'FFEAD1DC', /* soft pink */
    'FFD0E0E3', /* soft teal-grey */
    'FFE8D5F2', /* soft purple */
    'FFFFE6CC', /* peach */
    'FFDDEBF7', /* powder blue */
    'FFE2EFDA', /* mint */
    'FFF8CBAD', /* apricot */
    'FFD9D2E9'  /* lavender */
  ];

  function pastelForGroup(groupId, seenMap) {
    if (!seenMap[groupId]) {
      var idx = Object.keys(seenMap).length % PREP_PASTELS.length;
      seenMap[groupId] = PREP_PASTELS[idx];
    }
    return seenMap[groupId];
  }

  function eventDayFromDish(dish, helpers) {
    if (helpers && typeof helpers.getEventDay === 'function') {
      try {
        var ed = helpers.getEventDay(dish);
        if (ed) return String(ed);
      } catch (e) {}
    }
    return '';
  }

  function eventDateSortKey(dish, source, helpers) {
    /* Prefer real calendar date dd/mm/yyyy → YYYYMMDD; else event weekday; else leading N from source tab. */
    if (helpers && typeof helpers.getEventDateStr === 'function') {
      try {
        var ds = helpers.getEventDateStr(dish);
        if (ds) {
          var m = String(ds).trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
          if (m) {
            var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), yy = parseInt(m[3], 10);
            if (yy < 100) yy += 2000;
            return yy * 10000 + mm * 100 + dd;
          }
        }
      } catch (e) {}
    }
    var ed = eventDayFromDish(dish, helpers);
    if (ed) {
      var i = WEEKDAYS.indexOf(ed);
      if (i >= 0) return 1000 + i;
    }
    var src = String(source || '');
    var nm = src.match(/^(\d+)\b/);
    if (nm) return 2000 + parseInt(nm[1], 10);
    return 9999;
  }


  /**
   * 4.8.15: Move leading "DF " off the A–Z key so "DF Asparagus …" sorts with Asparagus.
   * "DF Asparagus ( NO BUTTER) / Trim…" → "Asparagus DF ( NO BUTTER) / Trim…"
   * Already-suffixed names ("Kombu Powder DF", "… GF DF") are left alone.
   */
  function renameDfPrefix(item) {
    var s = String(item == null ? '' : item);
    var m = s.match(/^DF\s+(.+)$/i);
    if (!m) return s;
    var rest = m[1];
    var paren = rest.search(/\s*\(/);
    var slash = rest.indexOf(' /');
    if (paren >= 0 && (slash < 0 || paren < slash)) {
      return rest.slice(0, paren).replace(/\s+$/, '') + ' DF' + rest.slice(paren);
    }
    if (slash >= 0) {
      return rest.slice(0, slash).replace(/\s+$/, '') + ' DF' + rest.slice(slash);
    }
    return rest.replace(/\s+$/, '') + ' DF';
  }

  function buildPaulaRows(rows, helpers) {
    helpers = helpers || {};
    var list = Array.isArray(rows) ? rows.slice() : [];
    /* 4.8.8 trial: smart-chef prep days from PreplineBatch (do not port to Paula). */
    var smartMap = null;
    if (root.Prepline488 && typeof root.Prepline488.smartPrepDayMap === 'function') {
      try { smartMap = root.Prepline488.smartPrepDayMap(list, helpers); } catch (e) { smartMap = null; }
    }
    var out = [];
    list.forEach(function (r, idx) {
      if (!r || !r.task) return;
      var sec = r.section || '';
      var pp = parsePerPax(r, helpers);
      var src = sourceTab(r, helpers);
      var rawDay = r.day;
      var smartInfo = null;
      if (smartMap) {
        var sp = root.Prepline488.smartPrepDayForRow(r, idx, smartMap);
        if (sp && sp.prepDay) {
          rawDay = sp.prepDay;
          smartInfo = sp.info;
        }
      }
      var prepLab = prepDayLabel(rawDay, helpers);
      var dishName = (helpers && typeof helpers.cleanDishName === 'function')
        ? (helpers.cleanDishName(r.dish) || r.dish || '')
        : (r.dish || '');
      /* Dish key for A–Z: prefer Source tab (Paula's dish label), fall back to cleaned dish. */
      var dishKey = String(src || dishName || '').toLowerCase().replace(/\s+/g, ' ').trim();
      var sheet = sheetForItem(r.task, sec);
      /* 4.8.7: Section text always matches the tab (overrides colour/keyword when heuristics move the row). */
      var sectionOut = sheet === OTHER_SHEET ? (sec || '—') : sectionForSheet(sheet);
      /* 4.8.15: DF prefix → name DF so A–Z groups with the ingredient. */
      var itemOut = renameDfPrefix(r.task);
      out.push({
        item: itemOut,
        qtyPerPax: pp.n,
        unit: pp.unit || '',
        pax: paxFor(r, helpers),
        fixedTotal: pp.fixedTotal,
        nonNumeric: !!pp.nonNumeric,
        batPo: '', /* blank write-in for chefs — never filled from upload */
        section: sectionOut,
        prepDay: prepLab,
        sourceTab: src,
        staff: staffAllocated(r, helpers),
        sheet: sheet,
        itemNorm: String(itemOut || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        dish: r.dish || '',
        dishKey: dishKey,
        prepSort: prepDaySortKey(prepLab, rawDay),
        eventSort: eventDateSortKey(r.dish, src, helpers),
        actualPrep: actualPrepSortKey(prepLab, src, r.dish, helpers),
        colourSection: sec || '',
        smartCovers: smartInfo && smartInfo.covers ? smartInfo.covers : '',
        smartBatchKey: smartInfo && smartInfo.batchKey ? smartInfo.batchKey : ''
      });
    });
    out.forEach(function (row) {
      row.prepColourId = prepColourGroupId(row.prepDay, row.actualPrep);
    });
    /* Apply organised sheet sort/filter state when provided (Excel-style menus). */
    var sheetState = (helpers && helpers.organisedSheetState) || null;
    var use488 = root.Prepline488 && typeof root.Prepline488.applySheetState === 'function';
    if (helpers && helpers.organisedSheetState === false) {
      /* explicit opt-out */
      use488 = false;
    }
    if (use488) {
      var st = sheetState || (typeof root.Prepline488.getSheetState === 'function' ? root.Prepline488.getSheetState() : null);
      out = root.Prepline488.applySheetState(out, st);
    } else if (root.Prepline488 && typeof root.Prepline488.smartChefSort === 'function') {
      /* 4.8.15 smart chef: prep-date → function/event order → Item A–Z → Source */
      out.sort(root.Prepline488.smartChefSort);
    } else {
      out.sort(function (a, b) {
        if (a.actualPrep !== b.actualPrep) return a.actualPrep - b.actualPrep;
        var ea = (typeof a.eventSort === 'number') ? a.eventSort : 9999;
        var eb = (typeof b.eventSort === 'number') ? b.eventSort : 9999;
        if (ea !== eb) return ea - eb;
        var sa = String(a.sourceTab || '').toLowerCase();
        var sb = String(b.sourceTab || '').toLowerCase();
        if (sa < sb) return -1;
        if (sa > sb) return 1;
        if (a.itemNorm < b.itemNorm) return -1;
        if (a.itemNorm > b.itemNorm) return 1;
        return 0;
      });
    }
    return out;
  }

  function thinBorder() {
    var s = { style: 'thin', color: { argb: 'FF000000' } };
    return { top: s, left: s, bottom: s, right: s };
  }

  function styleHeaderCell(cell) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF000000' } };
    cell.alignment = { vertical: 'middle', wrapText: true, horizontal: 'left' };
    cell.border = thinBorder();
  }

  function styleDataCell(cell, opts) {
    opts = opts || {};
    cell.font = { name: 'Calibri', size: 12, bold: false };
    cell.alignment = { vertical: 'top', wrapText: true, horizontal: opts.horizontal || 'left' };
    cell.border = thinBorder();
  }


  /** Total needed cell: plain numeric qty×pax (4.8.10).
   *  Prefer values over formulas so Excel, Protected View, LibreOffice,
   *  Google Sheets and phone previews never show literal "=B3*D3".
   *  Non-numeric or missing qty/pax → blank (never #VALUE). */
  function totalNeededCell(r, excelRow) {
    if (r.fixedTotal != null && r.fixedTotal !== '') {
      var ft = r.fixedTotal;
      if (typeof ft === 'number' && isFinite(ft)) return ft;
      if (typeof ft === 'string' && ft.trim() !== '') {
        var fn = Number(String(ft).replace(/,/g, ''));
        if (isFinite(fn)) return fn;
      }
      return ft;
    }
    if (r.nonNumeric) return '';
    var q = r.qtyPerPax;
    var p = r.pax;
    var qn = (typeof q === 'number') ? q : NaN;
    var pn = (typeof p === 'number') ? p : NaN;
    if (typeof q === 'string' && q.trim() !== '') {
      qn = Number(String(q).replace(/,/g, ''));
    }
    if (typeof p === 'string' && p.trim() !== '') {
      pn = Number(String(p).replace(/,/g, ''));
    }
    if (q === '' || p === '' || q == null || p == null) return '';
    if (!isFinite(qn) || !isFinite(pn)) return '';
    return qn * pn;
  }

  function fillSheetExcelJS(ws, sheetTitle, rows, weekEndingLabel) {
    var colourMap = {};
    var we = weekEndingLabel || 'WEEK ENDING: ____';
    var lastCol = COL_COUNT;

    /* Row 1 — WEEK ENDING (repeats on every printed page via printTitlesRow) */
    ws.mergeCells(TITLE_WE_ROW, 1, TITLE_WE_ROW, lastCol);
    var weCell = ws.getCell(TITLE_WE_ROW, 1);
    weCell.value = we;
    weCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF000000' } };
    weCell.alignment = { horizontal: 'center', vertical: 'middle' };
    weCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    weCell.border = thinBorder();
    ws.getRow(TITLE_WE_ROW).height = 24;

    /* Row 2 — section / tab title */
    ws.mergeCells(TITLE_SECTION_ROW, 1, TITLE_SECTION_ROW, lastCol);
    var title = ws.getCell(TITLE_SECTION_ROW, 1);
    title.value = sheetTitle;
    title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = thinBorder();
    ws.getRow(TITLE_SECTION_ROW).height = 21;

    /* Row 3 — yellow column headers */
    var head = ws.getRow(HEADER_ROW);
    HEADERS.forEach(function (h, i) {
      var cell = head.getCell(i + 1);
      cell.value = h;
      styleHeaderCell(cell);
    });
    head.height = 16.5;

    rows.forEach(function (r, idx) {
      var excelRow = DATA_START_ROW + idx;
      var row = ws.getRow(excelRow);
      row.getCell(1).value = r.item;
      if (typeof r.qtyPerPax === 'number') row.getCell(2).value = r.qtyPerPax;
      else row.getCell(2).value = r.qtyPerPax == null ? '' : r.qtyPerPax;
      row.getCell(3).value = r.unit || '';
      if (typeof r.pax === 'number') row.getCell(4).value = r.pax;
      else row.getCell(4).value = r.pax === '' ? '' : r.pax;
      row.getCell(5).value = totalNeededCell(r, excelRow);
      row.getCell(6).value = r.batPo || '';
      row.getCell(7).value = r.section || '';
      row.getCell(8).value = r.prepDay || '';
      row.getCell(9).value = r.sourceTab || '';
      row.getCell(10).value = r.staff || '';
      row.getCell(DONE_COL).value = DONE_UNCHECKED;
      for (var c = 1; c <= lastCol; c++) styleDataCell(row.getCell(c));
      row.getCell(DONE_COL).alignment = { horizontal: 'center', vertical: 'middle' };
      if (!colourMap) colourMap = {};
      var gid = r.prepColourId || prepColourGroupId(r.prepDay, r.actualPrep);
      var pastel = pastelForGroup(gid, colourMap);
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: pastel } };
      var len = String(r.item || '').length;
      var h = 18;
      if (len > 45) h = 36;
      if (len > 80) h = 54;
      if (len > 120) h = 72;
      row.height = h;
    });

    COL_WIDTHS.forEach(function (w, i) {
      ws.getColumn(i + 1).width = w;
    });

    var lastDataRow = Math.max(HEADER_ROW, DATA_START_ROW + rows.length - 1);
    if (rows.length === 0) lastDataRow = HEADER_ROW;
    ws.autoFilter = {
      from: { row: HEADER_ROW, column: 1 },
      to: { row: Math.max(HEADER_ROW, lastDataRow), column: lastCol }
    };

    /* DONE tick dropdown — ☐ / ☑ (prints as empty box; pen-friendly) */
    var doneRange = colLetter(DONE_COL) + DATA_START_ROW + ':' + colLetter(DONE_COL) + Math.max(DATA_START_ROW, lastDataRow + 50);
    try {
      ws.dataValidations.add(doneRange, {
        type: 'list',
        allowBlank: true,
        showErrorMessage: true,
        formulae: ['"' + DONE_UNCHECKED + ',' + DONE_CHECKED + '"']
      });
    } catch (e) { /* older ExcelJS */ }

    /* Grey out whole row when DONE = ☑ */
    try {
      var cfRef = 'A' + DATA_START_ROW + ':' + colLetter(lastCol) + Math.max(DATA_START_ROW, lastDataRow + 50);
      ws.addConditionalFormatting({
        ref: cfRef,
        rules: [{
          type: 'expression',
          formulae: ['$' + colLetter(DONE_COL) + DATA_START_ROW + '="' + DONE_CHECKED + '"'],
          style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD9D9D9' } } }
        }]
      });
    } catch (e2) {}

    /* Print: WE + section + yellow header on EVERY page */
    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      printTitlesRow: String(TITLE_WE_ROW) + ':' + String(HEADER_ROW)
    };
    ws.headerFooter = {
      oddHeader: '&C&B' + we,
      evenHeader: '&C&B' + we,
      oddFooter: '&C&B' + we + ' — Page &P of &N',
      evenFooter: '&C&B' + we + ' — Page &P of &N'
    };
    ws.views = [{ state: 'frozen', ySplit: HEADER_ROW, activeCell: 'A' + DATA_START_ROW, showGridLines: true }];
  }

  function colLetter(n) {
    var s = '';
    while (n > 0) {
      var m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  function fillSheetXLSX(XLSX, sheetTitle, rows, weekEndingLabel) {
    var we = weekEndingLabel || 'WEEK ENDING: ____';
    var aoa = [];
    var blank = [];
    for (var bi = 0; bi < COL_COUNT; bi++) blank.push('');
    var weRow = blank.slice(); weRow[0] = we;
    var titleRow = blank.slice(); titleRow[0] = sheetTitle;
    aoa.push(weRow);
    aoa.push(titleRow);
    aoa.push(HEADERS.slice());
    rows.forEach(function (r, idx) {
      var excelRow = DATA_START_ROW + idx;
      var qty = r.qtyPerPax == null ? '' : r.qtyPerPax;
      var pax = r.pax === '' ? '' : r.pax;
      var tot = totalNeededCell(r, excelRow);
      if (tot === '' || tot == null) tot = '';
      aoa.push([
        r.item, qty, r.unit || '', pax, tot,
        r.batPo || '', r.section || '', r.prepDay || '', r.sourceTab || '', r.staff || '',
        DONE_UNCHECKED
      ]);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: COL_COUNT - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: COL_COUNT - 1 } }
    ];
    var yellow = { patternType: 'solid', fgColor: { rgb: 'FFFF00' } };
    var weFill = { patternType: 'solid', fgColor: { rgb: 'FFF2CC' } };
    var boldH = { bold: true, name: 'Calibri', sz: 12 };
    var titleF = { bold: true, name: 'Calibri', sz: 16 };
    var weF = { bold: true, name: 'Calibri', sz: 18 };
    var dataF = { name: 'Calibri', sz: 12 };
    var wrap = { vertical: 'center', wrapText: true };
    var thin = { style: 'thin', color: { rgb: '000000' } };
    var border = { top: thin, bottom: thin, left: thin, right: thin };
    var aWe = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (!ws[aWe]) ws[aWe] = { t: 's', v: we };
    ws[aWe].s = { font: weF, fill: weFill, alignment: { horizontal: 'center', vertical: 'center' }, border: border };
    var a00 = XLSX.utils.encode_cell({ r: 1, c: 0 });
    if (!ws[a00]) ws[a00] = { t: 's', v: sheetTitle };
    ws[a00].s = { font: titleF, alignment: { horizontal: 'center', vertical: 'center' }, border: border };
    for (var c = 0; c < COL_COUNT; c++) {
      var ah = XLSX.utils.encode_cell({ r: 2, c: c });
      if (!ws[ah]) ws[ah] = { t: 's', v: HEADERS[c] };
      ws[ah].s = { fill: yellow, font: boldH, alignment: wrap, border: border };
    }
    for (var r = 3; r < aoa.length; r++) {
      for (var c2 = 0; c2 < COL_COUNT; c2++) {
        var ad = XLSX.utils.encode_cell({ r: r, c: c2 });
        if (!ws[ad]) ws[ad] = { t: 's', v: '' };
        ws[ad].s = Object.assign({}, ws[ad].s || {}, { font: dataF, alignment: { vertical: 'top', wrapText: true }, border: border });
      }
    }
    ws['!cols'] = COL_WIDTHS.map(function (w) { return { wch: w }; });
    var lastColL = XLSX.utils.encode_col(COL_COUNT - 1);
    var lastR = Math.max(HEADER_ROW, aoa.length);
    ws['!autofilter'] = { ref: 'A' + HEADER_ROW + ':' + lastColL + lastR };
    ws['!rows'] = [{ hpt: 24 }, { hpt: 21 }, { hpt: 16.5 }];
    ws['!freeze'] = 'A' + DATA_START_ROW;
    /* SheetJS limited print titles — set where supported */
    if (!ws['!printHeader']) ws['!printHeader'] = [];
    ws['!margins'] = { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
    return ws;
  }

  function downloadBlob(buf, filename) {
    if (typeof document === 'undefined') return;
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 1500);
  }

  function loadExcelJS() {
    return new Promise(function (resolve, reject) {
      if (root.ExcelJS) return resolve(root.ExcelJS);
      if (typeof document === 'undefined') return reject(new Error('no DOM'));
      var s = document.createElement('script');
      s.src = 'vendor/exceljs/exceljs.min.js';
      s.onload = function () { resolve(root.ExcelJS); };
      s.onerror = function () { reject(new Error('ExcelJS failed to load')); };
      document.head.appendChild(s);
    });
  }

  function groupBySheet(paulaRows) {
    var order = PAULA_TABS.map(function (t) { return t.sheet; });
    var buckets = {};
    order.forEach(function (s) { buckets[s] = []; });
    var other = [];
    paulaRows.forEach(function (r) {
      if (buckets[r.sheet]) buckets[r.sheet].push(r);
      else other.push(r);
    });
    var sheets = order.map(function (s) { return { name: s, rows: buckets[s] || [] }; })
      .filter(function (s) { return s.rows.length > 0; });
    if (other.length) sheets.push({ name: OTHER_SHEET, rows: other });
    return sheets;
  }

  function exportOrganisedXlsxPaula(rows, deps, helpers) {
    helpers = helpers || {};
    var paulaRows = buildPaulaRows(rows, helpers);
    if (!helpers.allRows && U.applyItemFiltersSort && U.getItemViewState) {
      /* filters apply to organised screen; for Paula export use raw rows as given */
    }
    var sheets = groupBySheet(paulaRows);
    var name = 'Prepline_Organised_' + (new Date().toISOString().slice(0, 10)) + '.xlsx';
    var totalRows = paulaRows.length;

    var weInfo = resolveWeekEndingLabel(helpers, paulaRows);
    var weLabel = weInfo.label;

    function withExcelJS(ExcelJS) {
      var wb = new ExcelJS.Workbook();
      wb.creator = 'Prepline by Autoprod';
      sheets.forEach(function (sh) {
        var ws = wb.addWorksheet(sh.name.slice(0, 31), {
          views: [{ state: 'frozen', ySplit: HEADER_ROW, activeCell: 'A' + DATA_START_ROW, showGridLines: true }]
        });
        fillSheetExcelJS(ws, sh.name, sh.rows, weLabel);
      });
      if (!sheets.length) {
        var empty = wb.addWorksheet('Sauce, Purees and Gels');
        fillSheetExcelJS(empty, 'Sauce, Purees and Gels', [], weLabel);
      }
      return wb.xlsx.writeBuffer().then(function (buf) {
        if (helpers.returnBuffer) return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), buffer: buf, engine: 'exceljs', layout: 'paula-sorted-az', weekEnding: weLabel, weekEndingSource: weInfo.source };
        downloadBlob(buf, name);
        return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), engine: 'exceljs', layout: 'paula-sorted-az', weekEnding: weLabel, weekEndingSource: weInfo.source };
      });
    }

    function withXLSX() {
      if (typeof XLSX === 'undefined' || !XLSX.utils) throw new Error('XLSX not loaded');
      var wb = XLSX.utils.book_new();
      wb.Props = { Title: 'Prepline Organised', Author: 'Prepline by Autoprod', Company: 'Autoprod' };
      wb.Custprops = { Creator: 'Prepline by Autoprod' };
      var used = {};
      (sheets.length ? sheets : [{ name: 'Sauce, Purees and Gels', rows: [] }]).forEach(function (sh) {
        var tab = sh.name.slice(0, 31);
        var n = 2;
        var base = tab;
        while (used[tab.toLowerCase()]) { tab = (base.slice(0, 28) + '-' + n).slice(0, 31); n++; }
        used[tab.toLowerCase()] = true;
        var ws = fillSheetXLSX(XLSX, sh.name, sh.rows, weLabel);
        XLSX.utils.book_append_sheet(wb, ws, tab);
      });
      if (helpers.returnBuffer) {
        var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return Promise.resolve({ name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), buffer: out, engine: 'xlsx', layout: 'paula-sorted-az', weekEnding: weLabel, weekEndingSource: weInfo.source });
      }
      XLSX.writeFile(wb, name);
      return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), engine: 'xlsx', layout: 'paula-sorted-az', weekEnding: weLabel, weekEndingSource: weInfo.source };
    }

    if (typeof document !== 'undefined') {
      if (helpers.forceXlsx) {
        var r = withXLSX();
        return (r && typeof r.then === 'function') ? r : Promise.resolve(r);
      }
      return loadExcelJS().then(withExcelJS).catch(function () { return withXLSX(); });
    }
    return withXLSX();
  }

  U.exportOrganisedXlsx = exportOrganisedXlsxPaula;
  U.buildPaulaOrganisedRows = buildPaulaRows;
  U.PAULA_ORGANISED_HEADERS = HEADERS;
  U.PAULA_ORGANISED_TABS = PAULA_TABS.map(function (t) { return t.sheet; });

  root.Prepline477 = {
    VERSION: '4.8.15',
    exportOrganisedXlsx: exportOrganisedXlsxPaula,
    buildPaulaOrganisedRows: buildPaulaRows,
    HEADERS: HEADERS,
    actualPrepSortKey: actualPrepSortKey,
    renameDfPrefix: renameDfPrefix,
    prepColourGroupId: prepColourGroupId,
    pastelForGroup: pastelForGroup,
    PREP_PASTELS: PREP_PASTELS,
    weekdayNum: weekdayNum,
    resolveWeekEndingLabel: resolveWeekEndingLabel,
    DONE_UNCHECKED: DONE_UNCHECKED,
    DONE_CHECKED: DONE_CHECKED
  };
})(typeof window !== 'undefined' ? window : globalThis);
