const util = require('util');
const exec = util.promisify(require('child_process').exec);
const Blocks = require('./ethblockListener');
const blockDb = require('./ethblockDb');
const AddrManager = require('./addressManager');
const addrmanager = AddrManager('eth');
const config = require('../config');
const hook = config.get('hook');
const state = require('src/lib/state');
const coinhookpath = `${process.env.CGDIR}/bin/coinhook`;
const Promise = require('bluebird');
const { sendethtomaster } = require('../rpc');
const blockdb = blockDb('/ethblocks');
const blockevent = Blocks();

module.exports = async () => {
  if (state.get('eth_rpc') == 'down') {
    blockdb.close();
    return console.warn('Ethereum wallet is down,stopping block listener');
  }
  blockevent.on('block', async ({ current, data }) => {
    if (blockdb.get() < current) {
      console.log('New block found for eth', current);
      const addresses = [...new Set(data.transactions.map(txs => txs.to))];
      if (addresses.length > 0) {
        let checkaddr = addrmanager.validateAddress(addresses);
        const masterAddrPair = addrmanager.getAddress(0);
        checkaddr = checkaddr.filter(addr => addr !== masterAddrPair.address);
        const txids = [];
        data.transactions.forEach(txs => {
          if (checkaddr.includes(txs.to)) {
            txids.push(txs.hash);
          }
        });
        for (const txid of txids) {
          console.log('Executing hook for tx id', txid);
          await exec(`${coinhookpath} ${txid} eth ${hook.pass}`);
        }
        if (checkaddr.length > 0) {
          console.log('Sweeping addresses to master');
          const txs = await Promise.map(checkaddr, caddr => sendethtomaster(['eth', caddr]), { concurrency: 5 });
          console.log('Successfully sweeped addresses with txids', txs);
        }
      }
    }
  });
  blockevent.on('setBlock', ({ blocknumber }) => {
    if (blockdb.get() < blocknumber) {
      blockdb.set(Number(blocknumber));
    }
  });
  return await blockevent.start();
};
