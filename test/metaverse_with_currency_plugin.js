const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");

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
contract("CurrencyPlugin", function (accounts) {
  var economy = null;
  var metaverse = null;
  var contract = null;
  var definitionPlugin = null;
  var mintingPlugin = null;

  before(async function () {
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    contract = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
    definitionPlugin = await CurrencyDefinitionPlugin.new(
      metaverse.address, accounts[9],
      "http://example.org/images/wmatic-image.png",
      "http://example.org/images/wmatic-16x16.png",
      "http://example.org/images/wmatic-32x32.png",
      "http://example.org/images/wmatic-64x64.png",
      "http://example.org/images/beat-image.png",
      "http://example.org/images/beat-16x16.png",
      "http://example.org/images/beat-32x32.png",
      "http://example.org/images/beat-64x64.png",
      { from: accounts[0] }
    );
    mintingPlugin = await CurrencyMintingPlugin.new(metaverse.address, definitionPlugin.address, accounts[9]);
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(contract.address, { from: accounts[0] });
    await metaverse.addPlugin(definitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(mintingPlugin.address, { from: accounts[0] });
  });

  it("must have the WMATIC and BEAT types defined appropriately (tests the types and metadata)", async function() {
    let WMATIC = await definitionPlugin.WMATICType();
    let BEAT = await definitionPlugin.BEATType();
    assert.isTrue(
      WMATIC.cmp(new BN("0x8000000000000000000000000000000000000000000000000000000000000000")) === 0,
      "The definition plug-in must have the WMATIC token appropriately defined"
    );
    assert.isTrue(
      BEAT.cmp(new BN("0x8000000000000000000000000000000000000000000000000000000000000001")) === 0,
      "The definition plug-in must have the BEAT token appropriately defined"
    );
  });
});