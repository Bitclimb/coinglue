const needle = require('needle');
const path = require('path');
const failTxQueue = path.resolve(__dirname, 'txque.json');
const config = require('../config');
const crypto = require('crypto');
const fs = require('fs-extra');
const hook = config.get('hook');

const storeQueue = async (trx, coin, hmacsig) => {
  try {
    let txObj = { 'txs': [] };
    if (fs.existsSync(failTxQueue)) {
      txObj = await fs.readJson(failTxQueue);
    }
    txObj.txs.push({ trx, coin, hmacsig });
    await fs.outputJson(failTxQueue, txObj);
  } catch (e) {
    console.error(e.message);
  }
};
const getQueueAndDel = async () => {
  try {
    let txObj = { 'txs': [] };
    if (!fs.existsSync(failTxQueue)) {
      return txObj;
    }
    txObj = await fs.readJson(failTxQueue);
    await fs.remove(failTxQueue);
    return txObj;
  } catch (e) {
    console.error(e.message);
  }
};

const sendHook = (trx, coin, hmacSec, cb) => {
  const postData = JSON.stringify({ tx: trx, coin });
  let hmacsig;
  if (hmacSec.length == 64) {
    hmacsig = hmacSec;
  } else {
    hmacsig = crypto.createHmac('sha256', hmacSec).update(postData).digest('hex');
  }
  console.log(`Sending tx hook txid: ${trx}\n coin: ${coin} hmacsig: ${hmacsig}`);
  const options = {
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'X-Coinworks-Sig': hmacsig,
      'User-Agent': 'Coinworks-WebHook'
    }
  };
  needle.post(hook.host, postData, options, (err, resp) => {
    let isFail = false;
    if (err || resp.statusCode !== 200) {
      console.error(`Problem with request: ${err ? err.message : ''} Status: ${resp.statusCode}`);
      isFail = true;
    } else {
      if (typeof resp.body === 'object' && !Array.isArray(resp.body)) {
        if (resp.body.success) {
          console.log(`Successful request: ${JSON.stringify(resp.body)}`);
        } else {
          console.error(`Failed request: ${JSON.stringify(resp.body)}`);
          isFail = true;
        }
      } else {
        console.error(`Invalid Response: ${JSON.stringify(resp.body)}`);
        isFail = true;
      }
    }
    if (isFail == true) {
      storeQueue(trx, coin, hmacsig).then(() => {
        process.nextTick(cb);
      })
        .catch(err => {
          console.error(err.message);
        });
    } else {
      process.nextTick(cb);
    }
  });
};

const queueRunner = (queTx) => {
  const processQueue = txArr => {
    if (txArr.length) {
      const txObj = txArr.shift();
      sendHook(txObj.trx, txObj.coin, txObj.hmacsig, () => {
        processQueue(txArr);
      });
    }
  };
  processQueue(queTx);
};

exports.hook = async (trx, coin, secret) => {
  let queArr = await getQueueAndDel();
  sendHook(trx, coin, secret, () => {
    if (queArr.txs.length) {
      process.nextTick(() => {
        queueRunner(queArr.txs);
      });
    }
  });
};
