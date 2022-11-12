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
  var economy = null;
  var metaverse = null;
  var brandRegistry = null;
  var brand1 = null;
  var brand2 = null;

  before(async function () {
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await brandRegistry.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[0] });
  });

  it("must successfully create a brand (account 1 will be operator of brand 1)", async function () {
    brand1 = web3.utils.soliditySha3(
      "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    );
    brand1 = web3.utils.toChecksumAddress("0x" + brand1.substr(26));

    await expectEvent(
      await brandRegistry.registerBrand(
        "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/ico16x16.png",
        "http://example.com/ico32x32.png", "http://example.com/ico64x64.png",
        {from: accounts[1], value: new BN("10000000000000000000")}
      ), "BrandRegistered", {
        "registeredBy": accounts[1], "brandId": brand1, "name": "My Brand 1",
        "description": "My awesome brand 1", "price": new BN("10000000000000000000"),
        "mintedBy": constants.ZERO_ADDRESS
      }
    );

    assert.isTrue(
      await economy.isApprovedForAll(brand1, accounts[1]),
      "The account 1, being owner of the brand 1, must also be considered its ERC1155 operator"
    );
  });

  it("must successfully create a brand from admin (account 2 will be operator of brand 2)", async function () {
    brand2 = web3.utils.soliditySha3(
      "0xd6", "0x94", brandRegistry.address, accounts[2], 2
    );
    brand2 = web3.utils.toChecksumAddress("0x" + brand2.substr(26));

    await expectEvent(
      await brandRegistry.registerBrandFor(
        accounts[2],
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/ico16x16-2.png",
        "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[0]}
      ), "BrandRegistered", {
        "registeredBy": accounts[2], "brandId": brand2, "name": "My Brand 2",
        "description": "My awesome brand 2", "price": new BN("0"),
        "mintedBy": accounts[0]
      }
    );

    assert.isTrue(
      await economy.isApprovedForAll(brand2, accounts[2]),
      "The account 2, being owner of the brand 2, must also be considered its ERC1155 operator"
    );
  });
});
