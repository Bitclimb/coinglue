const lmdb = require('node-lmdb');
const fs = require('fs-extra');
const singleton = require('src/lib/singleton');
class BlockDb {
  constructor (dir) {
    this.db = {};
    this.isOpen = false;
    this.db.txns = 0;
    this.node_env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    dir = `${__dirname}/${this.node_env}${dir}`;
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
      maxDbs: 1,
      mapSize: 268435456 * 4096,
      maxReaders: 126
    });
    this.db.blocks = this.db.env.openDbi({
      name: 'blocks',
      create: true
    });
    this.isOpen = true;
  }

  close () {
    if (!this.db.env || !this.isOpen) {
      return false;
    } else {
      console.log('Closing blockDb for eth');
      this.db.blocks.close();
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
  get () {
    let value;
    this.beginTransaction();
    value = this.getNumber(this.db.blocks, 'latest');
    this.commit();
    return value;
  }
  set (value) {
    this.beginTransaction();
    this.putNumber(this.db.blocks, 'latest', Number(value));
    this.commit();
  }
}

module.exports = dir => {
  let inst = singleton.get('db', 'blockdb');
  if (!inst) {
    singleton.set('db', 'blockdb', new BlockDb(dir));
    inst = singleton.get('db', 'blockdb');
  }
  return inst;
};
