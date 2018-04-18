const { socket } = require('bitclimb-ipc');
const sock = socket('sub');
const coinblock = require('./coinblock');
const coinhook = require('./coinhook');
const path = require('path');
const fs = require('fs');
const sockpath = path.resolve('/tmp/coinglue.sock');

const cleanSock = () => new Promise((resolve, reject) => {
  try {
    if (fs.existsSync(sockpath)) {
      fs.unlinkSync(sockpath);
    }
  } catch (e) {
    reject(e);
  }
  resolve();
});

const parseData = (txobj) => {
  try {
    txobj = txobj.toString();
    txobj = JSON.parse(txobj);
    console.log('Received IPC message:', JSON.stringify(txobj));
    if (!txobj.type || !txobj.coin || !txobj.secret) {
      console.log('Missing paramters', `type: ${txobj.type || 'missing'} coin: ${txobj.coin || 'missing'} ${!txobj.secret ? 'secret: missing' : ''}`);
      return false;
    }
    if (txobj.type == 'block') {
      if (!txobj.hash) {
        console.error('Block hash missing');
        return false;
      }
      console.log('Received blocknotify from', txobj.coin);
      coinblock.scanblock(txobj.hash, txobj.coin, txobj.secret).then(() => {
        console.log('Successfully processed block notification from', txobj.coin);
      }).catch(err => {
        console.error('Received an error while processing block for', txobj.coin, err.message);
      });
    } else if (txobj.type == 'wallet') {
      if (!txobj.trx) {
        console.error('Transaction hash missing');
        return false;
      }
      console.log('Received walletnotify from', txobj.coin);
      coinhook.hook(txobj.trx, txobj.coin, txobj.secret).then(() => {
        console.log('Successfully processed wallet notification from', txobj.coin);
      }).catch(err => {
        console.error('Received an error while processing transaction for', txobj.coin, err.message);
      });
    } else {
      console.error('Invalid type of IPC message');
      return false;
    }
  } catch (e) {
    console.error('Received an invalid IPC data', e);
  }
};

const onReady = () => {
  console.log('IPC Channel now listening at', sockpath);
  sock.on('connect', (client) => {
    client.on('data', data => {
      client.end();
      client.destroy();
      parseData(data);
    });
  });
};

const errorHandler = err => {
  if (err) {
    console.error('Received an error while biding to IPC channel', err.message || err);
    console.log('Retrying in 10 seconds...');
    sock.close();
    setTimeout(listen, 10000);
  }
};

exports.shutdown = () => {
  sock.close();
};

const listen = exports.listen = async () => {
  const connect = async () => {
    await cleanSock();
    console.log('Starting IPC Channel at', sockpath);
    sock.bind(sockpath, errorHandler).on('ready', onReady);
    sock.on('error', errorHandler);
  };
  connect().catch(errorHandler);
};
