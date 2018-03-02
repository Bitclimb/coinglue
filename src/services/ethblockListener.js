const Coinblocks = require('coinblocks');
const blockDb = require('./ethblockDb');
const rpcConn = require('src/rpc/connect');
const Promise = require('bluebird');
const EventEmitter = require('eventemitter3');
const singleton = require('src/lib/singleton');
const config = require('src/config');
const coins = config.get('coins');
const coinblockOpts = {
  coin: 'eth',
  rpc: coins.eth.rpc,
  family: coins.eth.family
};
const blockdb = blockDb('/ethblocks');

class Blocks extends EventEmitter {
  constructor () {
    super();
    this.coinblocks = new Coinblocks([coinblockOpts]);
  }
  async start () {
    await this.catchup(blockdb.get());
    return this._listen();
  }
  close () {
    console.log('Closing BlockListeners');
    this.coinblocks.close();
  }
  _listen () {
    try {
      console.log('Start listening for new blocks');
      this.coinblocks.on('newBlock', ({ coin, data }) => {
        if (coin == 'eth') {
          this._emitBlock(data.number, data);
          this._setBlock(data.number);
        }
      });
      this.coinblocks.start();
    } catch (e) {
      console.error(e.stack || e.message);
    }
  }
  _emitBlock (current, data) {
    this.emit('block', { current, data });
  }
  _setBlock (blocknumber) {
    this.emit('setBlock', { blocknumber });
  }
  async catchup (block) {
    try {
      console.log('Current block for eth', block);
      const [rpc] = rpcConn.connect('eth');

      const latestblock = await rpc.cmd('eth.getBlockNumber');
      if (block == null) {
        blockdb.set(latestblock);
        block = latestblock;
      }
      if (block === latestblock) {
        return;
      }
      console.log('Catching up for new blocks for eth current:', block, 'latest:', latestblock);
      const blockList = Array.from({ length: 10 }, (v, i) => block + (i + 1));
      const blockArr = await Promise.map(blockList, bn => {
        console.log('Syncing eth block', bn);
        return rpc.cmd('eth.getBlock', bn, true);
      }, { concurrency: 5 });
      for (const bl of blockArr) {
        this._emitBlock(bl.number, bl);
        this._setBlock(bl.number);
      }

      return await this.catchup(blockList.pop());
    } catch (err) {
      console.error(err.stack || err.message);
    }
  }
}

module.exports = () => {
  let inst = singleton.get('listener', 'blocks');
  if (!inst) {
    singleton.set('listener', 'blocks', new Blocks());
    inst = singleton.get('listener', 'blocks');
  }
  return inst;
};
