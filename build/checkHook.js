const readlineSync = require('readline-sync');
const fs = require('fs-extra');
const hookpath = `${process.env.CGDIR}/src/config/general/hook.js`;

const _setHook = exports.setHook = async () => {
  const hookhost = readlineSync.question('Enter the api hook full url: ');
  const hookpw = readlineSync.question('Enter the api hook secret/password: ', { hideEchoBack: true });
  fs.writeFileSync(hookpath, `module.exports = {host:'${hookhost}',pass:'${hookpw}'}`);
  return true;
};

exports.check = async () => {
  if (!await fs.pathExists(hookpath)) {
    if (readlineSync.keyInYN('Would you like to setup an api hook for tx notifications?')) {
      return await _setHook();
    }
  }
  return true;
};
