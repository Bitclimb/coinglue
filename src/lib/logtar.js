const util = require('util');
const dir = require('node-dir');
const execFile = util.promisify(require('child_process').execFile);
const fs = require('fs-extra');

function formatDate (d) {
  if (d instanceof Date == false) {
    return d;
  }
  const t = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toJSON();
  return t.split('.').shift().replace(/:/g, '-');
}
module.exports = () => {
  return new Promise((resolve, reject) => {
    const regex = /.*\.tar\.gz$/;
    dir.files('/var/log/coinglue/', 'file', async (err, files) => {
      if (err) return reject(err);
      files = files.filter(f => !regex.test(f));
      if (files.length) {
        let opts = ['-czf', `coinglue_${formatDate(new Date())}.tar.gz`];
        opts = opts.concat(files);
        const tarresp = await execFile('tar', opts, { cwd: '/var/log/coinglue' });
        if (tarresp.stderr) {
          console.error(tarresp.stderr);
        }

        files = files.filter(fn => !['coinglue.err', 'coinglue.log'].includes(fn));
        if (files.length) {
          opts = ['-rf'];
          opts = opts.concat(files);
          const rmresp = await execFile('rm', opts, { cwd: '/var/log/coinglue' });
          if (rmresp.stderr) {
            console.error(rmresp.stderr);
          }
        }
        await fs.outputFile('/var/log/coinglue/coinglue.err', '');
        await fs.outputFile('/var/log/coinglue/coinglue.log', '');
      }
      resolve();
    }, { shortName: true });
  });
};
