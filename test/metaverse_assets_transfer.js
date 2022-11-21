const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const SampleTokenTransferTracker = artifacts.require("SampleTokenTransferTracker");
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
  revertReason,
} = require("./test_utils");

/*
 * uncomment accounts to access the test accounts made available by the
 * Ethereum client
 * See docs: https://www.trufflesuite.com/docs/truffle/testing/writing-tests-in-javascript
 */
contract("Metaverse", function (accounts) {
  let economy = null;
  let metaverse = null;
  let brandRegistry = null;
  let sampleTokenTransferTracker = null;
  let simpleSignatureVerifier = null;
  let signatureVerifier = null;
  let brand1 = null;
  let brand2 = null;

  before(async function () {
    metaverse = await Metaverse.new({from: accounts[0]});
    economy = await Economy.new(metaverse.address, {from: accounts[0]})
    brandRegistry = await BrandRegistry.new(metaverse.address, accounts[9], 300, {from: accounts[0]});
    sampleTokenTransferTracker = await SampleTokenTransferTracker.new(metaverse.address, {from: accounts[0]});
    simpleSignatureVerifier = await SimpleECDSASignatureVerifier.new({from: accounts[0]});
    signatureVerifier = await MetaverseSignatureVerifier.new(
      metaverse.address, ["ECDSA"], [simpleSignatureVerifier.address], {from: accounts[0]}
    );
    await metaverse.setEconomy(economy.address, {from: accounts[0]});
    await metaverse.setBrandRegistry(brandRegistry.address, {from: accounts[0]});
    await metaverse.setSignatureVerifier(signatureVerifier.address, {from: accounts[0]});
    await brandRegistry.setBrandRegistrationCost(new BN("10000000000000000000"), {from: accounts[0]});
    await metaverse.addPlugin(sampleTokenTransferTracker.address, {from: accounts[0]});
    await signatureVerifier.setSignatureMethodAllowance(0, true, {from: accounts[2]});
  });

  it("must successfully create a brand (account 1 will be operator of brand 1)", async function () {
    brand1 = web3.utils.soliditySha3(
      "0xd6", "0x94", brandRegistry.address, accounts[1], 1
    );
    brand1 = web3.utils.toChecksumAddress("0x" + brand1.substr(26));

    await expectEvent(
      await brandRegistry.registerBrand(
        delegates.NO_DELEGATE,
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
      await brandRegistry.registerBrand(
        await delegates.makeDelegate(web3, accounts[2], [
          {type: "string", value: "My Brand 2"},
          {type: "string", value: "My awesome brand 2"},
          {type: "string", value: "http://example.com/brand2.png"}
        ]),
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

  it("must change ownership accordingly when transferring brand 1 to account 3", async function() {
    await economy.safeTransferFrom(accounts[1], accounts[3], new BN(brand1), 1, "0x00", {from: accounts[1]});
    assert.isTrue(
      await economy.isApprovedForAll(brand1, accounts[3]),
      "The account 3, being owner of the brand 1, must also be considered its ERC1155 operator"
    );
  });

  it("must change ownership accordingly when transferring brand 2 to account 4", async function() {
    await economy.safeTransferFrom(accounts[2], accounts[4], new BN(brand2), 1, "0x00", {from: accounts[2]});
    assert.isTrue(
      await economy.isApprovedForAll(brand2, accounts[4]),
      "The account 4, being owner of the brand 2, must also be considered its ERC1155 operator"
    );
  });

  it("must not allow transferring brand 1 from account 3 to the burner contract to be burned", async function() {
    await expectRevert(
      economy.safeTransferFrom(
        accounts[3], sampleTokenTransferTracker.address, new BN(brand1), 1, "0x00",
        {from: accounts[3]}
      ),
      "Economy: only non-brand tokens can be burned this way"
    );
  });

  it("must not allow batch-transferring brand 2 from account 4 to the burner contract to be burned", async function() {
    await expectRevert(
      economy.safeBatchTransferFrom(
        accounts[4], sampleTokenTransferTracker.address, [new BN(brand2)], [1], "0x00",
        {from: accounts[4]}
      ),
      "Economy: only non-brand tokens can be burned this way"
    );
  });

  it("must mint an NFT for account 1", async function() {
    await sampleTokenTransferTracker.mintNFT({ from: accounts[1] });
    let token = new BN("0x10000000000000000000000000000000000000000");
    let owner = await sampleTokenTransferTracker.ownerships(token);
    assert.isTrue(
      owner === accounts[1], "The owner of the new minted NFT must be account 1"
    );
  });

  it("must reflect appropriate owner when transferring to account 2", async function() {
    let token = new BN("0x10000000000000000000000000000000000000000");
    await economy.safeTransferFrom(accounts[1], accounts[2], token, 1, "0x00", {from: accounts[1]});
    let owner = await sampleTokenTransferTracker.ownerships(token);
    assert.isTrue(
      owner === accounts[2], "The new owner of the new minted NFT must be account 2 (" + accounts[2] +
      "), not: " + owner
    );
  });

  it("must reflect no owner when transferring to burn", async function() {
    let token = new BN("0x10000000000000000000000000000000000000000");
    await economy.safeTransferFrom(
      accounts[2], sampleTokenTransferTracker.address, token, 1, "0x00",
      {from: accounts[2]}
    );
    let owner = await sampleTokenTransferTracker.ownerships(token);
    assert.isTrue(
      owner === constants.ZERO_ADDRESS, "The token must have no owner, since it is burned"
    );
  });

  it("must properly mint 10 fungible tokens, and burn 5", async function() {
    let ftType = await sampleTokenTransferTracker.sampleFTType();
    await sampleTokenTransferTracker.mintFT(10, {from: accounts[1]});
    await economy.safeTransferFrom(
      accounts[1], sampleTokenTransferTracker.address, ftType, 5, "0x00",
      {from: accounts[1]}
    );
    assert.isTrue(
      (await economy.balanceOf(accounts[1], ftType)).cmp(new BN(5)) === 0,
      "The balance of ft tokens in account 1 must be 5"
    );
    assert.isTrue(
      (await economy.balanceOf(sampleTokenTransferTracker.address, ftType)).cmp(new BN(0)) === 0,
      "The balance of ft tokens in the burn contract must be 0"
    );
  });
});
