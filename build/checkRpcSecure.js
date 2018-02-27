const readlineSync = require('readline-sync');

module.exports = () => {
  if (readlineSync.keyInYN('Would you like to secure the rpc connection?')) {
    process.env.RPCUSER = readlineSync.question('Enter your desired rpc username: ');
    process.env.RPCPW = readlineSync.question('Enter your desired rpc password: ');
  }
  process.stdout.write('\x1B[2J\x1B[0f');
};
