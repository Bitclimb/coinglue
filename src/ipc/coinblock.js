const rpc = require('src/rpc/connect');
const coinhook = require('./coinhook');
const batchGetTxOutputs = async (r, txids) => {
  try {
    if (!txids.length) {
      return false;
    }
    const batch = txids.map(txid => ({
      method: 'gettransaction',
      parameters: [txid]
    }));
    console.log(`Batch request for ${txids.length} transactions`);
    let transaction = await r.cmd(batch);
    transaction = transaction.filter(tx => {
      return !tx.code && tx.code !== -5;
    });
    if (!transaction.length) {
      return false;
    }
    transaction = [...new Set(transaction.map(txs => txs.txid))];
    return transaction;
  } catch (err) {
    console.error(err.stack || err.message, 'ERROR');
    return false;
  }
};
exports.scanblock = async (blockhash, coin, secret) => {
  const [r] = rpc.connect(coin);
  console.log(`Received Block:${blockhash} ${coin}`);
  const blkinfo = await r.cmd('getblock', blockhash, true);
  const txidarr = await batchGetTxOutputs(r, blkinfo.tx);
  if (!txidarr || !txidarr.length) {
    console.log('No useful transactions to process');
  } else {
    for (const txid of txidarr) {
      await coinhook.hook(txid, coin, secret);
    }
  }
};
