const {dateify} = require("./helpers/dateUtils");
const {time, expect, BN} = require('openzeppelin-test-helpers/openzeppelin-test-helpers');
const {assert} = require('chai');
const BigNumber = BN;
const EmuToken = artifacts.require('EMU');
const debug = false;

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

contract('EMU', function ([_, owner, recipient, spender, allowedAddress, nonAllowedAddress]) {
    const amount = new BigNumber(100);

    beforeEach(async function () {
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

    describe("non-owner permission checks", async function () {
        it("doesn't let non-owner to read allowedAddress", async function () {
            await expectThrow(this.token.allowedAddresses({from: recipient}));
        });

        it("doesn't let non-owner add allowedAddress", async function () {
            await expectThrow(this.token.addAllowedAddress(allowedAddress, {from: recipient}));
        });

        it("doesn't let non-owner remove allowedAddress", async function () {
            await expectThrow(this.token.removeAllowedAddress(allowedAddress, {from: recipient}));
        });

        it("doesn't let non-owner to stop locking transfers", async function () {
            await expectThrow(this.token.stopLockingTransfers({from: recipient}));
        });

        it("doesn't let non-owner to check unlockDate", async function () {
            await expectThrow(this.token.unlockDateOf(recipient, {from: recipient}));
        });

        it("doesn't let non-owner to update unlockDate", async function () {
            await expectThrow(this.token.updateUnlockDate(recipient, new BigNumber(0), {from: recipient}));
        });
    });

    it("lets owner transfer token to other account", async function () {
        let result = await this.token.allowedAddresses({from: owner});
        result.length.should.be.equal(0);

        let balance = await this.token.balanceOf(recipient);
        balance.should.be.bignumber.equal(new BigNumber(0));

        await this.token.transfer(recipient, amount, {from: owner});

        balance = await this.token.balanceOf(recipient);
        balance.should.be.bignumber.equal(amount);
    });

    it("lets owner stop locking transactions", async function () {
        let lockingTransfers = await this.token.lockingTransfers();
        lockingTransfers.should.be.equal(true);

        await this.token.stopLockingTransfers({from: owner});

        lockingTransfers = await this.token.lockingTransfers();
        lockingTransfers.should.be.equal(false);

        await expectThrow(this.token.stopLockingTransfers({from: owner}));
    });

    it("lets owner add and remove allowedAddress", async function () {
        let result = await this.token.allowedAddresses({from: owner});
        result.length.should.be.equal(0);

        await this.token.addAllowedAddress(allowedAddress, {from: owner});

        result = await this.token.allowedAddresses({from: owner});
        let foundAllowedAddress = false;
        for (const allowedAddressFromContract of result) {
            if (allowedAddressFromContract.toLowerCase() === allowedAddress.toLowerCase()) {
                foundAllowedAddress = true;
            }
        }
        foundAllowedAddress.should.be.equal(true);

        await this.token.removeAllowedAddress(allowedAddress, {from: owner});
        result = await this.token.allowedAddresses({from: owner});
        foundAllowedAddress = false;
        for (const allowedAddressFromContract of result) {
            if (allowedAddressFromContract.toLowerCase() === allowedAddress.toLowerCase()) {
                foundAllowedAddress = true;
            }
        }
        foundAllowedAddress.should.be.equal(false);
    });

    context("allowedAddress is allowed", async function () {
        beforeEach(async function () {
            if (debug) console.log("");
            await this.token.addAllowedAddress(allowedAddress, {from: owner});
        });

        context("recipient has some token and allowedAddress is allowed", async function () {
            beforeEach(async function () {
                if (debug) console.log("");
                let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                unlockDateResult.should.be.bignumber.equal(new BigNumber(0));
                let myUnlockDateResult = await this.token.myUnlockDate({from: recipient});
                unlockDateResult.should.be.bignumber.equal(myUnlockDateResult);

                await this.token.transfer(recipient, amount, {from: owner});
            });

            it("assigns unlockDates to transfer recipients", async function () {
                const blockchainDate = dateify(await time.latest(), debug);
                if (debug) console.log("blockchainDate: " + blockchainDate);
                let unlockDateResult = await this.token.unlockDateOf(recipient, {from: owner});
                if (debug) console.log("unlockDateResult: " + unlockDateResult);
                let unlockDate = dateify(unlockDateResult.toNumber(), debug);
                if (debug) console.log("unlockDate: " + unlockDate);

                const lockDurationInDays = (unlockDate.getTime() - blockchainDate.getTime()) / (1000 * time.duration.days(1));

                unlockDate.should.be.above(blockchainDate);

                let percentDeviationOffDuration = Math.abs((lockDurationInDays / 40) - 1);
                if (debug) {
                    console.log("percentDeviationOffDuration: " + percentDeviationOffDuration);
                }
                percentDeviationOffDuration.should.be.below(0.01);

            });

            it("prevents recipients from transferring to non-allowed addresses before unlockDate elapsed",
                async function () {
                    await expectThrow(this.token.transfer(nonAllowedAddress, amount, {from: recipient}));
                });

            it("allows recipients to transfer to non-allowed addresses once we stopped locking transfers", async function () {
                let lockingTransfers = await this.token.lockingTransfers();
                lockingTransfers.should.be.equal(true);

                if (debug) console.log("stopped locking");
                await this.token.stopLockingTransfers({from: owner});

                lockingTransfers = await this.token.lockingTransfers();
                lockingTransfers.should.be.equal(false);

                await this.token.transfer(nonAllowedAddress, amount, {from: recipient});
            });

            it("allows recipients to transfer to non-allowed addresses once unlockDate elapsed", async function () {
                let unlockDateResult = (await this.token.unlockDateOf(recipient, {from: owner})).toNumber();
                if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
                await time.increaseTo(unlockDateResult);
                const blockchainDate = dateify(await time.latest(), debug);
                if (debug) console.log("blockchainDate: " + blockchainDate);
                await this.token.transfer(nonAllowedAddress, amount, {from: recipient});
            });

            it("allows recipients to transfer to allowed addresses before unlockDate elapsed", async function () {
                await this.token.transfer(allowedAddress, amount, {from: recipient});
            });

            context("locking has been stopped", async function () {
                beforeEach(async function () {
                    if (debug) console.log("");
                    await this.token.stopLockingTransfers({from: owner});
                });

                it("allows recipients to transfer to non-allowed addresses before unlockDate elapsed", async function () {
                    await this.token.transfer(nonAllowedAddress, amount, {from: recipient});

                    let balance = await this.token.balanceOf(nonAllowedAddress);
                    balance.should.be.bignumber.equal(amount);
                });

                describe("no longer locking transfers permission checks", async function () {

                    it("doesn't let owner add allowedAddress", async function () {
                        await expectThrow(this.token.addAllowedAddress(allowedAddress, {from: owner}));
                    });

                    it("doesn't let owner remove allowedAddress", async function () {
                        await expectThrow(this.token.removeAllowedAddress(allowedAddress, {from: owner}));
                    });

                    it("doesn't let owner to stop locking transfers", async function () {
                        await expectThrow(this.token.stopLockingTransfers({from: owner}));
                    });

                    it("doesn't let owner to check unlockDate", async function () {
                        await expectThrow(this.token.unlockDateOf(recipient, {from: owner}));
                    });

                    it("doesn't let owner to update unlockDate", async function () {
                        await expectThrow(this.token.updateUnlockDate(recipient, new BigNumber(0), {from: owner}));
                    });

                    it("doesn't let anyone check their lock date", async function () {
                        await expectThrow(this.token.myUnlockDate({from: owner}));
                        await expectThrow(this.token.myUnlockDate({from: recipient}));
                    });
                });
            });
            context("recipient approved spender to spend their entire balance", async function () {
                beforeEach(async function () {
                    if (debug) console.log("");
                    await this.token.approve(spender, amount, {from: recipient});
                });

                it("prevents spender from transferring to non-allowed addresses before unlockDate elapsed",
                    async function () {
                        await expectThrow(this.token.transferFrom(recipient, nonAllowedAddress, amount, {from: spender}));
                    });

                it("allows spender to transfer to non-allowed addresses once we stopped locking transfers", async function () {
                    let lockingTransfers = await this.token.lockingTransfers();
                    lockingTransfers.should.be.equal(true);

                    if (debug) console.log("stopped locking");
                    await this.token.stopLockingTransfers({from: owner});

                    lockingTransfers = await this.token.lockingTransfers();
                    lockingTransfers.should.be.equal(false);

                    await this.token.transferFrom(recipient, nonAllowedAddress, amount, {from: spender});
                });

                it("allows spender to transfer to non-allowed addresses once unlockDate elapsed", async function () {
                    let unlockDateResult = (await this.token.unlockDateOf(recipient, {from: owner})).toNumber();
                    if (debug) console.log("setting blockchainDate to unlockDate: " + dateify(unlockDateResult));
                    await time.increaseTo(unlockDateResult);
                    const blockchainDate = dateify(await time.latest(), debug);
                    if (debug) console.log("blockchainDate: " + blockchainDate);
                    await this.token.transferFrom(recipient, nonAllowedAddress, amount, {from: spender});
                });
            });
        });
    });
});
