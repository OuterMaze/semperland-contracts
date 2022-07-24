const SampleERC1155WithBrandRegistry = artifacts.require("SampleERC1155WithBrandRegistry");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("SampleERC1155WithBrandRegistry", function (accounts) {
  var contract = null;

  before(async function () {
    contract = await SampleERC1155WithBrandRegistry.new({ from: accounts[0] });
  });

  it("should assert true", async function () {
    return assert.isTrue(true);
  });
});
