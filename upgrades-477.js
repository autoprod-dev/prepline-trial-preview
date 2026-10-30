/* Prepline 4.7.7 — Organised export matches Paula's Sorted layout (trial copy only). Autoprod.
 * One sheet per kitchen section; yellow header row; title row; flat item rows (not batched).
 * Columns: Item | Quantity per pax | Unit | PAX | Total needed (=B*D) | BAT/PO # | Section |
 * Prep day | Source tab | STAFF ALLOCATED (allergen suggestions).
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
    'BAT/PO #', 'Section', 'Prep day', 'Source tab', 'STAFF ALLOCATED'
  ];

  var COL_WIDTHS = [38.75, 16.75, 8.75, 14.75, 13.75, 10, 24.75, 12.75, 34.75, 30.75];

  function sheetForSection(sec) {
    var s = String(sec || '').trim();
    for (var i = 0; i < PAULA_TABS.length; i++) {
      if (PAULA_TABS[i].sections.indexOf(s) >= 0) return PAULA_TABS[i].sheet;
    }
    return OTHER_SHEET;
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
    /* Paula's Sorted puts allergen suggestions in STAFF ALLOCATED. */
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

  function buildPaulaRows(rows, helpers) {
    helpers = helpers || {};
    var list = Array.isArray(rows) ? rows.slice() : [];
    var out = [];
    list.forEach(function (r) {
      if (!r || !r.task) return;
      var sec = r.section || '';
      var pp = parsePerPax(r, helpers);
      out.push({
        item: r.task,
        qtyPerPax: pp.n,
        unit: pp.unit || '',
        pax: paxFor(r, helpers),
        fixedTotal: pp.fixedTotal,
        nonNumeric: !!pp.nonNumeric,
        batPo: '',
        section: sec || '—',
        prepDay: prepDayLabel(r.day, helpers),
        sourceTab: sourceTab(r, helpers),
        staff: staffAllocated(r, helpers),
        sheet: sheetForSection(sec),
        itemNorm: String(r.task || '').toLowerCase().replace(/\s+/g, ' ').trim(),
        dish: r.dish || ''
      });
    });
    out.sort(function (a, b) {
      if (a.itemNorm < b.itemNorm) return -1;
      if (a.itemNorm > b.itemNorm) return 1;
      if (a.sourceTab < b.sourceTab) return -1;
      if (a.sourceTab > b.sourceTab) return 1;
      return 0;
    });
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

  function fillSheetExcelJS(ws, sheetTitle, rows) {
    ws.mergeCells(1, 1, 1, 10);
    var title = ws.getCell(1, 1);
    title.value = sheetTitle;
    title.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF000000' } };
    title.alignment = { horizontal: 'center', vertical: 'middle' };
    title.border = thinBorder();
    ws.getRow(1).height = 21;

    var head = ws.getRow(2);
    HEADERS.forEach(function (h, i) {
      var cell = head.getCell(i + 1);
      cell.value = h;
      styleHeaderCell(cell);
    });
    head.height = 16.5;

    rows.forEach(function (r, idx) {
      var excelRow = idx + 3;
      var row = ws.getRow(excelRow);
      row.getCell(1).value = r.item;
      if (typeof r.qtyPerPax === 'number') row.getCell(2).value = r.qtyPerPax;
      else row.getCell(2).value = r.qtyPerPax == null ? '' : r.qtyPerPax;
      row.getCell(3).value = r.unit || '';
      if (typeof r.pax === 'number') row.getCell(4).value = r.pax;
      else row.getCell(4).value = r.pax === '' ? '' : r.pax;
      if (r.fixedTotal != null && r.fixedTotal !== '') {
        row.getCell(5).value = r.fixedTotal;
      } else if (r.nonNumeric) {
        row.getCell(5).value = { formula: 'IF(ISNUMBER(B' + excelRow + '),B' + excelRow + '*D' + excelRow + ',"")' };
      } else if (r.qtyPerPax === '' || r.pax === '') {
        row.getCell(5).value = { formula: 'IF(OR(B' + excelRow + '="",D' + excelRow + '=""),"",B' + excelRow + '*D' + excelRow + ')' };
      } else {
        row.getCell(5).value = { formula: 'B' + excelRow + '*D' + excelRow };
      }
      row.getCell(6).value = r.batPo || '';
      row.getCell(7).value = r.section || '';
      row.getCell(8).value = r.prepDay || '';
      row.getCell(9).value = r.sourceTab || '';
      row.getCell(10).value = r.staff || '';
      for (var c = 1; c <= 10; c++) styleDataCell(row.getCell(c));
      var h = 16.5;
      if (String(r.item || '').length > 60) h = 32.25;
      if (String(r.item || '').length > 100) h = 48.75;
      row.height = h;
    });

    COL_WIDTHS.forEach(function (w, i) {
      ws.getColumn(i + 1).width = w;
    });
    ws.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: 2, column: 10 }
    };
  }

  function fillSheetXLSX(XLSX, sheetTitle, rows) {
    var aoa = [];
    aoa.push([sheetTitle, '', '', '', '', '', '', '', '', '']);
    aoa.push(HEADERS.slice());
    var formulas = [];
    rows.forEach(function (r, idx) {
      var excelRow = idx + 3;
      var qty = r.qtyPerPax == null ? '' : r.qtyPerPax;
      var pax = r.pax === '' ? '' : r.pax;
      var tot = '';
      if (r.fixedTotal != null && r.fixedTotal !== '') {
        tot = r.fixedTotal;
      } else {
        formulas.push({ r: excelRow - 1, c: 4, f: 'B' + excelRow + '*D' + excelRow });
      }
      aoa.push([
        r.item, qty, r.unit || '', pax, tot,
        r.batPo || '', r.section || '', r.prepDay || '', r.sourceTab || '', r.staff || ''
      ]);
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }];
    formulas.forEach(function (fc) {
      var addr = XLSX.utils.encode_cell({ r: fc.r, c: fc.c });
      ws[addr] = { t: 'n', f: fc.f, v: 0 };
    });
    var yellow = { patternType: 'solid', fgColor: { rgb: 'FFFF00' } };
    var boldH = { bold: true, name: 'Calibri', sz: 12 };
    var titleF = { bold: true, name: 'Calibri', sz: 16 };
    var dataF = { name: 'Calibri', sz: 12 };
    var wrap = { vertical: 'center', wrapText: true };
    var thin = { style: 'thin', color: { rgb: '000000' } };
    var border = { top: thin, bottom: thin, left: thin, right: thin };
    var a00 = XLSX.utils.encode_cell({ r: 0, c: 0 });
    if (!ws[a00]) ws[a00] = { t: 's', v: sheetTitle };
    ws[a00].s = { font: titleF, alignment: { horizontal: 'center', vertical: 'center' }, border: border };
    for (var c = 0; c < 10; c++) {
      var ah = XLSX.utils.encode_cell({ r: 1, c: c });
      if (!ws[ah]) ws[ah] = { t: 's', v: HEADERS[c] };
      ws[ah].s = { fill: yellow, font: boldH, alignment: wrap, border: border };
    }
    for (var r = 2; r < aoa.length; r++) {
      for (var c2 = 0; c2 < 10; c2++) {
        var ad = XLSX.utils.encode_cell({ r: r, c: c2 });
        if (!ws[ad]) ws[ad] = { t: 's', v: '' };
        ws[ad].s = Object.assign({}, ws[ad].s || {}, { font: dataF, alignment: { vertical: 'top', wrapText: true }, border: border });
      }
    }
    ws['!cols'] = COL_WIDTHS.map(function (w) { return { wch: w }; });
    ws['!autofilter'] = { ref: 'A2:J2' };
    ws['!rows'] = [{ hpt: 21 }, { hpt: 16.5 }];
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

    function withExcelJS(ExcelJS) {
      var wb = new ExcelJS.Workbook();
      wb.creator = 'Prepline by Autoprod';
      sheets.forEach(function (sh) {
        var ws = wb.addWorksheet(sh.name.slice(0, 31), {
          views: [{ state: 'normal', showGridLines: true }]
        });
        fillSheetExcelJS(ws, sh.name, sh.rows);
      });
      if (!sheets.length) {
        var empty = wb.addWorksheet('Sauce, Purees and Gels');
        fillSheetExcelJS(empty, 'Sauce, Purees and Gels', []);
      }
      return wb.xlsx.writeBuffer().then(function (buf) {
        if (helpers.returnBuffer) return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), buffer: buf, engine: 'exceljs', layout: 'paula-sorted' };
        downloadBlob(buf, name);
        return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), engine: 'exceljs', layout: 'paula-sorted' };
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
        var ws = fillSheetXLSX(XLSX, sh.name, sh.rows);
        XLSX.utils.book_append_sheet(wb, ws, tab);
      });
      if (helpers.returnBuffer) {
        var out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        return Promise.resolve({ name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), buffer: out, engine: 'xlsx', layout: 'paula-sorted' });
      }
      XLSX.writeFile(wb, name);
      return { name: name, rows: totalRows, headers: HEADERS, sheets: sheets.map(function (s) { return s.name; }), engine: 'xlsx', layout: 'paula-sorted' };
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
    VERSION: '4.7.7',
    exportOrganisedXlsx: exportOrganisedXlsxPaula,
    buildPaulaOrganisedRows: buildPaulaRows,
    HEADERS: HEADERS
  };
})(typeof window !== 'undefined' ? window : globalThis);
