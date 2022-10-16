const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const RealWorldPaymentsPlugin = artifacts.require("RealWorldPaymentsPlugin");

const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const {
  btoa,
  revertReason,
  txTotalGas
} = require("./test_utils");

function encodeParameters(

) {

}

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("RealWorldPaymentsPlugin", function (accounts) {
  var economy = null;
  var metaverse = null;
  var brandRegistry = null;
  var realWorldPaymentsPlugin = null;
  var brand1 = null;
  var brand2 = null;

  const BRAND_SIGN_PAYMENTS = web3.utils.soliditySha3("Plugins::RealWorldPayments::Brand::Payments::Sign");

  const FUND_SIGNATURE = web3.eth.abi.encodeFunctionSignature("fund(address,uint256,uint256)");
  const FUND_BATCH_SIGNATURE = web3.eth.abi.encodeFunctionSignature("fundBatch(address,uint256[],uint256[])");
  const PAY_SIGNATURE = web3.eth.abi.encodeFunctionSignature("pay(address,uint256,uint256,bytes)");
  const PAY_BATCH_SIGNATURE = web3.eth.abi.encodeFunctionSignature("payBatch(address,uint256[],uint256[],bytes)");

  before(async function () {
    // Set up the metaverse and two plug-ins.
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
    realWorldPaymentsPlugin = await RealWorldPaymentsPlugin.new(
        metaverse.address, 30, accounts[9], [], { from: accounts[0] }
    );
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await metaverse.addPlugin(realWorldPaymentsPlugin.address, { from: accounts[0] });

    // Mint some brands (define cost, and mint 2 brands).
    await brandRegistry.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[0] });

    await brandRegistry.registerBrand(
      "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/icon1-16x16.png",
      "http://example.com/icon1-32x32.png", "http://example.com/icon1-64x64.png",
      {from: accounts[1], value: new BN("10000000000000000000")}
    );
    brand1 = web3.utils.toChecksumAddress('0x' + web3.utils.soliditySha3(
        "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    ).substr(26));

    await brandRegistry.registerBrand(
      "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/icon2-16x16.png",
      "http://example.com/icon2-32x32.png", "http://example.com/icon2-64x64.png",
      {from: accounts[2], value: new BN("10000000000000000000")}
    );
    brand2 = web3.utils.toChecksumAddress('0x' + web3.utils.soliditySha3(
        "0xd6", "0x94", brandRegistry.address, accounts[2], 2
    ).substr(26));
  });

  it("must have the expected title", async function() {
    let realWorldPaymentsTitle = await realWorldPaymentsPlugin.title();
    assert.isTrue(
      realWorldPaymentsTitle === "Real-World Payments",
      "The title of the real-world markets plug-in must be: Real-World Payments, not: " + realWorldPaymentsTitle
    );
  });
});