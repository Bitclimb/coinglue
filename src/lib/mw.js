const util = require('util');
const ipbans = new Map();
let requestCounter = 0;
exports.logger = () => async (ctx, next) => {
  const requestId = requestCounter++;
  const remoteAddress = ctx.request.socket.remoteAddress;
  const ip = ctx.request.ip;
  const method = ctx.method;
  const start = new Date();
  console.log(util.format('-> RPC request id=%s remoteip=%s ip=%s method=%s ', requestId, remoteAddress, ip, method));
  const ipb = ipbans.get(ip);
  if (ipbans.get(ip) >= 3) {
    ctx.throw(403, 'Forbidden');
  }
  await next();
  if (ctx.body.error && ctx.body.error.message == 'Unauthorized') {
    ipbans.set(ip, ipb === undefined ? 1 : ipb + 1);
  }
  console.log(util.format('<- RPC response id=%s status=%s %s %sms', requestId, ctx.status, ctx.body.error ? ctx.body.error.message : '', start - new Date()));
};
