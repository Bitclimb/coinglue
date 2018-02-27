require('app-module-path/register');
const chalk = require('chalk');
const colors = {
  stamp: 'cyan',
  label (l) {
    if (l === '[LOG]') {
      return chalk.green(l);
    } else {
      return chalk.redBright(l);
    }
  }
};
require('console-stamp')(console, { pattern: 'mm-dd-yyyy HH:MM:ss', colors });
if (!process.env.CGDIR) {
  console.error('Please start the wallet service via "coinglue start" command.');
  process.exit();
}
process.title = 'coinglue';

require('src/app').start().then(() => {}).catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
