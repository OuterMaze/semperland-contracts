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

const {
  btoa,
  revertReason,
  txTotalGas
} = require("./test_utils");

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

  const BRAND_MANAGE_CURRENCIES = web3.utils.soliditySha3("Plugins::Currency::Brand::Currencies::Manage");
  const METAVERSE_MINT_BEAT = web3.utils.soliditySha3("Plugins::Currency::BEAT::Mint");

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
      metaverse.address, definitionPlugin.address, { from: accounts[0] }
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
    await definitionPlugin.setMintingPlugin(mintingPlugin.address, { from: accounts[0] });
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
      "The title of the minting plug-in must be: Currency (Minting), not: " + mintingTitle
    );
  });

  it("must start with the definition plug-in set appropriately", async function() {
    let definitionPluginAddress = await mintingPlugin.definitionPlugin();
    assert.isTrue(
      definitionPlugin.address === definitionPluginAddress,
      "The definition plug-in is not the expected one"
    );
  });

  it("must NOT allow minting SysCurr #1 from any external account, but from a registered plug-in", async function() {
    for(let index = 0; index < 10; index++) {
      await expectRevert(
        mintingPlugin.mintSystemCurrency(accounts[index], sysCurrency1, new BN("20000000000000000000"),
                                         {from: accounts[index]}),
        revertReason("MetaversePlugin: only one of the owning metaverse's plug-ins can invoke this method")
      );
    }
  });

  it("must not allow account 0 to mint 0 bulks", async function() {
    await expectRevert(
      mintingPlugin.mintBEAT(accounts[4], 0, {from: accounts[0]}),
      revertReason("CurrencyMintingPlugin: BEAT minting issued with zero amount")
    )
  });

  it("must allow minting BEAT to account 0", async function() {
    await mintingPlugin.mintBEAT(accounts[4], new BN("20000000000000000000"), {from: accounts[0]});
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
    await mintingPlugin.mintBEAT(accounts[4], new BN("20000000000000000000"), {from: accounts[7]});
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
      mintingPlugin.mintBEAT(accounts[4], new BN("20000000000000000000"), {from: accounts[7]}),
      revertReason("MetaversePlugin: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must find that account 4 has 40 BEAT tokens", async function() {
    let balance = await economy.balanceOf(accounts[4], BEAT);
    assert.isTrue(
      balance.cmp(new BN("40000000000000000000")) === 0,
      "The amount of BEAT tokens in the account 4 must be 40 full tokens"
    );
  });

  it("must allow the sample minting plug-in to mint sys. currency 1 to account 3", async function() {
    await sampleMintingPlugin.mintSystemCurrency(accounts[3], sysCurrency1, new BN("10000000000000000000"),
                                                 {from: accounts[0]});
    let balance = await economy.balanceOf(accounts[3], sysCurrency1);
    assert.isTrue(
      balance.cmp(new BN("10000000000000000000")) === 0,
      "The amount of system currency 1 in the account 3 must be 10 full tokens"
    );
  });

  it("must not allow account 0 to mint 1 bulks to account 2", async function() {
    await mintingPlugin.mintBEAT(accounts[3], new BN("10000000000000000000"), {from: accounts[0]});
    let balance = await economy.balanceOf(accounts[3], BEAT);
    assert.isTrue(
      balance.cmp(new BN("10000000000000000000")) === 0,
      "The amount of BEAT in the account 3 must be 10 full tokens"
    );
  });

  it("must fail minting a brand currency using a non-existing currency id", async function() {
    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[1], brand1Currency1.add(new BN(2)), new BN("10000000000000000000"),
                                      {from: accounts[1]}),
      revertReason("CurrencyMintingPlugin: the specified token id is not of a registered currency type")
    );
  });

  it("must fail minting a brand currency using empty bulks", async function() {
    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[1], brand1Currency1, 0, {from: accounts[1]}),
      revertReason("CurrencyMintingPlugin: brand currency minting issued with zero amount")
    );
  });

  it("must succeed minting a brand currency with appropriate parameters", async function() {
    let balance = await economy.balanceOf(accounts[5], brand1Currency1);
    await mintingPlugin.mintBrandCurrency(accounts[5], brand1Currency1, new BN("10000000000000000000"),
                                          {from: accounts[1]});
    let expectedNewBalance = balance.add(new BN("10000000000000000000"));
    let actualNewBalance = await economy.balanceOf(accounts[5], brand1Currency1);
    assert.isTrue(
      expectedNewBalance.cmp(actualNewBalance) === 0,
      "The new balance should be " + expectedNewBalance.toString() + ", but it is " + actualNewBalance.toString()
    );
  });

  it("must fail minting a brand currency with 5th account in brand 1, due to lack of permissions", async function() {
    let value = new BN("5000000000000000000");
    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[5], brand1Currency1, 1, {from: accounts[5]}),
      "FTTypeCheckingPlugin: caller is not brand owner nor approved, " +
      "and does not have the required permission"
    );
  });

  it("must fail granting the BRAND_MANAGE_CURRENCIES on brand 1 with 5th account on itself", async function() {
    await expectRevert(
      brandRegistry.brandSetPermission(
        brand1, BRAND_MANAGE_CURRENCIES, accounts[5], true, { from: accounts[5] }
      ),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must allow 1st account to grant BRAND_MANAGE_CURRENCIES on brand 1 to 5th account", async function() {
    await expectEvent(
      await brandRegistry.brandSetPermission(
        brand1, BRAND_MANAGE_CURRENCIES, accounts[5], true, { from: accounts[1] }
      ),
      "BrandPermissionChanged", {
        "brandId": brand1, "permission": BRAND_MANAGE_CURRENCIES, "user": accounts[5],
        "set": true, "sender": accounts[1]
      }
    );
  });

  it("must allow minting a brand currency with 5th account in brand 1", async function() {
    let balance = await economy.balanceOf(accounts[5], brand1Currency1);
    await mintingPlugin.mintBrandCurrency(accounts[5], brand1Currency1, new BN("10000000000000000000"),
                                          {from: accounts[5]});
    let expectedNewBalance = balance.add(new BN("10000000000000000000"));
    let actualNewBalance = await economy.balanceOf(accounts[5], brand1Currency1);
    assert.isTrue(
      expectedNewBalance.cmp(actualNewBalance) === 0,
      "The new balance should be " + expectedNewBalance.toString() + ", but it is " + actualNewBalance.toString()
    );
  });

  it("must allow 1st account to revoke BRAND_MANAGE_CURRENCIES on brand 1 to 5th account", async function() {
    await expectEvent(
      await brandRegistry.brandSetPermission(
        brand1, BRAND_MANAGE_CURRENCIES, accounts[5], false, { from: accounts[1] }
      ),
      "BrandPermissionChanged", {
        "brandId": brand1, "permission": BRAND_MANAGE_CURRENCIES, "user": accounts[5],
        "set": false, "sender": accounts[1]
      }
    );
  });

  it("must fail minting a brand currency with 5th account in brand 1, due to lack of permissions", async function() {
    await expectRevert(
      mintingPlugin.mintBrandCurrency(accounts[5], brand1Currency1, 1, {from: accounts[5]}),
      "FTTypeCheckingPlugin: caller is not brand owner nor approved, and does not " +
      "have the required permission"
    );
  });

  it("must succeed in wrapping 16 MATIC", async function() {
    let amount = new BN("16000000000000000000");
    await web3.eth.sendTransaction({ from: accounts[4], to: mintingPlugin.address, value: amount });
    let balance = await economy.balanceOf(accounts[4], WMATIC);
    assert.isTrue(
      balance.cmp(amount) === 0,
      "The expected amount of WMATIC must be 16 full coins, since that amount was wrapped"
    )
  });

  it("must succeed in wrapping 3 more MATIC", async function() {
    let amount = new BN("3000000000000000000");
    let expectedBalance = new BN("19000000000000000000");
    await web3.eth.sendTransaction({ from: accounts[4], to: mintingPlugin.address, value: amount });
    let balance = await economy.balanceOf(accounts[4], WMATIC);
    assert.isTrue(
      balance.cmp(expectedBalance) === 0,
      "The expected amount of WMATIC must be 19 full coins, since that amount was wrapped in total"
    )
  });

  it("must succeed in sending 2 BEAT (they'll be burned)", async function() {
    await economy.safeTransferFrom(
      accounts[4], mintingPlugin.address, BEAT, new BN("2000000000000000000"), web3.utils.asciiToHex("hello"),
      {from: accounts[4]}
    );
    let balance = await economy.balanceOf(mintingPlugin.address, BEAT);
    assert.isTrue(
      balance.cmp(new BN(0)) === 0,
      "The expected BEAT amount in the minting plug-in must be 0"
    );
  });

  it("must succeed in sending 5 WMATIC (they'll be unwrapped)", async function() {
    let initialBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let tx = await economy.safeTransferFrom(
      accounts[4], mintingPlugin.address, WMATIC, new BN("5000000000000000000"), web3.utils.asciiToHex("hello"),
      {from: accounts[4]}
    );
    let totalGas = await txTotalGas(web3, tx);
    let finalBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let expectedFinalBalance = initialBalance.sub(totalGas).add(new BN("5000000000000000000"));
    assert.isTrue(
      expectedFinalBalance.cmp(finalBalance) === 0,
      "The final balance is " + finalBalance + " but must be " + expectedFinalBalance + " instead"
    );
  });

  it("must succeed in sending 5 WMATIC (they'll be unwrapped) again", async function() {
    let initialBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let tx = await economy.safeTransferFrom(
      accounts[4], mintingPlugin.address, WMATIC, new BN("5000000000000000000"), web3.utils.asciiToHex("hello"),
      {from: accounts[4]}
    );
    let totalGas = await txTotalGas(web3, tx);
    let finalBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let expectedFinalBalance = initialBalance.sub(totalGas).add(new BN("5000000000000000000"));
    assert.isTrue(
      expectedFinalBalance.cmp(finalBalance) === 0,
      "The final balance is " + finalBalance + " but must be " + expectedFinalBalance + " instead"
    );
    let wmaticBalance = await economy.balanceOf(mintingPlugin.address, WMATIC);
    assert.isTrue(
      wmaticBalance.cmp(new BN(0)) === 0,
      "The WMATIC balance in the minting plug-in must be 0"
    );
  });

  it("must succeed in sending 6 WMATIC (they will be unwrapped) and 6 BEAT, in batch", async function() {
    let amount = new BN("6000000000000000000");
    let initialBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let tx = await economy.safeBatchTransferFrom(
      accounts[4], mintingPlugin.address, [BEAT, WMATIC], [amount, amount], web3.utils.asciiToHex("hello"),
      {from: accounts[4]}
    );
    let totalGas = await txTotalGas(web3, tx);
    let finalBalance = new BN(await web3.eth.getBalance(accounts[4]));
    let expectedFinalBalance = initialBalance.sub(totalGas).add(new BN("6000000000000000000"));
    assert.isTrue(
      expectedFinalBalance.cmp(finalBalance) === 0,
      "The final balance is " + finalBalance + " but must be " + expectedFinalBalance + " instead"
    );
    let beatBalance = await economy.balanceOf(mintingPlugin.address, BEAT);
    assert.isTrue(
      beatBalance.cmp(new BN(0)) === 0,
      "The BEAT balance in the minting plug-in must be 0"
    );
    let wmaticBalance = await economy.balanceOf(mintingPlugin.address, WMATIC);
    assert.isTrue(
      wmaticBalance.cmp(new BN(0)) === 0,
      "The WMATIC balance in the minting plug-in must be 0"
    );
  });

  it("must not allow transferring another asset type (e.g. a brand)", async function() {
    let one = new BN(1);
    let amount = new BN("1000000000000000000");
    await economy.safeBatchTransferFrom(
      accounts[4], accounts[1], [BEAT, WMATIC], [amount, amount], web3.utils.asciiToHex("hello"),
      {from: accounts[4], gas: new BN("5000000")}
    );
    await expectRevert(
      economy.safeBatchTransferFrom(
        accounts[1], mintingPlugin.address, [BEAT, WMATIC, new BN(brand1)], [amount, amount, one],
        web3.utils.asciiToHex("hello"), {from: accounts[1], gas: new BN("5000000")}
      ),
      revertReason(
        "CurrencyMintingPlugin: cannot receive, from users, non-currency or bounded currency tokens"
      )
    );
  });

  it("must not allow minting currencies directly from the definition plug-in", async function() {
    await expectRevert(
      definitionPlugin.mintCurrency(
        accounts[3], WMATIC, new BN("1000000000000000000"), "0x00", {from: accounts[0]}
      ),
      revertReason("CurrencyDefinitionPlugin: only the minting plugin is allowed to mint currencies")
    )
  });
});