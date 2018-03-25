const Client = require('bitcoin-core');
const Web3 = require('web3');
const Transaction = require('ethereumjs-tx');
const config = require('src/config');
const coins = config.get('coins');
const state = require('src/lib/state');

class BtcRpc extends Client {
  constructor (opts, c) {
    super(opts);
    this.coin = c;
  }
  async _updateState () {
    try {
      const info = await this.cmd('getwalletinfo');

      if (info) {
        state.set(`${this.coin}_rpc`, 'up');
      } else {
        state.set(`${this.coin}_rpc`, 'down');
      }
    } catch (err) {
      state.set(`${this.coin}_rpc`, 'down');
      return err.message;
    }
  }
  async cmd (command, ...args) {
    const start = new Date();
    let cmdname = command;
    if (Array.isArray(cmdname)) {
      cmdname = 'Batch';
    }
    console.log(`Requesting ${cmdname}`);
    const resp = await super.command(command, ...args);
    console.log(`Response for ${cmdname} received in ${(new Date() - start) / 1000} secs`);
    return resp;
  }
}
class EthRpc {
  constructor (opts, c) {
    this.coin = c;
    this._web3 = new Web3(`ws://${opts.host}:${opts.port}`);
  }
  async _updateState () {
    try {
      const blknum = await this._web3.eth.getBlockNumber();
      if (blknum) {
        state.set(`${this.coin}_rpc`, 'up');
      } else {
        state.set(`${this.coin}_rpc`, 'down');
        return 'Error connecting to eth service';
      }
    } catch (err) {
      console.error(err.stack || err.message);
      return 'Error connecting to eth service';
    }
  }
  get web3 () {
    return this._web3;
  }
  async cmd (command, ...args) {
    const [api, cmd] = command.split('.');
    const ethmethod = this._web3[api][cmd];
    try {
      if (args.length) {
        return await ethmethod(...args);
      } else {
        return await ethmethod();
      }
    } catch (err) {
      console.error(err);
      return err;
    }
  }
  fromWei (data, from) {
    return this._web3.utils.fromWei(data, from);
  }
  toWei (number, unit) {
    return this._web3.utils.toWei(number, unit);
  }
  add0x (input) {
    if (typeof (input) !== 'string') {
      return input;
    }
    if (input.length < 2 || input.slice(0, 2) !== '0x') {
      return `0x${input}`;
    }
    return input;
  }
  rawTx (txObject, privkey) {
    const privateKey = Buffer.from(privkey, 'hex');
    const tx = new Transaction(txObject);
    tx.sign(privateKey);
    return tx;
  }
}
const rpcStore = {
  btc: {},
  nxt: {},
  eth: {}
};
for (const [c, opts] of Object.entries(coins)) {
  if (opts.family === 'btc') {
    rpcStore.btc[c] = new BtcRpc(opts.rpc, c);
  } else if (opts.family === 'eth') {
    rpcStore.eth[c] = new EthRpc(opts.rpc, c);
  }
}

exports.connect = (currency) => {
  const family = coins[currency].family;
  return [rpcStore[family][currency], family];
};
