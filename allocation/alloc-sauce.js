/* Prepline: Sauce kitchen allocation (Production template).
   Colour Codes → sections matching Gerard's sauce-a.xlsx outcome:
     E2EFDA Sydney Eats → Syd eats / Lunch
     FFD9D9 Canape      → Canape
     FFC000 MT/AT       → Crew + MT
     D5A6BD Kiosk       → Retail
   Team cafe + bulk scaffold always present. Prep looks ahead (excludes function day). */
(function (root) {
  'use strict';

  var P = typeof AllocProduction !== 'undefined' ? AllocProduction
    : (typeof require === 'function' ? (function () { try { return require('./alloc-production.js'); } catch (e) { return null; } })() : null);

  var COLOR_SEC = {
    E2EFDA: 'Syd eats / Lunch',
    FFD9D9: 'Canape',
    FFC000: 'Crew + MT',
    D5A6BD: 'Retail'
  };
  var SEC_META = [
    { key: 'Team cafe', fill: 'C59EE2', label: 'Team café', amDefault: 2 },
    { key: 'Syd eats / Lunch', fill: '92D050', label: 'Lunch', amDefault: null },
    { key: 'Canape', fill: 'FF6699', label: 'canape', amDefault: null },
    { key: 'Crew + MT', fill: 'FFC000', label: 'crew', amDefault: null },
    { key: 'Retail', fill: 'FFE598', label: 'retail', amDefault: null },
    { key: 'bulk', fill: 'BFBFBF', label: 'bulk', amDefault: null }
  ];
  var SERVICE_SECTIONS = SEC_META.map(function (s) { return s.key; });
  var SERVICE_FILL = {};
  SEC_META.forEach(function (s) { SERVICE_FILL[s.key] = s.fill; });
  var PREP_SECTIONS = SEC_META.map(function (s) {
    return { key: s.key, title: s.key, fill: s.fill, matrix: [['', 'am'], [null, 'pm']] };
  });

  function clean(v) { return v == null ? '' : String(v).replace(/\u00a0/g, ' ').trim(); }
  function lc(s) { return String(s || '').toLowerCase(); }

  function detectSauce(legend, sheetNames) {
    var names = (legend || []).map(function (x) { return lc((x && x.name) || x || ''); });
    var sheets = (sheetNames || []).map(function (n) { return lc(n || ''); });
    if (sheets.some(function (n) { return /sauce\s*tally|^sauce$/.test(n); })) return true;
    if (names.some(function (n) { return /^sauce$/.test(n.trim()) || /sauce\s*kitchen/.test(n); })) return true;
    /* Colour Codes with Sydney Eats + MT/AT and no Larder sandwich → Sauce */
    var hasSE = names.some(function (n) { return /sydney\s*eats/.test(n); });
    var hasMT = names.some(function (n) { return /^mt\/?at$/.test(n.trim()) || n === 'mt/at'; });
    var hasSand = names.some(function (n) { return /sandwich|salad|fruit/.test(n); });
    if (hasSE && hasMT && !hasSand) return true;
    return false;
  }

  function eventShort(ev) {
    var e = clean(ev);
    if (/ageing\s*australia/i.test(e)) return 'Ageing australia';
    if (/\bfacts\b/i.test(e)) return 'FACTS';
    if (/a11y/i.test(e)) return 'A11y';
    if (/commonwealth\s*bank|commbank/i.test(e)) return 'commbank';
    if (/business\s*show/i.test(e)) return 'business show';
    if (/undertale/i.test(e)) return 'Undertale';
    if (/crypto/i.test(e)) return 'Australian crypto';
    if (/dirty\s*dancing/i.test(e)) return 'Dirty dancing DHT';
    if (/papua|new\s*guinea|png/i.test(e)) return 'Papua new guinea';
    if (/five\s*v|5\s*v\b/i.test(e)) return 'FIVE';
    if (/nsw\s*trustee/i.test(e)) return 'NSW trustee';
    if (/woolworths/i.test(e)) return 'Woolworths';
    var bits = e.replace(/\b20\d\d\b/g, '').replace(/national conference|conference|summit|forum|awards/ig, '')
      .trim().split(/\s+/).slice(0, 3);
    return bits.join(' ') || e;
  }

  function hotShort(item) {
    var t = lc(item);
    if (/kadai/.test(t)) return 'kadai lamb';
    if (/salmon/.test(t)) return 'salmon';
    if (/chickpea\s*curry|coconut\s*chickpea/.test(t)) return 'chickpea curry';
    if (/butter\s*chicken|rambo/.test(t)) return 'butter chicken';
    if (/barramundi|barra\b/.test(t)) return 'barra';
    if (/mapo/.test(t)) return 'mapo';
    if (/soy\s*brais/.test(t)) return 'soy braise';
    if (/beef\s*brisket|brisket/.test(t)) return 'beef brisket';
    if (/\bkorma\b/.test(t)) return 'korma';
    if (/sicilian|caponata|roasted\s*chicken/.test(t) && /chicken|caponata/.test(t)) return 'sicilian chicken';
    if (/bulgogi/.test(t)) return 'bulgogi';
    if (/gnocchi/.test(t)) return 'gnocchi';
    /* fallback: first 3 words after Hot Dish - / Plant Based - */
    var s = clean(item).replace(/^(Hot Dish|Plant Based)\s*[-–—:]\s*/i, '');
    return lc(s.split(/,| with /i)[0] || s).split(/\s+/).slice(0, 3).join(' ');
  }

  function pastryShort(item) {
    var t = lc(item);
    if (/mac\s*and\s*cheese/.test(t)) return 'mac and cheese';
    if (/lamb\s*and\s*vegetable\s*pastie|lamb.*pastie/.test(t)) return 'lamb and vege pastie';
    if (/beef\s*empanada/.test(t)) return 'beef empanada';
    if (/fricassee|fricass/.test(t)) return 'fricassee';
    if (/focaccia/.test(t)) return 'focaccia';
    if (/pork.*sausage|sausage\s*roll/.test(t)) return 'pork and sausage roll';
    if (/mac\s*and\s*cheese\s*croq|croquette/.test(t) && /mac/.test(t)) return 'mac and cheese croq';
    if (/platter/.test(t)) return 'platters';
    return lc(clean(item).split(/,| with /i)[0]).split(/\s+/).slice(0, 4).join(' ');
  }

  function canapeItemShort(item) {
    var t = lc(item);
    if (/parm|parmesan|croq/.test(t)) return 'parm croq';
    if (/bhaji/.test(t)) return 'bhaji';
    if (/lamb\s*empanada|empanada/.test(t)) return 'lamb empanada';
    if (/arancini/.test(t)) return 'arancini';
    if (/sujuk/.test(t)) return 'sujuk';
    if (/spring\s*roll/.test(t)) return 'spring roll';
    return null;
  }

  function isSkipItem(item) {
    var t = lc(item);
    if (!t) return true;
    if (/^(hot|cold)\s*items?:?\s*$/i.test(t)) return true;
    if (/^big\s*bites:?\s*$/i.test(t)) return true;
    if (/dietary\s*option|baucher|table\s*service|filter\s*coffee|^teas?\b|botanical\s*water|hire\b|service\s*fee/i.test(t)) return true;
    if (/piece\s*of\s*whole\s*seasonal\s*fruit|energy\s*bar/i.test(t)) return true;
    return false;
  }

  function functionsFromWo(wo) {
    var by = {};
    (wo.lines || []).forEach(function (l) {
      if (!l || !l.date) return;
      var no = String(l.eventNo || '').trim();
      var name = String(l.event || '').trim();
      var k = no + '|' + l.date;
      if (!by[k]) {
        by[k] = { date: l.date, event: name, name: name, eventNo: no, rooms: {}, dishes: [], paxMax: 0, first: l.r || 0 };
      }
      var g = by[k];
      if (name && (!g.name || name.length > g.name.length)) { g.name = name; g.event = name; }
      if (l.qty > g.paxMax) g.paxMax = l.qty;
      var dish = String(l.item || '').trim();
      if (dish && g.dishes.indexOf(dish) < 0) g.dishes.push(dish);
      if (l.room) g.rooms[l.room] = 1;
    });
    return Object.keys(by).map(function (k) {
      var g = by[k];
      return {
        date: g.date, event: g.event, name: g.name, eventNo: g.eventNo,
        rooms: Object.keys(g.rooms), dishes: g.dishes, paxMax: g.paxMax, first: g.first
      };
    }).sort(function (a, b) {
      return a.date.localeCompare(b.date) || String(a.eventNo).localeCompare(String(b.eventNo));
    });
  }

  function dayWordFor(isoD) {
    if (P && P.dayWord) {
      var w = P.dayWord(isoD);
      if (w === 'wednesday') return 'wed';
      if (w === 'thursday') return 'thursday';
      return w;
    }
    var DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    var p = isoD.split('-').map(Number);
    var w = DAYS[new Date(p[0], p[1] - 1, p[2]).getDay()];
    return w === 'wednesday' ? 'wed' : w;
  }

  /**
   * Parse WO lines into function-dated Production items (not yet placed on prep days).
   */
  function collectItems(wo) {
    var items = []; /* {section, dish, paxParts[], functionDate, dayWord, event, kind, staff?} */
    var byKey = {};
    var put = function (section, dish, pax, functionDate, meta) {
      meta = meta || {};
      var k = section + '|' + functionDate + '|' + lc(dish);
      var g = byKey[k];
      if (!g) {
        g = {
          section: section, dish: dish, paxParts: [], functionDate: functionDate,
          dayWord: dayWordFor(functionDate), event: meta.event || '', kind: meta.kind || 'dish',
          first: meta.r || 0, notes: meta.notes || null
        };
        byKey[k] = g;
        items.push(g);
      }
      if (pax != null && pax !== '' && pax !== 0) g.paxParts.push(pax);
      if (meta.r && (!g.first || meta.r < g.first)) g.first = meta.r;
      if (meta.mergeDayWord) {
        /* multi-day label e.g. tuesday/wed */
        if (g.dayWord.indexOf(meta.mergeDayWord) < 0) {
          g.dayWord = g.dayWord + '/' + meta.mergeDayWord;
        }
      }
      return g;
    };

    /* Group lines by event+date for hot-dish combos and package pax */
    var groups = {};
    (wo.lines || []).forEach(function (l) {
      if (!l || !l.date || !l.item) return;
      var col = String(l.colour || '').toUpperCase();
      if (col.length === 8) col = col.slice(-6);
      var sec = COLOR_SEC[col];
      if (!sec) return; /* Plated/Cutaway/uncoloured skipped for Sauce */
      var gk = l.date + '|' + clean(l.event) + '|' + sec;
      if (!groups[gk]) groups[gk] = { date: l.date, event: l.event, sec: sec, lines: [] };
      groups[gk].lines.push(l);
    });

    Object.keys(groups).forEach(function (gk) {
      var g = groups[gk];
      var sec = g.sec;
      var evS = eventShort(g.event);
      var lines = g.lines;
      var packagePax = null;
      var packageLabel = null;
      var hotBits = [];
      var hotPax = null;
      var pastryBits = [];
      var canapeNamed = [];
      var canapePackagePax = null;
      var crewParts = [];
      var customLunchParts = [];
      var mtPackagePax = null;
      var isRetail = false;
      var isGreenroom = false;
      var greenroomKind = null;

      lines.forEach(function (l) {
        var it = clean(l.item);
        var its = lc(it);
        if (isSkipItem(it)) return;

        if (sec === 'Retail' || /retail\s*kiosk/i.test(it)) {
          isRetail = true;
          return;
        }
        if (/green\s*room/i.test(it)) {
          isGreenroom = true;
          if (/dinner/i.test(it)) greenroomKind = 'dinner';
          else if (/lunch/i.test(it)) greenroomKind = 'lunch';
          else if (/breakfast/i.test(it)) greenroomKind = 'breakfast';
          if (l.qty >= 1) packagePax = (packagePax || 0) + l.qty;
          return;
        }

        /* Sydney Eats package header */
        if (/^sydney\s*eats\s*\(/i.test(it) && !/morning\s*tea|afternoon\s*tea/i.test(it)) {
          if (l.qty >= 10) packagePax = l.qty;
          packageLabel = 'lunch';
          return;
        }
        if (/custom\s*lunch/i.test(it)) {
          if (l.qty >= 1) customLunchParts.push(l.qty);
          return;
        }
        if (/build\s*your\s*own\s*sydney\s*eats/i.test(it)) {
          if (l.qty >= 1) packagePax = l.qty;
          packageLabel = 'BYO';
          return;
        }
        if (/stand\s*up.*lunch|standup.*lunch|stand-up.*lunch/i.test(it)) {
          if (l.qty >= 1) packagePax = (packagePax || 0) + l.qty;
          packageLabel = 'stand up lunch';
          return;
        }

        /* Hot dishes */
        if (/^hot\s*dish|^plant\s*based/i.test(it)) {
          hotBits.push(hotShort(it));
          if (l.qty >= 10) hotPax = (hotPax == null ? 0 : hotPax) + l.qty;
          else if (l.qty >= 1 && l.qty < 10 && hotPax == null) hotPax = l.qty; /* A11y style absolute */
          return;
        }

        /* MT/AT package */
        if (/morning\s*tea|afternoon\s*tea|standard\s*(morning|afternoon)/i.test(it)) {
          if (l.qty >= 10) mtPackagePax = (mtPackagePax || 0) + l.qty;
          else if (l.qty >= 1 && mtPackagePax == null) mtPackagePax = l.qty;
          return;
        }
        if (/platter/i.test(it) && sec === 'Crew + MT') {
          pastryBits.push({ name: evS + ' platters', pax: l.qty });
          return;
        }

        /* Crew */
        if (/crew\s*(main\s*)?meal|generic\s*crew|crew\s*catering/i.test(it)) {
          crewParts.push(l.qty >= 1 ? l.qty : 1);
          return;
        }

        /* Canape packages */
        if (sec === 'Canape') {
          if (/canap|pre-dinner|party/i.test(it) && l.qty >= 10) {
            canapePackagePax = l.qty;
            return;
          }
          if (/generic\s*menu\s*item/i.test(it) && l.qty >= 10) {
            canapePackagePax = Math.max(canapePackagePax || 0, l.qty);
            return;
          }
          if (/generic\s*menu\s*item/i.test(it) && l.qty < 10) return;
          var cs = canapeItemShort(it);
          if (cs) { canapeNamed.push(cs); return; }
          /* custom canapes package without named children */
          if (/custom\s*canap/i.test(it) && l.qty >= 10) {
            canapePackagePax = l.qty;
            return;
          }
          return;
        }

        /* Named pastry / MT item */
        if (sec === 'Crew + MT') {
          if (/generic\s*menu\s*item/i.test(it)) return;
          pastryBits.push({ name: pastryShort(it), pax: mtPackagePax || (l.qty >= 10 ? l.qty : null) });
          return;
        }

        /* leftover Syd eats generics */
        if (sec === 'Syd eats / Lunch') {
          if (/generic\s*menu\s*item/i.test(it) && l.qty >= 10) {
            packagePax = l.qty;
            packageLabel = packageLabel || 'lunch';
          }
        }
      });

      /* Emit aggregated rows */
      if (sec === 'Syd eats / Lunch') {
        if (customLunchParts.length) {
          var sum = customLunchParts.reduce(function (a, b) { return a + b; }, 0);
          put(sec, evS + ' custom lunch', sum, g.date, { event: g.event, kind: 'package', formula: '=' + customLunchParts.join('+') });
        }
        if (isGreenroom) {
          var gk = greenroomKind || 'dinner';
          var gname = /dirty/i.test(evS) ? (evS + ' greenroom lunch/dinner') : (evS + ' greenroom ' + gk);
          put(sec, gname, packagePax || 'TBC', g.date, { event: g.event, kind: 'greenroom' });
        } else if (packageLabel === 'BYO' && packagePax) {
          put(sec, evS + ' BYO', packagePax, g.date, { event: g.event, kind: 'package' });
        } else if (packageLabel === 'stand up lunch' && packagePax) {
          put(sec, evS + ' stand up lunch', packagePax, g.date, { event: g.event, kind: 'package' });
        }
        /* Hot combo when present; pax from package when components are fractional/small */
        var hotDish = null;
        var hp = null;
        if (hotBits.length) {
          hotDish = hotBits.join('/');
          if (/kadai/.test(hotDish) && /salmon/.test(hotDish) && /chickpea/.test(hotDish)) {
            hotDish = /kadai lamb/.test(hotBits[0]) ? 'kadai lamb/salmon/chickpea curry' : 'kadai/salmon/chickpea curry';
          }
          if (/butter chicken/.test(hotDish) && /barra/.test(hotDish) && /mapo/.test(hotDish)) hotDish = 'butter chicken/barra/mapo';
          if (/soy braise/.test(hotDish) && /brisket/.test(hotDish) && /korma/.test(hotDish)) hotDish = 'soy braise/beef brisket/korma';
          if (/sicilian/.test(hotDish) && /bulgogi/.test(hotDish) && /gnocchi/.test(hotDish)) hotDish = 'sicilian chicken/bulgogi/gnocchi';
          hp = (hotPax != null && hotPax >= 10) ? hotPax : packagePax;
          if (hp == null) hp = hotPax;
        }
        /* Lunch package line when no hot combo, OR when hot qtys look like menu-mix fractions and package is large conference */
        var emitLunch = packagePax && packageLabel === 'lunch' && !customLunchParts.length && !isGreenroom;
        if (emitLunch && hotDish && packagePax >= 500) {
          /* Prefer hot combo for large events that list named hots — still emit lunch for first-day style when all hot qtys < 1 */
          var allFrac = lines.every(function (l) {
            var it = clean(l.item);
            if (!/^hot\s*dish|^plant\s*based/i.test(it)) return true;
            return l.qty > 0 && l.qty < 1;
          });
          if (!allFrac) emitLunch = false; /* Wed/Thu Ageing style → hot only */
        }
        if (emitLunch) put(sec, evS + ' lunch', packagePax, g.date, { event: g.event, kind: 'package' });
        if (hotDish) put(sec, hotDish, hp, g.date, { event: g.event, kind: 'hot' });
        else if (packagePax && packageLabel === 'lunch' && !emitLunch && !customLunchParts.length && !isGreenroom && !hotBits.length) {
          put(sec, evS + ' lunch', packagePax, g.date, { event: g.event, kind: 'package' });
        }
      }

      if (sec === 'Canape') {
        if (canapeNamed.length >= 2) {
          put(sec, canapeNamed.join('/'), canapePackagePax || null, g.date, { event: g.event, kind: 'canape-named' });
        } else if (canapePackagePax) {
          var cname = /ageing/i.test(evS) && canapePackagePax >= 2000 ? 'Ageing australia canape'
            : /ageing/i.test(evS) ? 'Ageing Australia'
            : /FACTS/i.test(evS) ? 'FACTS canape'
            : /FIVE/i.test(evS) ? 'FIVE pre canape'
            : /papua/i.test(evS) ? 'papua new guinea canape'
            : /Undertale/i.test(evS) ? 'Undertale amex'
            : evS + ' canape';
          var cpax = /Undertale/i.test(evS) ? 'retail' : canapePackagePax;
          put(sec, cname, cpax, g.date, { event: g.event, kind: 'canape' });
        } else if (/Undertale|amex/i.test(g.event) || /retail\s*kiosk/i.test(lines.map(function (x) { return x.item; }).join(' '))) {
          put(sec, 'Undertale amex', 'retail', g.date, { event: g.event, kind: 'canape' });
        }
      }

      /* Crew / MT / pastry → Crew + MT even if WO colour was Syd-eats green */
      if (crewParts.length || mtPackagePax || pastryBits.length) {
        if (crewParts.length) {
          var crewName = /ageing/i.test(evS) ? 'Ageing Australia' : (evS + ' crew');
          put('Crew + MT', crewName, crewParts.length === 1 ? crewParts[0] : crewParts.join('+'), g.date, { event: g.event, kind: 'crew' });
        }
        if (mtPackagePax) {
          put('Crew + MT', evS + ' MT/AT', mtPackagePax, g.date, { event: g.event, kind: 'mt' });
        }
        /* Merge platter qty parts into one dish line via put() keying */
        pastryBits.forEach(function (pb) {
          var px = pb.pax != null ? pb.pax : null;
          put('Crew + MT', pb.name, px, g.date, { event: g.event, kind: 'pastry' });
        });
      }

      if (sec === 'Retail' || isRetail) {
        put('Retail', evS + ' retail', 'retail', g.date, { event: g.event, kind: 'retail' });
      }
    });

    /* Drop standalone lunch for an event whose pax already appears inside a same-day hot combo (NSW trustee → soy braise). */
    (function () {
      var hotByDate = {};
      items.forEach(function (it) {
        if (it.kind === 'hot' && it.paxParts && it.paxParts.length) {
          hotByDate[it.functionDate] = hotByDate[it.functionDate] || [];
          hotByDate[it.functionDate].push(it);
        }
      });
      for (var i = items.length - 1; i >= 0; i--) {
        var it = items[i];
        if (it.kind !== 'package' || !/lunch$/i.test(it.dish) || /custom|stand up|BYO|greenroom/i.test(it.dish)) continue;
        var hots = hotByDate[it.functionDate] || [];
        if (!hots.length || !it.paxParts.length) continue;
        var lunchPax = it.paxParts[0];
        var absorbed = hots.some(function (h) {
          return h.paxParts.some(function (pp) { return pp === lunchPax; });
        });
        if (absorbed) {
          var k = it.section + '|' + it.functionDate + '|' + lc(it.dish);
          delete byKey[k];
          items.splice(i, 1);
        }
      }
    })();

    /* Merge same dish across events on same function date (pax join) — already keyed by dish+date.
       Cross-event same hot dish shorthand: merge paxParts. Done via byKey. */

    return items.map(function (it) {
      var pax = null;
      if (it.paxParts.length) {
        var nums = it.paxParts.filter(function (x) { return typeof x === 'number'; });
        var strs = it.paxParts.filter(function (x) { return typeof x === 'string'; });
        if (strs.length && !nums.length) pax = strs[0];
        else if (nums.length === 1 && !strs.length) pax = nums[0];
        else if (nums.length > 1) pax = nums.join('+');
        else pax = it.paxParts.join('+');
      }
      if (it.formula && typeof pax === 'number') {
        /* keep numeric for match; formula available */
      }
      var staff = (P && P.staffGuess) ? P.staffGuess(pax) : null;
      return {
        section: it.section,
        dish: it.dish,
        paxValue: pax,
        paxFormula: it.formula || null,
        functionDate: it.functionDate,
        dayWord: it.dayWord,
        staff: staff,
        notes: it.notes,
        event: it.event,
        kind: it.kind,
        first: it.first
      };
    });
  }

  function build(wo, settings) {
    settings = settings || {};
    var fnList = functionsFromWo(wo);
    var items = collectItems(wo);
    var skipped = [];
    var trace = items.map(function (it) {
      return { dish: it.dish, section: it.section, date: it.functionDate };
    });

    /* Week from WO */
    var days = (wo.days || []).slice().sort();
    if (!days.length && items.length) {
      days = items.map(function (i) { return i.functionDate; }).sort();
    }
    var first = days[0];
    var addDays = P ? P.addDays : function (d, n) {
      var p = d.split('-').map(Number);
      var x = new Date(p[0], p[1] - 1, p[2] + n);
      return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    };
    var dow = P ? P.dow : function (d) {
      var p = d.split('-').map(Number);
      return new Date(p[0], p[1] - 1, p[2]).getDay();
    };
    var monday = addDays(first, -((dow(first) + 6) % 7));
    var week = [0, 1, 2, 3, 4, 5, 6].map(function (i) { return addDays(monday, i); });

    var ahead = settings.prepDaysAhead != null ? settings.prepDaysAhead : 3;
    var extraAhead = settings.extraAhead || { Thursday: 5, Friday: 5, Saturday: 4 };
    var placed = P
      ? P.placeOnPrepDays(items, week, { ahead: ahead, includeFunctionDay: false, extraAhead: extraAhead })
      : items.map(function (it) { return Object.assign({}, it, { prepDate: it.functionDate }); });

    /* Staff: bump closer to function day */
    placed.forEach(function (l) {
      if (l.staff == null) return;
      var gap = P ? P.daysBetween(l.prepDate, l.functionDate) : 2;
      if (gap === 1 && typeof l.staff === 'number') l.staff = Math.min(5, l.staff + 1);
    });

    return {
      lines: placed,
      items: items,
      skipped: skipped,
      trace: trace,
      functions: fnList.map(function (f) {
        return {
          date: f.date, event: f.event, name: f.name, eventNo: f.eventNo,
          rooms: f.rooms, dishes: f.dishes.length, dishList: f.dishes, paxMax: f.paxMax
        };
      }),
      kitchenSection: 'Sauce',
      mode: 'production',
      note: 'Sauce Production allocation (colour → Syd eats / Canape / Crew+MT / Retail).',
      week: week,
      sections: SEC_META
    };
  }

  function buildDaySummary(opts) {
    opts = opts || {};
    var wo = opts.wo;
    var X = opts.XLSX || opts.X || (typeof XLSX !== 'undefined' ? XLSX : null);
    if (!wo) throw new Error('Sauce day summary needs a parsed work order');
    var fns = functionsFromWo(wo);
    var rows = [['Sauce day summary'],
      ['Event #', 'Function', 'Date', 'Pax', 'Dishes', 'Rooms']];
    fns.forEach(function (f) {
      rows.push([f.eventNo || '', f.name || f.event || '', f.date, f.paxMax || '',
        (f.dishes || []).join('; '), (f.rooms || []).join('; ')]);
    });
    var fileName = summaryFileName(wo);
    if (!X) return { rows: fns, aoa: rows, fileName: fileName, mode: 'production', workbook: null };
    var wb = X.utils.book_new();
    var ws = X.utils.aoa_to_sheet(rows);
    X.utils.book_append_sheet(wb, ws, 'Sauce summary');
    return { workbook: wb, rows: fns, fileName: fileName, mode: 'production' };
  }

  function summaryFileName(wo) {
    var days = (wo && wo.days) || [];
    var last = days.length ? days[days.length - 1] : null;
    if (!last) return 'Sauce_DaySummary.xlsx';
    var p = String(last).split('-');
    return 'Sauce_DaySummary_WE_' + p[2] + '.' + p[1] + '.' + (p[0] || '').slice(2) + '.xlsx';
  }

  var API = {
    VERSION: '4.8.37-sauce-prod',
    detectSauce: detectSauce,
    functionsFromWo: functionsFromWo,
    collectItems: collectItems,
    build: build,
    buildDaySummary: buildDaySummary,
    summaryFileName: summaryFileName,
    SERVICE_SECTIONS: SERVICE_SECTIONS,
    SERVICE_FILL: SERVICE_FILL,
    PREP_SECTIONS: PREP_SECTIONS,
    SEC_META: SEC_META,
    MODE: 'production',
    COLOR_SEC: COLOR_SEC
  };
  root.AllocSauce = API;
  if (typeof module !== 'undefined') module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
