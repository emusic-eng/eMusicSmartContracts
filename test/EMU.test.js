const {dateify} = require("./helpers/dateUtils");
const {time, expect, BN} = require('openzeppelin-test-helpers/openzeppelin-test-helpers');
const {assert} = require('chai');
const BigNumber = BN;
const EmuToken = artifacts.require('EMU');
const debug = false;

// TODO: add test for doesn't let non-owner to read allowedSenderAddress
// TODO: change 'recipient' to 'user wallet 1' where appropriate
async function expectThrow(promise, message) {
    try {
        await promise;
    } catch (error) {
        // Message is an optional parameter here
        if (message) {
            assert(
                error.message.search(message) >= 0,
                'Expected \'' + message + '\', got \'' + error + '\' instead',
            );
            return;
        } else {
            // TODO: Check jump destination to destinguish between a throw
            //       and an actual invalid jump.
            const invalidOpcode = error.message.search('invalid opcode') >= 0;
            // TODO: When we contract A calls contract B, and B throws, instead
            //       of an 'invalid jump', we get an 'out of gas' error. How do
            //       we distinguish this from an actual out of gas event? (The
            //       ganache log actually show an 'invalid jump' event.)
            const outOfGas = error.message.search('out of gas') >= 0;
            const revert = error.message.search('revert') >= 0;
            assert(
                invalidOpcode || outOfGas || revert,
                'Expected throw, got \'' + error + '\' instead',
            );
            return;
        }
    }
    assert.fail('Expected throw not received');
}

