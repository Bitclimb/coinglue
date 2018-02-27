const lmdb = require('node-lmdb');
const fs = require('fs-extra');
const singleton = require('src/lib/singleton');
class BlockDb {
  constructor () {
    this.db = {};
    this.isOpen = false;
    this.db.txns = 0;
    const dir = `${__dirname}/ipbandb`;
    fs.ensureDirSync(dir);
    this.open(dir);
  }
  open (dir) {
    if (this.isOpen) {
      return;
    }
    this.db.env = new lmdb.Env();
    this.db.env.open({
      path: dir,
      create: true,
      maxDbs: 2,
      mapSize: 268435456 * 4096,
      maxReaders: 126
    });
    this.db.ipstore = this.db.env.openDbi({
      name: 'ipstore',
      create: true
    });
    this.db.ipban = this.db.env.openDbi({
      name: 'ipban',
      create: true
    });
    this.isOpen = true;
  }

  close () {
    if (!this.db.env || !this.isOpen) {
      return false;
    } else {
      console.log('Closing ipbanDb');
      this.db.ipstore.close();
      this.db.ipban.close();
      this.db.env.close();
      this.isOpen = false;
      return true;
    }
  }
  commit () {
    this.db.txns -= 1;
    if (this.db.txns == 0) {
      this.db.txn.commit();
      delete this.db.txn;
    }
  }
  abort () {
    this.db.txns = 0;
    this.db.txn.abort();
    delete this.db.txn;
  }
  count (dbname) {
    this.beginTransaction();
    const stat = this.db[dbname].stat(this.db.txn);
    this.commit();
    return stat.entryCount;
  }
  beginTransaction () {
    if (!this.db.txn) {
      this.db.txn = this.db.env.beginTxn();
    }
    this.db.txns += 1;
    return this.db.txn;
  }
  putNumber (db, key, value) {
    return this.db.txn.putNumber(db, key, value);
  }
  getNumber (db, key) {
    return this.db.txn.getNumber(db, key);
  }
  get (dbname, uip) {
    this.beginTransaction();
    const value = this.getNumber(this.db[dbname], uip);
    this.commit();
    return value;
  }
  set (dbname, uip, value) {
    this.beginTransaction();
    this.putNumber(this.db[dbname], uip, Number(value));
    this.commit();
  }
}

module.exports = () => {
  let inst = singleton.get('ip', 'bandb');
  if (!inst) {
    singleton.set('ip', 'bandb', new BlockDb());
    inst = singleton.get('ip', 'bandb');
  }
  return inst;
};
