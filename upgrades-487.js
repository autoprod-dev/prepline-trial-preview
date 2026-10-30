/* Prepline 4.8.7 — Organised export fixes (trial). Autoprod.
 * 1) Section column always equals its tab (sectionForSheet after sheetForItem).
 * 2) Total needed (col E) writes formula WITH cached result so Excel Protected View,
 *    LibreOffice and phone viewers show the value immediately (never blank / #VALUE).
 */
(function (root) {
  'use strict';
  root.Prepline487 = {
    VERSION: '4.8.7',
    FIX: 'organised-export-section-equals-tab+total-needed-cached'
  };
})(typeof window !== 'undefined' ? window : globalThis);
