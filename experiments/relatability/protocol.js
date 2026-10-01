(function (root) {
  'use strict';
  const variants = ['dark', 'scenery', 'everyday'];
  const orders = [
    ['dark','scenery','everyday'], ['dark','everyday','scenery'],
    ['scenery','dark','everyday'], ['scenery','everyday','dark'],
    ['everyday','dark','scenery'], ['everyday','scenery','dark'],
  ];
  function orderFor(participant) {
    if (!Number.isInteger(participant) || participant < 1) throw Error('Participant number must be a positive whole number');
    return orders[(participant - 1) % orders.length].slice();
  }
  function validateMedia(items) {
    if (items.length !== 3) throw Error('Choose all three edits');
    for (const item of items) {
      if (!Number.isFinite(item.duration) || Math.abs(item.duration - 20) > 0.15) throw Error('Each edit must be 20 seconds (within 0.15 seconds)');
      if (!(item.width > 0 && item.height > 0) || Math.abs(item.width/item.height - 9/16) > 0.015) throw Error('Each edit must be vertical 9:16');
    }
    if (Math.max(...items.map(x=>x.duration))-Math.min(...items.map(x=>x.duration)) > 0.1) throw Error('Edit durations must match within 0.1 seconds');
    return true;
  }
  function csv(rows) {
    const columns = ['study','participant','position','variant','association','connection','readability','familiarity','favorite_position','favorite_variant'];
    const escape = value => {
      let s = String(value ?? '');
      // Treat spreadsheet formulas entered in free text as literal text.
      if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return [columns.join(','), ...rows.map(r=>columns.map(c=>escape(r[c])).join(','))].join('\r\n');
  }
  const api = { variants, orderFor, validateMedia, csv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WalvrStudy = api;
})(typeof window !== 'undefined' ? window : globalThis);
