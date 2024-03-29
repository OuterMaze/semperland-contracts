const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const SampleSystemCurrencyDefiningPlugin = artifacts.require("SampleSystemCurrencyDefiningPlugin");
const SimpleECDSASignatureVerifier = artifacts.require("SimpleECDSASignatureVerifier");
const MetaverseSignatureVerifier = artifacts.require("MetaverseSignatureVerifier");
const delegates = require("../front-end/js/plug-ins/delegates/delegates.js");


const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const {
  atob,
  revertReason,
  jsonUrl,
} = require("./test_utils");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("CurrencyDefinitionPlugin", function (accounts) {
  let economy = null;
  let metaverse = null;
  let brandRegistry = null;
  let simpleSignatureVerifier = null;
  let signatureVerifier = null;
  let definitionPlugin = null;
  let sampleDefinitionPlugin = null;
  let brand1 = null;
  let brand2 = null;

  const SUPERUSER = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const METAVERSE_MANAGE_CURRENCIES_SETTINGS = web3.utils.soliditySha3("Plugins::Currency::Settings::Manage");
  const METAVERSE_GIVE_BRAND_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Currencies::Brands::Give");
  const BRAND_MANAGE_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Brand::Currencies::Manage");

  before(async function () {
    // Set up the metaverse and two plug-ins.
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], 300, { from: accounts[0] });
    simpleSignatureVerifier = await SimpleECDSASignatureVerifier.new({from: accounts[0]});
    signatureVerifier = await MetaverseSignatureVerifier.new(
      metaverse.address, ["ECDSA"], [simpleSignatureVerifier.address], {from: accounts[0]}
    );
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
      300,
      { from: accounts[0] }
    );
    sampleDefinitionPlugin = await SampleSystemCurrencyDefiningPlugin.new(
        metaverse.address, definitionPlugin.address, { from: accounts[0] }
    );
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await metaverse.setSignatureVerifier(signatureVerifier.address, { from: accounts[0] });
    await metaverse.addPlugin(definitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(sampleDefinitionPlugin.address, { from: accounts[0] });

    // Mint some brands.
    await brandRegistry.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[0] });
    await brandRegistry.registerBrand(
      delegates.NO_DELEGATE,
      "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/icon1-16x16.png",
      "http://example.com/icon1-32x32.png", "http://example.com/icon1-64x64.png",
      {from: accounts[1], value: new BN("10000000000000000000")}
    );
    brand1 = web3.utils.toChecksumAddress('0x' + web3.utils.soliditySha3(
        "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    ).substr(26));

    await brandRegistry.registerBrand(
      delegates.NO_DELEGATE,
      "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/icon2-16x16.png",
      "http://example.com/icon2-32x32.png", "http://example.com/icon2-64x64.png",
      {from: accounts[2], value: new BN("10000000000000000000")}
    );
    brand2 = web3.utils.toChecksumAddress('0x' + web3.utils.soliditySha3(
        "0xd6", "0x94", brandRegistry.address, accounts[2], 2
    ).substr(26));

    await signatureVerifier.setSignatureMethodAllowance(0, true, { from: accounts[1] });
    await signatureVerifier.setSignatureMethodAllowance(0, true, { from: accounts[2] });
  });

  it("must have the expected titles", async function() {
    let definitionTitle = await definitionPlugin.title();
    assert.isTrue(
      definitionTitle === "Currency (Definition)",
      "The title of the definition plug-in must be: Currency (Definition), not: " + definitionTitle
    );
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

  it("must start with a definition cost of 0", async function() {
    let currencyDefinitionCost = await definitionPlugin.currencyDefinitionCost();
    assert.isTrue(
      currencyDefinitionCost.cmp(new BN("0")) === 0,
      "The initial definition cost must be 0, not " + currencyDefinitionCost.toString()
    );
  });

  it("must start with the earnings receiver to be the 9th accounts", async function() {
    let earningsReceiver = await definitionPlugin.brandCurrencyDefinitionEarningsReceiver();
    assert.isTrue(
      earningsReceiver === accounts[9],
      "The initial earnings receiver must be " + accounts[9] + ", not " + earningsReceiver
    );
  });

  it("has both WMATICType and BEATType as accessible from the metaverse itself", async function() {
    let WMATIC = await definitionPlugin.WMATICType();
    let BEAT = await definitionPlugin.BEATType();
    let posterior = BEAT.add(new BN(1));
    let WMATICMetadata = await economy.uri(WMATIC);
    let BEATMetadata = await economy.uri(BEAT);
    let posteriorMetadata = await economy.uri(posterior);

    let expectedWMATICMetadata = jsonUrl({
      name: "WMATIC", description: "Wrapped MATIC",
      image: "http://example.org/images/wmatic-image.png",
      decimals: 18,
      properties: {
        icon16x16: "http://example.org/images/wmatic-16x16.png",
        icon32x32: "http://example.org/images/wmatic-32x32.png",
        icon64x64: "http://example.org/images/wmatic-64x64.png",
        color: "#ffd700",
        type: "currency"
      }
    });
    assert.isTrue(
      WMATICMetadata === expectedWMATICMetadata,
      "The WMATIC metadata should be: " + expectedWMATICMetadata + ", not: " + WMATICMetadata
    );

    let expectedBEATMetadata = jsonUrl({
      name: "BEAT", description: "BEAT coin",
      image: "http://example.org/images/beat-image.png",
      decimals: 18,
      properties: {
        icon16x16: "http://example.org/images/beat-16x16.png",
        icon32x32: "http://example.org/images/beat-32x32.png",
        icon64x64: "http://example.org/images/beat-64x64.png",
        color: "#87cefa",
        type: "currency"
      },
    });
    assert.isTrue(
      BEATMetadata === expectedBEATMetadata,
      "The BEAT metadata should be: " + expectedBEATMetadata + ", not: " + BEATMetadata
    );

    assert.isTrue(
      posteriorMetadata === "",
      "The posterior token metadata (which does not exist, yet) should be empty, not: " + posteriorMetadata
    )
  });

  it("must not allow to set the earnings receiver to 0x000...000", async function() {
    await expectRevert(
      definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(
        "0x0000000000000000000000000000000000000000", { from: accounts[0] }
      ),
      revertReason(
        "CurrencyDefinitionPlugin: the brand currency definition earnings receiver must not be the 0 address"
      )
    );
  });

  it("must allow account 0 to set the receiver to account 8", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[8], { from: accounts[0] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", {
        "newReceiver": accounts[8], "updatedBy": accounts[0]
      }
    );
  });

  it("must allow account 0 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[9], { from: accounts[0] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", {
        "newReceiver": accounts[9], "updatedBy": accounts[0]
      }
    );
  });

  it("must not allow account 7 to set the receiver to account 8, since it lacks of permissions", async function() {
    await expectRevert(
      definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[8], { from: accounts[7] }),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 7 to grant the METAVERSE_MANAGE_CURRENCIES_SETTINGS on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 7 to grant the SUPERUSER on itself", async function() {
    await expectRevert(
      metaverse.setPermission(SUPERUSER, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow account 0 to grant METAVERSE_MANAGE_CURRENCIES_SETTINGS to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_CURRENCIES_SETTINGS, "user": accounts[7], "set": true, "sender": accounts[0]
      }
    );
  });

  it("must allow account 7 to set the receiver to account 8", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[8], { from: accounts[7] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", {
        "newReceiver": accounts[8], "updatedBy": accounts[7]
      }
    );
  });

  it("must allow account 7 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[9], { from: accounts[7] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", {
        "newReceiver": accounts[9], "updatedBy": accounts[7]
      }
    );
  });

  it("must allow account 0 to revoke METAVERSE_MANAGE_CURRENCIES_SETTINGS to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], false, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_CURRENCIES_SETTINGS, "user": accounts[7], "set": false, "sender": accounts[0]
      }
    );
  });

  it("must not allow any of the first 10 accounts to define a system currency", async function() {
    for(let index = 0; index < 10; index++) {
      await expectRevert(
        definitionPlugin.defineSystemCurrency(
          accounts[index], "New System Currency", "A newly defined system currency",
          "https://example.org/images/image-nsc.png",
          "https://example.org/images/icon-nsc-16x16.png",
          "https://example.org/images/icon-nsc-32x32.png",
          "https://example.org/images/icon-nsc-64x64.png",
          "#ff7700"
        ),
        revertReason("MetaversePlugin: only one of the owning metaverse's plug-ins can invoke this method")
      );
    }
  });

  it("must however allow the sample plug-in to define 3 system currencies", async function() {
    let _id = new BN('0x8000000000000000000000000000000000000000000000000000000000000002');
    for(let index = 0; index < 3; index++) {
      await sampleDefinitionPlugin.defineSystemCurrency();
      let expectedMetadata = jsonUrl({
        name: "SysCurr #" + (index + 1), description: "System Currency #" + (index + 1),
        image: "http://example.org/sys-currs/image-" + (index + 1) + ".png",
        decimals: 18,
        properties: {
          icon16x16: "http://example.org/sys-currs/icon16-" + (index + 1) + ".png",
          icon32x32: "http://example.org/sys-currs/icon32-" + (index + 1) + ".png",
          icon64x64: "http://example.org/sys-currs/icon64-" + (index + 1) + ".png",
          color: "#ddcc00",
          type: "currency"
        }
      });
      let metadata = await economy.uri(_id);
      let len = "data:application/json;base64,".length;
      assert.isTrue(
        metadata === expectedMetadata,
        "The system currency #" + (index + 1) + "'s metadata should be: " + atob(expectedMetadata.substr(len)) +
        ", not: " + atob(metadata.substr(len))
      );
      _id = _id.add(new BN("1"));
    }
  });

  it("must not allow the owner of brand #1 to define a currency, since the cost is 0", async function() {
    await expectRevert(
      definitionPlugin.defineBrandCurrency(
        delegates.NO_DELEGATE,
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[1] }
      ),
      revertReason("CurrencyDefinitionPlugin: brand currency definition is currently disabled (no price is set)")
    );
  });

  it("must not allow the 7th account to define a currency for brand 1, since it is disabled", async function() {
    await expectRevert(
      definitionPlugin.defineBrandCurrency(
        await delegates.makeDelegate(web3, accounts[1], [
          {type: "address", value: brand1},
          {type: "string", value: "Brand #1 Curr #1"},
          {type: "string", value: "Currency #1 of Brand #1"},
          {type: "string", value: "http://example.org/images/brand1-1-image.png"},
        ]),
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[7], gas: 500000 }
      ),
      revertReason(
        "CurrencyDefinitionPlugin: brand currency definition is currently disabled (no price is set)"
      )
    );
  });

  it("must not allow the 7th account to define a currency for brand 1, since it is signed by another user", async function() {
    await expectRevert(
      definitionPlugin.defineBrandCurrency(
        await delegates.makeDelegate(web3, accounts[2], [
          {type: "address", value: brand1},
          {type: "string", value: "Brand #1 Curr #1"},
          {type: "string", value: "Currency #1 of Brand #1"},
          {type: "string", value: "http://example.org/images/brand1-1-image.png"},
        ]),
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[7], gas: 500000 }
      ),
      revertReason(
        "MetaversePlugin: caller is not brand owner nor approved, and does not have the required permission"
      )
    );
  });

  it("must not allow account 7 to grant the METAVERSE_GIVE_BRAND_CURRENCIES on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_GIVE_BRAND_CURRENCIES, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow account 0 to grant METAVERSE_GIVE_BRAND_CURRENCIES to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_GIVE_BRAND_CURRENCIES, accounts[7], true, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_GIVE_BRAND_CURRENCIES, "user": accounts[7], "set": true, "sender": accounts[0]
      }
    );
  });

  it("must allow the 7th account to define a currency for brand 1, now having permission", async function() {
    let brandPart = brand1.substr(2).toLowerCase();
    let index = "0000000000000000";
    let id = new BN("0x80000000" + brandPart + index);

    await expectEvent(
      await definitionPlugin.defineBrandCurrency(
        await delegates.makeDelegate(web3, accounts[1], [
          {type: "address", value: brand1},
          {type: "string", value: "Brand #1 Curr #1"},
          {type: "string", value: "Currency #1 of Brand #1"},
          {type: "string", value: "http://example.org/images/brand1-1-image.png"},
        ]),
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[7] }
      ),
      "CurrencyDefined", {
        "tokenId": id, "brandId": brand1, "definedBy": accounts[7], "paidPrice": new BN('0'),
        "name": "Brand #1 Curr #1", "description": "Currency #1 of Brand #1"
      }
    );
    let metadata = await economy.uri(id);
    let expectedMetadata = jsonUrl({
      name: "Brand #1 Curr #1", description: "Currency #1 of Brand #1",
      image: "http://example.org/images/brand1-1-image.png",
      decimals: 18,
      properties: {
        icon16x16: "",
        icon32x32: "",
        icon64x64: "",
        color: "#ffd700",
        type: "currency"
      }
    });
    let len = "data:application/json;base64,".length;
    assert.isTrue(
      metadata === expectedMetadata,
      "The new currency's metadata should be: " + atob(expectedMetadata.substr(len)) +
      ", not: " + atob(metadata.substr(len))
    );
  });

  it("must allow the owner to set the definition cost to 10 matic", async function() {
    await expectEvent(
      await definitionPlugin.setCurrencyDefinitionCost(new BN("10000000000000000000"), {from: accounts[0]}),
      "CurrencyDefinitionCostUpdated", {
        "newCost": new BN("10000000000000000000"), "updatedBy": accounts[0]
      }
    );
  });

  it("must not allow account 7 to set the cost to 5 matic, since it lacks of permissions", async function() {
    await expectRevert(
      definitionPlugin.setCurrencyDefinitionCost(new BN("5000000000000000000"), { from: accounts[7] }),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 7 to grant the METAVERSE_MANAGE_CURRENCIES_SETTINGS on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 7 to grant the SUPERUSER on itself", async function() {
    await expectRevert(
      metaverse.setPermission(SUPERUSER, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow account 0 to grant METAVERSE_MANAGE_CURRENCIES_SETTINGS to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_CURRENCIES_SETTINGS, "user": accounts[7], "set": true, "sender": accounts[0]
      }
    );
  });

  it("must allow account 7 to set the definition cost to 5 matic", async function() {
    await expectEvent(
      await definitionPlugin.setCurrencyDefinitionCost(new BN("5000000000000000000"), {from: accounts[7]}),
      "CurrencyDefinitionCostUpdated", {
        "newCost": new BN("5000000000000000000"), "updatedBy": accounts[7]
      }
    );
  });

  it("must allow account 7 to set the definition cost to 10 matic", async function() {
    await expectEvent(
      await definitionPlugin.setCurrencyDefinitionCost(new BN("10000000000000000000"), {from: accounts[7]}),
      "CurrencyDefinitionCostUpdated", {
        "newCost": new BN("10000000000000000000"), "updatedBy": accounts[7]
      }
    );
  });

  it("must allow account 0 to revoke METAVERSE_MANAGE_CURRENCIES_SETTINGS to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], false, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_CURRENCIES_SETTINGS, "user": accounts[7], "set": false, "sender": accounts[0]
      }
    );
  });

  it("must not allow account 7 to set the cost to 5 matic, since it lacks of permissions", async function() {
    await expectRevert(
        definitionPlugin.setCurrencyDefinitionCost(new BN("5000000000000000000"), { from: accounts[7] }),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow the owner of brand #1 to define a currency, since it paid a wrong cost", async function() {
    await expectRevert(
      definitionPlugin.defineBrandCurrency(
        delegates.NO_DELEGATE,
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[1], value: new BN("11000000000000000000"), gas: new BN("5000000") }
      ),
      revertReason("CurrencyDefinitionPlugin: brand currency definition requires an exact payment of 10000000000000000000 " +
                   "but 11000000000000000000 was given")
    );
  });

  it("must allow the owner of brand #1 to define a currency, and have a matching metadata", async function() {
    let brandPart = brand1.substr(2).toLowerCase();
    let index = "0000000000000001";
    let id = new BN("0x80000000" + brandPart + index);

    await expectEvent(
      await definitionPlugin.defineBrandCurrency(
        delegates.NO_DELEGATE,
        brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
        { from: accounts[1], value: new BN("10000000000000000000") }
      ),
      "CurrencyDefined", {
        "tokenId": id, "brandId": brand1, "definedBy": accounts[1], "paidPrice": new BN("10000000000000000000"),
        "name": "Brand #1 Curr #1", "description": "Currency #1 of Brand #1"
      }
    );
    let metadata = await economy.uri(id);
    let expectedMetadata = jsonUrl({
      name: "Brand #1 Curr #1", description: "Currency #1 of Brand #1",
      image: "http://example.org/images/brand1-1-image.png",
      decimals: 18,
      properties: {
        icon16x16: "",
        icon32x32: "",
        icon64x64: "",
        color: "#ffd700",
        type: "currency"
      }
    });
    let len = "data:application/json;base64,".length;
    assert.isTrue(
      metadata === expectedMetadata,
      "The new currency's metadata should be: " + atob(expectedMetadata.substr(len)) +
      ", not: " + atob(metadata.substr(len))
    );
  });

  it("must not allow 3rd account to define a currency in brand 1, since it lacks of permission", async function() {
    await expectRevert(
      definitionPlugin.defineBrandCurrency(
        delegates.NO_DELEGATE,
        brand1, "Brand #1 Curr #2", "Currency #2 of Brand #1", "http://example.org/images/brand1-2-image.png",
        { from: accounts[3] }
      ),
      revertReason("MetaversePlugin: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must not allow account 3 to grant the BRAND_MANAGE_CURRENCIES of brand #1 on itself", async function() {
    await expectRevert(
      brandRegistry.brandSetPermission(
        delegates.NO_DELEGATE,
        brand1, BRAND_MANAGE_CURRENCIES, accounts[3], true, { from: accounts[3] }
      ),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must not allow account 3 to grant the SUPERUSER of brand #1 on itself", async function() {
    await expectRevert(
      brandRegistry.brandSetPermission(
        delegates.NO_DELEGATE,
        brand1, SUPERUSER, accounts[3], true, { from: accounts[3] }
      ),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must not allow account 0 to grant the BRAND_MANAGE_CURRENCIES of brand #1 on account 3", async function() {
    await expectRevert(
      brandRegistry.brandSetPermission(
        delegates.NO_DELEGATE,
        brand1, BRAND_MANAGE_CURRENCIES, accounts[3], true, { from: accounts[0] }
      ),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must allow account 1 to grant the BRAND_MANAGE_CURRENCIES of brand #1 on account 3", async function() {
    await expectEvent(
      await brandRegistry.brandSetPermission(
        delegates.NO_DELEGATE,
        brand1, BRAND_MANAGE_CURRENCIES, accounts[3], true, { from: accounts[1] }
      ),
      "BrandPermissionChanged", {
        "brandId": brand1, "permission": BRAND_MANAGE_CURRENCIES, "user": accounts[3],
        "set": true, "sender": accounts[1]
      }
    );
  });

  it("must allow account 3 to define the new currency, now", async function() {
    let brandPart = brand1.substr(2).toLowerCase();
    let index = "0000000000000002";
    let id = new BN("0x80000000" + brandPart + index);

    await expectEvent(
      await definitionPlugin.defineBrandCurrency(
        delegates.NO_DELEGATE,
        brand1, "Brand #1 Curr #3", "Currency #3 of Brand #1", "http://example.org/images/brand1-3-image.png",
        { from: accounts[3], value: new BN("10000000000000000000") }
      ),
      "CurrencyDefined", {
        "tokenId": id, "brandId": brand1, "definedBy": accounts[3], "paidPrice": new BN("10000000000000000000"),
        "name": "Brand #1 Curr #3", "description": "Currency #3 of Brand #1"
      }
    );
    let metadata = await economy.uri(id);
    let expectedMetadata = jsonUrl({
      name: "Brand #1 Curr #3", description: "Currency #3 of Brand #1",
      image: "http://example.org/images/brand1-3-image.png",
      decimals: 18,
      properties: {
        icon16x16: "",
        icon32x32: "",
        icon64x64: "",
        color: "#ffd700",
        type: "currency"
      }
    });
    let len = "data:application/json;base64,".length;
    assert.isTrue(
      metadata === expectedMetadata,
      "The new currency's metadata should be: " + atob(expectedMetadata.substr(len)) +
      ", not: " + atob(metadata.substr(len))
    );
  });

  it("must still allow the account 7 to define a currency for that brand", async function() {
    let brandPart = brand1.substr(2).toLowerCase();
    let index = "0000000000000003";
    let id = new BN("0x80000000" + brandPart + index);

    await expectEvent(
      await definitionPlugin.defineBrandCurrency(
        await delegates.makeDelegate(web3, accounts[1], [
          {type: "address", value: brand1},
          {type: "string", value: "Brand #1 Curr #4"},
          {type: "string", value: "Currency #4 of Brand #1"},
          {type: "string", value: "http://example.org/images/brand1-4-image.png"},
        ]),
        brand1, "Brand #1 Curr #4", "Currency #4 of Brand #1", "http://example.org/images/brand1-4-image.png",
        { from: accounts[7] }
      ),
      "CurrencyDefined", {
        "tokenId": id, "brandId": brand1, "definedBy": accounts[7], "paidPrice": new BN('0'),
        "name": "Brand #1 Curr #4", "description": "Currency #4 of Brand #1"
      }
    );
    let metadata = await economy.uri(id);
    let expectedMetadata = jsonUrl({
      name: "Brand #1 Curr #4", description: "Currency #4 of Brand #1",
      image: "http://example.org/images/brand1-4-image.png",
      decimals: 18,
      properties: {
        icon16x16: "",
        icon32x32: "",
        icon64x64: "",
        color: "#ffd700",
        type: "currency"
      }
    });
    let len = "data:application/json;base64,".length;
    assert.isTrue(
      metadata === expectedMetadata,
      "The new currency's metadata should be: " + atob(expectedMetadata.substr(len)) +
      ", not: " + atob(metadata.substr(len))
    );
  });

  it("must allow account 0 to grant, again, METAVERSE_MANAGE_CURRENCIES_SETTINGS to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_CURRENCIES_SETTINGS, "user": accounts[7], "set": true, "sender": accounts[0]
      }
    );
  });

  let metadataChangeStages = [
    {
      tokenId: () => new BN("0x8000000000000000000000000000000000000000000000000000000000000000"),
      invalidTokenId: () => new BN("0x800000000000000000000000000000000000000000000000000000000000000f"),
      allowed: 7,
      disallowed: 6,
      owner: 0,
      errorMessage: "FTTypeCheckingPlugin: caller is not metaverse owner, and does not have the required permission",
      caption: "the first system currency",
      newValues: {
        image: "http://example.org/images/wmatic-image-new.png",
        icon16x16: "http://example.org/images/wmatic-16x16-new.png",
        icon32x32: "http://example.org/images/wmatic-32x32-new.png",
        icon64x64: "http://example.org/images/wmatic-64x64-new.png",
        color: "#112233",
        type: "currency"
      },
      currentMetadata: {
        name: "WMATIC", description: "Wrapped MATIC",
        image: "http://example.org/images/wmatic-image.png",
        decimals: 18,
        properties: {
          icon16x16: "http://example.org/images/wmatic-16x16.png",
          icon32x32: "http://example.org/images/wmatic-32x32.png",
          icon64x64: "http://example.org/images/wmatic-64x64.png",
          color: "#ffd700",
          type: "currency"
        }
      },
    },
    {
      tokenId: () => new BN("0x80000000" + brand1.substr(2).toLowerCase() + "0000000000000000"),
      invalidTokenId: () => new BN("0x80000000" + brand1.substr(2).toLowerCase() + "000000000000000f"),
      allowed: 3,
      disallowed: 4,
      owner: 1,
      errorMessage: "FTTypeCheckingPlugin: caller is not brand owner nor approved, and does not have the required permission",
      caption: "the first currency of brand #1",
      newValues: {
        image: "http://example.org/images/brand1-1-image-new.png",
        icon16x16: "http://example.org/images/brand1-1-16x16-new.png",
        icon32x32: "http://example.org/images/brand1-1-32x32-new.png",
        icon64x64: "http://example.org/images/brand1-1-64x64-new.png",
        color: "#445566",
        type: "currency"
      },
      currentMetadata: {
        name: "Brand #1 Curr #1", description: "Currency #1 of Brand #1",
        image: "http://example.org/images/brand1-1-image.png",
        decimals: 18,
        properties: {
          icon16x16: "",
          icon32x32: "",
          icon64x64: "",
          color: "#ffd700",
          type: "currency"
        }
      }
    }
  ];

  let methods = [
    {
      caption: "main image",
      newValue: function() { return this.newValues.image; },
      method: async function(id, image, sender) {
        let value = await definitionPlugin.setCurrencyImage(delegates.NO_DELEGATE, id, image, { from: sender });
        this.currentMetadata.image = image;
        return value;
      }
    },
    {
      caption: "16x16 icon",
      newValue: function() { return this.newValues.icon16x16; },
      method: async function(id, image, sender) {
        let value = await definitionPlugin.setCurrencyIcon16x16(delegates.NO_DELEGATE, id, image, { from: sender });
        this.currentMetadata.properties.icon16x16 = image;
        return value;
      }
    },
    {
      caption: "32x32 icon",
      newValue: function() { return this.newValues.icon32x32; },
      method: async function(id, image, sender) {
        let value = await definitionPlugin.setCurrencyIcon32x32(delegates.NO_DELEGATE, id, image, { from: sender });
        this.currentMetadata.properties.icon32x32 = image;
        return value;
      }
    },
    {
      caption: "64x64 icon",
      newValue: function() { return this.newValues.icon64x64; },
      method: async function(id, image, sender) {
        let value = await definitionPlugin.setCurrencyIcon64x64(delegates.NO_DELEGATE, id, image, { from: sender });
        this.currentMetadata.properties.icon64x64 = image;
        return value;
      }
    },
    {
      caption: "color",
      newValue: function() { return this.newValues.color; },
      method: async function(id, color, sender) {
        let value = await definitionPlugin.setCurrencyColor(delegates.NO_DELEGATE, id, color, { from: sender });
        this.currentMetadata.properties.color = color;
        return value;
      }
    },
  ]

  metadataChangeStages.forEach(function(e) {
    methods.forEach(function(m) {
      it("must not allow account " + e.disallowed + " to change the currency's " + m.caption +
         " since it lacks of permissions", async function() {
        await expectRevert(
          m.method.call(e, e.tokenId(), m.newValue.call(e), accounts[e.disallowed]),
          revertReason(e.errorMessage)
        );
      });

      async function assertOKInToken(e, m, which) {
        await m.method.call(e, e.tokenId(), m.newValue.call(e), which);
        let metadata = await economy.uri(e.tokenId());
        let expectedMetadata = jsonUrl(e.currentMetadata);
        let len = "data:application/json;base64,".length;
        assert.isTrue(
          metadata === expectedMetadata,
          "The new currency's metadata should be: " + atob(expectedMetadata.substr(len)) +
          ", not: " + atob(metadata.substr(len))
        );
      }

      async function assertErrorInNonExistingToken(e, m, which) {
        await expectRevert(
          m.method.call(e, e.invalidTokenId(), m.newValue.call(e), which),
          revertReason("CurrencyDefinitionPlugin: the specified token id is not of a registered currency type")
        )
      }

      it("must allow owner account " + e.owner + " to change the currency's " + m.caption, async function() {
        await assertOKInToken(e, m, accounts[e.owner]);
      });

      it("must also allow account " + e.allowed + " to change the currency's " + m.caption, async function() {
        await assertOKInToken(e, m, accounts[e.allowed]);
      });

      it("must not allow owner account " + e.owner + " to change the non-existing " +
         "currency's " + m.caption, async function() {
        await assertErrorInNonExistingToken(e, m, accounts[e.owner]);
      });

      it("must neither allow account " + e.allowed + " to change the non-existing " +
          "currency's " + m.caption, async function() {
        await assertErrorInNonExistingToken(e, m, accounts[e.allowed]);
      });
    });
  });
});