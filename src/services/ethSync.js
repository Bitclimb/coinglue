const config = require('src/config');
const needle = require('needle');
const crypto = require('crypto');
const ethRpc = config.get('coins.eth.rpc');
const Api = require('@parity/api');
const provider = new Api.Provider.Ws(`ws://${ethRpc.host}:${ethRpc.port}`);
const api = new Api(provider);

const hook = config.get('hook');
const fs = require('fs-extra');
const { resolve } = require('path');
const db = require('src/db');
let txQue = [];

const Promise = require('bluebird');
const readFile = Promise.promisify(fs.readFile);

const blockPath = resolve(__dirname, 'eth.blk');

const getLastBlockProcessed = async () => {
  if (!fs.existsSync(blockPath)) {
    return null;
  }
  const blknum = await readFile(blockPath, 'utf8');
  return parseInt(blknum) + 1;
};

const saveBlock = async blknum => await fs.outputFile(blockPath, parseInt(blknum));

const sendHook = (tx, address, amount) => {
  const postData = JSON.stringify({ tx, address, amount });
  const hmacSig = crypto.createHmac('sha256', hook.pass).update(postData).digest('hex');
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Coinworks-Sig': hmacSig,
      'User-Agent': 'Coinworks-WebHook'
    }
  };

  needle.post(`${hook.host}/eth`, postData, options, (err, resp) => {
    let isFail = false;
    if (err || resp.statusCode !== 200) {
      console.error(`Problem with request: ${err ? err.message : ''} Status: ${resp.statusCode}`);
      isFail = true;
    } else {
      if (typeof resp.body === 'object' && !Array.isArray(resp.body)) {
        if (!resp.body.success) {
          console.error(`Failed request: ${JSON.stringify(resp.body)}`);
          isFail = true;
        }
      } else {
        console.error(`Invalid Response: ${JSON.stringify(resp.body)}`);
        isFail = true;
      }
    }
    if (isFail == true) {
      txQue.push({ tx, address, amount });
    }
    processQue();
  });
};

const processQue = () => {
  const q = txQue;
  txQue = [];
  for (const txs of q) {
    sendHook(txs.tx, txs.address, txs.amount);
  }
};

const syncer = async (blknum) => {
  const islistenting = await api.net.listening();
  if (islistenting) {
    let lastBlk = await getLastBlockProcessed();
    lastBlk = !lastBlk ? blknum : lastBlk;

    let addresses = await db.getAllAddressByCoin('eth');

    console.log('Syncing', lastBlk, '=>', blknum);
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
    traceRes.forEach(tx => {
      sendHook(tx.txid, tx.to, tx.amount);
    });
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
