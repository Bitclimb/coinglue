const DB = require('./db');
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
      this.dbdir = config.get(`coins.${this.coin}.addressDb`);
      this.addrType = config.get(`coins.${this.coin}.type`);
      this.db = DB(this.dbdir, this.coin);
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
  getNewAddress (accid) {
    let index;
    let lastIndex = this.db.get('addressIndex', accid, 'number');
    if (lastIndex == null) {
      index = 0;
    } else {
      index = lastIndex + 1;
    }
    const { address, privkey } = this.getAddressPair(accid, index);
    this.db.set('address', address, { accountId: accid, index });
    this.db.set('addressIndex', accid, index);
    this.db.set('addressMap', `acc${accid}_i${index}`, address);

    return { address, privkey, index };
  }
  getAddressInfo (address) {
    return this.db.get('address', address);
  }
  getAddress (accid) {
    let lastIndex = this.db.get('addressIndex', accid, 'number');
    if (lastIndex == null) {
      return false;
    }
    const addr = this.db.get('addressMap', `acc${accid}_i${lastIndex}`);
    const addrPair = this.getAddressPair(accid, lastIndex);

    return { address: addr, privkey: addrPair.privkey, index: lastIndex };
  }
  getAllAddress () {
    return this.db.getAll('addressMap');
  }
  validateAddress (address) {
    return this.db.has('addressMap', address);
  }
  getAccount (accid, num = 10) {
    let payload = [];
    const lastIndex = this.db.get('addressIndex', accid, 'number');
    if (lastIndex === null) {
      return payload;
    }
    for (let i = lastIndex; i > lastIndex - num && i >= 0; i--) {
      const address = this.db.get('addressMap', `acc${accid}_i${i}`);
      payload.push({ address, index: i });
    }
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
