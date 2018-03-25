const coinup = require('coinup');
const rpc = require('./connect');
const parser = require('./connect/argsParser');
const Promise = require('bluebird');
const { errMsg, errCodes } = require('./connect/errCodes');
const AddrManager = require('src/services/addressManager');
const estimatefee = require('./connect/estimateFee');
const utils = require('src/lib/utils');
const config = require('src/config');
const state = require('src/lib/state');
const blockDb = require('src/services/ethblockDb');
const checkState = async coin => {
  let s = state.get(`${coin}_rpc`);
  const { host, port } = config.get('coins')[coin].rpc;
  let isup = await coinup(`${host}:${port}`) == true ? 'up' : 'down';
  if (isup !== s) {
    if (s == 'down' && isup == 'up') {
      console.warn(`${coin} wallet is reachable but may not accept jsonrpc commands`);
      isup = true;
    } else if (s == 'up' && isup == 'down') {
      console.warn(`${coin} wallet is unreachable`);
      state.set(`${coin}_rpc`, isup);
      isup = false;
    }
  }
  return isup;
};
/* Since getinfo is deprecated, return getwalletinfo instead */
exports.getinfo = exports.getwalletinfo = async (args) => {
  const parsed = parser('getinfo', args);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const payload = {
    currency: parsed.coin
  };
  const [r, fam] = rpc.connect(parsed.coin);
  const { address } = await getmasteraddress([parsed.coin]);
  if (fam === 'btc') {
    const [chaininfo, walletinfo, netinfo] = await Promise.all([
      r.cmd('getblockchaininfo'),
      r.cmd('getwalletinfo'),
      r.cmd('getnetworkinfo')
    ]);
    payload.masteraddress = address;
    payload.version = { networkversion: netinfo.version, walletversion: walletinfo.walletversion };
    payload.balance = walletinfo.balance;
    payload.unconfirmed_balance = walletinfo.unconfirmed_balance;
    payload.chain = chaininfo.chain;
    payload.height = chaininfo.blocks;
    payload.difficulty = chaininfo.difficulty;
    payload.txcount = walletinfo.txcount;
    payload.networkactive = netinfo.networkactive;
    payload.connections = netinfo.connections;
  } else if (fam === 'eth') {
    const [nodev, ethv, bal] = await Promise.all([
      r.cmd('version.getNode'),
      r.cmd('version.getEthereum'),
      r.cmd('eth.getBalance', address)
    ]);
    const [gas, height, peercount, networkactive] = await Promise.all([
      r.cmd('eth.getGasPrice'),
      r.cmd('eth.getBlockNumber'),
      r.cmd('net.getPeerCount'),
      r.cmd('net.getListening')
    ]);
    const blockinfo = await r.cmd('eth.getBlock', height);

    payload.version = {
      nodeversion: nodev,
      ethereumversion: ethv
    };
    payload.masteraddress = address;
    payload.balance = r.fromWei(bal.toString(10), 'ether');
    payload.gasprice = r.fromWei(gas.toString(10), 'ether');
    payload.height = height;
    payload.difficulty = blockinfo.difficulty;
    payload.totaldifficulty = blockinfo.totalDifficulty;
    payload.networkactive = networkactive;
    payload.connections = peercount;
  }
  return payload;
};

exports.getbalance = async args => {
  const parsed = parser('getbalance', args);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const [r, fam] = rpc.connect(parsed.coin);
  const balance = {};
  if (fam === 'btc') {
    balance.balance = await r.cmd('getbalance', '', 1);
    const totalBalance = await r.cmd('getbalance', '', 0);
    balance.unconfirmed = totalBalance - balance.balance;
  } else if (fam === 'eth') {
    const { address } = await getmasteraddress([parsed.coin]);
    const bal = await r.cmd('eth.getBalance', address);
    balance.balance = r.fromWei(bal.toString(10), 'ether');
  }
  return balance;
};

