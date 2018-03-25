const fs = require('fs-extra');
const crypto = require('crypto');
const config = require('src/config');
const coins = config.get('coins');
const rpcCon = require('src/rpc/connect');
const rpc = require('src/rpc');

const state = require('src/lib/state');

const sendToParent = (code, msg) => {
  if (process.send) {
    process.send([code, msg]);
  }
};
module.exports = async (rpcopts) => {
  if (config._isEncrypted() && !process.env.CGSEED) {
    console.error('Missing seed, make sure you entered the correct master password');
    process.exit();
  } else if (config._isEncrypted() && process.env.CGSEED) {
    config._setSeed(process.env.CGSEED);
    delete process.env.CGSEED;
  }

  for (const c of Object.keys(coins)) {
    console.log(`Checking ${c} rpc connection...`);
    sendToParent(1, `Checking ${c} rpc connection...`);
    const [connection] = rpcCon.connect(c);

    const isErr = await connection._updateState();

    if (isErr) {
      console.error(isErr);
      sendToParent(2, isErr);
    }
    const rsp = await rpc.getmasteraddress([c]);

    if (typeof rsp === 'string') {
      console.error(rsp);
      sendToParent(2, rsp);
    }
  }

  const allState = state.getAll();
  console.log('Checking services states...');
  sendToParent(1, 'Checking services states...');
  for (const [service, status] of Object.entries(allState)) {
    if (status === 'down') {
      console.error(service, 'service is', status);
      sendToParent(2, `${service} service is ${status}`);
    } else {
      console.log(service, 'service is', status);
      sendToParent(1, `${service} service is ${status}`);
    }
  }
  const rpcCmds = {
    uri: `http://${config.get('HOST')}:${config.get('PORT')}`,
    methods: Object.keys(rpc)
  };
  if (rpcopts.auth) {
    if (rpcopts.auth.username && rpcopts.auth.password) {
      rpcCmds.token = crypto.createHmac('sha256', rpcopts.auth.password).update(rpcopts.auth.username).digest('hex');
    }
  }

  await fs.outputFile(`${process.env.CGDIR}/rpc.json`, JSON.stringify(rpcCmds, null, 2));
};
