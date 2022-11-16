const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const {
  revertReason,
} = require("./test_utils");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("Metaverse", function (accounts) {
  let economy = null;
  let metaverse = null;
  let brandRegistry = null;

  before(async function () {
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], 300, { from: accounts[0] });
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
  });

  it("must fail when calling Metaverse::onBrandOwnerChanged for common accounts", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    ).substr(26);

    await expectRevert(
      metaverse.onBrandOwnerChanged(brandId1, accounts[0], {from: accounts[0]}),
      revertReason("Metaverse: the only allowed sender is the economy system")
    );
  });

  it("must fail when calling Metaverse::mintFor for common accounts", async function() {
    await expectRevert(
      economy.mintFor(accounts[1], 1, 1, "0x00", {from: accounts[0]}),
      revertReason("Economy: the only allowed sender is the metaverse system")
    );
  });

  it("must fail when calling Metaverse::burn for common accounts", async function() {
    await expectRevert(
      economy.burn(accounts[1], 1, 1, {from: accounts[0]}),
      revertReason("Economy: the only allowed sender is the metaverse system")
    );
  });

  it("must fail when calling Metaverse::burnBatch for common accounts", async function() {
    await expectRevert(
      economy.burnBatch(accounts[1], [1], [1], {from: accounts[0]}),
      revertReason("Economy: the only allowed sender is the metaverse system")
    );
  });

  it("must fail when calling BrandRegistry::onBrandOwnerChanged for common accounts", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    ).substr(26);

    await expectRevert(
      brandRegistry.onBrandOwnerChanged(brandId1, accounts[0], {from: accounts[0]}),
      revertReason("BrandRegistry: the only allowed sender is the metaverse system")
    );
  });

  it("must fail when calling Metaverse::defineNextFTType for common accounts", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
        "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    ).substr(26);

    await expectRevert(
      metaverse.defineNextFTType(brandId1, {from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::defineNextNFTType for common accounts", async function() {
    await expectRevert(
      metaverse.defineNextNFTType({from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::mintFTFor for common accounts", async function() {
    await expectRevert(
      metaverse.mintFTFor(accounts[0], 1, 1, "0x00", {from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::mintNFTFor for common accounts", async function() {
    await expectRevert(
      metaverse.mintNFTFor(accounts[0], 1, "0x00", {from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::burnToken for common accounts", async function() {
    await expectRevert(
      metaverse.burnToken(1, 1, {from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::burnTokens for common accounts", async function() {
    await expectRevert(
      metaverse.burnTokens([1], [1], {from: accounts[0]}),
      revertReason("Metaverse: the sender must be a plug-in")
    );
  });

  it("must fail when calling Metaverse::mintBrandFor for common accounts", async function() {
    await expectRevert(
      metaverse.mintBrandFor(accounts[0], "0x0123456789012345678901234567890123456789", {from: accounts[0]}),
      revertReason("Metaverse: the only allowed sender is the brand registry")
    );
  });
});