const ethsend = async (address, privkey, amt, to, r) => {
  const bal = await r.cmd('eth.getBalance', address);
  const totalBalance = r.fromWei(bal.toString(10), 'ether');
  let gasPrice = await r.cmd('eth.getGasPrice');
  gasPrice = gasPrice.toNumber();
  const gasLimit = 21000;
  if (typeof amt === 'string' && amt == 'all') {
    amt = bal - (gasLimit * gasPrice);
    amt = r.fromWei(amt, 'ether');
    console.log('Sweeping', amt, 'from', address, 'to', to);
  }
  if (totalBalance < amt || amt < 0) {
    console.error(`Insufficient funds to send ${amt} to address ${to}. Wallet only has ${totalBalance}`);
    return 'Insufficient funds';
  }

  const rawpayload = {
    nonce: await r.cmd('eth.getTransactionCount', address, 'pending'),
    to,
    gasPrice,
    gasLimit,
    value: parseFloat(amt) * 1.0e18
  };
  console.log(rawpayload);
  const tx = r.rawTx(rawpayload, privkey);
  const feeCost = r.fromWei(tx.getUpfrontCost().toString(10), 'ether');
  console.log('feeCost', feeCost);
  if (feeCost > totalBalance) {
    console.error(`Insufficient funds to send ${amt} to address ${to}. Wallet only has ${totalBalance}`);
    return 'Insufficient funds';
  }
  const rawHex = `0x${tx.serialize().toString('hex')}`;

  const res = await r.cmd('eth.sendRawTransaction', rawHex);
  return res;
};

exports.sweep = async (args) => {
  const parsed = parser('sweep', args);
  if (parsed.coin !== 'eth') {
    return 'Can only sweep ethereum wallet';
  }
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const addresses = await getalladdress([parsed.coin]);
  const payload = { txids: [] };
  for (const addr of addresses) {
    const txid = await sendethtomaster([parsed.coin, addr]);
    if (txid !== 'Insufficient funds') {
      payload.txids.push(txid);
    }
  }
  return payload;
};
// this will send all eth balance from a specific address to the master address
const sendethtomaster = exports.sendethtomaster = async args => {
  try {
    const parsed = parser('sendethtomaster', args, 2);
    if (parsed.coin !== 'eth') {
      return 'Can only use sendethtomaster method on ethereum wallet';
    }
    if (errCodes.includes(parsed)) {
      return errMsg[parsed];
    }
    if (!await checkState(parsed.coin)) {
      return errMsg.wdr;
    }
    const [r] = rpc.connect(parsed.coin);
    const addrManager = AddrManager(parsed.coin);
    const { address } = await getmasteraddress([parsed.coin]);
    const addrFrom = parsed.params[0];
    const addrBal = await r.cmd('eth.getBalance', addrFrom);
    if (addrBal > 0) {
      const { accountId, index } = addrManager.getAddressInfo(addrFrom);
      const addrPair = addrManager.getAddressPair(accountId, index);
      return await ethsend(addrPair.address, addrPair.privkey, 'all', address, r);
    } else {
      return 'Insufficient funds';
    }
  } catch (err) {
    console.error(err.stack || err.message);
    return 'an error occured';
  }
};
const getFee = async (r) => {
  let fee;
  try {
    fee = await r.cmd('estimatesmartfee', 2);
  } catch (e) {
    fee = await r.cmd('estimatefee', 2);
  }
  return fee;
};
const createAndSend = async (coin, r, changeAddress, objTo) => {
  let fee;
  if (coin !== 'btc' && coin !== 'tbtc') {
    fee = await getFee(r);
  } else {
    fee = await estimatefee.get();
  }
  const rawHex = await r.cmd('createrawtransaction', [], objTo);
  const fundedHex = await r.cmd('fundrawtransaction', rawHex, { changeAddress, feeRate: fee });
  const signedHex = await r.cmd('signrawtransaction', fundedHex.hex);
  const res = await r.cmd('sendrawtransaction', signedHex.hex);
  return res;
};
exports.sendmany = async args => {
  try {
    const parsed = parser('sendmany', args, 2);
    if (errCodes.includes(parsed)) {
      return errMsg[parsed];
    }
    if (!await checkState(parsed.coin)) {
      return errMsg.wdr;
    }
    const objTo = parsed.params[0];
    if (!utils.isObject(objTo)) {
      return errMsg.ipf;
    }
    const totalAmt = Object.values(objTo).reduce((a, b) => a + b, 0);
    if (parsed.coin === 'eth') {
      return 'sendmany cannot be used for eth';
    }
    const [r, fam] = rpc.connect(parsed.coin);
    const { address } = await getmasteraddress([parsed.coin]);
    if (fam === 'btc') {
      const totalBalance = await r.cmd('getbalance', '', 0);
      if (typeof totalAmt === 'number' && totalBalance < totalAmt) {
        console.error(`Insufficient funds to send ${totalAmt}. Wallet only has ${totalBalance}`);
        return 'Insufficient funds';
      }
      let txid;
      if (parsed.coin !== 'doge') {
        txid = await createAndSend(parsed.coin, r, address, objTo);
      } else {
        txid = await r.cmd('sendmany', objTo);
      }
      return txid;
    }
  } catch (err) {
    console.error(err.stack || err.message);
    return 'an error occured';
  }
};

