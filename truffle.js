let HDWalletProvider = require("truffle-hdwallet-provider");

let mnemonic = "your mnemonic here";
module.exports = {
    // See <http://truffleframework.com/docs/advanced/configuration>
    // for more about customizing your Truffle configuration!
    networks: {
        development: {
            host: "127.0.0.1",
            port: 7545,
            network_id: "*"
        },
        ropsten: {
            provider: new HDWalletProvider(mnemonic, "http://ropsten.testnet.server.com/"),
            network_id: 3
        }
    }
};
