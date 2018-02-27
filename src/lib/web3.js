const Web3 = require('web3');
const Promise = require('bluebird');

module.exports = class Web3js {
  constructor (host, port) {
    this._web3 = new Web3(new Web3.providers.HttpProvider(`http://${host}:${port}`));
    Promise.promisifyAll(this._web3.eth);
    Promise.promisifyAll(this._web3.net);
    Promise.promisifyAll(this._web3.version);
  }
  get web3 () {
    return this._web3;
  }
};
