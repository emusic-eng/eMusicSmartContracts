# eMusic's smart contracts
At the moment, we can only publish the EMU token's smart contract. In the future this repository will include content, sale and other smart contracts.

## Possible dependencies
- If on Windows, open a powershell window as administrator and run ``npm install -g windows-build-tools``
- Run ``npm install -g solc``

## To generate a Java Solidity smart contract wrapper
* Get the web3j command line tools (https://docs.web3j.io/command_line.html)
* Add web3 to the path by running ``set PATH=%PATH%;web3j-3.5.0\bin``
* Run ``web3j solidity generate --javaTypes output\___contracts_EMU_sol_EMU.bin output\___contracts_EMU_sol_EMU.abi -o output-java -p com.triplay.crypto.contract``
* Look in the output-java directory