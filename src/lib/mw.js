const util = require('util');
let requestCounter = 0;
exports.logger = () => async (ctx, next) => {
  const requestId = requestCounter++;
  const remoteAddress = ctx.request.socket.remoteAddress;
  const ip = ctx.request.ip;
  const method = ctx.method;
  const start = new Date();
  console.log(util.format('-> RPC request id=%s remoteip=%s ip=%s method=%s ', requestId, remoteAddress, ip, method));
  await next();
  console.log(util.format('<- RPC response id=%s status=%s %sms', requestId, ctx.status, start - new Date()));
};
