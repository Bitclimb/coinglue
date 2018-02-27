const needle = require('needle');

exports.get = async () => {
  try {
    let getfee = await needle('get', 'https://bitcoinfees.earn.com/api/v1/fees/recommended');
    getfee = getfee.body;

    return getfee.fastestFee / 100000;
  } catch (err) {
    console.error(err.stack || err.message);
    return false;
  }
};
