const readlineSync = require('readline-sync');
const fs = require('fs-extra');
const rpcpath = `${process.env.CGDIR}/src/config/general/rpc.js`;

const _setRpc = exports.setRpc = async () => {
  const rpcuser = readlineSync.question('Enter your desired rpc username: ');
  const rpcpass = readlineSync.question('Enter your desired rpc password: ');
  await fs.outputFile(rpcpath, `module.exports = {rpcuser:'${rpcuser}',rpcpass:'${rpcpass}'}`);
  process.stdout.write('\x1B[2J\x1B[0f');
  return true;
};
exports.check = async () => {
  if (!await fs.pathExists(rpcpath)) {
    if (readlineSync.keyInYN('Would you like to secure the rpc connection?')) {
      return await _setRpc();
    }
  }
  return true;
};
