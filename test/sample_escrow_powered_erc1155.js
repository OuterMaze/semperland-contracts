const SampleEscrowPoweredERC1155 = artifacts.require("SampleEscrowPoweredERC1155");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("SampleEscrowPoweredERC1155", function (accounts) {
  var contract = null;

  before(async function () {
    contract = await SampleEscrowPoweredERC1155.new({ from: accounts[0] });
  });

  async function expectBalances(ids, amounts, account) {
    for(let i = 0; i < ids.length; i++) {
      let result = await contract.balanceOf(account, ids[i], {from: account});
      let expected = amounts[i];
      assert.isTrue(
        result.cmp(expected) === 0,
        "The account " + account + " has an amount of token " + ids[i] + " of " + result +
        ", but " + expected + " is expected"
      );
    }
  }

  function revertReason(message) {
    return message + " -- Reason given: " + message;
  }

  it("must have the initial balance for the 1st account", async function () {
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("1000000000000000000"), new BN("2000000000000000000"), new BN("3000000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
  });

  it("must transfer half of the balance to another account", async function () {
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await contract.safeBatchTransferFrom(accounts[0], accounts[1], ids, amounts,
                                         web3.utils.asciiToHex("test"), {from: accounts[0]});
  });

  it("must have half of the balance on each account", async function () {
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
  });

  it("must define operators (3rd -> 1st, 4th -> 2nd)", async function () {
    await contract.setApprovalForAll(accounts[2], true, {from: accounts[0]});
    await contract.setApprovalForAll(accounts[3], true, {from: accounts[1]});
  });

  it("must start a deal from account 0, directly (and capture the event)", async function () {
    // 0. Direct usage.
    console.log("0. Direct usage");
    let tx = await contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")],
      {from: accounts[0]}
    );
    // 1. The balances must be unchanged, on both accounts.
    console.log("1. The balances must be unchanged, on both accounts");
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 2. An event must have been triggered.
    console.log("2. An event must have been triggered");
    expectEvent(tx, "DealStarted", {
      dealId: new BN("1"), emitter: accounts[0], receiver: accounts[1]
    });
    // 3. Also, the deal must be valid.
    console.log("3. Also, the deal must be valid");
    let newDeal = await contract.deals(new BN("1"), {from: accounts[0]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("0")) === 0,
      "The new deal must have a state of 0, not " + newDeal.state
    );
    // 4. Then, the deal must be accepted by the receiver.
    console.log("4. Then, the deal must be accepted by the receiver");
    tx = await contract.dealAccept(new BN("1"), [new BN("3")], [new BN("150000000000000000")], {from: accounts[1]});
    // 5. The balances must be unchanged, on both accounts.
    console.log("5. The balances must be unchanged, on both accounts");
    ids = [new BN("1"), new BN("2"), new BN("3")];
    amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 6. An event must have been triggered.
    console.log("6. An event must have been triggered");
    expectEvent(tx, "DealAccepted", {
      dealId: new BN("1"), emitter: accounts[0], receiver: accounts[1]
    });
    // 7. Also, the deal must be valid.
    console.log("7. Also, the deal must be valid");
    newDeal = await contract.deals(new BN("1"), {from: accounts[1]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("1")) === 0,
      "The new deal must have a state of 1, not " + newDeal.state
    );
    // 8. Them, the deal must be confirmed by the emitter.
    console.log("8. Them, the deal must be confirmed by the emitter");
    tx = await contract.dealConfirm(new BN("1"), {from: accounts[0]});
    // 9. An event must have been triggered.
    console.log("9. An event must have been triggered");
    expectEvent(tx, "DealConfirmed", {
      dealId: new BN("1"), emitter: accounts[0], receiver: accounts[1]
    });
    // 10. And now, the balances must be different, reflecting the exchanges.
    console.log("10. And now, the balances must be different, reflecting the exchanges");
    ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts1 = [new BN("450000000000000000"), new BN("900000000000000000"), new BN("1650000000000000000")];
    let amounts2 = [new BN("550000000000000000"), new BN("1100000000000000000"), new BN("1350000000000000000")];
    await expectBalances(ids, amounts1, accounts[0]);
    await expectBalances(ids, amounts2, accounts[1]);
    // 11. Ok, let's reinstate their balances.
    console.log("11. Ok, let's reinstate their balances");
    await contract.safeBatchTransferFrom(
      accounts[0], accounts[1], [new BN("3")],
      [new BN("150000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[0]}
    );
    await contract.safeBatchTransferFrom(
      accounts[1], accounts[0], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[1]}
    );
  });

  it("must be able to work this out only with the appropriate operators", async function () {
    // 0.a. Wrong operator.
    console.log("0.a. Wrong Operator");
    await expectRevert(contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")],
      {from: accounts[1]}
    ), revertReason("EscrowPoweredERC1155: caller is not emitter nor approved"));
    // 0.b. Good operator.
    console.log("0.b. Good operator");
    let tx = await contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")],
      {from: accounts[2]}
    );
    // 1. The balances must be unchanged, on both accounts.
    console.log("1. The balances must be unchanged, on both accounts");
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 2. An event must have been triggered.
    console.log("2. An event must have been triggered");
    expectEvent(tx, "DealStarted", {
      dealId: new BN("2"), emitter: accounts[0], receiver: accounts[1]
    });
    // 3. Also, the deal must be valid.
    console.log("3. Also, the deal must be valid");
    let newDeal = await contract.deals(new BN("2"), {from: accounts[0]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("0")) === 0,
      "The new deal must have a state of 0, not " + newDeal.state
    );
    // 4. Then, the deal must be accepted by the receiver.
    console.log("4. Then, the deal must be accepted by the receiver");
    // 4.a. Wrong operator.
    console.log("4.a. Wrong operator");
    await expectRevert(
      contract.dealAccept(new BN("2"), [new BN("3")], [new BN("150000000000000000")], {from: accounts[0]}),
      revertReason("EscrowPoweredERC1155: caller is not receiver nor approved")
    );
    // 4.b. Good operator.
    console.log("4.b. Good operator");
    tx = await contract.dealAccept(new BN("2"), [new BN("3")], [new BN("150000000000000000")], {from: accounts[3]});
    // 5. The balances must be unchanged, on both accounts.
    console.log("5. The balances must be unchanged, on both accounts");
    ids = [new BN("1"), new BN("2"), new BN("3")];
    amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 6. An event must have been triggered.
    console.log("6. An event must have been triggered");
    expectEvent(tx, "DealAccepted", {
      dealId: new BN("2"), emitter: accounts[0], receiver: accounts[1]
    });
    // 7. Also, the deal must be valid.
    console.log("7. Also, the deal must be valid");
    newDeal = await contract.deals(new BN("2"), {from: accounts[1]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("1")) === 0,
      "The new deal must have a state of 1, not " + newDeal.state
    );
    // 8. Then, the deal must be confirmed by the emitter.
    console.log("8. Then, the deal must be confirmed by the emitter");
    // 8.a. Wrong operator.
    console.log("8.a. Wrong operator");
    await expectRevert(
      contract.dealConfirm(new BN("2"), {from: accounts[1]}),
      revertReason("EscrowPoweredERC1155: caller is not emitter nor approved")
    );
    // 8.b. Good operator.
    console.log("8.b. Good operator");
    tx = await contract.dealConfirm(new BN("2"), {from: accounts[2]});
    // 9. An event must have been triggered.
    console.log("9. An event must have been triggered");
    expectEvent(tx, "DealConfirmed", {
      dealId: new BN("2"), emitter: accounts[0], receiver: accounts[1]
    });
    // 10. And now, the balances must be different, reflecting the exchanges.
    console.log("10. And now, the balances must be different, reflecting the exchanges");
    ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts1 = [new BN("450000000000000000"), new BN("900000000000000000"), new BN("1650000000000000000")];
    let amounts2 = [new BN("550000000000000000"), new BN("1100000000000000000"), new BN("1350000000000000000")];
    await expectBalances(ids, amounts1, accounts[0]);
    await expectBalances(ids, amounts2, accounts[1]);
    // 11. Ok, let's reinstate their balances.
    console.log("11. Ok, let's reinstate their balances");
    await contract.safeBatchTransferFrom(
      accounts[0], accounts[1], [new BN("3")],
      [new BN("150000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[0]}
    );
    await contract.safeBatchTransferFrom(
      accounts[1], accounts[0], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[1]}
    );
  });

  it("must check data and state errors", async function() {
    // 0. Direct usage.
    await expectRevert(contract.dealStart(
      accounts[0], accounts[1], [], [], {from: accounts[0]}
    ), revertReason("EscrowPoweredERC1155: token ids and amounts length mismatch or 0"));
    await expectRevert(contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")], [new BN("100000000000000000")], {from: accounts[0]}
    ), revertReason("EscrowPoweredERC1155: token ids and amounts length mismatch or 0"));
    await expectRevert(contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")],
      [new BN("0"), new BN("100000000000000000")],
      {from: accounts[0]}
    ), revertReason("EscrowPoweredERC1155: token in position 0 must not have amount of 0"));
    let tx = await contract.dealStart(
      accounts[0], accounts[1], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")],
      {from: accounts[0]}
    );
    // 1. The balances must be unchanged, on both accounts.
    let ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 2. An event must have been triggered.
    expectEvent(tx, "DealStarted", {
      dealId: new BN("3"), emitter: accounts[0], receiver: accounts[1]
    });
    // 3. Also, the deal must be valid.
    let newDeal = await contract.deals(new BN("3"), {from: accounts[0]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("0")) === 0,
      "The new deal must have a state of 0, not " + newDeal.state
    );
    // 4. Then, the deal must be accepted by the receiver.
    tx = await contract.dealAccept(new BN("3"), [new BN("3")], [new BN("150000000000000000")], {from: accounts[1]});
    // 5. The balances must be unchanged, on both accounts.
    ids = [new BN("1"), new BN("2"), new BN("3")];
    amounts = [new BN("500000000000000000"), new BN("1000000000000000000"), new BN("1500000000000000000")];
    await expectBalances(ids, amounts, accounts[0]);
    await expectBalances(ids, amounts, accounts[1]);
    // 6. An event must have been triggered.
    expectEvent(tx, "DealAccepted", {
      dealId: new BN("3"), emitter: accounts[0], receiver: accounts[1]
    });
    // 7. Also, the deal must be valid.
    newDeal = await contract.deals(new BN("3"), {from: accounts[1]});
    assert.isTrue(
      newDeal.emitter === accounts[0],
      "The new deal has an emitter of " + newDeal.emitter + " but the expected one is: " + accounts[0]
    );
    assert.isTrue(
      newDeal.receiver === accounts[1],
      "The new deal has a receiver of " + newDeal.receiver + " but the expected one is: " + accounts[1]
    );
    assert.isTrue(
      newDeal.state.cmp(new BN("1")) === 0,
      "The new deal must have a state of 1, not " + newDeal.state
    );
    // 8. Them, the deal must be confirmed by the emitter.
    tx = await contract.dealConfirm(new BN("3"), {from: accounts[0]});
    // 9. An event must have been triggered.
    expectEvent(tx, "DealConfirmed", {
      dealId: new BN("3"), emitter: accounts[0], receiver: accounts[1]
    });
    // 10. And now, the balances must be different, reflecting the exchanges.
    ids = [new BN("1"), new BN("2"), new BN("3")];
    let amounts1 = [new BN("450000000000000000"), new BN("900000000000000000"), new BN("1650000000000000000")];
    let amounts2 = [new BN("550000000000000000"), new BN("1100000000000000000"), new BN("1350000000000000000")];
    await expectBalances(ids, amounts1, accounts[0]);
    await expectBalances(ids, amounts2, accounts[1]);
    // 11. Ok, let's reinstate their balances.
    await contract.safeBatchTransferFrom(
      accounts[0], accounts[1], [new BN("3")],
      [new BN("150000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[0]}
    );
    await contract.safeBatchTransferFrom(
      accounts[1], accounts[0], [new BN("1"), new BN("2")],
      [new BN("50000000000000000"), new BN("100000000000000000")], web3.utils.asciiToHex("test"),
      {from: accounts[1]}
    );
  })
});
