const readlineSync = require('readline-sync');
const fs = require('fs-extra');
const coinpath = `${process.env.CGDIR}/src/config/general/coins.js`;
const _add = exports._add = async () => {
  const coinsymbol = readlineSync.question('Enter the coin symbol/abbreviate eg. btc [required]: ');
  const host = readlineSync.question('Enter the coin host eg. 127.0.0.1 [required]: ');
  const port = parseInt(readlineSync.question('Enter the coin port eg. 8331 [required]: '));
  const username = readlineSync.question('Enter the coin rpc usename, leave blank if not required [optional]: ');
  const password = readlineSync.question('Enter the coin rpc password, leave blank if not required [optional]: ');
  const family = readlineSync.question('Enter the coin family eg. for btc ltc doge etc, enter "btc" as the family [required]: ');
  let type = '';
  if (coinsymbol === 'btc' || coinsymbol === 'tbtc') {
    type = readlineSync.question('Enter the address type, either legacy,bech32 or p2sh [required]: ');
    if (!type) {
      console.error('Missing parameters');
      process.exit(1);
    }
  }
  if (!coinsymbol || !host || !port || !family) {
    console.error('Missing parameters');
    process.exit(1);
  }
  const payload = {
    [coinsymbol]: {
      rpc: {
        host,
        port,
        username,
        password,
        timeout: 30000
      },
      family,
      addressDb: `/${coinsymbol}`,
      type
    }
  };

  await _commit('add', payload);
  if (readlineSync.keyInYN('Would you like to add another?')) {
    return await _add();
  }
  return true;
};

exports._remove = async () => {
  const coinsymbol = readlineSync.question('Enter the coin symbol/abbreviate that you want to remove eg. btc [required]: ');
  if (!coinsymbol) {
    console.error('Missing parameters');
    process.exit(1);
  }
  await _commit('remove', { coinsymbol });
};

const _commit = async (action, pl) => {
  try {
    let coinsymbol, coinlist;
    if (action == 'add') {
      coinsymbol = Object.keys(pl)[0];
      if (await fs.pathExists(coinpath)) {
        coinlist = require(coinpath);
        if (coinlist[coinsymbol]) {
          if (!readlineSync.keyInYN('Coin already exists, would you like to overwrite?')) {
            return;
          }
        }
      } else {
        coinlist = {};
      }
      coinlist = Object.assign(coinlist, pl);
    } else if (action == 'remove') {
      coinsymbol = pl.coinsymbol;
      if (await fs.pathExists(coinpath)) {
        coinlist = require(coinpath);
        if (coinlist[coinsymbol]) {
          delete coinlist[coinsymbol];
        }
      }
    }
    coinlist = JSON.stringify(coinlist, null, 2);
    await fs.outputFile(coinpath, `module.exports = ${coinlist}`);
    console.log(`Successfully added/removed ${coinsymbol}`);
  } catch (err) {
    console.error(err.stack || err.message);
    process.exit(1);
  }
};

exports.check = async () => {
  if (!await fs.pathExists(coinpath)) {
    console.log('No coins exists in the wallet, please add atleast 1 coin');
    return await _add();
  }
  return true;
};