exports.send = async args => {
  try {
    const parsed = parser('send', args, 3);
    if (errCodes.includes(parsed)) {
      return errMsg[parsed];
    }
    if (!await checkState(parsed.coin)) {
      return errMsg.wdr;
    }
    const to = parsed.params[0];
    let amt = parsed.params[1];

    const [r, fam] = rpc.connect(parsed.coin);
    const { address, privkey } = await getmasteraddress([parsed.coin]);
    if (fam === 'btc') {
      const totalBalance = await r.cmd('getbalance', '', 0);
      if (typeof amt === 'number' && totalBalance < amt) {
        console.error(`Insufficient funds to send ${amt} to address ${to}. Wallet only has ${totalBalance}`);
        return 'Insufficient funds';
      }
      if (typeof amt === 'string' && amt == 'all') {
        return await r.cmd('sendtoaddress', to, totalBalance, '', '', true);
      }
      let txid;
      if (parsed.coin !== 'doge') {
        const objTo = {};
        objTo[to] = amt;
        txid = await createAndSend(parsed.coin, r, address, objTo);
      } else {
        txid = await r.cmd('sendtoaddress', to, amt);
      }
      return txid;
    } else if (fam === 'eth') {
      return await ethsend(address, privkey, amt, to, r);
    }
  } catch (err) {
    console.error(err.stack || err.message);
    return 'an error occured';
  }
};

