const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");
const SampleSystemCurrencyDefiningPlugin = artifacts.require("SampleSystemCurrencyDefiningPlugin");

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
  var brandRegistry = null;
  var definitionPlugin = null;
  var mintingPlugin = null;
  var samplePlugin = null;

  const SUPERUSER = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const METAVERSE_MANAGE_CURRENCIES_SETTINGS = web3.utils.soliditySha3("Plugins::Currency::Settings::Manage");
  const METAVERSE_GIVE_BRAND_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Currencies::Brands::Give");
  const BRAND_MANAGE_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Brand::Currencies::Manage");

  function revertReason(message) {
    return message + " -- Reason given: " + message;
  }

  function btoa(raw) {
    return new Buffer(raw).toString("base64");
  }

  function atob(encoded) {
    return new Buffer(encoded, 'base64').toString("ascii");
  }

  function jsonUrl(payload) {
    new Buffer("pija");
    return "data:application/json;base64," + btoa(JSON.stringify(payload));
  }

  before(async function () {
    // Set up the metaverse and two plug-ins.
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
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
    samplePlugin = await SampleSystemCurrencyDefiningPlugin.new(
        metaverse.address, definitionPlugin.address, { from: accounts[0] }
    );
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await metaverse.addPlugin(definitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(mintingPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(samplePlugin.address, { from: accounts[0] });

    // Mint some brands.
    await brandRegistry.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[0] });
    await brandRegistry.registerBrand(
      "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/icon1-16x16.png",
      "http://example.com/icon1-32x32.png", "http://example.com/icon1-64x64.png",
      {from: accounts[1], value: new BN("10000000000000000000")}
    );
    await brandRegistry.registerBrand(
      "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/icon2-16x16.png",
      "http://example.com/icon2-32x32.png", "http://example.com/icon2-64x64.png",
      {from: accounts[2], value: new BN("10000000000000000000")}
    );
  });

  it("must have the expected titles", async function() {
    let definitionTitle = await definitionPlugin.title();
    assert.isTrue(
      definitionTitle === "Currency (Definition)",
      "The title of the definition plug-in must be: Currency (Definition), not: " + definitionTitle
    );
    let mintingTitle = await mintingPlugin.title();
    assert.isTrue(
      mintingTitle === "Currency (Minting)",
      "The title of the definition plug-in must be: Currency (Minting), not: " + mintingTitle
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
      "The initial earnings receiver must be " + accounts[0] + ", not " + earningsReceiver
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
      name: "WMATIC", description: "Wrapped MATIC in this world",
      image: "http://example.org/images/wmatic-image.png",
      decimals: 18,
      properties: {
        icon16x16: "http://example.org/images/wmatic-16x16.png",
        icon32x32: "http://example.org/images/wmatic-32x32.png",
        icon64x64: "http://example.org/images/wmatic-64x64.png",
        color: "#ffd700"
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
        color: "#87cefa"
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
      "BrandCurrencyDefinitionEarningsReceiverUpdated", { "newReceiver": accounts[8] }
    );
  });

  it("must allow account 0 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[9], { from: accounts[0] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", { "newReceiver": accounts[9] }
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

  it("must allow account 0 to set the receiver to account 8", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[8], { from: accounts[7] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", { "newReceiver": accounts[8] }
    );
  });

  it("must allow account 0 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await definitionPlugin.setBrandCurrencyDefinitionEarningsReceiver(accounts[9], { from: accounts[7] }),
      "BrandCurrencyDefinitionEarningsReceiverUpdated", { "newReceiver": accounts[9] }
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
      await samplePlugin.defineSystemCurrency();
      let expectedMetadata = jsonUrl({
        name: "SysCurr #" + (index + 1), description: "System Currency #" + (index + 1),
        image: "http://example.org/sys-currs/image-" + (index + 1) + ".png",
        decimals: 18,
        properties: {
          icon16x16: "http://example.org/sys-currs/icon16-" + (index + 1) + ".png",
          icon32x32: "http://example.org/sys-currs/icon32-" + (index + 1) + ".png",
          icon64x64: "http://example.org/sys-currs/icon64-" + (index + 1) + ".png",
          color: "#ddcc00"
        }
      });
      let metadata = await economy.uri(_id);
      console.log("Given");
      console.log(metadata);
      console.log("Expected");
      console.log(expectedMetadata);
      let len = "data:application/json;base64,".length;
      assert.isTrue(
        metadata === expectedMetadata,
        "The system currency #" + (index + 1) + "'s metadata should be: " + atob(expectedMetadata.substr(len)) +
        ", not: " + atob(metadata.substr(len))
      );
      _id = _id.add(new BN("1"));
    }
  })
});