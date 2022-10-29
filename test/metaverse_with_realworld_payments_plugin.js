const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const SimpleECDSASignatureVerifier = artifacts.require("SimpleECDSASignatureVerifier");
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
  txTotalGas,
  txGasDetails
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
  var GAS_COST = parseFloat(process.env.GAS_COST || "120000000000");
  var NATIVE_PRICE = parseFloat(process.env.NATIVE_PRICE || "0.8");

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
      metaverse.address, 30, accounts[9], [
        (await SimpleECDSASignatureVerifier.new({ from: accounts[0] })).address
      ], { from: accounts[0] }
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
    // And wrap some MATIC for accounts[9]
    let amount = new BN("20000000000000000000");
    await web3.eth.sendTransaction({from: accounts[9], to: mintingPlugin.address, value: amount});
    // Also: mint some brand1currency1 to account 0 (also brand2currency1).
    let cost = new BN("1000000000000000000");
    amount = new BN("100000000000000000000");
    await mintingPlugin.setCurrencyMintAmount(amount, {from: accounts[0]});
    await mintingPlugin.setCurrencyMintCost(cost, {from: accounts[0]});
    await mintingPlugin.mintBrandCurrency(accounts[0], brand1Currency1, 1, {from: accounts[1], value: cost});
    await mintingPlugin.mintBrandCurrency(accounts[0], brand2Currency1, 1, {from: accounts[2], value: cost});
    await mintingPlugin.mintBEAT(accounts[0], 1, {from: accounts[0]});
    // Finally: fund the rewards pot.
    await economy.safeTransferFrom(
      accounts[0], realWorldPaymentsPlugin.address, brand1Currency1, amount, payments.FUND_CALL,
      {from: accounts[0]}
    );
    await economy.safeBatchTransferFrom(
      accounts[0], realWorldPaymentsPlugin.address, [brand2Currency1], [amount], payments.FUND_BATCH_CALL,
      {from: accounts[0]}
    );
    await economy.safeTransferFrom(
      accounts[0], realWorldPaymentsPlugin.address, BEAT, amount, payments.FUND_CALL,
      {from: accounts[0]}
    );
    // Also: ensure brand1 is committed.
    await brandRegistry.updateBrandSocialCommitment(brand1, true);
  });

  it("must have the exected initial reward balances", async function() {
    let amount = new BN("100000000000000000000");
    let rewardFunds;
    // BEAT funds.
    rewardFunds = await realWorldPaymentsPlugin.balances(accounts[0], BEAT);
    assert.isTrue(
      amount.cmp(rewardFunds) === 0,
      "The expected BEAT funds must be 100 full tokens, not: " + rewardFunds.toString()
    );
    rewardFunds = await realWorldPaymentsPlugin.balances(accounts[0], brand1Currency1);
    assert.isTrue(
      amount.cmp(rewardFunds) === 0,
      "The expected Brand #1 Currency #1 funds must be 100 full tokens, not: " + rewardFunds.toString()
    );
    rewardFunds = await realWorldPaymentsPlugin.balances(accounts[0], brand2Currency1);
    assert.isTrue(
      amount.cmp(rewardFunds) === 0,
      "The expected Brand #2 Currency #1 funds must be 100 full tokens, not: " + rewardFunds.toString()
    );
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
   * @param tamperUrlData An optional function to "hack" the tamper data.
   * @param erc1155Address The address of the ERC1155 contract.
   * @param erc1155ABI The ABI of the ERC1155 contract.
   * @param paymentsAddress The address of the payments contract.
   * @param paymentsABI The ABI of the payments contract.
   * @param executorAddress The customer that will execute this query
   *   (in this case, this only serves for dryRun (gas estimation)).
   * @returns {Promise<void>} Just a promise to be awaited for
   */
  async function makePaymentAndThenParseIt(
      web3, domainForMakingPayment, domainForParsingPayment, signer, timestamp, dueTime, toAddress,
      reference, description, brandAddress, rewardIds, rewardValues, paymentType, paymentId, paymentValue,
      tamperUrlData, erc1155Address, erc1155ABI, paymentsAddress, paymentsABI, executorAddress
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

    if (tamperUrlData) {
      let prefix = "payto://" + domainForMakingPayment + "/real-world-payments?data=";
      let _obj = JSON.parse(decodeURIComponent(url.substr(prefix.length)));
      tamperUrlData(_obj);
      url = "payto://" + domainForMakingPayment + "/real-world-payments?data=" +
            encodeURIComponent(JSON.stringify(_obj));
    }

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

    let gas = await payments.executePaymentOrderConfirmationCall(
      obj, web3, executorAddress, erc1155Address, erc1155ABI, paymentsAddress, paymentsABI, true
    );
    console.log("dry run result:", gas * GAS_COST / 1000000000000000000 * NATIVE_PRICE);
  }

  it("must validate: good payment, native, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    );
  });

  it("must validate: good payment, token, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    );
  });

  it("must validate: good payment, tokens, no rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], null,
      economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    );
  });

  it("must validate: good payment, native, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "native", null, new web3.utils.BN("2000000000000000000"),
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    );
  });

  it("must validate: good payment, token, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "token", WMATIC, new web3.utils.BN("2000000000000000000"), null,
      economy.address, economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    );
  });

  it("must validate: good payment, tokens, with rewards", async function() {
    await makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")],
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    );
  });

  it("must fail: the domain used for payment making is anything else", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, 1, "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")],
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "domain: the value must be of string type");
  });

  it("must fail: the domains not matching on make vs. parse", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.con", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")],
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "It does not start with: payto://lingr.com/real-world-payments?data=");
  });

  it("must fail: the signer not being a valid address for this web3 client", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      "0xacb7def96172617299ab987c8bb8e90c0098aedc", dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")],
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Returned error: cannot sign data; no private key");
  });

  it("must fail: the toAddress is not an address", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, "0xinvalidaddress",
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("500000000000000000")],
      "tokens", [WMATIC], [new web3.utils.BN("2000000000000000000")],
      null, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "toAddress: the value must be a valid address");
  });

  it("must fail: the reference is not a string", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      1, "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "reference: the value must be of string type");
  });

  it("must fail: the description is not a string", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", 1, constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "description: the value must be of string type");
  });

  it("must fail: the brandAddress is not an address", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", "0xinvalidaddress",
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "brandAddress: the value must be a valid address");
  });

  it("must fail: reward ids and values have different length", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [new BN("1")], [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(Error, "Reward ids and values length mismatch");
  });

  it("must fail: reward ids is not an array of BNs", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      "", [], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "rewardIds: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [""], [new web3.utils.BN("1")], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(Error, "rewardIds.0: the value must be a BN instance");
  });

  it("must fail: reward values is not an array of BNs", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], "", "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "rewardValues: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [new web3.utils.BN("1")], [""], "native", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "rewardValues.0: the value must be a BN instance");
  });

  it("must fail: invalid payment type", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "invalid", null,
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(Error, "Invalid payment method type: invalid");
  });

  it("must fail: invalid token id for method 'token'", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", "badtokenid",
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "paymentMethod.id: the value must be a BN instance");
  });

  it("must fail: invalid token ids for method 'tokens'", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", "badtokenid",
      new web3.utils.BN("2000000000000000000"), null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi,
      accounts[9]
    )).to.be.rejectedWith(TypeError, "paymentMethod.ids: the values must be an array");
  });

  it("must fail: invalid token value for method 'native'", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      "badtokenvalue", null, economy.address,
      economy.abi, realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "paymentMethod.value: the value must be a BN instance");
  });

  it("must fail: invalid token value for method 'token'", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      "badtokenvalue", null, economy.address, economy.abi,
      realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "paymentMethod.value: the value must be a BN instance");
  });

  it("must fail: invalid token values for method 'tokens'", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      "badtokenvalues", null, economy.address, economy.abi,
      realWorldPaymentsPlugin.address, realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "paymentMethod.values: the values must be an array");
  });

  // The "url tampering" tests will start here.

  it("must fail: tamper -- invalid or non-matching PoS address", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.posAddress = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.payment.posAddress: the value must be a valid address");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.posAddress = accounts[5];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching target address", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.toAddress = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.toAddress: the value must be a valid address");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.toAddress = accounts[5];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching reference", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.reference = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.payment.reference: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.reference = "A tampered reference";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching description", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.description = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.payment.description: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.description = "A tampered description";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching stamp", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.now = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.payment.now: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.now = "foo";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.payment.now: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.payment.now = "3";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching due date", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.dueDate = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.dueDate: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.dueDate = "foo";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.dueDate: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.dueDate = "3";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching brand address", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.brandAddress = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.brandAddress: the value must be a valid address");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.brandAddress = accounts[5];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching rewards ids", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardIds = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardIds: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardIds = [1];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardIds.0: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardIds = ["foo"];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardIds.0: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardIds = [new web3.utils.BN("1")];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Reward ids and values length mismatch");
  });

  it("must fail: tamper -- invalid or non-matching rewards values", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardValues = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardValues: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardValues = [1];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardValues.0: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardValues = ["foo"];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.args.rewardValues.0: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.args.rewardValues = [new web3.utils.BN("1")];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Reward ids and values length mismatch");
  });

  it("must fail: tamper -- rewards signature check failure", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("1000000000000000000")],
      "native", null, new web3.utils.BN("2000000000000000000"),
      function(obj) {
        obj.args.rewardValues = [new web3.utils.BN("4")];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("1000000000000000000")],
      "native", null, new web3.utils.BN("2000000000000000000"),
      function(obj) {
        obj.args.rewardIds = [new web3.utils.BN("3")];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [brand1Currency1], [new web3.utils.BN("1000000000000000000")],
      "native", null, new web3.utils.BN("2000000000000000000"),
      function(obj) {
        obj.args.rewardIds = [new web3.utils.BN("3")];
        obj.args.rewardValues = [new web3.utils.BN("4")];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid native payment value", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.value = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.value: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.value = "foo";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.value: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "native", null,
      new web3.utils.BN("2000000000000000000"), function(obj) {
          obj.value = "1";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid token payment id", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.id = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.id: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.id = "foo";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.id: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.id = "1";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid token payment value", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.value = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.value: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.value = "foo";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.value: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "token", WMATIC,
      new web3.utils.BN("2000000000000000000"), function(obj) {
        obj.value = "1";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- invalid or non-matching tokens payment ids", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.ids: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = [1];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.ids.0: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = ["foo"];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.ids.0: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = [WMATIC.toString(), brand1Currency1.toString()];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "ids and values length mismatch");
  });

  it("must fail: tamper -- invalid or non-matching tokens payment values", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [brand1Currency1],
      [new web3.utils.BN("1000000000000000000")], function(obj) {
        obj.values = 1;
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.values: the values must be an array");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [brand1Currency1],
      [new web3.utils.BN("1000000000000000000")], function(obj) {
        obj.values = [1];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.values.0: the value must be of string type");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [brand1Currency1],
      [new web3.utils.BN("1000000000000000000")], function(obj) {
        obj.values = ["foo"];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(TypeError, "obj.values.0: the value must satisfy pattern: unsigned integer");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [brand1Currency1],
      [new web3.utils.BN("1000000000000000000")], function(obj) {
        obj.values = ["1", "1"];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "ids and values length mismatch");
  });

  it("must fail: tamper -- tokens signature check failure", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.values = [new web3.utils.BN("1000000000000000000").toString()];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = [brand1Currency1.toString()];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");

    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.ids = [brand1Currency1.toString()];
        obj.values = [new web3.utils.BN("1000000000000000000").toString()];
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  it("must fail: tamper -- signature check", async function() {
    await expect(makePaymentAndThenParseIt(
      web3, "lingr.com", "lingr.com",
      accounts[0], dates.timestamp(), 300, accounts[1],
      "PAY:000000001-001-001", "My payment", constants.ZERO_ADDRESS,
      [], [], "tokens", [WMATIC],
      [new web3.utils.BN("2000000000000000000")], function(obj) {
        obj.args.paymentSignature = "0x1212121212121212121212121212121212121212121212121212121212121212" +
                                    "121212121212121212121212121212121212121212121212121212121212121212";
      }, economy.address, economy.abi, realWorldPaymentsPlugin.address,
      realWorldPaymentsPlugin.abi, accounts[9]
    )).to.be.rejectedWith(Error, "Signature check failed");
  });

  // The true execution tests start here.

  let rewardsTypes = ["no-rewards", "with-rewards"];
  let paymentTypes = ["native", "token", "tokens"];
  let brandTypes = ["no-brand", "non-committed-brand", "committed-brand"];

  for(let idxRewardsType = 0; idxRewardsType < rewardsTypes.length; idxRewardsType++) {
    for(let idxPaymentType = 0; idxPaymentType < paymentTypes.length; idxPaymentType++) {
      for(let idxBrandType = 0; idxBrandType < brandTypes.length; idxBrandType++) {
        let rewardsType = rewardsTypes[idxRewardsType];
        let paymentType = paymentTypes[idxPaymentType];
        let brandType = brandTypes[idxBrandType];

        let settingsCaption = "[rewards:" + rewardsType + "; payment:" + paymentType + "; brand:" + brandType + "]";

        // First, the base settings.

        async function buildTestPaymentObj() {
          let now = dates.timestamp();
          let obj = {
            args: {
              toAddress: accounts[3],
              payment: {
                posAddress: accounts[0],
                reference: "000001-" + settingsCaption,
                description: "My 1st Payment (" + settingsCaption + ")",
                now: now
              },
              dueDate: now + 30
            }
          };

          let rewardToken = null;
          switch(brandType) {
            case "no-brand":
              obj.args.brandAddress = constants.ZERO_ADDRESS;
              rewardToken = BEAT;
              break;
            case "non-committed-brand":
              obj.args.brandAddress = brand2;
              rewardToken = brand2Currency1;
              break;
            case "committed-brand":
              obj.args.brandAddress = brand1;
              rewardToken = brand1Currency1
              break;
            default:
              throw new Error("Unexpected brandType value on test: " + brandType);
          }

          switch(rewardsType) {
            case "no-rewards":
              obj.args.rewardIds = [];
              obj.args.rewardValues = [];
              break;
            case "with-rewards":
              obj.args.rewardIds = [rewardToken];
              obj.args.rewardValues = [new web3.utils.BN("1000000000000000000")];
              break;
            default:
              throw new Error("Unexpected rewardsType value on test: " + rewardsType);
          }

          let messageHash = "";
          obj.type = paymentType;
          switch(paymentType) {
            case "native":
              obj.value = new web3.utils.BN("1000000000000000000");
              messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                  {type: 'address', value: obj.args.payment.posAddress},
                  {type: 'string', value: obj.args.payment.reference},
                  {type: 'string', value: obj.args.payment.description},
                  {type: 'uint256', value: obj.args.payment.now}
                )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256', value: obj.value},
              );
              break;
            case "token":
              obj.id = WMATIC;
              obj.value = new web3.utils.BN("1000000000000000000");
              messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                  {type: 'address', value: obj.args.payment.posAddress},
                  {type: 'string', value: obj.args.payment.reference},
                  {type: 'string', value: obj.args.payment.description},
                  {type: 'uint256', value: obj.args.payment.now}
                )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256', value: obj.id},
                {type: 'uint256', value: obj.value},
              );
              break;
            case "tokens":
              obj.ids = [WMATIC];
              obj.values = [new web3.utils.BN("1000000000000000000")];
              messageHash = web3.utils.soliditySha3(
                {type: 'address', value: obj.args.toAddress},
                {type: 'bytes32', value: web3.utils.soliditySha3(
                  {type: 'address', value: obj.args.payment.posAddress},
                  {type: 'string', value: obj.args.payment.reference},
                  {type: 'string', value: obj.args.payment.description},
                  {type: 'uint256', value: obj.args.payment.now}
                )},
                {type: 'uint256', value: obj.args.dueDate},
                {type: 'address', value: obj.args.brandAddress},
                {type: 'uint256[]', value: obj.args.rewardIds},
                {type: 'uint256[]', value: obj.args.rewardValues},
                {type: 'uint256[]', value: obj.ids},
                {type: 'uint256[]', value: obj.values},
              );
              break;
          }

          obj.args.paymentSignature = await web3.eth.sign(messageHash, accounts[0]);

          return obj;
        }

        // TODO these tests fail: {with-rewards} x {token, tokens}

        it("must validate: a good transaction using settings " + settingsCaption, async function f() {
          let obj = await buildTestPaymentObj();
          let brandPermissionGranter = null;
          switch(obj.args.brandAddress) {
            case brand1:
              brandPermissionGranter = accounts[1];
              break;
            case brand2:
              brandPermissionGranter = accounts[2];
              break;
          }

          // Set BRAND_SIGN_PAYMENTS to accounts[0] in the brand.
          if (brandPermissionGranter) {
            await brandRegistry.brandSetPermission(
              obj.args.brandAddress, BRAND_SIGN_PAYMENTS, accounts[0], true, { from: brandPermissionGranter }
            );
          }

          let gasAmount = new web3.utils.BN("200000");
          let tx = await payments.executePaymentOrderConfirmationCall(
            obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
            realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
          );
          let wrappedTx = {
            receipt: {
              gasUsed: tx.gasUsed,
            },
            tx: tx.transactionHash
          }
          console.log("TX gas details (" + settingsCaption + "):", await txGasDetails(web3, wrappedTx));

          // Unset BRAND_SIGN_PAYMENTS to accounts[0] in the brand.
          if (brandPermissionGranter) {
            await brandRegistry.brandSetPermission(
              obj.args.brandAddress, BRAND_SIGN_PAYMENTS, accounts[0], false, {from: brandPermissionGranter}
            );
          }
        });
      }
    }
  }
});