const fs = require('fs-extra');
const util = require('util');
const execFile = util.promisify(require('child_process').execFile);

async function getPidFromProc (pname) {
  try {
    const pid = await execFile('pidof', [pname]);
    return parseInt(pid.stdout);
  } catch (err) {
    return false;
  }
}
async function getPidFromTmp (pname) {
  try {
    const pid = await fs.readFile(`/tmp/${pname}.pid`);
    return parseInt(pid);
  } catch (err) {
    return false;
  }
}

async function processChecker (pname) {
  try {
    const pidProc = await getPidFromProc(pname);
    const pidTmp = await getPidFromTmp(pname);
    if (pidProc && pidTmp && pidProc == pidTmp) {
      return pidTmp;
    }
    if (pidProc && !pidTmp) {
      await fs.outputFile(`/tmp/${pname}.pid`, pidProc);
      return processChecker(pname);
    }
    if (!pidProc && pidTmp) {
      await fs.remove(`/tmp/${pname}.pid`);
      return processChecker(pname);
    }
  } catch (err) {
    return false;
  }
}

module.exports = async pname => await processChecker(pname);
