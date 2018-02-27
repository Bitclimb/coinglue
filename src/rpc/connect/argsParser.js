module.exports = (apiname, args, count = 1) => {
  console.log(`${apiname} method has been called`);
  if (!Array.isArray(args)) {
    return 'ipf';
  }
  if (args.length < count) {
    return 'mp';
  }
  const coin = args[0];
  const params = args.slice(1, args.length);
  return { coin, params };
};
