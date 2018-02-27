const Koa = require('koa');
const config = require('./config');
const apirpc = require('./rpc');
const port = config.get('PORT');
let host = config.get('HOST');
const listenOpts = [port];
const app = new Koa();

const rpcopts = {
  limit: '1mb'
};
if (process.env.RPCUSER && process.env.RPCPW) {
  rpcopts.auth = {
    username: process.env.RPCUSER,
    password: process.env.RPCPW
  };
  delete process.env.RPCUSER;
  delete process.env.RPCPW;
} else {
  listenOpts.push(host);
}

const jsonrpc = require('koa-jsonrpc')(rpcopts);

app.use(require('src/lib/mw').logger());
for (const [k, v] of Object.entries(apirpc)) {
  jsonrpc.use(k, v);
}
app.use(jsonrpc.app());

app.start = async () => {
  await require('./init')(rpcopts);
  app.listen(...listenOpts, async () => {
    let msg1 = `Coinglue is up: rpc: ${host}:${port} and using process id: ${process.pid}`;
    console.log(msg1);
    if (process.send) {
      process.send([0, msg1]);
    }
    await require('./services/ethblockManager')();
  });
};

module.exports = app;
