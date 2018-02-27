const coinjs = require('coinjs-lib');
const fs = require('fs');
const readlineSync = require('readline-sync');
const config = require('src/config');
const { encrypt, decrypt } = require('src/lib/utils');
const env = config.get('NODE_ENV') === 'production' ? 'prod' : 'dev';

function genMnemonic (choice) {
  let mnemonicseed;
  if (choice === 'Generate Bip39 Seed') {
    mnemonicseed = coinjs.bip39.generateMnemonic();
  } else {
    mnemonicseed = readlineSync.question('Enter a bip39 compatible seed separated by spaces: ');
  }
  if (!coinjs.bip39.validateMnemonic(mnemonicseed)) {
    if (choice !== 'Generate Bip39 Seed') {
      console.error('You have entered an invalid bip39 mnemonic seed, please try again or ctrl+c to cancel');
    }
    return genMnemonic(choice);
  } else {
    return mnemonicseed;
  }
}

function enterPw () {
  const password = readlineSync.question('Enter a password: ', { hideEchoBack: true });
  const password2 = readlineSync.question('Confirm your password: ', { hideEchoBack: true });
  if (password !== password2) {
    if (readlineSync.keyInYN('Password does not match! Would you like to try again?')) {
      return enterPw();
    } else {
      process.exit(0);
    }
  }
  return password;
}

function startGenSeed () {
  let payload;
  process.stdout.write('\x1B[2J\x1B[0f');
  console.info(`Oops! it seems like you are missing your ${env == 'dev' ? 'development' : 'production'} mnemonic seed on src/config/${env}/seed.js`);
  if (readlineSync.keyInYN('Would you like to continue?')) {
    const genchoice = ['Generate Bip39 Seed', 'Enter your own'];
    const gindex = readlineSync.keyInSelect(genchoice, 'Would you like to generate a bip39 compatible seed or enter your own?');
    const mnemonic = genMnemonic(genchoice[gindex]);
    process.stdout.write('\x1B[2J\x1B[0f');
    console.info();
    console.info('====================================================================');
    console.info();
    console.info(mnemonic);
    console.info();
    console.info('====================================================================');
    console.info('WARNING: PLEASE WRITE DOWN AND BACK UP YOUR SEED!!!');
    console.info();
    readlineSync.keyInPause('Press any key(except enter) to continue. The console will be cleared after.');
    process.stdout.write('\x1B[2J\x1B[0f');
    let masterpw;
    if (readlineSync.keyInYN('Would you like to encrypt your seed with a password?')) {
      console.info();
      console.info('WARNING: There is no way to recover your wallet seed if you lose your password!');
      console.info();
      masterpw = enterPw();
      if (readlineSync.keyInYN('This wallet will ask for your password every application start, Would you like to continue?')) {
        const encrypted = encrypt(mnemonic, masterpw);
        payload = `module.exports = {data:'${encrypted.data}',iv:'${encrypted.iv}'}`;
      } else {
        process.exit(0);
      }
    } else {
      payload = `module.exports = '${mnemonic}'`;
    }
    const seedpath = `${process.env.CGDIR}/src/config/${env}/seed.js`;
    fs.writeFileSync(seedpath, payload);
    console.info(`Seed generation complete! Your seed is stored on src/config/${env}/seed.js`);
    readlineSync.keyInPause('Restart the wallet service by running "coinglue start" again');
    process.exit(0);
  } else {
    process.exit(0);
  }
}

module.exports = () => {
  console.log('Checking seed config...');
  const currseed = config.get('seed');
  if (!currseed) {
    startGenSeed();
  }
  console.log('Checking seed encryption...');
  if (config._isEncrypted()) {
    const CGSEEDPW = readlineSync.question('Enter your master seed password: ', { hideEchoBack: true });

    process.env.CGSEED = decrypt(CGSEEDPW, currseed.iv, currseed.data);
    if (!process.env.CGSEED || !coinjs.bip39.validateMnemonic(process.env.CGSEED)) {
      console.error('Invalid master password');
      process.exit(0);
    }
  }
  process.env.CGPASS = 'pass';
  return true;
};
