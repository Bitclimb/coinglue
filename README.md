# CoinGlue (coinglue)

A multi-crypto currency framework that glues btc, btc-like and eth wallets together for a centralized api.

## Features
- Uses its own simple Address database using LMDB
- Be able to listen for new block on ethereum network
- Bip39 mnemonic seed creation
- Hook implementation for walletnotify for bitcoind-like wallets
- Optional security for RPC calls
- Uses JSON-RPC 2 protocol
TODO add the rest of the features...

## Installation
(Must be root)
- Fork this repository then, `npm install` then run the following command `sudo npm link`

## coinglue usage
- Usage help type `coinglue --help`
```
  Usage: coinglue <actions> [options]


  Options:

    -V, --version  output the version number
    -h, --help     output usage information


  Commands:

    start [options]  starts the wallet service,use --debug for debugging mode
    stop|kill        stops the wallet service
    clear|reset      clears all configurations,seeds,and database. Dangerous! Use with care!
    add              add a new coin
    remove           remove a coin
    hook             add/replace hook config
    list             list all added coins
    restart|reload   restarts/reloads the wallet service
    logs             prints out the wallet service logs
    status           display the status of the wallet service
```

## coincli usage
- Usage help type `coincli --help`
```
  Usage: coincli <method> <parameters>


  Options:

    -V, --version  output the version number
    -h, --help     output usage information

  Methods:
    getwalletinfo
    getinfo
    getbalance
    sweep
    sendethtomaster
    sendmany
    send
    getnewaddress
    getaddress
    getmasteraddress
    getaccount
    getalladdress
    getseed
    validateaddress
    gettxoutputs

  Parameters:
    -Atleast 1 paramater is required which is the currency/coin symbol

  Example:
    $ coincli getinfo btc
    $ coincli getaccount eth 4
```

## Walltenotify Integration
On your bitcoin.conf add this line:
`walletnotify=coinhook %s tbtc yourPersonalHookSecret`

## Api usage
- Send a POST request using the format below as its body
`{"method":"getinfo","params":["tbtc"],"id":"test","jsonrpc":"2.0"}`
- If rpc is secured, you must add a Authroization header
`Authorization: Token YourAuthorizationToken`
- The Token is the Hmac-sha256 of your rpc username and password (this is different from the rpcuser and rpcpass on bitcoin.conf)

## NOTE
- Always back up your seed!