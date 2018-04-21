require('bitclimb-error').catch();
require('app-module-path/register');
require('dotenv').config();
require('src/lib/logger')(console);
const schedule = require('node-schedule');

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

require('src/app').start().then(() => {}).catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
