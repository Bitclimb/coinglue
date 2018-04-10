const schedule = require('node-schedule');
const db = require('src/db');
const rcon = require('src/rpc/connect');
const [r] = rcon.connect('eth');
const Promise = require('bluebird');

module.exports = async () => {
  let addresses = await db.getAllAddressByCoin('eth');

  addresses = await Promise.filter(addresses, async addr => {
    const bal = await r.cmd('eth.getBalance', addr);
    console.log(bal);
    return bal > 0;
  });

  return addresses;
};
