const lmdb = require('node-lmdb');
const fs = require('fs-extra');
const singleton = require('src/lib/singleton');
class ServiceDb {
  constructor (dir) {
    this.db = {};
    this.isOpen = false;
    this.db.txns = 0;
    this.node_env = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
    this.dbdir = dir;
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
      maxDbs: 3,
      mapSize: 268435456 * 4096,
      maxReaders: 126
    });
    this.db.address = this.db.env.openDbi({
      name: 'address',
      create: true
    });
    this.db.addressIndex = this.db.env.openDbi({
      name: 'addressIndex',
      keyIsUint32: true,
      create: true
    });
    this.db.addressMap = this.db.env.openDbi({
      name: 'addressMap',
      create: true
    });
    this.isOpen = true;
  }

  close () {
    if (!this.db.env || !this.isOpen) {
      return false;
    } else {
      console.log('Closing addressDB for', this.dbdir);
      this.db.address.close();
      this.db.addressIndex.close();
      this.db.addressMap.close();
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
  getAll (dbname) {
    this.beginTransaction();
    const cursor = new lmdb.Cursor(this.db.txn, this.db[dbname]);
    const records = [];
    try {
      let found = cursor.goToFirst();
      while (found != null) {
        records.push(this._parser(cursor.getCurrentString()));
        found = cursor.goToNext();
      }
    } finally {
      cursor.close();
    }
    return records;
  }
  putNumber (db, key, value) {
    return this.db.txn.putNumber(db, key, value);
  }
  putString (db, key, value) {
    return this.db.txn.putString(db, key, value);
  }
  getString (db, key) {
    return this.db.txn.getString(db, key);
  }
  getNumber (db, key) {
    return this.db.txn.getNumber(db, key, { keyIsUint32: true });
  }
  has (dbname, value) {
    this.beginTransaction();
    if (!Array.isArray(value)) {
      value = [value];
    }
    const cursor = new lmdb.Cursor(this.db.txn, this.db[dbname]);
    let isfound = [];
    try {
      let found = cursor.goToFirst();
      while (found != null) {
        const cursorvalue = this._parser(cursor.getCurrentString());
        if (value.includes(cursorvalue)) {
          isfound.push(cursorvalue);
          if (value.length === isfound.length) {
            found = null;
          }
        }
        found = cursor.goToNext();
      }
    } finally {
      cursor.close();
    }
    return isfound;
  }
  get (dbname, key, type = 'string') {
    let value;
    this.beginTransaction();
    if (type === 'string') {
      value = this.getString(this.db[dbname], key);
    } else if (type === 'number') {
      value = this.getNumber(this.db[dbname], key);
    }
    this.commit();

    return this._parser(value);
  }
  set (dbname, key, value, opts) {
    this.beginTransaction();
    if (typeof value === 'number') {
      this.putNumber(this.db[dbname], key, value);
      this.commit();
    } else {
      opts = opts || { append: false };
      if (opts.append) {
        let dbdata = this.getString(this.db[dbname], key);
        if (!dbdata && opts.type === 'array') {
          dbdata = [];
        } else if (!dbdata && opts.type === 'object') {
          dbdata = {};
        } else {
          dbdata = JSON.parse(dbdata);
        }
        if (opts.type === 'array') {
          dbdata.push(value);
        } else if (opts.type === 'object') {
          dbdata = Object.assign(dbdata, value);
        }
        this.putString(this.db[dbname], key, JSON.stringify(dbdata));
      } else {
        this.putString(this.db[dbname], key, JSON.stringify(value));
      }
      this.commit();
    }
  }
  _parser (value) {
    try {
      return JSON.parse(value);
    } catch (err) {
      return value;
    }
  }
}

module.exports = (dir, coin) => {
  let inst = singleton.get('adressdb', coin);
  if (!inst) {
    singleton.set('adressdb', coin, new ServiceDb(dir));
    inst = singleton.get('adressdb', coin);
  }
  return inst;
};
