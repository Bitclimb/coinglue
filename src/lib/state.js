const state = {};

exports.set = (service, s) => {
  if (['up', 'down'].includes(s)) {
    state[service] = s;
  }
};
exports.get = service => state[service];

exports.getAll = () => state;
