const SampleERC1155WithBrandRegistry = artifacts.require("SampleERC1155WithBrandRegistry");

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
contract("SampleERC1155WithBrandRegistry", function (accounts) {
  var contract = null;

  before(async function () {
    contract = await SampleERC1155WithBrandRegistry.new({ from: accounts[0] });
    // console.log("sample keccak", web3.utils.keccak256("Hello world!"));
    // console.log("address", contract.address);
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
      revertReason("BrandRegistry: not allowed to set the brand registration cost")
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
  it("must successfully create a brand", async function () {
    let hash = web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    );
    hash = web3.utils.toChecksumAddress("0x" + hash.substr(26));

    await expectEvent(
      await contract.registerBrand(
        "My Brand 1", "My awesome brand 1", "http://example.com/brand1.png", "http://example.com/challenge.json",
        "http://example.com/ico16x16.png", "http://example.com/ico32x32.png", "http://example.com/ico64x64.png",
        {from: accounts[1], value: new BN("2000000000000000000")}
      ), "BrandRegistered",
      {"registeredBy": accounts[1], "brandId": hash, "name": "My Brand 1",
        "description": "My awesome brand 1", "price": new BN("2000000000000000000")}
    );
  });

  // 8. This should revert: Create a new brand (a happy case), using account 1 and spending 2.1 ether.
  //    Also another test: Create a new brand (a happy case), using account 1 and spending 1.9 ether.
  it("must not allow to create a brand using another price but 2", async function() {
    await expectRevert(
      contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/challenge2.json",
        "http://example.com/ico16x16-2.png", "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[1], value: new BN("2000000000000000001")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "2000000000000000000 but 2000000000000000001 was given"
      )
    );

    await expectRevert(
      contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/challenge2.json",
        "http://example.com/ico16x16-2.png", "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
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
  it("must successfully create a brand", async function () {
    let hash = web3.utils.soliditySha3(
        "0xd6", "0x94", contract.address, accounts[1], 2
    );
    hash = web3.utils.toChecksumAddress("0x" + hash.substr(26));

    await expectEvent(
      await contract.registerBrand(
        "My Brand 2", "My awesome brand 2", "http://example.com/brand2.png", "http://example.com/challenge2.json",
        "http://example.com/ico16x16-2.png", "http://example.com/ico32x32-2.png", "http://example.com/ico64x64-2.png",
        {from: accounts[1], value: new BN("4000000000000000000")}
        ), "BrandRegistered",
        {"registeredBy": accounts[1], "brandId": hash, "name": "My Brand 2",
        "description": "My awesome brand 2", "price": new BN("4000000000000000000")}
    );
  });

  // 11. This should revert: Create a new brand (a happy case), using account 1 and spending 4.1 ether.
  //     Also another test: Create a new brand (a happy case), using account 1 and spending 3.9 ether.
  it("must not allow to create a brand using another price but 2", async function() {
    await expectRevert(
      contract.registerBrand(
        "My Brand 3", "My awesome brand 3", "http://example.com/brand3.png", "http://example.com/challenge3.json",
        "http://example.com/ico16x16-3.png", "http://example.com/ico32x32-3.png", "http://example.com/ico64x64-3.png",
        {from: accounts[1], value: new BN("4000000000000000001")}
      ),
      revertReason(
        "BrandRegistry: brand registration requires an exact payment of " +
        "4000000000000000000 but 4000000000000000001 was given"
      )
    );

    await expectRevert(
      contract.registerBrand(
        "My Brand 3", "My awesome brand 3", "http://example.com/brand3.png", "http://example.com/challenge3.json",
        "http://example.com/ico16x16-3.png", "http://example.com/ico32x32-3.png", "http://example.com/ico64x64-3.png",
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
        "challengeUrl":"http://example.com/challenge.json",
        "icon16x16":"http://example.com/ico16x16.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png"
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
      callback(brandId, notOwner), revertReason("BrandRegistry: caller is not brand owner nor approved")
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
        "challengeUrl":"http://example.com/challenge.json",
        "icon16x16":"http://example.com/ico16x16.png",
        "icon32x32":"http://example.com/ico32x32.png",
        "icon64x64":"http://example.com/ico64x64.png"
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
        "icon64x64":"http://example.com/ico64x64.png"
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
        "icon64x64":"http://example.com/ico64x64.png"
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
        "icon64x64":"http://example.com/ico64x64.png"
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
        "icon64x64":"http://example.com/ico64x64-bazinga.png"
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

  // TODO ERC1155-related tests: transferring the brand and setting operators.

  it("must transfer the brand, and only validate the new owner", async function () {
    let brandId1 = "0x" + web3.utils.soliditySha3(
      "0xd6", "0x94", contract.address, accounts[1], 1
    ).substr(26);
    console.log("Brand id: ", brandId1);
    // A transfer is done, with this brand, to brand 0.
    await contract.safeTransferFrom(
      accounts[1], accounts[0], new BN(brandId1), 1, web3.utils.asciiToHex("test transfer"), {from: accounts[1]}
    );
    // The old owner (1) must fail.
    await expectRevert(
      contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[1]}),
      revertReason("BrandRegistry: caller is not brand owner nor approved")
    );
    // And the new owner (0) must succeed.
    await contract.updateBrandImage(brandId1, "http://example.com/brand1-bazinga.png", {from: accounts[0]});
  });
});
