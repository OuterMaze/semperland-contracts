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
contract("SampleEscrowPoweredERC1155", function (/* accounts */) {
  var contract = null;

  before(async function () {
    contract = SampleEscrowPoweredERC1155.new();
  });

  it("should assert true", async function () {

  });
});