const getnewaddress = exports.getnewaddress = async args => {
  const parsed = parser('getnewaddress', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const [r, fam] = rpc.connect(parsed.coin);
  const addrManager = AddrManager(parsed.coin);
  const { address, privkey, index } = addrManager.getNewAddress(parsed.params[0]);
  if (address && privkey) {
    if (fam == 'btc') {
      try {
        console.log('Importing to wallet', address);
        await r.cmd('importprivkey', privkey, '', false);
        const checkaddr = await r.cmd('validateaddress', address);
        if (!checkaddr.isvalid || !checkaddr.ismine) {
          console.error('Address was not imported to', this.coin, 'wallet:', address, privkey);
          return 'Internal error occured';
        }
      } catch (err) {
        console.error(err);
        return 'Internal error occured';
      }
    }
    return { address, privkey, index };
  }
  console.error('Cannot get new address pair using parameters', parsed.params[0]);
  return 'Internal error occured';
};

const getaddress = exports.getaddress = async args => {
  const parsed = parser('getaddress', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const addrManager = AddrManager(parsed.coin);

  const addrPair = addrManager.getAddress(parsed.params[0]);
  if (!addrPair) {
    return await getnewaddress(args);
  }
  return addrPair;
};
const getmasteraddress = exports.getmasteraddress = async args => {
  const addrPair = await getaddress([args[0], 0]);
  if (addrPair && typeof addrPair !== 'string') {
    state.set(`${args[0]}_address_manager`, 'up');
  } else {
    state.set(`${args[0]}_address_manager`, 'down');
  }
  return addrPair;
};
exports.getaccount = async args => {
  const parsed = parser('getaccount', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const addrManager = AddrManager(parsed.coin);
  return addrManager.getAccount(parsed.params[0]);
};
const getalladdress = exports.getalladdress = async args => {
  const parsed = parser('getalladdress', args);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  const addrManager = AddrManager(parsed.coin);
  const addrArr = addrManager.getAllAddress(parsed.params[0]);
  // return all addresses except master address
  addrArr.shift();
  return addrArr;
};
exports.getseed = args => {
  const parsed = parser('getseed', args, 0);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  return config.get('seed');
};
exports.validateaddress = async args => {
  const parsed = parser('validateaddress', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  let addressArr = parsed.params[0];
  if (!Array.isArray(addressArr)) {
    addressArr = addressArr.split(',').map(e => e.trim());
  }
  const addrManager = AddrManager(parsed.coin);
  const [r, fam] = rpc.connect(parsed.coin);
  const addressInDb = addrManager.validateAddress(addressArr);
  const payload = [];
  let checkaddr;
  if (fam === 'btc') {
    checkaddr = await Promise.map(addressArr, addr => r.cmd('validateaddress', addr));
    for (const addrObj of checkaddr) {
      payload.push({
        address: addrObj.address,
        indb: addressInDb.includes(addrObj.address),
        isvalid: addrObj.isvalid,
        ismine: addrObj.ismine
      });
    }
  } else if (fam === 'eth') {
    checkaddr = await Promise.map(addressArr, addr => ({
      address: addr,
      isvalid: r.web3.utils.isAddress(addr)
    }));
    for (const addrObj of checkaddr) {
      const indb = addressInDb.includes(addrObj.address);
      payload.push({
        address: addrObj.isvalid ? addrObj.address : undefined,
        indb,
        isvalid: addrObj.isvalid,
        ismine: addrObj.isvalid ? indb : undefined
      });
    }
  }

  return payload;
};
exports.listtransactions = async args => {
  const parsed = parser('gettxoutputs', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  let txinfo = [];
  // if coin is eth, the count is considered the last 10 blocks.
  const count = parsed.params[0];
  const [r, fam] = rpc.connect(parsed.coin);
  const addrManager = AddrManager(parsed.coin);
  if (fam == 'btc') {
    try {
      txinfo = await r.cmd('listtransactions', '*', count);
      txinfo = txinfo.filter((tx) => tx.category == 'receive');
      txinfo = txinfo.map(tx => ({
        address: tx.address,
        txid: tx.txid,
        confirmation: tx.confirmations,
        vout: tx.vout,
        amount: tx.amount
      }));
    } catch (err) {
      console.error(err.stack || err.message);
      return false;
    }
  } else if (fam == 'eth') {
    const blockdb = blockDb('/ethblocks');
    const currblock = blockdb.get();
    try {
      let txblk = await r.cmd('eth.getBlock', currblock - count, true);
      txblk = txblk.transactions.filter(txs => {
        if (txs.to) {
          return addrManager.getAddressInfo(txs.to);
        }
      });
      if (txblk.length > 0) {
        for (const ethtx of txblk) {
          txinfo.push({
            confirmation: ethtx.blockNumber == null ? 0 : 1,
            txid: ethtx.hash,
            address: ethtx.to,
            amount: Number.parseFloat(r.fromWei(ethtx.value.toString(10), 'ether')).toFixed(8)
          });
        }
      }
    } catch (err) {
      console.error(err.stack || err.message);
      return false;
    }
  }
  return txinfo;
};
exports.gettxoutputs = async args => {
  const parsed = parser('gettxoutputs', args, 2);
  if (errCodes.includes(parsed)) {
    return errMsg[parsed];
  }
  if (!await checkState(parsed.coin)) {
    return errMsg.wdr;
  }
  let txinfo;
  const txid = parsed.params[0];
  const [r, fam] = rpc.connect(parsed.coin);
  if (fam == 'btc') {
    try {
      const btctx = await r.cmd('gettransaction', txid);
      txinfo = btctx.details.map(tx => {
        if (tx.category === 'receive') {
          return {
            address: tx.address,
            txid: btctx.txid,
            confirmation: btctx.confirmations,
            vout: tx.vout,
            amount: tx.amount
          };
        }
      });
    } catch (err) {
      console.error(err);
      return 'Invalid or non-wallet transaction id';
    }
  } else if (fam == 'eth') {
    const ethtx = await r.cmd('eth.getTransaction', txid);
    txinfo = [{
      confirmation: ethtx.blockNumber == null ? 0 : 1,
      txid: ethtx.hash,
      address: ethtx.to,
      amount: Number.parseFloat(r.fromWei(ethtx.value.toString(10), 'ether')).toFixed(8)
    }];
  }

  return txinfo.filter(v => v);
};
