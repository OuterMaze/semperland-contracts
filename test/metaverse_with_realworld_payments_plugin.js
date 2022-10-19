const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const RealWorldPaymentsPlugin = artifacts.require("RealWorldPaymentsPlugin");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");

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

const {
  makePaymentOrderURI,
  FUND_CALL,
  FUND_BATCH_CALL
} = require("../front-end/js/plug-ins/real-world/real-world-payments");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("RealWorldPaymentsPlugin", function (accounts) {
  var economy = null;
  var metaverse = null;
  var brandRegistry = null;
  var definitionPlugin = null;
  var mintingPlugin = null;
  var realWorldPaymentsPlugin = null;
  var brand1 = null;
  var brand2 = null;
  var brand1Currency1 = null;
  var brand2Currency1 = null;
  var WMATIC = null;
  var BEAT = null;

  const BRAND_SIGN_PAYMENTS = web3.utils.soliditySha3("Plugins::RealWorldPayments::Brand::Payments::Sign");

  before(async function () {
    // Set up the metaverse and two plug-ins.
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] });
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
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
    mintingPlugin = await CurrencyMintingPlugin.new(
      metaverse.address, definitionPlugin.address, accounts[9], { from: accounts[0] }
    );
    realWorldPaymentsPlugin = await RealWorldPaymentsPlugin.new(
      metaverse.address, 30, accounts[9], [], { from: accounts[0] }
    );
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await metaverse.addPlugin(definitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(mintingPlugin.address, { from: accounts[0] });
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

    // Define 1 brand currency (in brand #1).
    await definitionPlugin.defineBrandCurrencyFor(
      brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
      "http://example.org/images/brand1-1-icon16x16.png", "http://example.org/images/brand1-1-icon32x32.png",
      "http://example.org/images/brand1-1-icon64x64.png", "#001111", { from: accounts[0] }
    );

    // Define 1 brand currency (in brand #2).
    await definitionPlugin.defineBrandCurrencyFor(
      brand2, "Brand #2 Curr #1", "Currency #1 of Brand #2", "http://example.org/images/brand2-1-image.png",
      "http://example.org/images/brand2-1-icon16x16.png", "http://example.org/images/brand2-1-icon32x32.png",
      "http://example.org/images/brand2-1-icon64x64.png", "#002211", { from: accounts[0] }
    );

    // Foresee the brand ids and currency ids.
    let brand1Part = brand1.substr(2).toLowerCase();
    let brand2Part = brand2.substr(2).toLowerCase();
    let index1 = "0000000000000000";
    brand1Currency1 = new BN("0x80000000" + brand1Part + index1);
    brand2Currency1 = new BN("0x80000000" + brand2Part + index1);
    // Also get the default tokens:
    WMATIC = await definitionPlugin.WMATICType();
    BEAT = await definitionPlugin.BEATType();
  });

  it("must have the expected title", async function() {
    let realWorldPaymentsTitle = await realWorldPaymentsPlugin.title();
    assert.isTrue(
      realWorldPaymentsTitle === "Real-World Payments",
      "The title of the real-world markets plug-in must be: Real-World Payments, not: " + realWorldPaymentsTitle
    );
  });
});