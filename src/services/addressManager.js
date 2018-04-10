const db = require('src/db');
const coinjs = require('coinjs-lib');
const config = require('src/config');
const addrUtils = require('./utils');
const { getName } = require('coinnames');
let seed;
const singleton = require('src/lib/singleton');
class AddrManager {
  constructor (coin) {
    this.family = config.get(`coins.${coin}.family`);
    this.coin = coin;
    this.isopen = false;
    this.open();
  }
  open () {
    if (this.isopen === false) {
      this.netw = addrUtils.getNetwork(this.coin);
      this.rootNode = coinjs.HDNode.fromSeedBuffer(seed, this.netw);
      this.bip44 = addrUtils.getConstant(this.coin);
      this.coinname = this.coin == 'tbtc' ? 'Testnet' : getName(this.coin);
      this.addrType = config.get(`coins.${this.coin}.type`);
      this.isopen = true;
    }
    return this;
  }

  _deriveAddress (accid, index) {
    const master = this.rootNode.derivePath(`m/44'/${this.bip44}'/${accid}'/0/${index}`);
    let masteraddress;
    if (this.addrType) {
      const pubKey = master.getPublicKeyBuffer();
      let redeemScript = coinjs.script.witnessPubKeyHash.output.encode(coinjs.crypto.hash160(pubKey));
      if (this.addrType === 'p2sh') {
        redeemScript = coinjs.script.scriptHash.output.encode(coinjs.crypto.hash160(redeemScript));
        masteraddress = coinjs.address.fromOutputScript(redeemScript, this.netw);
      } else if (this.addrType === 'bech32') {
        masteraddress = coinjs.address.fromOutputScript(redeemScript, this.netw);
      } else {
        masteraddress = master.getAddress(this.coin);
      }
    } else {
      masteraddress = master.getAddress(this.coin);
    }

    const privkey = master.getPrivateKey();
    return { address: masteraddress, privkey };
  }
  getAddressPair (accid, index) {
    return this._deriveAddress(accid, index);
  }
  async getNewAddress (accid) {
    let index;
    let { lastIndex } = await db.getAccAddrIndex(accid, this.coin);
    if (lastIndex == null) {
      index = 0;
    } else {
      index = lastIndex + 1;
    }
    const { address, privkey } = this.getAddressPair(accid, index);
    return { address, privkey, index };
  }
  async getAddressInfo (address) {
    return await db.getAddrInfoByCoin(address, this.coin);
  }
  async getAddress (accid) {
    let { lastIndex } = await db.getAccAddrIndex(accid, this.coin);
    if (lastIndex == null) {
      return false;
    }
    const addrPair = this.getAddressPair(accid, lastIndex);
    return { address: addrPair.address, privkey: addrPair.privkey, index: lastIndex };
  }
  async getAllAddress () {
    return await db.getAllAddressByCoin(this.coin);
  }
  async validateAddress (address) {
    return await db.addressesExists(address, this.coin);
  }
  async getAccount (accid, num = 10) {
    const payload = await db.getAccountAddresses(accid, this.coin, num);
    return {
      payload
    };
  }
}

module.exports = coin => {
  if (!seed) {
    seed = coinjs.bip39.mnemonicToSeed(config.get('seed'));
  }
  let inst = singleton.get('addressManager', coin);
  if (!inst) {
    singleton.set('addressManager', coin, new AddrManager(coin));
    inst = singleton.get('addressManager', coin);
  }
  return inst;
};
