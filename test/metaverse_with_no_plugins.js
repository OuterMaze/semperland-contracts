const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");

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
contract("Metaverse", function (accounts) {
  var economy = null;
  var metaverse = null;
  var contract = null;

  const SUPERUSER = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
  const BRAND_EDITOR = web3.utils.soliditySha3("BrandRegistry::Brand::Edit");
  const METAVERSE_MANAGE_REGISTRATION_SETTINGS = web3.utils.soliditySha3("BrandRegistry::Settings::Manage");
  const METAVERSE_SET_BRAND_COMMITMENT = web3.utils.soliditySha3("BrandRegistry::SetBrandCommitment");
  const METAVERSE_MINT_BRAND_FOR = web3.utils.soliditySha3("BrandRegistry::Brands::MintFor");

  before(async function () {
    metaverse = await Metaverse.new({ from: accounts[0] });
    economy = await Economy.new(metaverse.address, { from: accounts[0] })
    contract = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
    await metaverse.setEconomy(economy.address, { from: accounts[0] });
    await metaverse.setBrandRegistry(contract.address, { from: accounts[0] });
  });

  // Tests I need:
  // 1. Set a new price of 10 ether, using account 0.
  //    Expect the appropriate event.
  it("must allow the account 0 to set the price to 10 ether", async function () {
    await expectEvent(
      await contract.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[0] }),
      "BrandRegistrationCostUpdated", {"newCost": new BN("10000000000000000000")}
    );
  });

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

  // 2. Test the price to be 10 ether.
  it("must have a price of 10 ether", async function() {
    let cost = await contract.brandRegistrationCost();
    assert.isTrue(
      cost.cmp(new BN("10000000000000000000")) === 0,
      "The brand registration cost should be 10 ether, but it is: " + cost.toString()
    )
  });

  // 3. Set a new price of 2 ether, using account 0.
  //    Expect the appropriate event.
  it("must allow the account 0 to set the brand registration price to 2 ether", async function () {
    await expectEvent(
      await contract.setBrandRegistrationCost(new BN("2000000000000000000"), { from: accounts[0] }),
      "BrandRegistrationCostUpdated", {"newCost": new BN("2000000000000000000")}
    );
  });

  // 4. Test the price to be 2 ether.
  it("must have a brand registration price of 2 ether", async function() {
    let cost = await contract.brandRegistrationCost();
    assert.isTrue(
      cost.cmp(new BN("2000000000000000000")) === 0,
      "The brand registration cost should be 2 ether, but it is: " + cost.toString()
    )
  });

  // 5. This should revert: set a new price of 3 ether, using account 1.
  it("must not allow a brand registration price to account 1", async function () {
    await expectRevert(
      contract.setBrandRegistrationCost(new BN("10000000000000000000"), { from: accounts[1] }),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    )
  });

  // 6. This should revert: set a new price of 0.009 ether, using account 0.
  it("must not allow the brand registration price to be lower than 1", async function () {
    await expectRevert(
      contract.setBrandRegistrationCost(new BN("9000000000000000"), { from: accounts[0] }),
      revertReason("BrandRegistry: the brand registry cost must not be less than 0.01 native tokens")
    )
  });

  // 7. Create a mew brand (a happy case), using account 1 and spending 2 ether.
  //    Also expect the appropriate events.
  it("must successfully create a brand (account 9 will receive 2 eth)", async function () {
    let hash = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    hash = web3.utils.toChecksumAddress("0x" + hash.substr(26));

    await expectEvent(
      await contract.registerBrand(
        "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/ico16x16.png",
        "http://example.com/ico32x32.png", "http://example.com/ico64x64.png",
        {from: accounts[1], value: new BN("2000000000000000000")}
      ), "BrandRegistered", {
        "registeredBy": accounts[1], "brandId": hash, "name": "My Brand 1",
        "description": "My awesome brand 1", "price": new BN("2000000000000000000"),
        "mintedBy": constants.ZERO_ADDRESS
      }
    );

    let balance = new BN(await web3.eth.getBalance(accounts[9]));
    assert.isTrue(
      balance.cmp(new BN("102000000000000000000")) === 0,
      revertReason(
        "BrandRegistry: the current registration earnings are " + balance.toString() +
        " but they should be 102000000000000000000 for account 9 (base 100 eth + 2 new eth)"
      )
    );
  });

  it("must not allow account 1 to set the earnings receiver", async function() {
    await expectRevert(
      contract.setBrandRegistrationEarningsReceiver(accounts[8], { from: accounts[1] }),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow account 0 to grant the permission to set earnings receiver to account 1", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_REGISTRATION_SETTINGS, accounts[1], true, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_REGISTRATION_SETTINGS, "user": accounts[1], "set": true, sender: accounts[0]
      }
    );
  });

  it("must allow the account 0 to set the brand registration price to 4 ether", async function () {
    await expectEvent(
      await contract.setBrandRegistrationEarningsReceiver(accounts[8], { from: accounts[1] }),
      "BrandRegistrationEarningsReceiverUpdated", {"newReceiver": accounts[8]}
    );
  });

  it("must allow account 0 to revoke the permission to set earnings receiver to account 1", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MANAGE_REGISTRATION_SETTINGS, accounts[1], false, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_MANAGE_REGISTRATION_SETTINGS, "user": accounts[1], "set": false, sender: accounts[0]
      }
    );
  });

  it("must not allow account 1 to set the earnings receiver", async function() {
    await expectRevert(
      contract.setBrandRegistrationEarningsReceiver(accounts[8], { from: accounts[1] }),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    );
  });

  // 8. This should revert: Create a new brand (a happy case), using account 1 and spending 2.1 ether.
  //    Also another test: Create a new brand (a happy case), using account 1 and spending 1.9 ether.
  it("must not allow to create a brand using another price but 2", async function() {
    await expectRevert(
      contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/ico16x16-2.png",
        "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[1], value: new BN("2000000000000000001")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "2000000000000000000 but 2000000000000000001 was given"
      )
    );

    await expectRevert(
      contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/ico16x16-2.png",
        "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[1], value: new BN("1999999999999999999")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "2000000000000000000 but 1999999999999999999 was given")
    );
  });

  // 9. Set a new price o 4 ether, using account 0.
  it("must allow the account 0 to set the brand registration price to 4 ether", async function () {
    await expectEvent(
      await contract.setBrandRegistrationCost(new BN("4000000000000000000"), { from: accounts[0] }),
      "BrandRegistrationCostUpdated", {"newCost": new BN("4000000000000000000")}
    );
  });

  // 10. Create a new brand (a happy case), using account 1 and spending 4 ether.
  //     Also expect the appropriate events.
  it("must successfully create a brand (account 8 will receive 4 eth)", async function () {
    let hash = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 2
    );
    hash = web3.utils.toChecksumAddress("0x" + hash.substr(26));

    await expectEvent(
      await contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/ico16x16-2.png",
        "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[1], value: new BN("4000000000000000000")}
        ), "BrandRegistered", {
        "registeredBy": accounts[1], "brandId": hash, "name": "My Brand 2",
        "description": "My awesome brand 2", "price": new BN("4000000000000000000"),
        "mintedBy": constants.ZERO_ADDRESS
      }
    );

    let balance = new BN(await web3.eth.getBalance(accounts[8]));
    assert.isTrue(
      balance.cmp(new BN("104000000000000000000")) === 0,
      revertReason(
        "BrandRegistry: the current registration earnings are " + balance.toString() +
        " but they should be 104000000000000000000 for account 8 (base 100 eth + 4 new eth)"
      )
    );
  });

  // 11. This should revert: Create a new brand (a happy case), using account 1 and spending 4.1 ether.
  //     Also another test: Create a new brand (a happy case), using account 1 and spending 3.9 ether.
  it("must not allow to create a brand using another price but 2", async function() {
    await expectRevert(
      contract.registerBrand(
        "My Brand 3", "My awesome brand 3", "http://example.com/brand3.png", "http://example.com/ico16x16-3.png",
        "http://example.com/ico32x32-3.png", "http://example.com/ico64x64-3.png",
        {from: accounts[1], value: new BN("4000000000000000001")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "4000000000000000000 but 4000000000000000001 was given"
      )
    );

    await expectRevert(
      contract.registerBrand(
        "My Brand 3", "My awesome brand 3", "http://example.com/brand3.png", "http://example.com/ico16x16-3.png",
        "http://example.com/ico32x32-3.png", "http://example.com/ico64x64-3.png",
        {from: accounts[1], value: new BN("3999999999999999999")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "4000000000000000000 but 3999999999999999999 was given"
      )
    );
  });

  // **** Now, let's focus only on the brands (creation and update) validation *****

  async function expectMetadata(brandId, payload) {
    let metadataURI = await contract.brandMetadataURI(brandId);
    let payloadJSON = JSON.stringify(payload);
    assert.isTrue(
      metadataURI === jsonUrl(payload),
      "the metadata URI is " + metadataURI + ", which does not correspond to payload: " + payloadJSON +
      ", but instead seems to correspond to payload: " + atob(metadataURI.substr(29))
    )
  }

  // 12. Test the JSON metadata for brand 1.
  it("must have the appropriate metadata for brand with id for brand 1", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await expectMetadata(brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1.png",
      "properties":{
        "challengeUrl":"about:blank",
        "icon16x16":"http://example.com/ico16x16.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png",
        "committed":false
      }
    });
  })

  async function changeAndTest(callback, owner, notOwner, brandId, expectedPayloadAfterChange) {
    let tx = await callback(brandId, owner);
    // console.log("Transaction receipt is:", tx);
    await expectEvent(
      tx, "BrandUpdated", [owner, brandId]
    );
    await expectMetadata(brandId, expectedPayloadAfterChange);
    await expectRevert(
      callback(brandId, notOwner), revertReason(
        "BrandRegistry: caller is not brand owner nor approved, and does not have the required permission"
      )
    );
    await expectMetadata(brandId, expectedPayloadAfterChange);
  }

  // 13. Change brand image (using addresses[1]).
  // 14. Test the JSON metadata for brand 1.
  // 15. This must revert: Change brand image (using addresses[0]).
  // 16. Test the JSON metadata for brand 1 (it must be the same as 14.).
  it("must change the image URL appropriately and reflect it in the metadata", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await changeAndTest(async function(brandId, user) {
      return await contract.updateBrandImage(brandId, "http://example.com/brand1-bazinga.png", {from: user});
    }, accounts[1], accounts[0], brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"about:blank",
        "icon16x16":"http://example.com/ico16x16.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png",
        "committed":false
      }
    });
  });

  // 17. Change brand challenge (using addresses[1]).
  // 18. Test the JSON metadata for brand 1.
  // 19. This must revert: Change brand challenge (using addresses[0]).
  // 20. Test the JSON metadata for brand 1 (it must be the same as 18.).
  it("must change the challenge URL appropriately and reflect it in the metadata", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await changeAndTest(async function(brandId, user) {
      return await contract.updateBrandChallengeUrl(brandId, "http://example.com/challenge-bazinga.json", {from: user});
    }, accounts[1], accounts[0], brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png",
        "committed":false
      }
    });
  });

  // 21. Change brand icon 16 (using addresses[1]).
  // 22. Test the JSON metadata for brand 1.
  // 23. This must revert: Change brand icon 16 (using addresses[0]).
  // 24. Test the JSON metadata for brand 1 (it must be the same as 22.).
  it("must change the 16x16 icon URL appropriately and reflect it in the metadata", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await changeAndTest(async function(brandId, user) {
      return  await contract.updateBrandIcon16x16Url(brandId, "http://example.com/ico16x16-bazinga.png", {from: user});
    }, accounts[1], accounts[0], brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png",
        "committed":false
      }
    });
  });

  // 25. Change brand icon 32 (using addresses[1]).
  // 26. Test the JSON metadata for brand 1.
  // 27. This must revert: Change brand icon 32 (using addresses[0]).
  // 28. Test the JSON metadata for brand 1 (it must be the same as 26.).
  it("must change the 32x32 icon URL appropriately and reflect it in the metadata", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await changeAndTest(async function(brandId, user) {
      return await contract.updateBrandIcon32x32Url(brandId, "http://example.com/ico32x32-bazinga.png", {from: user});
    }, accounts[1], accounts[0], brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32-bazinga.png",
        "icon64x64":"http://example.com/ico64x64.png",
        "committed":false
      }
    });
  });

  // 29. Change brand icon 64 (using addresses[1]).
  // 30. Test the JSON metadata for brand 1.
  // 31. This must revert: Change brand icon 64 (using addresses[0]).
  // 32. Test the JSON metadata for brand 1 (it must be the same as 30.).
  it("must change the 64x64 icon URL appropriately and reflect it in the metadata", async function() {
    let brandId1 = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));

    await changeAndTest(async function(brandId, user) {
      return await contract.updateBrandIcon64x64Url(brandId, "http://example.com/ico64x64-bazinga.png", {from: user});
    }, accounts[1], accounts[0], brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32-bazinga.png",
        "icon64x64":"http://example.com/ico64x64-bazinga.png",
        "committed":false
      }
    });
  });

  it("must consider My Brand 1 as existing", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    assert.isTrue(
      await contract.brandExists(brandId1),
      "The brand " + brandId1 + " must exist"
    );
  });

  it("must consider My Brand 2 as existing", async function() {
    let brandId2 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 2
    );
    brandId2 = web3.utils.toChecksumAddress("0x" + brandId2.substr(26));
    assert.isTrue(
      await contract.brandExists(brandId2),
      "The brand " + brandId2 + " must exist"
    );
  });

  it("must consider My Brand 3 as NOT existing", async function() {
    let brandId3 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 3
    );
    brandId3 = web3.utils.toChecksumAddress("0x" + brandId3.substr(26));
    assert.isTrue(
      !await contract.brandExists(brandId3),
      "The brand " + brandId3 + " must NOT exist"
    );
  });

  it("must transfer the brand, and only validate the new owner", async function () {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);
    // A transfer is done, with this brand, to brand 0.
    await economy.safeTransferFrom(
      accounts[1], accounts[0], new BN(brandId1), 1, web3.utils.asciiToHex("test transfer"), {from: accounts[1]}
    );
    // The old owner (1) must fail.
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[1]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
    // And the new owner (0) must succeed.
    await contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[0]});
  });

  it("must not allow the address 1 to set brand social commitment, or to an invalid brand", async function () {
    let brandId1 = "0x" + web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);
    let brandId3 = "0x" + web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 3
    ).substr(26);

    await expectRevert(
      contract.updateBrandSocialCommitment(brandId1, true, {from: accounts[1]}),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    );
    await expectRevert(
      contract.updateBrandSocialCommitment(brandId3, true, {from: accounts[0]}),
      revertReason("BrandRegistry: non-existing brand")
    );
  });

  it("must allow the address 0 to set the brand social commitment of 1st brand to true", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);

    await contract.updateBrandSocialCommitment(brandId1, true, {from: accounts[0]});

    await expectMetadata(brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32-bazinga.png",
        "icon64x64":"http://example.com/ico64x64-bazinga.png",
        "committed":true
      }
    });
  });

  it("must allow the address 0 to set the brand social commitment of 1st brand to false", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);

    await contract.updateBrandSocialCommitment(brandId1, false, {from: accounts[0]});

    await expectMetadata(brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32-bazinga.png",
        "icon64x64":"http://example.com/ico64x64-bazinga.png",
        "committed":false
      }
    });
  });

  it("must not allow account 1 to set the brand commitment", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);

    await expectRevert(
      contract.updateBrandSocialCommitment(brandId1, true, {from: accounts[1]}),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow account 1 to grant setting the brand commitment on itself", async function() {
    await expectRevert(
      metaverse.setPermission(METAVERSE_SET_BRAND_COMMITMENT, accounts[1], false, {from: accounts[1]}),
      revertReason("Metaverse: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must allow the account 0 to grant setting the brand commitment on account 1", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_SET_BRAND_COMMITMENT, accounts[1], true, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_SET_BRAND_COMMITMENT, "user": accounts[1], "set": true, sender: accounts[0]
      }
    );
  });

  it("must allow the account 1 to set the brand commitment on brand 1", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);

    await contract.updateBrandSocialCommitment(brandId1, true, {from: accounts[1]});

    await expectMetadata(brandId1, {
      "name":"My Brand 1",
      "description":"My awesome brand 1","image":"http://example.com/brand1-bazinga.png",
      "properties":{
        "challengeUrl":"http://example.com/challenge-bazinga.json",
        "icon16x16":"http://example.com/ico16x16-bazinga.png",
        "icon32x32":"http://example.com/ico32x32-bazinga.png",
        "icon64x64":"http://example.com/ico64x64-bazinga.png",
        "committed":true
      }
    });
  });

  it("must allow the account 0 to revoke setting the brand commitment to account 1", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_SET_BRAND_COMMITMENT, accounts[1], false, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_SET_BRAND_COMMITMENT, "user": accounts[1], "set": false, sender: accounts[0]
      }
    );
  });

  it("must not allow the account 1 to set the brand commitment to brand 1", async function() {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);

    await expectRevert(
      contract.updateBrandSocialCommitment(brandId1, true, {from: accounts[1]}),
      revertReason("BrandRegistry: caller is not metaverse owner, and does not have the required permission")
    );
  });

  it("must not allow 2 and 3 to set the brand image, since they don't have permissions", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[2]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[3]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must not allow 2 to grant brand editor to 3, since they don't have permissions", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectRevert(
      contract.brandSetPermission(brandId1, BRAND_EDITOR, accounts[3], true, {from: accounts[2]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must allow 0 to grant superuser to 2, but must now allow 2 to grant superuser to 3", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectEvent(
      await contract.brandSetPermission(brandId1, SUPERUSER, accounts[2], true, {from: accounts[0]}),
      "BrandPermissionChanged", {
        "brandId": brandId1, "permission": SUPERUSER, "user": accounts[2],
        "set": true, "sender": accounts[0]
      }
    );
    await expectRevert(
      contract.brandSetPermission(brandId1, SUPERUSER, accounts[3], true, {from: accounts[2]}),
      revertReason("BrandRegistry: SUPERUSER permission cannot be added by this user")
    )
  });

  it("must allow both 0 and 2 to grant brand editor to 3", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await contract.brandSetPermission(brandId1, BRAND_EDITOR, accounts[3], true, {from: accounts[0]});
    await contract.brandSetPermission(brandId1, BRAND_EDITOR, accounts[3], true, {from: accounts[2]});
  });

  it("must allow 0, 2 and 3 to set the brand 0 image", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[2]});
    await contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[3]});
  });

  it("must allow 2 to revoke brand editor to 3", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectEvent(
      await contract.brandSetPermission(brandId1, BRAND_EDITOR, accounts[3], false, {from: accounts[2]}),
      "BrandPermissionChanged", {
        "brandId": brandId1, "permission": BRAND_EDITOR, "user": accounts[3],
        "set": false, "sender": accounts[2]
      }
    );
  });

  it("must not allow 3 to revoke any permission to 2, or set the brand image", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[3]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
    await expectRevert(
      contract.brandSetPermission(brandId1, SUPERUSER, accounts[2], true, {from: accounts[3]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  it("must allow 0 to revoke superuser to 2", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectEvent(
      await contract.brandSetPermission(brandId1, SUPERUSER, accounts[2], false, {from: accounts[0]}),
      "BrandPermissionChanged", {
        "brandId": brandId1, "permission": SUPERUSER, "user": accounts[2],
        "set": false, "sender": accounts[0]
      }
    );
  });

  it("must not allow 2 and 3 to set the brand image, since they don't have permissions, again", async function() {
    let brandId1 = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    brandId1 = web3.utils.toChecksumAddress("0x" + brandId1.substr(26));
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[2]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[3]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved, and does not have the required permission")
    );
  });

  // TODO (when implemented) Test user groups (with relevant permissions) in Metaverse (for BrandRegistry actions).
  // TODO (when implemented) Test user groups (with relevant permissions) in a Brand (for BrandRegistry actions).

  it("must allow an appropriate user to set the brand registration cost to 0", async function() {
    await expectEvent(
      await contract.setBrandRegistrationCost(new BN("0"), { from: accounts[0] }),
      "BrandRegistrationCostUpdated", {"newCost": new BN("0")}
    );
  });

  it("must not allow brand registration to be done while the cost is 0", async function() {
    await expectRevert(
      contract.registerBrand(
        "My Brand 4", "My awesome brand 4", "http://example.com/brand4.png", "http://example.com/ico16x16-4.png",
        "http://example.com/ico32x32-4.png", "http://example.com/ico64x64-4.png",
        {from: accounts[1], value: new BN("2000000000000000001")}
      ),
      revertReason(
        "BrandRegistry: brand registration is currently disabled (no price is set)"
      )
    );
  });

  it("must not allow regular users to mint brand 'for'", async function() {
    await expectRevert(
      contract.registerBrandFor(
        accounts[1],
        "My Brand 5", "My awesome brand 5", "http://example.com/brand5.png", "http://example.com/ico16x16-5.png",
        "http://example.com/ico32x32-5.png", "http://example.com/ico64x64-5.png",
        {from: accounts[1]}
      ),
      revertReason(
        "BrandRegistry: caller is not metaverse owner, and does not have the required permission"
      )
    );
  });

  it("must allow the metaverse owner to grant the free brand minting permission to another user", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MINT_BRAND_FOR, accounts[1], true, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_MINT_BRAND_FOR, "user": accounts[1], "set": true, sender: accounts[0]
      }
    );
  });

  it("must allow the permitted user to mint brand 'for'", async function() {
    let hash = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[2], 3
    );
    hash = web3.utils.toChecksumAddress("0x" + hash.substr(26));

    await expectEvent(
      await contract.registerBrandFor(
        accounts[2],
        "My Brand 5", "My awesome brand 5", "http://example.com/brand5.png", "http://example.com/ico16x16-5.png",
        "http://example.com/ico32x32-5.png", "http://example.com/ico64x64-5.png",
        {from: accounts[1]},
      ), "BrandRegistered", {
        "registeredBy": accounts[2], "brandId": hash, "name": "My Brand 5",
        "description": "My awesome brand 5", "price": new BN("0"),
        "mintedBy": accounts[1]
      }
    );
  });

  it("must allow the metaverse owner to revoke the free brand minting permission to another user", async function() {
    await expectEvent(
      await metaverse.setPermission(METAVERSE_MINT_BRAND_FOR, accounts[1], false, {from: accounts[0]}),
      "PermissionChanged", {
        "permission": METAVERSE_MINT_BRAND_FOR, "user": accounts[1], "set": false, sender: accounts[0]
      }
    );
  });

  it("must not allow regular users to mint brand 'for', again", async function() {
    await expectRevert(
      contract.registerBrandFor(
        accounts[1],
        "My Brand 6", "My awesome brand 6", "http://example.com/brand6.png", "http://example.com/ico16x16-6.png",
        "http://example.com/ico32x32-6.png", "http://example.com/ico64x64-6.png",
        {from: accounts[1]}
      ),
      revertReason(
        "BrandRegistry: caller is not metaverse owner, and does not have the required permission"
      )
    );
  });

  it("must allow an appropriate user to set the brand registration cost to 2 MATIC", async function() {
    await expectEvent(
      await contract.setBrandRegistrationCost(new BN("2000000000000000000"), { from: accounts[0] }),
      "BrandRegistrationCostUpdated", {"newCost": new BN("2000000000000000000")}
    );
  });
});
