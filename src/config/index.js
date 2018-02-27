const dir = require('node-dir');
const path = require('path');
const assert = require('assert');
let all = {};

function getConfigs (foldername) {
  const files = dir.files(`${__dirname}/${foldername}`, { sync: true });
  if (files) {
    for (const f of files) {
      const fname = path.basename(f, '.js');
      console.log(`Loading ${fname} configurations...`);
      all[fname] = require(f);
    }
  }
}

function parseConfigs () {
  all = {};
  if (process.env.NODE_ENV === 'production') {
    getConfigs('prod');
  } else if (process.env.NODE_ENV === 'test') {
    getConfigs('test');
  } else {
    getConfigs('dev');
  }
  getConfigs('general');
}

function walk (obj, prop) {
  // check config file first
  let value;
  if (!Array.isArray(prop) && !prop.includes('.')) {
    value = obj.config[prop];
    if (value) {
      return value;
    }
  }
  const elems = Array.isArray(prop) ? prop : prop.split('.');
  const name = elems[0];
  value = obj[name];
  if (elems.length <= 1) {
    return value;
  }

  return walk(value, elems.slice(1));
}
parseConfigs();
exports._reset = parseConfigs;
exports._setSeed = newseed => {
  if (isEncrypted()) {
    all.seed = newseed;
    return true;
  } else {
    console.error('You can only set a new seed if the seed is encrypted');
    return false;
  }
};
const isEncrypted = () => {
  const mseed = get('seed');
  if (mseed) {
    if (mseed.data && mseed.iv) {
      return true;
    } else {
      return false;
    }
  }
  return false;
};
exports._isEncrypted = isEncrypted;
const get = (confname) => {
  assert(typeof confname === 'string', 'Invalid config name type');

  return walk(all, confname);
};
exports.get = get;
exports.all = () => all;
