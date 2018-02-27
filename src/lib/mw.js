const util = require('util');
const IpBan = require('src/services/ipBanDb');
const ipban = IpBan();
let requestCounter = 0;
exports.logger = () => async (ctx, next) => {
  const requestId = requestCounter++;
  const remoteAddress = ctx.request.socket.remoteAddress;
  const ip = ctx.request.ip;
  const method = ctx.method;
  const start = new Date();
  console.log(util.format('-> RPC request id=%s remoteip=%s ip=%s method=%s ', requestId, remoteAddress, ip, method));
  const isban = ipban.get('ipban', ip);
  if (isban) {
    ctx.throw(403, 'Forbidden');
  }
  await next();
  if (ctx.body.error && ctx.body.error.message == 'Unauthorized') {
    let instore = ipban.get('ipstore', ip);
    instore = instore === null ? 0 : instore;
    if (instore == 2) {
      ipban.set('ipban', ip, 1);
    } else {
      ipban.set('ipstore', ip, instore + 1);
    }
  }
  console.log(util.format('<- RPC response id=%s status=%s %s %sms', requestId, ctx.status, ctx.body.error ? ctx.body.error.message : '', start - new Date()));
};
