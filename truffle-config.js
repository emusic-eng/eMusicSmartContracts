let HDWalletProvider = require("truffle-hdwallet-provider");

let mnemonic = "not a twelve word mnemonic here thank you oh so very much";
module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*" // Match any network id
        },
        ropsten: {
            provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/aQK0KBNfugHWR6hSgBD5"),
            network_id: 3
        }
    }
};