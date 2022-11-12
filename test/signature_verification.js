const SignatureVerifierHub = artifacts.require("SignatureVerifierHub");
const SimpleECDSASignatureVerifier = artifacts.require("SimpleECDSASignatureVerifier");

const {
  BN,           // Big Number support
  constants,    // Common constants, like the zero address and largest integers
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');

const {
  revertReason,
} = require("./test_utils");

contract("SimpleECDSASignatureVerifier", function(accounts) {
  let hub = null;
  let simpleVerifier = null;

  before(async function() {
    simpleVerifier = await SimpleECDSASignatureVerifier.new({ from: accounts[0] });
    hub = await SignatureVerifierHub.new(["ECDSA"], [simpleVerifier.address], { from: accounts[0] });
    await hub.setSignatureMethodAllowance(0, true, { from: accounts[0] });
  });

  function arrayEqual(a, b) {
    return a.length === b.length && a.every((e, i) => e === b[i]);
  }

  it("must have proper settings", async function() {
    console.log(
      await hub.verifiersKeys(0),
      await hub.verifiersLength()
    )
    assert.isTrue(
      "ECDSA" === await hub.verifiersKeys(0) && (await hub.verifiersLength()).cmp(new BN(1)) === 0,
      "The only registered key must be ECDSA"
    );
    assert.isTrue(
      simpleVerifier.address === await hub.verifiers(0) && (await hub.verifiersLength()).cmp(new BN(1)) === 0,
      "The only registered key must be the simple verifier"
    );
  })

  it("must appropriately validate by the default mechanism", async function() {
    let message = "Hello World!";
    let hash = web3.utils.soliditySha3(message);
    let signature = web3.eth.abi.encodeParameters(["uint16", "bytes"], [0, await web3.eth.sign(hash, accounts[0])]);
    let address = await hub.verifySignature(hash, signature, { from: accounts[0] });
    assert.isTrue(
      address === accounts[0],
      "The recovered address should be " + accounts[0] + ", not " + address
    );
  });
});