const config = require('src/config');
const ethRpc = config.get('coins.eth.rpc');
const Api = require('@parity/api');
const provider = new Api.Provider.Ws(`ws://${ethRpc.host}:${ethRpc.port}`);
const api = new Api(provider);

const fs = require('fs-extra');
const { resolve } = require('path');
const db = require('src/db');

const Promise = require('bluebird');
const readFile = Promise.promisify(fs.readFile);

const blockPath = resolve(__dirname, 'eth.blk');

const toHex = blknum => {
  blknum = Number.parseInt(blknum);
  return `0x${blknum.toString(16)}`;
};

const getLastBlockProcessed = async () => {
  if (!fs.existsSync(blockPath)) {
    return null;
  }
  const blknum = await readFile(blockPath, 'utf8');
  return toHex(parseInt(blknum) + 1);
};
const getLatestBlock = async () => {
  let latestBlk = await api.eth.blockNumber();
  if (!latestBlk || typeof latestBlk !== 'number') {
    console.log('Invalid Latest Blk', latestBlk, 'retrying in 5 seconds');
    setTimeout(async () => await getLatestBlock(), 5000);
  }
  return toHex(latestBlk);
};
const saveBlock = async blknum => await fs.outputFile(blockPath, parseInt(blknum));

const syncer = async (blknum) => {
  const islistenting = await api.net.listening();
  if (islistenting) {
    blknum = toHex(blknum);
    let lastBlk = await getLastBlockProcessed();
    lastBlk = !lastBlk ? toHex(blknum) : lastBlk;
    let addresses = await db.getAllAddressByCoin('eth');
    console.log('Syncing', parseInt(lastBlk), '=>', parseInt(blknum));
    let traceRes = await api.trace.filter({
      'fromBlock': lastBlk,
      'toBlock': blknum,
      'toAddress': addresses
    });
    traceRes = traceRes.filter(tx => tx.action.value.toNumber() > 0).map(tx => ({
      to: tx.action.to,
      amount: api.util.fromWei(tx.action.value, 'ether').toNumber().toFixed(8) * 1e8,
      txid: tx.transactionHash
    }));
    await saveBlock(blknum);
  } else {
    console.log('Failed to connect to Parity Ws, retrying in 5secs');
    await syncer(blknum);
  }
};

const listener = async () => {
  try {
    const islistenting = await api.net.listening();
    if (islistenting) {
      const sub = await api.subscribe('eth_blockNumber', async (err, rep) => {
        syncer(rep.toNumber());
      });
    } else {
      console.log('Eth not listening, retrying in 5 secs');
      setTimeout(listener, 5000);
    }
  } catch (e) {
    console.error(e.stack || e.message);
  }
};
module.exports = listener;
