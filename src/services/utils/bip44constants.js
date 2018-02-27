let bip44const = require('bip44-constants');
bip44const = Object.keys(bip44const).reduce((c, k) => (c[k.toLowerCase()] = bip44const[k], c), {});
module.exports = (coin) => {
  if (coin == 'ethereum') {
    coin = 'ether';
  }
  const coinHex = bip44const[coin];
  if (!coinHex) return false;
  return parseInt(coinHex - 2 ** 31, 10);
};
