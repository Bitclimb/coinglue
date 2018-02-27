const coinjs = require('coinjs-lib');

const coinNetworks = () => {
  return coinjs.networks;
};

exports.get = (coin) => {
  return coinNetworks()[coin];
};
