const instances = {};

exports.get = (id, key) => {
  if (!instances[id]) {
    return false;
  }
  if (!instances[id][key]) {
    return false;
  }
  return instances[id][key];
};
exports.set = (id, key, val) => {
  if (!instances[id]) {
    instances[id] = {};
  }
  instances[id][key] = val;
};

exports.getAll = () => instances;
