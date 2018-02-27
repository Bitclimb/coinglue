const crypto = require('crypto');
exports.isObject = o => {
  if (typeof o !== 'object' || Array.isArray(o)) {
    return false;
  }
  const isObj = Object.prototype.toString.call({}).split(' ').pop().slice(0, -1);
  if (isObj === 'Object') {
    return true;
  }
  return false;
};
exports.encrypt = (mnemonic, pw) => {
  pw = crypto.createHash('sha256').update(pw).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.Cipheriv('aes-256-cbc', pw, iv);
  let encrypted = cipher.update(mnemonic, 'utf8', 'binary');
  encrypted += cipher.final('binary');
  return { data: Buffer.from(encrypted, 'binary').toString('base64'), iv: iv.toString('base64') };
};
exports.decrypt = (pw, iv, encrypted) => {
  try {
    pw = crypto.createHash('sha256').update(pw).digest();
    encrypted = Buffer.from(encrypted, 'base64').toString('binary');
    iv = Buffer.from(iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', pw, iv);
    let decrypted = decipher.update(encrypted, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return false;
  }
};
