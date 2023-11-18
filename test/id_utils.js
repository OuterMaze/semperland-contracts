const IdUtils = artifacts.require("IdUtils");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

contract("IdUtils", function(accounts) {
  let lib = null;

  before(async function() {
    lib = await IdUtils.new();
  });

  it("should appropriately build a generic NFT id", async function () {
    let result = await lib.nftId(new BN("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"));
    let expected = new BN("0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
    return assert.isTrue(
      result.cmp(expected) === 0,
      "The expected result is " + expected + " but " + result + " was returned instead"
    );
  });

  it("should appropriately build a brand NFT id", async function () {
    let result = await lib.brandId(accounts[0]);
    let expected = new BN(accounts[0]);
    return assert.isTrue(
      result.cmp(expected) === 0,
      "The expected result is " + expected + " but " + result + " was returned instead"
    );
  });

  it("should appropriately build a brand FT id", async function () {
    let result = await lib.brandTokenId(accounts[0], new BN("0x1212121234343434"));
    let expected = new BN("0x80000000" + accounts[0].substr(2) + "1212121234343434");
    return assert.isTrue(
        result.cmp(expected) === 0,
        "The expected result is " + expected + " but " + result + " was returned instead"
    );
  });

  it("should appropriately build a system FT id", async function () {
    let id = new BN("0x1234567890abcdef");
    let result = await lib.systemTokenId(id);
    let expected = new BN("0x8000000000000000000000000000000000000000000000001234567890abcdef");
    return assert.isTrue(
      result.cmp(expected) === 0,
      "The expected result is " + expected + " but " + result + " was returned instead"
    );
  });
});
