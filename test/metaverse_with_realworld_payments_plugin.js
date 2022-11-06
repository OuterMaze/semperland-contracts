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
  const METAVERSE_MANAGE_FEE_SETTINGS = web3.utils.soliditySha3("Plugins::RealWorldPayments::Fee::Manage");
  const METAVERSE_MANAGE_AGENT_SETTINGS = web3.utils.soliditySha3("Plugins::RealWorldPayments::Agents::Manage");

  before(async function () {
    // Set up the metaverse and two plug-ins.
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] });
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[8], { from: accounts[0] });
    definitionPlugin = await CurrencyDefinitionPlugin.new(
      metaverse.address, accounts[8],
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
      metaverse.address, definitionPlugin.address, accounts[8], { from: accounts[0] }
    );
    realWorldPaymentsPlugin = await RealWorldPaymentsPlugin.new(
      metaverse.address, 30, accounts[8], [
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
    // And grant some BEAT to accounts[9].
    await mintingPlugin.mintBEAT(accounts[9], 1, {from: accounts[0]});
    // And continue minting for accounts[0] (rewards).
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

  async function buildTestPaymentObj(rewardsType, paymentType, brandType, settingsCaption, params) {
    params = params || {};
    let now = params.now || dates.timestamp();
    let obj = {
      args: {
        toAddress: params.toAddress || accounts[3],
        payment: {
          posAddress: params.posAddress || accounts[0],
          reference: params.reference || ("000001-" + settingsCaption),
          description: params.description || ("My 1st Payment (" + settingsCaption + ")"),
          now: now
        },
        dueDate: now + (params.dueTime || 30)
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
        obj.args.rewardValues = [params.rewardAmount || new web3.utils.BN("1000000000000000000")];
        break;
      default:
        throw new Error("Unexpected rewardsType value on test: " + rewardsType);
    }

    let messageHash = "";
    let tokenValue = params.tokenValue || new web3.utils.BN("10000000000000000");
    obj.type = paymentType;
    switch(paymentType) {
      case "native":
        obj.value = tokenValue;
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
        obj.value = tokenValue;
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
        obj.values = [tokenValue];
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

  for(let idxRewardsType = 0; idxRewardsType < rewardsTypes.length; idxRewardsType++) {
    for(let idxPaymentType = 0; idxPaymentType < paymentTypes.length; idxPaymentType++) {
      for(let idxBrandType = 0; idxBrandType < brandTypes.length; idxBrandType++) {
        let rewardsType = rewardsTypes[idxRewardsType];
        let paymentType = paymentTypes[idxPaymentType];
        let brandType = brandTypes[idxBrandType];

        let settingsCaption = "[rewards:" + rewardsType + "; payment:" + paymentType + "; brand:" + brandType + "]";

        // First, the base settings.

        it("must validate: a good transaction using settings " + settingsCaption, async function f() {
          let obj = await buildTestPaymentObj(rewardsType, paymentType, brandType, settingsCaption);
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

          // Get the balance of the reward token.
          let rewardTokenBalance = obj.args.rewardIds.length === 0 ? 0 : (
            await realWorldPaymentsPlugin.balances(accounts[0], obj.args.rewardIds[0])
          );

          // Get the balance(s) of the payment token, and the fee.
          let targetTokenBalance;
          let feeReceiverTokenBalance;
          let tokenValue = new web3.utils.BN("10000000000000000");
          let paymentFeeDetails = await realWorldPaymentsPlugin.paymentFee(obj.args.payment.posAddress);
          let receiverFee = paymentFeeDetails['0'];
          assert.isTrue(
            receiverFee.cmp(new web3.utils.BN('30000')) === 0,
            "The receiver fee must be 30000 for this test, not " + receiverFee.toString()
          )
          let absoluteReceiverFee = tokenValue.mul(receiverFee).divn(1000000);
          let absoluteRemainder = tokenValue.sub(absoluteReceiverFee);
          switch(paymentType) {
            case "native":
              targetTokenBalance = new web3.utils.BN(await web3.eth.getBalance(obj.args.toAddress));
              feeReceiverTokenBalance = new web3.utils.BN(await web3.eth.getBalance(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver()
              ));
              break;
            case "token":
              targetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.id);
              feeReceiverTokenBalance = await economy.balanceOf(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.id
              );
              break;
            case "tokens":
              targetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.ids[0]);
              feeReceiverTokenBalance = await economy.balanceOf(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.ids[0]
              );
              break;
          }

          // Execute a working transaction.
          let gasAmount = new web3.utils.BN("250000");
          let tx = await payments.executePaymentOrderConfirmationCall(
            obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
            realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
          );
          console.log(
            "TX price (USD for " + settingsCaption + "):", tx.gasUsed * GAS_COST / 1000000000000000000 * NATIVE_PRICE
          );

          // Assert on the rewards being delivered.
          if (obj.args.rewardIds.length) {
            let newRewardTokenBalance = await realWorldPaymentsPlugin.balances(accounts[0], obj.args.rewardIds[0]);
            let expectedNewRewardTokenBalance = rewardTokenBalance.sub(obj.args.rewardValues[0]);
            assert.isTrue(
              newRewardTokenBalance.cmp(expectedNewRewardTokenBalance) === 0,
              "The new reward token balance should be " + expectedNewRewardTokenBalance.toString() + " since that " +
              "one results of subtracting " + obj.args.rewardValues[0].toString() + " from " +
              rewardTokenBalance.toString() + ", but instead it is " + newRewardTokenBalance.toString()
            );
          }

          // Get the NEW balance(s) of the payment token, and the fee.
          let newTargetTokenBalance;
          let newFeeReceiverTokenBalance;
          switch(paymentType) {
            case "native":
              newTargetTokenBalance = new web3.utils.BN(await web3.eth.getBalance(obj.args.toAddress));
              newFeeReceiverTokenBalance = new web3.utils.BN(await web3.eth.getBalance(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver()
              ));
              break;
            case "token":
              newTargetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.id);
              newFeeReceiverTokenBalance = await economy.balanceOf(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.id
              );
              break;
            case "tokens":
              newTargetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.ids[0]);
              newFeeReceiverTokenBalance = await economy.balanceOf(
                await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.ids[0]
              );
              break;
          }

          // Assert on the balances & fees.
          if (brandType === "committed-brand") {
            assert.isTrue(
              newFeeReceiverTokenBalance.cmp(feeReceiverTokenBalance) === 0,
              "The new and old fee receiver token balances must be the same, since the commission is 0%. " +
              "Expected value: " + feeReceiverTokenBalance.toString() +
              ", actual value: " + newFeeReceiverTokenBalance.toString()
            );
            assert.isTrue(
              newTargetTokenBalance.cmp(targetTokenBalance.add(tokenValue)) === 0,
              "The new and old target token balances must be the original plus the full token value, since " +
              "the commission is 0%. " +
              "Expected value: " + targetTokenBalance.toString() + " + " + tokenValue.toString() +
              ", actual value: " + newTargetTokenBalance.toString()
            );
          } else {
            assert.isTrue(
              newFeeReceiverTokenBalance.cmp(feeReceiverTokenBalance.add(absoluteReceiverFee)) === 0,
              "The new and old fee receiver token balances must be right, since the commission is 3%. " +
              "Expected value: " + feeReceiverTokenBalance.toString() + " + " + absoluteReceiverFee.toString() +
              ", actual value: " + newFeeReceiverTokenBalance.toString()
            );
            assert.isTrue(
              newTargetTokenBalance.cmp(targetTokenBalance.add(absoluteRemainder)) === 0,
              "The new and old target token balances must be the original plus the remaining value, since " +
              "the commission is 3%. " +
              "Expected value: " + targetTokenBalance.toString() + " + " + absoluteRemainder.toString() +
              ", actual value: " + newTargetTokenBalance.toString()
            );
          }

          // Execute a REPEATED transaction. This causes an exception.
          await expectRevert(
            payments.executePaymentOrderConfirmationCall(
              obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
              realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
            ),
            "RealWorldPaymentsPlugin: payment already processed"
          );

          // Unset BRAND_SIGN_PAYMENTS to accounts[0] in the brand.
          if (brandPermissionGranter) {
            await brandRegistry.brandSetPermission(
              obj.args.brandAddress, BRAND_SIGN_PAYMENTS, accounts[0], false, {from: brandPermissionGranter}
            );

            // Now try executing a different request, but the brand does not
            // authorize the PoS.
            obj = await buildTestPaymentObj(rewardsType, paymentType, brandType, settingsCaption, {
              reference: "000002-" + settingsCaption, description: "My 2nd Payment (" + settingsCaption + ")"
            });
            // console.log("new obj is (second request):", obj);
            await expectRevert(
              payments.executePaymentOrderConfirmationCall(
                obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
                realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
              ),
              "RealWorldPaymentsPlugin: a brand is given for the payment, " +
              "but the signer is not allowed to sign into it"
            );

            await brandRegistry.brandSetPermission(
              obj.args.brandAddress, BRAND_SIGN_PAYMENTS, accounts[0], true, {from: brandPermissionGranter}
            );
          }
        });

        // Data corruption validation starts here.

        let gasAmount = new web3.utils.BN("250000");
        let errorMessage;
        let callbacks = [
          ["changing posAddress", function(obj) { obj.args.payment.posAddress = accounts[5]; }],
          ["changing reference", function(obj) { obj.args.payment.reference = "00000INVALID"; }],
          ["changing description", function(obj) { obj.args.payment.description = "A corrupted description"; }],
          ["changing timestamp", function(obj) { obj.args.payment.now += 7; }],
          ["changing due date", function(obj) { obj.args.dueDate += 7; }],
          ["changing toAddress", function(obj) { obj.args.toAddress = accounts[9]; }],
          ["changing brandAddress", function(obj) { obj.args.brandAddress = accounts[0]; }],
        ];

        switch(paymentType) {
          case "native":
            callbacks.push(
              ["changing value", function(obj) { obj.value = new web3.utils.BN("2000000000000000000"); }]
            );
            errorMessage = "RealWorldPaymentsPlugin: native payment signature verification failed";
            break;
          case "token":
            callbacks.push(
              ["changing value", function(obj) { obj.value = new web3.utils.BN("2000000000000000000"); }],
              ["changing id", function(obj) { obj.id = BEAT; }]
            );
            errorMessage = "RealWorldPaymentsPlugin: token payment signature verification failed";
            break;
          case "tokens":
            callbacks.push(
              ["changing values", function(obj) { obj.values = [new web3.utils.BN("2000000000000000000")]; }],
              ["changing ids", function(obj) { obj.ids = [BEAT]; }]
            );
            errorMessage = "RealWorldPaymentsPlugin: batch token payment signature verification failed";
            break;
        }

        if (rewardsType === "no-rewards") {
          callbacks.push(
            ["changing reward ids", function(obj) { obj.args.rewardIds = [BEAT, WMATIC]; }],
            ["changing reward values", function(obj) {
              obj.args.rewardIds = [
                new web3.utils.BN("10000000000000000"), new web3.utils.BN("10000000000000000")
              ];
            }],
            ["changing both reward values (breaking lengths)", function(obj) {
              obj.args.rewardIds = [BEAT, WMATIC];
              obj.args.rewardIds = [
                new web3.utils.BN("10000000000000000")
              ];
            }],
            ["changing both reward values", function(obj) {
              obj.args.rewardIds = [BEAT, WMATIC];
              obj.args.rewardIds = [
                new web3.utils.BN("10000000000000000"), new web3.utils.BN("10000000000000000")
              ];
            }],
          );
        } else {
          callbacks.push(
            ["changing reward ids (keeping length)", function(obj) { obj.args.rewardIds = [
              obj.args.rewardIds[0] === brand1Currency1 ? BEAT : brand1Currency1
            ]; }],
            ["changing reward ids (breaking length)", function(obj) { obj.args.rewardIds = [BEAT, WMATIC]; }],
            ["changing reward values (keeping length)", function(obj) {
              obj.args.rewardIds = [
                new web3.utils.BN("20000000000000000")
              ];
            }],
            ["changing reward values (breaking length)", function(obj) {
              obj.args.rewardIds = [
                new web3.utils.BN("10000000000000000"), new web3.utils.BN("10000000000000000")
              ];
            }],
          );
        }

        for(let callbackIndex = 0; callbackIndex < callbacks.length; callbackIndex++) {
          let callback = callbacks[callbackIndex];

          it("must validate data errors using settings " + settingsCaption + " and callback: '" + callback[0] + "'",
              async function() {
            let obj = await buildTestPaymentObj(rewardsType, paymentType, brandType, settingsCaption);
            await new Promise(function(r) { setTimeout(r, 5); });
            // console.log("posAddress:", obj.args.payment.posAddress, "signature:", obj.args.paymentSignature);
            // console.log("callback:", callbacks[callbackIndex]);
            callback[1](obj);
            // console.log("posAddress:", obj.args.payment.posAddress, "signature:", obj.args.paymentSignature);
            await expectRevert(
              payments.executePaymentOrderConfirmationCall(
                obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
                realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
              ), errorMessage
            );
          });
        }

        it("must reject expired payments using settings: " + settingsCaption, async function() {
          let obj = await buildTestPaymentObj(
            rewardsType, paymentType, brandType, settingsCaption,
            {now: dates.timestamp() - 2000, reference: "00003", description: "third payment"}
          );

          await new Promise(function(r) { setTimeout(r, 5); });
          await expectRevert(
            payments.executePaymentOrderConfirmationCall(
              obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
              realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
            ), "RealWorldPaymentsPlugin: expired payment"
          );
        });

        if (rewardsType === "with-rewards") {
          it("must reject payments with exceeding rewards: " + settingsCaption, async function() {
            let obj = await buildTestPaymentObj(
              rewardsType, paymentType, brandType, settingsCaption,
              {rewardAmount: new web3.utils.BN("1000000000000000000000")}
            );

            await new Promise(function(r) { setTimeout(r, 5); });
            // This returns an empty native exception, which is converted to the opaque
            // message: "ERC1155: transfer to non ERC1155Receiver implementer". In my
            // opinion this is a platform limitation, but this is what we have so far.
            // BUT FOR THE NATIVE TRANSACTIONS the message is "revert".
            await expectRevert(
              payments.executePaymentOrderConfirmationCall(
                obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
                realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
              ), "er"
            );
          });
        }
      }
    }
  }

  // Tests on permissions and restrictions for setPaymentFeeEarningsReceiver and setPaymentFeeDefaultAmount.

  describe("agent-related tests", function() {
    it("must have an initial fee of 30 (this is: 30 over 1000)", async function() {
      let defaultAmount = await realWorldPaymentsPlugin.paymentFeeDefaultAmount();
      assert.isTrue(
        defaultAmount.cmp(new BN("30")) === 0,
        "The initial paymentFeeDefaultAmount must be 30, not " + defaultAmount.toString()
      );
    });

    it("must have a limit of 30 (this is: 30 over 1000)", async function() {
      let limit = await realWorldPaymentsPlugin.paymentFeeLimit();
      assert.isTrue(
        limit.cmp(new BN("30")) === 0,
        "The paymentFeeLimit must be 30, not " + limit.toString()
      );
    });

    it("must not allow account 8 to set the default fee amount, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("29"), {from: accounts[8]}),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
      )
    });

    it("must not allow account 8 to grant the METAVERSE_MANAGE_FEE_SETTINGS on itself", async function() {
      await expectRevert(
        metaverse.setPermission(METAVERSE_MANAGE_FEE_SETTINGS, accounts[8], true, { from: accounts[8] }),
        revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
      );
    });

    it("must allow account 0 to grant METAVERSE_MANAGE_FEE_SETTINGS to account 8", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_FEE_SETTINGS, accounts[8], true, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_FEE_SETTINGS, "user": accounts[8], "set": true, sender: accounts[0]
        }
      )
    });

    it("must not allow account 8 to set the default amount to 31 since it passes the limit", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("31"), {from: accounts[8]}),
        revertReason(
          "RealWorldPaymentsPlugin: the default payment fee must be between 1 / 1000 and the payment fee limit"
        )
      );
    });

    it("must not allow account 8 to set the default amount to 0", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("0"), {from: accounts[8]}),
        revertReason(
          "RealWorldPaymentsPlugin: the default payment fee must be between 1 / 1000 and the payment fee limit"
        )
      );
    });

    it("must allow account 8 to set the default value to 25", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("25"), {from: accounts[8]}),
        "PaymentFeeDefaultAmountUpdated", {
          "updatedBy": accounts[8], "newAmount": new BN("25")
        }
      );
      let defaultAmount = await realWorldPaymentsPlugin.paymentFeeDefaultAmount();
      assert.isTrue(
        defaultAmount.cmp(new BN("25")) === 0,
        "The initial paymentFeeDefaultAmount must be 25, not " + defaultAmount.toString()
      );
    });

    it("must allow account 0 to set the default value to 27", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("27"), {from: accounts[0]}),
        "PaymentFeeDefaultAmountUpdated", {
          "updatedBy": accounts[0], "newAmount": new BN("27")
        }
      );
      let defaultAmount = await realWorldPaymentsPlugin.paymentFeeDefaultAmount();
      assert.isTrue(
        defaultAmount.cmp(new BN("27")) === 0,
        "The initial paymentFeeDefaultAmount must be 27, not " + defaultAmount.toString()
      );
    });

    it("must allow account 0 to revoke METAVERSE_MANAGE_FEE_SETTINGS to account 8", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_FEE_SETTINGS, accounts[8], false, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_FEE_SETTINGS, "user": accounts[8], "set": false, sender: accounts[0]
        }
      );
    });

    it("must not allow account 8 to set the default fee amount, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeDefaultAmount(new BN("29"), {from: accounts[8]}),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
      );
    });

    it("must have the fee receiver as account 8", async function() {
      let earningsReceiver = await realWorldPaymentsPlugin.paymentFeeEarningsReceiver();
      assert.isTrue(
        earningsReceiver === accounts[8],
        "The initial paymentFeeEarningsReceiver must account 8, not " + earningsReceiver
      );
    });

    it("must not allow account 8 to set the earnings receiver, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeEarningsReceiver(accounts[7], {from: accounts[8]}),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
      );
    });

    it("must allow account 0 to grant METAVERSE_MANAGE_FEE_SETTINGS to account 8", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_FEE_SETTINGS, accounts[8], true, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_FEE_SETTINGS, "user": accounts[8], "set": true, sender: accounts[0]
        }
      );
    });

    it("must not allow setting the earnings receiver to the zero address", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeEarningsReceiver(constants.ZERO_ADDRESS, {from: accounts[8]}),
        revertReason(
          "RealWorldPaymentsPlugin: the fee earnings receiver must not be the 0 address"
        )
      );
    });

    it("must allow account 8 to set the earnings receiver to account 7", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.setPaymentFeeEarningsReceiver(accounts[7], {from: accounts[8]}),
        "PaymentFeeEarningsReceiverUpdated", {
          "updatedBy": accounts[8], "newReceiver": accounts[7]
        }
      );
    });

    it("must allow account 0 to set the earnings receiver to account 8", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.setPaymentFeeEarningsReceiver(accounts[8], {from: accounts[0]}),
        "PaymentFeeEarningsReceiverUpdated", {
          "updatedBy": accounts[0], "newReceiver": accounts[8]
        }
      );
    });

    it("must allow account 0 to revoke METAVERSE_MANAGE_FEE_SETTINGS to account 8", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_FEE_SETTINGS, accounts[8], false, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_FEE_SETTINGS, "user": accounts[8], "set": false, sender: accounts[0]
        }
      );
    });

    it("must not allow account 8 to set the earnings receiver, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setPaymentFeeEarningsReceiver(accounts[7], {from: accounts[8]}),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
      );
    });

    it("must not allow account 1 to use account 7 as agent, since account 7 it not an agent", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setAgent(accounts[7], {from: accounts[1]}),
        revertReason("RealWorldPaymentsPlugin: the chosen address is not an active agent")
      );
    });

    it("must not allow account 9 to set account 7 as an agent, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(600), {from: accounts[9]}),
        revertReason(
          "MetaversePlugin: caller is not metaverse owner, and does not have the required permission"
        )
      );
    });

    it("must not allow account 8 to grant the METAVERSE_MANAGE_FEE_SETTINGS on itself", async function() {
      await expectRevert(
        metaverse.setPermission(METAVERSE_MANAGE_AGENT_SETTINGS, accounts[9], true, { from: accounts[9] }),
        revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
      );
    });

    it("must allow account 0 to grant METAVERSE_MANAGE_FEE_SETTINGS to account 9", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_AGENT_SETTINGS, accounts[9], true, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_AGENT_SETTINGS, "user": accounts[9], "set": true, sender: accounts[0]
        }
      );
    });

    it("must not allow account 9 to set address 0 as agent, since that address is not allowed", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.updatePaymentFeeAgent(constants.ZERO_ADDRESS, new BN(600), {from: accounts[9]}),
        revertReason(
          "RealWorldPaymentsPlugin: the agent must not be the zero address"
        )
      );
    });

    it("must now allow account 0 to set account 7 as agent with a fraction > 999", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(1000), {from: accounts[9]}),
        revertReason(
          "RealWorldPaymentsPlugin: the fee fraction must be between 1 and 999"
        )
      );
    });

    it("must allow account 9 to set accounts 7 as agent with a fraction of 600", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(600), {from: accounts[9]}),
        "PaymentFeeAgentUpdated", {
          "updatedBy": accounts[9], "agent": accounts[7], "feeFraction": new BN(600)
        }
      );
    });

    it("must allow account 0 to set accounts 6 as agent with a fraction of 550", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[6], new BN(550), {from: accounts[0]}),
        "PaymentFeeAgentUpdated", {
          "updatedBy": accounts[0], "agent": accounts[6], "feeFraction": new BN(550)
        }
      );
    });

    it("must have the agents settings appropriately", async function() {
      let agent6 = await realWorldPaymentsPlugin.agents(accounts[6]);
      let agent7 = await realWorldPaymentsPlugin.agents(accounts[7]);
      assert.isTrue(
        agent6.feeFraction.cmp(new BN(550)) === 0 && agent6.active,
        "The account 6 must be an active agent with a fraction of 550"
      );
      assert.isTrue(
        agent7.feeFraction.cmp(new BN(600)) === 0 && agent7.active,
        "The account 7 must be an active agent with a fraction of 600"
      );
    });

    it("must allow account 0 to revoke account 6 as agent", async function() {
      await expectEvent(
        await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[6], new BN(0), {from: accounts[0]}),
        "PaymentFeeAgentUpdated", {
          "updatedBy": accounts[0], "agent": accounts[6], "feeFraction": new BN(0)
        }
      );
    });

    it("must have the agents settings appropriately (2)", async function() {
      let agent6 = await realWorldPaymentsPlugin.agents(accounts[6]);
      let agent7 = await realWorldPaymentsPlugin.agents(accounts[7]);
      assert.isTrue(
        agent6.feeFraction.cmp(new BN(550)) === 0 && !agent6.active,
        "The account 6 must be an INactive agent with a fraction of 550"
      );
      assert.isTrue(
        agent7.feeFraction.cmp(new BN(600)) === 0 && agent7.active,
        "The account 7 must be an active agent with a fraction of 600"
      );
    });

    it("must allow account 0 to revoke METAVERSE_MANAGE_FEE_SETTINGS to account 9", async function() {
      await expectEvent(
        await metaverse.setPermission(METAVERSE_MANAGE_AGENT_SETTINGS, accounts[9], false, {from: accounts[0]}),
        "PermissionChanged", {
          "permission": METAVERSE_MANAGE_AGENT_SETTINGS, "user": accounts[9], "set": false, sender: accounts[0]
        }
      );
    });

    it("must not allow account 9 to set account 7 as an agent, because it lacks the permission", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(600), {from: accounts[9]}),
        revertReason(
          "MetaversePlugin: caller is not metaverse owner, and does not have the required permission"
        )
      );
    });

    it("must allow account 1 to choose account 7 as agent", async function() {
      await realWorldPaymentsPlugin.setAgent(accounts[7], {from: accounts[1]});
    });

    it("must now allow account 1 to choose account 6 as agent", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setAgent(accounts[6], {from: accounts[1]}),
        revertReason(
          "RealWorldPaymentsPlugin: the chosen address is not an active agent"
        )
      );
    });

    it("must not allow account 7 to set the fee to account 2, since it is not their agent", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setFee(accounts[2], new BN(28), {from: accounts[6]}),
        "RealWorldPaymentsPlugin: the sender is not an active agent"
      );
    });

    it("must allow account 2 to choose account 7 as its agent", async function() {
      await realWorldPaymentsPlugin.setAgent(accounts[7], {from: accounts[2]});
    });

    it("must have the proper fee settings", async function() {
      let result1 = await realWorldPaymentsPlugin.paymentFee(accounts[1]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
        result1['0'].cmp(new BN(27 * 400)) === 0 &&
        result1['1'].cmp(new BN(27 * 600)) === 0 &&
        result1['2'] === accounts[7],
        "The expected fee settings for account 1 must be (27 * 400, 27 * 600, account 7), not " +
        "(" + result1['0'].toString() + ", " + result1['1'].toString() + ", " + result1['2'] + ")"
      );

      let result2 = await realWorldPaymentsPlugin.paymentFee(accounts[2]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
        result2['0'].cmp(new BN(27 * 400)) === 0 &&
        result2['1'].cmp(new BN(27 * 600)) === 0 &&
        result2['2'] === accounts[7],
        "The expected fee settings for account 1 must be (27 * 400, 27 * 600, account 2), not " +
        "(" + result2['0'].toString() + ", " + result2['1'].toString() + ", " + result2['2'] + ")"
      );
    });

    function testAppropriateFees() {
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

            it("must pass 18 tests, expecting different fees for agent", async function() {
              let obj = await buildTestPaymentObj(rewardsType, paymentType, brandType, settingsCaption, {
                tokenValue: new web3.utils.BN("10")
              });
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

              // Get the balance of the reward token.
              let rewardTokenBalance = obj.args.rewardIds.length === 0 ? 0 : (
                  await realWorldPaymentsPlugin.balances(accounts[0], obj.args.rewardIds[0])
              );

              // Get the balance(s) of the payment token, and the fee.
              let targetTokenBalance;
              let feeReceiverTokenBalance;
              let agentTokenBalance;
              let tokenValue = new web3.utils.BN("10");
              let paymentFeeDetails = await realWorldPaymentsPlugin.paymentFee(obj.args.payment.posAddress);
              let receiverFee = paymentFeeDetails['0'];
              let agentFee = paymentFeeDetails['1'];
              let agent = paymentFeeDetails['2'];
              let absoluteReceiverFee = tokenValue.mul(receiverFee).divn(1000000);
              let absoluteAgentFee = tokenValue.mul(agentFee).divn(1000000);
              let absoluteRemainder = tokenValue.sub(absoluteReceiverFee).sub(absoluteAgentFee);
              switch(paymentType) {
                case "native":
                  targetTokenBalance = new web3.utils.BN(await web3.eth.getBalance(obj.args.toAddress));
                  feeReceiverTokenBalance = new web3.utils.BN(await web3.eth.getBalance(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver()
                  ));
                  if (agent !== constants.ZERO_ADDRESS) {
                    agentTokenBalance = new web3.utils.BN(await web3.eth.getBalance(agent));
                  }
                  break;
                case "token":
                  targetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.id);
                  feeReceiverTokenBalance = await economy.balanceOf(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.id
                  );
                  if (agent !== constants.ZERO_ADDRESS) {
                    agentTokenBalance = await economy.balanceOf(agent, obj.id);
                  }
                  break;
                case "tokens":
                  targetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.ids[0]);
                  feeReceiverTokenBalance = await economy.balanceOf(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.ids[0]
                  );
                  if (agent !== constants.ZERO_ADDRESS) {
                    agentTokenBalance = await economy.balanceOf(agent, obj.ids[0]);
                  }
                  break;
              }

              // Execute a working transaction.
              let gasAmount = new web3.utils.BN("250000");
              let tx = await payments.executePaymentOrderConfirmationCall(
                obj, web3, accounts[9], economy.address, economy.abi, realWorldPaymentsPlugin.address,
                realWorldPaymentsPlugin.abi, false, {amount: gasAmount}
              );
              console.log(
                "TX price (USD for " + settingsCaption + "):", tx.gasUsed * GAS_COST / 1000000000000000000 * NATIVE_PRICE
              );

              // Assert on the rewards being delivered.
              if (obj.args.rewardIds.length) {
                let newRewardTokenBalance = await realWorldPaymentsPlugin.balances(accounts[0], obj.args.rewardIds[0]);
                let expectedNewRewardTokenBalance = rewardTokenBalance.sub(obj.args.rewardValues[0]);
                assert.isTrue(
                  newRewardTokenBalance.cmp(expectedNewRewardTokenBalance) === 0,
                  "The new reward token balance should be " + expectedNewRewardTokenBalance.toString() + " since that " +
                  "one results of subtracting " + obj.args.rewardValues[0].toString() + " from " +
                  rewardTokenBalance.toString() + ", but instead it is " + newRewardTokenBalance.toString()
                );
              }

              // Get the NEW balance(s) of the payment token, and the fee.
              let newTargetTokenBalance;
              let newFeeReceiverTokenBalance;
              let newAgentTokenBalance;
              switch(paymentType) {
                case "native":
                  newTargetTokenBalance = new web3.utils.BN(await web3.eth.getBalance(obj.args.toAddress));
                  newFeeReceiverTokenBalance = new web3.utils.BN(await web3.eth.getBalance(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver()
                  ));
                  if (agent !== constants.ZERO_ADDRESS) {
                    newAgentTokenBalance = new web3.utils.BN(await web3.eth.getBalance(agent));
                  }
                  break;
                case "token":
                  newTargetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.id);
                  newFeeReceiverTokenBalance = await economy.balanceOf(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.id
                  );
                  if (agent !== constants.ZERO_ADDRESS) {
                    newAgentTokenBalance = await economy.balanceOf(agent, obj.id);
                  }
                  break;
                case "tokens":
                  newTargetTokenBalance = await economy.balanceOf(obj.args.toAddress, obj.ids[0]);
                  newFeeReceiverTokenBalance = await economy.balanceOf(
                    await realWorldPaymentsPlugin.paymentFeeEarningsReceiver(), obj.ids[0]
                  );
                  if (agent !== constants.ZERO_ADDRESS) {
                    newAgentTokenBalance = await economy.balanceOf(agent, obj.ids[0]);
                  }
                  break;
              }

              // Assert on the balances & fees.
              if (brandType === "committed-brand") {
                assert.isTrue(
                  newFeeReceiverTokenBalance.cmp(feeReceiverTokenBalance) === 0,
                  "The new and old fee receiver token balances must be the same, since the commission is 0%. " +
                  "Expected value: " + feeReceiverTokenBalance.toString() +
                  ", actual value: " + newFeeReceiverTokenBalance.toString()
                );
                if (agent !== constants.ZERO_ADDRESS) {
                  assert.isTrue(
                    newAgentTokenBalance.cmp(agentTokenBalance) === 0,
                    "The new and old agent token balances must be the same, since the commission is 0%. " +
                    "Expected value: " + agentTokenBalance.toString() +
                    ", actual value: " + newAgentTokenBalance.toString()
                  );
                }
                assert.isTrue(
                  newTargetTokenBalance.cmp(targetTokenBalance.add(tokenValue)) === 0,
                  "The new and old target token balances must be the original plus the full token value, since " +
                  "the commission is 0%. " +
                  "Expected value: " + targetTokenBalance.toString() + " + " + tokenValue.toString() +
                  ", actual value: " + newTargetTokenBalance.toString()
                );
              } else {
                assert.isTrue(
                  newFeeReceiverTokenBalance.cmp(feeReceiverTokenBalance.add(absoluteReceiverFee)) === 0,
                  "The new and old fee receiver token balances must be right, since the commission is 3%. " +
                  "Expected value: " + feeReceiverTokenBalance.toString() + " + " + absoluteReceiverFee.toString() +
                  ", actual value: " + newFeeReceiverTokenBalance.toString()
                );
                if (agent !== constants.ZERO_ADDRESS) {
                  assert.isTrue(
                    newAgentTokenBalance.cmp(agentTokenBalance.add(absoluteAgentFee)) === 0,
                    "The new and old agent token balances must be the right, since the commission is 3%. " +
                    "Expected value: " + agentTokenBalance.toString() +
                    ", actual value: " + newAgentTokenBalance.toString()
                  );
                }
                assert.isTrue(
                  newTargetTokenBalance.cmp(targetTokenBalance.add(absoluteRemainder)) === 0,
                  "The new and old target token balances must be the original plus the remaining value, since " +
                  "the commission is 3%. " +
                  "Expected value: " + targetTokenBalance.toString() + " + " + absoluteRemainder.toString() +
                  ", actual value: " + newTargetTokenBalance.toString()
                );
              }
            });
          }
        }
      }
    }

    testAppropriateFees();

    it("must have proper PoS settings", async function() {
      let pos1 = await realWorldPaymentsPlugin.posSponsorships(accounts[1]);
      assert.isTrue(
        pos1.agent === accounts[7],
        "The agent for account 1 must be account 7, not " + pos1.agent
      );
      assert.isTrue(
        pos1.customFee.cmp(new BN(27)) === 0,
        "The fee for account 1 must be 27 / 1000, not " + pos1.customFee + " / 1000"
      );
      let pos2 = await realWorldPaymentsPlugin.posSponsorships(accounts[2]);
      assert.isTrue(
        pos2.agent === accounts[7],
        "The agent for account 1 must be account 7, not " + pos1.agent
      );
      assert.isTrue(
        pos2.customFee.cmp(new BN(27)) === 0,
        "The fee for account 1 must be 27 / 1000, not " + pos2.customFee + " / 1000"
      );
    });

    it("must not allow changing the fee for account 1 to 0", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setFee(accounts[2], new BN(0), {from: accounts[7]}),
        "RealWorldPaymentsPlugin: invalid custom fee"
      );
    });

    it("must not allow changing the fee for account 1 to 31", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setFee(accounts[2], new BN(31), {from: accounts[7]}),
        "RealWorldPaymentsPlugin: invalid custom fee"
      );
    });

    it("must allow changing the fee for account 1 to 30", async function() {
      await realWorldPaymentsPlugin.setFee(accounts[2], new BN(26), {from: accounts[7]});
    });

    it("must have the proper fee settings", async function() {
      let result1 = await realWorldPaymentsPlugin.paymentFee(accounts[1]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
        result1['0'].cmp(new BN(27 * 400)) === 0 &&
        result1['1'].cmp(new BN(27 * 600)) === 0 &&
        result1['2'] === accounts[7],
        "The expected fee settings for account 1 must be (27 * 400, 27 * 600, account 7), not " +
        "(" + result1['0'].toString() + ", " + result1['1'].toString() + ", " + result1['2'] + ")"
      );

      let result2 = await realWorldPaymentsPlugin.paymentFee(accounts[2]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
        result2['0'].cmp(new BN(26 * 400)) === 0 &&
        result2['1'].cmp(new BN(26 * 600)) === 0 &&
        result2['2'] === accounts[7],
        "The expected fee settings for account 1 must be (26 * 400, 26 * 600, account 2), not " +
        "(" + result2['0'].toString() + ", " + result2['1'].toString() + ", " + result2['2'] + ")"
      );
    });

    testAppropriateFees();

    it("must have proper PoS settings", async function() {
      let pos1 = await realWorldPaymentsPlugin.posSponsorships(accounts[1]);
      assert.isTrue(
        pos1.agent === accounts[7],
        "The agent for account 1 must be account 7, not " + pos1.agent
      );
      assert.isTrue(
        pos1.customFee.cmp(new BN(27)) === 0,
        "The fee for account 1 must be 27 / 1000, not " + pos1.customFee + " / 1000"
      );
      let pos2 = await realWorldPaymentsPlugin.posSponsorships(accounts[2]);
      assert.isTrue(
        pos2.agent === accounts[7],
        "The agent for account 1 must be account 7, not " + pos1.agent
      );
      assert.isTrue(
        pos2.customFee.cmp(new BN(26)) === 0,
        "The fee for account 1 must be 26 / 1000, not " + pos2.customFee + " / 1000"
      );
    });

    it("must allow account 0 to change the fraction for agent 7 to 700, and agent 6 (re-set) to 650", async function() {
      await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(700), {from: accounts[0]});
      await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[6], new BN(650), {from: accounts[0]});
    });

    it("must allow account 1 to choose account 6 as agent (resets fee to 27)", async function() {
      await realWorldPaymentsPlugin.setAgent(accounts[6], {from: accounts[2]});
    });

    it("must allow account 0 to disable account 7 as agent", async function() {
      await realWorldPaymentsPlugin.updatePaymentFeeAgent(accounts[7], new BN(0), {from: accounts[0]});
    });

    it("must now allow account 1 to [re-]set account 7 as agent", async function() {
      await expectRevert(
        realWorldPaymentsPlugin.setAgent(accounts[7], {from: accounts[1]}),
        revertReason("RealWorldPaymentsPlugin: the chosen address is not an active agent")
      );
    });

    it("must have the proper fee settings", async function() {
      let result1 = await realWorldPaymentsPlugin.paymentFee(accounts[1]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
          result1['0'].cmp(new BN(27 * 300)) === 0 &&
          result1['1'].cmp(new BN(27 * 700)) === 0 &&
          result1['2'] === accounts[7],
          "The expected fee settings for account 1 must be (27 * 400, 27 * 600, account 7), not " +
          "(" + result1['0'].toString() + ", " + result1['1'].toString() + ", " + result1['2'] + ")"
      );

      let result2 = await realWorldPaymentsPlugin.paymentFee(accounts[2]);
      // The fraction is (600 * min(27, 30)) / 1000000
      assert.isTrue(
        result2['0'].cmp(new BN(27 * 350)) === 0 &&
        result2['1'].cmp(new BN(27 * 650)) === 0 &&
        result2['2'] === accounts[6],
        "The expected fee settings for account 1 must be (26 * 400, 26 * 600, account 2), not " +
        "(" + result2['0'].toString() + ", " + result2['1'].toString() + ", " + result2['2'] + ")"
      );
    });

    testAppropriateFees();

    it("must have proper PoS settings", async function() {
      let pos1 = await realWorldPaymentsPlugin.posSponsorships(accounts[1]);
      assert.isTrue(
        pos1.agent === accounts[7],
        "The agent for account 1 must be account 7, not " + pos1.agent
      );
      assert.isTrue(
        pos1.customFee.cmp(new BN(27)) === 0,
        "The fee for account 1 must be 27 / 1000, not " + pos1.customFee + " / 1000"
      );
      let pos2 = await realWorldPaymentsPlugin.posSponsorships(accounts[2]);
      assert.isTrue(
        pos2.agent === accounts[6],
        "The agent for account 1 must be account 6, not " + pos1.agent
      );
      assert.isTrue(
        pos2.customFee.cmp(new BN(27)) === 0,
        "The fee for account 1 must be 27 / 1000, not " + pos2.customFee + " / 1000"
      );
    });
  });
});