contract('EMU', function ([_, owner, recipient, unlockedWallet, spender, allowedReceiverAddress, nonAllowedReceiverAddress, allowedSenderAddress]) {
    const amount = new BigNumber(100);

    beforeEach(async () => {
        if (debug) console.log("");
        this.token = await EmuToken.new({from: owner});
        if (debug) {
            let latestTimeOnBlockchain = dateify(await time.latest(), debug);
            console.log("latestTimeOnBlockchain: " + latestTimeOnBlockchain);
            let now = Math.trunc(Date.now() / 1000);
            if (latestTimeOnBlockchain.getTime() < now - 1000 * 60 * 60 * 12) {
                console.log("Blockchain lagging by more than an hour");
                console.log("Increasing time to now");
                await time.increaseTo(now);
                latestTimeOnBlockchain = dateify(await time.latest(), debug);
                console.log("latestTimeOnBlockchain: " + latestTimeOnBlockchain);
            }
        }
    });

    describe("non-owner permission checks", async () => {
        it("doesn't let non-owner add allowedReceiverAddress", async () => {
            await expectThrow(this.token.addAllowedReceiverAddress(allowedReceiverAddress, {from: recipient}));
        });

        it("doesn't let non-owner remove allowedReceiverAddress", async () => {
            await expectThrow(this.token.removeAllowedReceiverAddress(allowedReceiverAddress, {from: recipient}));
        });

        it("doesn't let non-owner add allowedSenderAddress", async () => {
            await expectThrow(this.token.addAllowedSenderAddress(allowedSenderAddress, {from: recipient}));
        });

        it("doesn't let non-owner remove allowedSenderAddress", async () => {
            await expectThrow(this.token.removeAllowedSenderAddress(allowedSenderAddress, {from: recipient}));
        });

        it("doesn't let non-owner to stop locking transfers", async () => {
            await expectThrow(this.token.stopLockingTransfers({from: recipient}));
        });

        it("doesn't let non-owner to update unlockDate", async () => {
            await expectThrow(this.token.updateUnlockDate(recipient, new BigNumber(0), {from: recipient}));
        });
    });

    it("lets owner transfer token to other account", async () => {
        let result = await this.token.allowedReceiverAddresses({from: owner});
        result.length.should.be.equal(0);

        let balance = await this.token.balanceOf(recipient);
        balance.should.be.bignumber.equal(new BigNumber(0));

        await this.token.transfer(recipient, amount, {from: owner});

        balance = await this.token.balanceOf(recipient);
        balance.should.be.bignumber.equal(amount);
    });

    it("lets owner stop locking transactions", async () => {
        let lockingTransfers = await this.token.lockingTransfers();
        lockingTransfers.should.be.equal(true);

        await this.token.stopLockingTransfers({from: owner});

        lockingTransfers = await this.token.lockingTransfers();
        lockingTransfers.should.be.equal(false);

        await expectThrow(this.token.stopLockingTransfers({from: owner}));
    });

    it("lets owner add and remove allowedReceiverAddress", async () => {
        let result = await this.token.allowedReceiverAddresses({from: owner});
        result.length.should.be.equal(0);

        await this.token.addAllowedReceiverAddress(allowedReceiverAddress, {from: owner});

        result = await this.token.allowedReceiverAddresses({from: owner});
        let foundAllowedReceiverAddress = false;
        for (const allowedReceiverAddressFromContract of result) {
            if (allowedReceiverAddressFromContract.toLowerCase() === allowedReceiverAddress.toLowerCase()) {
                foundAllowedReceiverAddress = true;
            }
        }
        foundAllowedReceiverAddress.should.be.equal(true);

        await this.token.removeAllowedReceiverAddress(allowedReceiverAddress, {from: owner});
        result = await this.token.allowedReceiverAddresses({from: owner});
        foundAllowedReceiverAddress = false;
        for (const allowedReceiverAddressFromContract of result) {
            if (allowedReceiverAddressFromContract.toLowerCase() === allowedReceiverAddress.toLowerCase()) {
                foundAllowedReceiverAddress = true;
            }
        }
        foundAllowedReceiverAddress.should.be.equal(false);
    });

    it("lets owner add and remove allowedSenderAddress", async () => {
        let result = await this.token.allowedSenderAddresses({from: owner});
        result.length.should.be.equal(1);

        await this.token.addAllowedSenderAddress(allowedSenderAddress, {from: owner});

        result = await this.token.allowedSenderAddresses({from: owner});
        let foundAllowedSenderAddress = false;
        for (const allowedSenderAddressFromContract of result) {
            if (allowedSenderAddressFromContract.toLowerCase() === allowedSenderAddress.toLowerCase()) {
                foundAllowedSenderAddress = true;
            }
        }
        foundAllowedSenderAddress.should.be.equal(true);

        await this.token.removeAllowedSenderAddress(allowedSenderAddress, {from: owner});
        result = await this.token.allowedSenderAddresses({from: owner});
        foundAllowedSenderAddress = false;
        for (const allowedSenderAddressFromContract of result) {
            if (allowedSenderAddressFromContract.toLowerCase() === allowedSenderAddress.toLowerCase()) {
                foundAllowedSenderAddress = true;
            }
        }
        foundAllowedSenderAddress.should.be.equal(false);
    });

    context("unlockedWallet has some token received from allowed sender (owner) and has passed its unlock date", async () => {
        beforeEach(async () => {
            if (debug) console.log("");
            await this.token.transfer(unlockedWallet, amount, {from: owner});
            let unlockDateResult = (await this.token.unlockDateOf(unlockedWallet, {from: owner})).toNumber();
            if (debug) console.log("unlockDateResult: " + unlockDateResult);
            if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
            // fast forward one second after the unlock date
            await time.increaseTo(unlockDateResult+1);
            const blockchainDate = dateify(await time.latest(), debug);
            if (debug) console.log("blockchainDate: " + blockchainDate);
            let unlockDate = dateify(unlockDateResult, debug);
            if (debug) console.log("unlockDate: " + unlockDate);
            unlockDate.should.be.below(blockchainDate); // Should be just recently passed

        });

        it("assigns now unlockDate to transfer recipient", async () => {
            await this.token.transfer(recipient, amount, {from: unlockedWallet});
            // fast forward one second
            await time.increase(1);

            const blockchainDate = dateify(await time.latest(), debug);
            if (debug) console.log("blockchainDate: " + blockchainDate);
            let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
            if (debug) console.log("unlockDateResult: " + unlockDateResult);
            let unlockDate = dateify(unlockDateResult.toNumber(), debug);
            if (debug) console.log("unlockDate: " + unlockDate);

            blockchainDate.should.be.above(unlockDate); // Should have just passed
        });

        context("allowedReceiverAddress and allowedSenderAddress are approved", async () => {
            beforeEach(async () => {
                if (debug) console.log("");
                await this.token.addAllowedReceiverAddress(allowedReceiverAddress, {from: owner});
                await this.token.addAllowedSenderAddress(allowedSenderAddress, {from: owner});
            });

            // TODO: add context for non-allowed sender that already passed time limit
            context("recipient has some token received from allowed sender (owner)", async () => {
                beforeEach(async () => {
                    if (debug) console.log("");
                    let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                    unlockDateResult.should.be.bignumber.equal(new BigNumber(0));
                    let myUnlockDateResult = await this.token.unlockDateOf(recipient, {from: recipient});
                    unlockDateResult.should.be.bignumber.equal(myUnlockDateResult);
                    await this.token.transfer(recipient, amount, {from: owner});
                });

                it("assigns future unlockDate to transfer recipient", async () => {
                    const blockchainDate = dateify(await time.latest(), debug);
                    if (debug) console.log("blockchainDate: " + blockchainDate);
                    let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                    if (debug) console.log("unlockDateResult: " + unlockDateResult);
                    let unlockDate = dateify(unlockDateResult.toNumber(), debug);
                    if (debug) console.log("unlockDate: " + unlockDate);

                    const lockDurationInDays = (unlockDate.getTime() - blockchainDate.getTime()) / (1000 * time.duration.days(1));
                    unlockDate.should.be.above(blockchainDate); // Should be ~40 days in the future

                    let percentDeviationOffDuration = Math.abs((lockDurationInDays / 40) - 1);
                    if (debug) {
                        console.log("percentDeviationOffDuration: " + percentDeviationOffDuration);
                    }
                    percentDeviationOffDuration.should.be.below(0.01);
                });

                context("recipient got token from unlockedWallet", async () => {
                    beforeEach(async () => {
                        if (debug) console.log("");
                        await this.token.transfer(recipient, amount, {from: unlockedWallet});
                        // fast forward one second
                        await time.increase(1);
                    });

                    it("assigns now unlockDate", async () => {
                        const blockchainDate = dateify(await time.latest(), debug);
                        if (debug) console.log("blockchainDate: " + blockchainDate);
                        let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                        if (debug) console.log("unlockDateResult: " + unlockDateResult);
                        let unlockDate = dateify(unlockDateResult.toNumber(), debug);
                        if (debug) console.log("unlockDate: " + unlockDate);

                        blockchainDate.should.be.above(unlockDate); // Should have just passed
                    });

                    it("still has past unlockDate if receives transfer from allowed sender (owner)", async () => {
                        await this.token.transfer(recipient, amount, {from: owner});
                        const blockchainDate = dateify(await time.latest(), debug);
                        if (debug) console.log("blockchainDate: " + blockchainDate);
                        let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                        if (debug) console.log("unlockDateResult: " + unlockDateResult);
                        let unlockDate = dateify(unlockDateResult.toNumber(), debug);
                        if (debug) console.log("unlockDate: " + unlockDate);

                        blockchainDate.should.be.above(unlockDate); // Should have just passed
                    });

                });

                it("prevents recipients from transferring to non-allowed addresses before unlockDate elapsed", async () => {
                    await expectThrow(this.token.transfer(nonAllowedReceiverAddress, amount, {from: recipient}));
                });

                it("allows recipients to transfer to non-allowed addresses once unlockDate elapsed", async () => {
                    let unlockDateResult = (await this.token.unlockDateOf(recipient, {from: owner})).toNumber();
                    if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
                    await time.increaseTo(unlockDateResult);
                    const blockchainDate = dateify(await time.latest(), debug);
                    if (debug) console.log("blockchainDate: " + blockchainDate);
                    await this.token.transfer(nonAllowedReceiverAddress, amount, {from: recipient});
                });

                it("allows recipients to transfer to allowed addresses before unlockDate elapsed", async () => {
                    await this.token.transfer(allowedReceiverAddress, amount, {from: recipient});
                });

                context("recipient approved spender to spend their entire balance", async () => {
                    beforeEach(async () => {
                        if (debug) console.log("");
                        await this.token.approve(spender, amount, {from: recipient});
                    });

                    it("allows spender to transfer to allowed addresses before unlockDate elapsed", async () => {
                        await this.token.transferFrom(recipient, allowedReceiverAddress, amount, {from: spender});
                    });

                    it("prevents spender from transferring to non-allowed addresses before unlockDate elapsed", async () => {
                        await expectThrow(this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: spender}));
                    });

                    it("allows spender to transfer to non-allowed addresses once we stopped locking transfers", async () => {
                        await this.token.stopLockingTransfers({from: owner});
                        await this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: spender});
                    });

                    it("allows spender to transfer to non-allowed addresses once unlockDate elapsed", async () => {
                        let unlockDateResult = (await this.token.unlockDateOf(recipient, {from: owner})).toNumber();
                        if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
                        await time.increaseTo(unlockDateResult);
                        const blockchainDate = dateify(await time.latest(), debug);
                        if (debug) console.log("blockchainDate: " + blockchainDate);
                        await this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: spender});
                    });
                });

                context("recipient approved owner to spend their entire balance", async () => {
                    beforeEach(async () => {
                        if (debug) console.log("");
                        await this.token.approve(owner, amount, {from: recipient});
                    });

                    it("allows owner to transfer to allowed addresses before unlockDate elapsed", async () => {
                        await this.token.transferFrom(recipient, allowedReceiverAddress, amount, {from: owner});
                    });

                    it("prevents owner from transferring to non-allowed addresses before unlockDate elapsed", async () => {
                        await expectThrow(this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: owner}));
                    });

                    it("allows owner to transfer to non-allowed addresses once we stopped locking transfers", async () => {
                        await this.token.stopLockingTransfers({from: owner});
                        await this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: owner});
                    });

                    it("allows owner to transfer to non-allowed addresses once unlockDate elapsed", async () => {
                        let unlockDateResult = (await this.token.unlockDateOf(recipient, {from: owner})).toNumber();
                        if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
                        await time.increaseTo(unlockDateResult);
                        const blockchainDate = dateify(await time.latest(), debug);
                        if (debug) console.log("blockchainDate: " + blockchainDate);
                        await this.token.transferFrom(recipient, nonAllowedReceiverAddress, amount, {from: owner});
                    });
                });

                context("locking has been stopped", async () => {
                    beforeEach(async () => {
                        if (debug) console.log("");
                        let lockingTransfers = await this.token.lockingTransfers();
                        lockingTransfers.should.be.equal(true);

                        if (debug) console.log("stopped locking");
                        await this.token.stopLockingTransfers({from: owner});

                        lockingTransfers = await this.token.lockingTransfers();
                        lockingTransfers.should.be.equal(false);
                    });

                    it("allows recipients to transfer to non-allowed addresses before unlockDate elapsed", async () => {
                        await this.token.transfer(nonAllowedReceiverAddress, amount, {from: recipient});
                        let balance = await this.token.balanceOf(nonAllowedReceiverAddress);
                        balance.should.be.bignumber.equal(amount);
                    });

                    describe("no longer locking transfers permission checks", async () => {
                        // TODO: add tests for allowedSenderAddresses
                        it("doesn't let owner add allowedReceiverAddress", async () => {
                            await expectThrow(this.token.addAllowedReceiverAddress(allowedReceiverAddress, {from: owner}));
                        });

                        it("doesn't let owner remove allowedReceiverAddress", async () => {
                            await expectThrow(this.token.removeAllowedReceiverAddress(allowedReceiverAddress, {from: owner}));
                        });

                        it("doesn't let owner to stop locking transfers", async () => {
                            await expectThrow(this.token.stopLockingTransfers({from: owner}));
                        });

                        it("doesn't let owner to update unlockDate", async () => {
                            await expectThrow(this.token.updateUnlockDate(recipient, new BigNumber(0), {from: owner}));
                        });

                    });
                });
            });
        });
    });
});