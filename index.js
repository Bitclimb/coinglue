require('app-module-path/register');
require('dotenv').config();
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
const schedule = require('node-schedule');
const logtar = require('src/lib/logtar');
if (!process.env.CGDIR) {
  console.error('Please start the wallet service via "coinglue start" command.');
  process.exit();
}
process.title = 'coinglue';

const j = schedule.scheduleJob('* * * * *', () => {
  if (global.gc) {
    console.log('Running garbage collection');
    global.gc();
  } else {
    j.cancel();
  }
});

const logrotate = schedule.scheduleJob('0 */12 * * *', async () => {
  try {
    await logtar();
  } catch (err) {
    console.error(err.stack || err.message);
    logrotate.cancel();
  }
});
require('src/app').start().then(() => {}).catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
