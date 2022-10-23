const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const RealWorldPaymentsPlugin = artifacts.require("RealWorldPaymentsPlugin");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");
const payments = require("../front-end/js/plug-ins/real-world/real-world-payments.js");
const types = require("../front-end/js/utils/types.js");
const dates = require("../front-end/js/utils/dates.js");
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const expect = chai.expect;
chai.use(chaiAsPromised);

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

  /**
   * Tests just a serialization and parsing of a payment object.
   * @param web3 The web3 client to use.
   * @param domainForMakingPayment The domain to use for making a payment.
   * @param domainForParsingPayment The domain to use for parsing a payment.
   * @param signer The address that signs the payment.
   * @param timestamp The current timestamp of the payment.
   * @param dueTime The due time (in seconds - it will be added to the timestamp).
   * @param toAddress The address that must receive the payment.
   * @param reference The external reference of the payment.
   * @param description The description of the payment.
   * @param brandAddress The brand address (It may be the zero address).
   * @param rewardIds The ids of the rewards to give.
   * @param rewardValues The values of the rewards to give.
   * @param paymentType The type of the payment.
   * @param paymentId The id, or ids, of the payment. Not used for native payment.
   * @param paymentValue The value, or values, of the payment.
   * @returns {Promise<void>} Just a promise to be awaited for
   */
  async function makePaymentAndThenParseIt(
      web3, domainForMakingPayment, domainForParsingPayment, signer, timestamp, dueTime, toAddress,
      reference, description, brandAddress, rewardIds, rewardValues, paymentType, paymentId, paymentValue
  ) {
    let payment = {
      type: paymentType
    }
    switch(paymentType) {
      case "native":
        payment.value = paymentValue;
        break;
      case "token":
        payment.id = paymentId;
        payment.value = paymentValue;
        break;
      case "tokens":
        payment.ids = paymentId;
        payment.values = paymentValue;
        break;
    }
    timestamp = new web3.utils.BN(timestamp);
    dueTime = new web3.utils.BN(dueTime);
    let dueDate = dueTime.add(timestamp);

    // Making the payment order.
    let url = await payments.makePaymentOrderURI(
      domainForMakingPayment, web3, signer, timestamp, dueTime, toAddress,
      reference, description, brandAddress, rewardIds, rewardValues, payment
    );

    // Parsing the payment order.
    let obj = payments.parsePaymentOrderURI(domainForParsingPayment, web3, url);

    // Assert on the payment type.
    assert.isTrue(
      obj.type === paymentType,
      "The payment's type must match in parsed vs. making. But the initial " +
      "type is " + paymentType + " and the final type is " + obj.type
    );

    // Assert on the due time.
    assert.isTrue(
      obj.args.dueDate.cmp(dueDate) === 0,
      "The payment's due date must match in parsed vs. making. But the initial " +
      "(computed) due date is " + dueDate.toString() + " and the final due date is " +
      obj.args.dueDate.toString()
    );

    // Assert on the target address.
    assert.isTrue(
      obj.args.toAddress === toAddress,
      "The payment's target address must match in parsed vs. making. But the initial " +
      "target address is " + toAddress + " and the final target address is " + obj.args.toAddress
    );

    // Assert on the timestamp.
    assert.isTrue(
      obj.args.payment.now.cmp(timestamp) === 0,
      "The payment's timestamp must match in parsed vs. making. But the initial " +
      "timestamp is " + timestamp.toString() + " and the final timestamp is " +
      obj.args.payment.now.toString()
    );

    // Assert on the reference.
    assert.isTrue(
      obj.args.payment.reference === reference,
      "The payment's reference  must match in parsed vs. making. But the initial " +
      "reference is " + reference + " and the final reference is " + obj.args.payment.reference
    );

    // Assert on the description.
    assert.isTrue(
      obj.args.payment.description === description,
      "The payment's description  must match in parsed vs. making. But the initial " +
      "description is " + reference + " and the final description is " + obj.args.payment.description
    );

    // Assert on the signer (pos) address.
    assert.isTrue(
      obj.args.payment.posAddress === signer,
      "The payment's pos address must match in parsed vs. making. But the initial " +
      "pos address is " + signer + " and the final pos address is " + obj.args.payment.posAddress
    );

    // Assert on the brand address.
    assert.isTrue(
      obj.args.brandAddress === brandAddress,
      "The payment's brand address must match in parsed vs. making. But the initial " +
      "brand address is " + brandAddress + " and the final brand address is " + obj.args.brandAddress
    );

    // Assert on reward ids.
    assert.isTrue(
      obj.args.rewardIds.length === rewardIds.length && obj.args.rewardIds.every(function(element, index) {
        return element.cmp(rewardIds[index]) === 0
      }),
      "The payment's reward ids must match in parsed vs. making. But the initial " +
      "ids are " + JSON.stringify(obj.args.rewardIds) + " and the final ids are " +
      JSON.stringify(rewardIds)
    );

    // Assert on reward values.
    assert.isTrue(
      obj.args.rewardValues.length === rewardValues.length && obj.args.rewardValues.every(
        function(element, index) {
          return element.cmp(rewardValues[index]) === 0
        }
      ),
      "The payment's reward values must match in parsed vs. making. But the initial " +
      "values are " + JSON.stringify(obj.args.rewardValues) + " and the final values are " +
      JSON.stringify(rewardValues)
    );
  }

  it("must validate: good payment, native, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000")
    );
  });

  it("must validate: good payment, token, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000")
    );
  });

  it("must validate: good payment, tokens, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")]
    );
  });

  it("must validate: good payment, native, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "native", null, new web3.utils.BN("2000000000000000000")
    );
  });

  it("must validate: good payment, token, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "token", WMATIC, new web3.utils.BN("2000000000000000000")
    );
  });

  it("must validate: good payment, tokens, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")]
    );
  });

  it("must fail: the domain used for payment making is anything else", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, 1, "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")]
    )).to.be.rejectedWith(TypeError, "domain: the value must be of string type");
  });

  it("must fail: the domains not matching on make vs. parse", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.con", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")]
    )).to.be.rejectedWith(Error, "It does not start with: payto://lingr.com/real-world-payments?data=");
  });

  it("must fail: the signer not being a valid address for this web3 client", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      "0xacb7def96172617299ab987c8bb8e90c0098aedc", dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")]
    )).to.be.rejectedWith(Error, "Returned error: cannot sign data; no private key");
  });

  it("must fail: the timestamp is not a number", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      "0xacb7def96172617299ab987c8bb8e90c0098aedc", dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")]
    )).to.be.rejectedWith(Error, "Returned error: cannot sign data; no private key");
  });
});