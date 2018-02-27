const codes = {
  'mp': 'Missing parameters',
  'ipf': 'Invalid parameter format',
  'wnf': 'Wallet not found',
  'wdr': 'Wallet is either down or not yet ready'
};

module.exports = {
  errMsg: codes,
  errCodes: Object.keys(codes)
};
