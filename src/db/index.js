const pgLazy = require('pg-lazy');
const PGCONNECTIONTIMEOUTMILLIS = parseInt(process.env.PGCONNECTIONTIMEOUTMILLIS);
const PGIDLETIMEOUTMILLIS = parseInt(process.env.PGIDLETIMEOUTMILLIS);
const PGMAX = parseInt(process.env.PGMAX);
const assert = require('assert');
const { pool, sql } = pgLazy(require('pg'), null, { connectionTimeoutMillis: PGCONNECTIONTIMEOUTMILLIS, idleTimeoutMillis: PGIDLETIMEOUTMILLIS, max: PGMAX });

const parseCurrency = currency => {
  assert(currency);
  currency = currency.toUpperCase();
  return currency == 'TBTC' ? 'TEST' : currency;
};

exports.getAccAddrIndex = async (accid, currency) => {
  assert(accid !== undefined);
  accid = parseInt(accid);
  currency = parseCurrency(currency);
  const response = await pool.one(sql`
    SELECT address_index AS lastIndex FROM addresses_view WHERE user_id = ${accid} AND currency = ${currency} ORDER BY address_index DESC LIMIT 1;
    `);
  return response === undefined ? { lastIndex: null } : { lastIndex: response.lastindex };
};

exports.getAllAddressByCoin = async currency => {
  currency = parseCurrency(currency);
  const addresses = await pool.many(sql`
    SELECT address FROM addresses_view WHERE currency = ${currency};
    `);
  return addresses !== undefined ? addresses.map(x => x.address) : addresses;
};

exports.getAddrInfoByCoin = async (address, currency) => {
  currency = parseCurrency(currency);
  const response = await pool.on(sql`SELECT user_id AS accountId, address_index AS index FROM addresses_view WHERE address = ${address} AND currency = ${currency}`);
  return { accountId: response.accountid, index: response.index };
};

exports.addressesExists = async (addresses, currency) => {
  assert(Array.isArray(addresses));
  currency = parseCurrency(currency);
  const addr = await pool.many(sql`SELECT address FROM addresses_view WHERE address = ANY (${addresses}) AND currency = ${currency}`);
  return addr !== undefined ? addr.map(x => x.address) : addr;
};

exports.getAccountAddresses = async (accid, currency, limit = 10) => {
  currency = parseCurrency(currency);
  return pool.many(sql`SELECT address, address_index AS index FROM addresses_view WHERE user_id = ${accid} AND currency = ${currency} ORDER BY address_index DESC LIMIT ${limit}`);
};
