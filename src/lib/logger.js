const { Console } = require('console');
const tar = require('tar');
const dateFormat = require('dateformat');
const { socket } = require('bitclimb-ipc');
const chalk = require('chalk');
const sock = socket('pub');

const path = require('path');
const fs = require('fs');
const levels = ['log', 'info', 'warn', 'error'];

const sockpath = path.resolve('/tmp/coinglue_log.sock');
const logDir = path.resolve('/var/log/coinglue');
const debugFile = path.join(logDir, 'debug.log');
const errorFile = path.join(logDir, 'error.log');

const cleanSock = () => {
  try {
    if (fs.existsSync(sockpath)) {
      fs.unlinkSync(sockpath);
    }
  } catch (e) {
    console.error(e);
  }
};

const archiveLog = (files) => {
  if (!files.length) return;
  const now = new Date();
  tar.c({
    gzip: true,
    file: path.join(logDir, `debug-error.log-${dateFormat(now, 'mmddyy-HHMMss')}.tgz`)
  }, files).then().catch(console.error);
};

const checkExisting = () => {
  let files = [debugFile, errorFile];
  files = files.filter(f => fs.existsSync(f));
  archiveLog(files);
};
const stringify = obj => {
  let str = '';
  for (const [k, v] of Object.entries(obj)) {
    str += `"${k}": "${v}", `;
  }
  str = str.substr(0, str.length - 2);
  return `{ ${str} }`;
};
const colorizeLvl = lvl => {
  const error = chalk.bold.red;
  const log = chalk.greenBright;
  const info = chalk.magentaBright;
  if (['trace', 'error', 'warn'].includes(lvl)) {
    return error(lvl.toUpperCase());
  } else if (lvl == 'info') {
    return info(lvl.toUpperCase());
  }
  return log(lvl.toUpperCase());
};
const msgFormat = (lvl, msg, colors, local) => {
  msg = msg.join(' ');
  let ts = dateFormat(new Date(), 'mmm|dd|yy-hh:MM:ss:TT');
  if (colors) {
    ts = chalk.cyanBright(ts);
    msg = chalk.yellowBright(msg);
    lvl = colorizeLvl(lvl);
  }
  if (local) {
    return [`[${ts}][${lvl}]: ${msg}`];
  }

  return [stringify({ ts, lvl, msg })];
};
module.exports = (con, colors = false, local = false) => {
  if (!local) {
    checkExisting();
    cleanSock();
    sock.bind(sockpath, err => {
      if (err) throw new Error(err);
      try {
        fs.chmodSync(sockpath, 0o777);
      } catch (err) {}
    });
    const debugStream = fs.createWriteStream(debugFile, { flags: 'a' });
    const errorStream = fs.createWriteStream(errorFile, { flags: 'a' });
    const logger = new Console(debugStream, errorStream);

    levels.forEach(o => {
      con[o] = (...args) => {
        const msg = msgFormat(o, args, colors, local);
        sock.send(o, ...msg);
        return logger[o].apply(con, msg);
      };
    });
  } else {
    levels.forEach(o => {
      const orig = con[o];
      con[o] = (...args) => {
        const msg = msgFormat(o, args, colors, local);
        return orig.apply(con, msg);
      };
    });
  }
};
