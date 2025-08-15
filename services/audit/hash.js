/* eslint-disable */ // @ts-nocheck
'use strict';
const crypto = require('crypto');

function stableStringify(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map(k => JSON.stringify(k)+':'+stableStringify(obj[k])).join(',')}}`;
}

function auditHash(payload) {
  const s = stableStringify(payload);
  return crypto.createHash('sha256').update(s).digest('hex');
}

module.exports = { auditHash, stableStringify };
