const { getName } = require('coinnames');
const bip44const = require('./bip44constants');
const networks = require('./networks');

exports.getNetwork = coin => {
  const name = coin == 'tbtc' ? 'testnet' : getName(coin, 'lower');

  return networks.get(name.replace(' ', '_'));
};

exports.getConstant = coin => {
  const name = coin == 'tbtc' ? 'testnet' : getName(coin, 'lower');
  return bip44const(name);
};
