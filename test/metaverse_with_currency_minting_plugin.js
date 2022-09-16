const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");
const SampleSystemCurrencyDefiningPlugin = artifacts.require("SampleSystemCurrencyDefiningPlugin");
const SampleSystemCurrencyMintingPlugin = artifacts.require("SampleSystemCurrencyMintingPlugin");

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
contract("CurrencyMintingPlugin", function (accounts) {
  var economy = null;
  var metaverse = null;
  var brandRegistry = null;
  var definitionPlugin = null;
  var mintingPlugin = null;
  var sampleDefinitionPlugin = null;
  var sampleMintingPlugin = null;
  var brand1 = null;
  var brand2 = null;
  var brand1Currency1 = null;
  var brand1Currency2 = null;
  var brand2Currency1 = null;
  var brand2Currency2 = null;
  var sysCurrency1 = null;
  var WMATIC = null;
  var BEAT = null;

  const SUPERUSER = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const METAVERSE_MANAGE_CURRENCIES_SETTINGS = web3.utils.soliditySha3("Plugins::Currency::Settings::Manage");
  const METAVERSE_GIVE_BRAND_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Currencies::Brands::Give");
  const BRAND_MANAGE_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Brand::Currencies::Manage");
  const METAVERSE_MINT_BEAT = web3.utils.soliditySha3("Plugins::Currency::BEAT::Mint");

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
    sampleDefinitionPlugin = await SampleSystemCurrencyDefiningPlugin.new(
        metaverse.address, definitionPlugin.address, { from: accounts[0] }
    );
    sampleMintingPlugin = await SampleSystemCurrencyMintingPlugin.new(
        metaverse.address, mintingPlugin.address, { from: accounts[0] }
    );
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(brandRegistry.address, { from: accounts[0] });
    await metaverse.addPlugin(definitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(mintingPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(sampleDefinitionPlugin.address, { from: accounts[0] });
    await metaverse.addPlugin(sampleMintingPlugin.address, { from: accounts[0] });

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

    // Foresee the brand ids and currency ids.
    let brand1Part = brand1.substr(2).toLowerCase();
    let brand2Part = brand2.substr(2).toLowerCase();
    let system = "0000000000000000000000000000000000000000";
    let index1 = "0000000000000000";
    let index2 = "0000000000000001";
    brand1Currency1 = new BN("0x80000000" + brand1Part + index1);
    brand1Currency2 = new BN("0x80000000" + brand1Part + index2);
    brand2Currency1 = new BN("0x80000000" + brand2Part + index1);
    brand2Currency2 = new BN("0x80000000" + brand2Part + index2);
    sysCurrency1 = new BN("0x80000000" + system + index1);
    // Also get the default tokens:
    WMATIC = await definitionPlugin.WMATICType();
    BEAT = await definitionPlugin.BEATType();

    // Define 2 brand currencies (in brand #1).
    await definitionPlugin.defineBrandCurrencyFor(
      brand1, "Brand #1 Curr #1", "Currency #1 of Brand #1", "http://example.org/images/brand1-1-image.png",
      "http://example.org/images/brand1-1-icon16x16.png", "http://example.org/images/brand1-1-icon32x32.png",
      "http://example.org/images/brand1-1-icon64x64.png", "#001111", { from: accounts[0] }
    );
    await definitionPlugin.defineBrandCurrencyFor(
      brand1, "Brand #1 Curr #2", "Currency #2 of Brand #1", "http://example.org/images/brand1-2-image.png",
      "http://example.org/images/brand1-2-icon16x16.png", "http://example.org/images/brand1-2-icon32x32.png",
      "http://example.org/images/brand1-2-icon64x64.png", "#001122", { from: accounts[0] }
    );

    // Define 2 brand currencies (in brand #2).
    await definitionPlugin.defineBrandCurrencyFor(
      brand2, "Brand #2 Curr #1", "Currency #1 of Brand #2", "http://example.org/images/brand2-1-image.png",
      "http://example.org/images/brand2-1-icon16x16.png", "http://example.org/images/brand2-1-icon32x32.png",
      "http://example.org/images/brand2-1-icon64x64.png", "#002211", { from: accounts[0] }
    );
    await definitionPlugin.defineBrandCurrencyFor(
      brand2, "Brand #2 Curr #2", "Currency #2 of Brand #2", "http://example.org/images/brand2-2-image.png",
      "http://example.org/images/brand2-2-icon16x16.png", "http://example.org/images/brand2-2-icon32x32.png",
      "http://example.org/images/brand2-2-icon64x64.png", "#002222", { from: accounts[0] }
    );

    // Define 1 system currency.
    await sampleDefinitionPlugin.defineSystemCurrency();
  });

  it("must have the expected titles", async function() {
    let mintingTitle = await mintingPlugin.title();
    assert.isTrue(
      mintingTitle === "Currency (Minting)",
      "The title of the definition plug-in must be: Currency (Minting), not: " + mintingTitle
    );
  });

  it("must start with the definition plug-in set appropriately", async function() {
    let definitionPluginAddress = await mintingPlugin.definitionPlugin();
    assert.isTrue(
      definitionPlugin.address === definitionPluginAddress,
      "The definition plug-in is not the expected one"
    );
  });

  it("must start with currency mint cost set to 0", async function() {
    let currencyMintCost = await mintingPlugin.currencyMintCost();
    assert.isTrue(
      currencyMintCost.cmp(new BN("0")) === 0,
      "The initial mint cost must be 0, not " + currencyMintCost.toString()
    );
  });

  it("must start with currency mint amount set to 0", async function() {
    let currencyMintAmount = await mintingPlugin.currencyMintAmount();
    assert.isTrue(
      currencyMintAmount.cmp(new BN("0")) === 0,
      "The initial mint amount must be 0, not " + currencyMintAmount.toString()
    );
  });

  it("must start with the earnings receiver to be the 9th accounts", async function() {
    let earningsReceiver = await mintingPlugin.brandCurrencyMintingEarningsReceiver();
    assert.isTrue(
      earningsReceiver === accounts[9],
      "The initial earnings receiver must be " + accounts[9] + ", not " + earningsReceiver
    );
  });

  it("must not allow to set the earnings receiver to 0x000...000", async function() {
    await expectRevert(
      mintingPlugin.setBrandCurrencyMintingEarningsReceiver(
        "0x0000000000000000000000000000000000000000", { from: accounts[0] }
      ),
      revertReason(
        "CurrencyMintingPlugin: the brand currency minting earnings receiver must not be the 0 address"
      )
    );
  });

  it("must allow account 0 to set the receiver to account 8", async function() {
    await expectEvent(
      await mintingPlugin.setBrandCurrencyMintingEarningsReceiver(accounts[8], { from: accounts[0] }),
      "BrandCurrencyMintingEarningsReceiverUpdated", { "newReceiver": accounts[8] }
    );
  });

  it("must allow account 0 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await mintingPlugin.setBrandCurrencyMintingEarningsReceiver(accounts[9], { from: accounts[0] }),
      "BrandCurrencyMintingEarningsReceiverUpdated", { "newReceiver": accounts[9] }
    );
  });

  it("must not allow account 7 to set the receiver to account 8, since it lacks of permissions", async function() {
    await expectRevert(
      mintingPlugin.setBrandCurrencyMintingEarningsReceiver(accounts[8], { from: accounts[7] }),
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
      await mintingPlugin.setBrandCurrencyMintingEarningsReceiver(accounts[8], { from: accounts[7] }),
      "BrandCurrencyMintingEarningsReceiverUpdated", { "newReceiver": accounts[8] }
    );
  });

  it("must allow account 7 to set the receiver to account 9, again", async function() {
    await expectEvent(
      await mintingPlugin.setBrandCurrencyMintingEarningsReceiver(accounts[9], { from: accounts[7] }),
      "BrandCurrencyMintingEarningsReceiverUpdated", { "newReceiver": accounts[9] }
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

  it("must not allow account 1/2 to mint currency 1 of brand 1/2, since the mint amount is not set", async function() {
    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[1], brand1Currency1, 2, {from: accounts[1]}),
      revertReason("CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0")
    );

    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[2], brand2Currency1, 2, {from: accounts[2]}),
      revertReason("CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0")
    );
  });

  it("must not allow account 0 to mint currency 1 of brand 1, since the mint amount is not set", async function() {
    await expectRevert(
      mintingPlugin.mintBrandCurrencyFor(accounts[2], brand2Currency1, 2, {from: accounts[0]}),
      revertReason("CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0")
    );
  });

  it("must not allow the sample plugin to mint sys. currency 1, since the mint amount is not set", async function() {
    await expectRevert(
      sampleMintingPlugin.mintSystemCurrency(accounts[0], sysCurrency1, 1, {from: accounts[0]}),
      revertReason("CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0")
    );
  });

  it("must not allow minting BEAT, since the mint amount is not set", async function() {
    await expectRevert(
      mintingPlugin.mintBEAT(accounts[0], 1, {from: accounts[0]}),
      revertReason("CurrencyMintingPlugin: minting is disabled while the mint to amount per bulk is 0")
    );
  });

  it("must have the mint amount starting with 0", async function() {
    let mintAmount = await mintingPlugin.currencyMintAmount();
    assert.isTrue(
      mintAmount.cmp(new BN(0)) === 0,
      "The mint amount must be initially 0"
    );
  });

  it("must allow account 0 to set the minting amount to 10 matic", async function() {
    await expectEvent(
      await mintingPlugin.setCurrencyMintAmount(new BN("10000000000000000000"), {from: accounts[0]}),
      "CurrencyMintAmountUpdated", {"newAmount": new BN("10000000000000000000")}
    );
  });

  it("must not allow account 7 to set the minting amount to 15 matic, since it lacks of permission", async function(){
    await expectRevert(
      mintingPlugin.setCurrencyMintAmount(new BN("15000000000000000000"), {from: accounts[7]}),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 7 to grant METAVERSE_MANAGE_CURRENCIES_SETTINGS on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must now allow account 7 to grant SUPERUSER on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_MANAGE_CURRENCIES_SETTINGS, accounts[7], true, { from: accounts[7] }),
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

  it("must allow account 7 to set the minting amount to 15 matic", async function() {
    await expectEvent(
      await mintingPlugin.setCurrencyMintAmount(new BN("15000000000000000000"), {from: accounts[7]}),
      "CurrencyMintAmountUpdated", {"newAmount": new BN("15000000000000000000")}
    );
  });

  it("must allow account 7 to set the minting amount to 10 matic", async function() {
    await expectEvent(
      await mintingPlugin.setCurrencyMintAmount(new BN("10000000000000000000"), {from: accounts[7]}),
      "CurrencyMintAmountUpdated", {"newAmount": new BN("10000000000000000000")}
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

  it("must not allow account 7 to set the minting amount to 15 matic, since it lacks of permission", async function(){
    await expectRevert(
        mintingPlugin.setCurrencyMintAmount(new BN("15000000000000000000"), {from: accounts[7]}),
        revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must NOT allow minting SysCurr #1 from any external account, but from a registered plug-in", async function() {
    for(let index = 0; index < 10; index++) {
      await expectRevert(
        mintingPlugin.mintSystemCurrency(accounts[index], sysCurrency1, 2, {from: accounts[index]}),
        revertReason("MetaversePlugin: only one of the owning metaverse's plug-ins can invoke this method")
      );
    }
  });

  it("must not allow account 0 to mint 0 bulks", async function() {
    await expectRevert(
      mintingPlugin.mintBEAT(accounts[4], 0, {from: accounts[0]}),
      revertReason("CurrencyMintingPlugin: BEAT minting issued with no units")
    )
  });

  it("must allow minting BEAT to account 0", async function() {
    await mintingPlugin.mintBEAT(accounts[4], 2, {from: accounts[0]});
  });

  it("must not allow account 7 to mint 2 bulks to account 4", async function() {
    await expectRevert(
      mintingPlugin.mintBEAT(accounts[4], 2, {from: accounts[7]}),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    )
  });

  it("must not allow account 7 to grant METAVERSE_MINT_BEAT on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_MINT_BEAT, accounts[7], true, { from: accounts[7] }),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow account 0 to grant METAVERSE_MINT_BEAT to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MINT_BEAT, accounts[7], true, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MINT_BEAT, "user": accounts[7], "set": true, "sender": accounts[0]
      }
    );
  });

  it("must allow account 7 to mint BEAT to account 4", async function() {
    await mintingPlugin.mintBEAT(accounts[4], 2, {from: accounts[7]});
  });

  it("must allow account 0 to revoke METAVERSE_MINT_BEAT to account 7", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MINT_BEAT, accounts[7], false, { from: accounts[0] }),
      "PermissionChanged", {
        "permission": METAVERSE_MINT_BEAT, "user": accounts[7], "set": false, "sender": accounts[0]
      }
    );
  });

  it("must not allow account 7 to mint 2 bulks to account 4", async function() {
    await expectRevert(
      mintingPlugin.mintBEAT(accounts[4], 2, {from: accounts[7]}),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must find that account 4 has 40 BEAT tokens", async function() {
    let balance = await economy.balanceOf(accounts[4], BEAT);
    assert.isTrue(
      balance.cmp(new BN("40000000000000000000")) === 0,
      "The amount of BEAT tokens in the account 4 must be 40 full tokens"
    )
  });

  // 1. accounts[1] to mint brand1Currency1 must fail. Reason: Mint cost not set.
  // 2. accounts[2] to mint brand2Currency1 must fail. Reason: Mint cost not set.
  // 3. accounts[0] to mint brand1Currency1 for brand 1 must succeed.
  // 4. sampleMintingPlugin to mint sysCurrency1 must succeed.
  // 5. accounts[0] to mint BEAT must succeed.
});