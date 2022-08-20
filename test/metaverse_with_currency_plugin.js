const BrandRegistry = artifacts.require("BrandRegistry");
const Economy = artifacts.require("Economy");
const Metaverse = artifacts.require("Metaverse");
const CurrencyPlugin = artifacts.require("CurrencyPlugin");

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
    var contract = null;
    var plugin = null;

    before(async function () {
        metaverse = await Metaverse.new({ from: accounts[0] });
        economy = await Economy.new(metaverse.address, { from: accounts[0] })
        contract = await BrandRegistry.new(metaverse.address, accounts[9], { from: accounts[0] });
        plugin = await CurrencyPlugin.new(metaverse.address, accounts[9], { from: accounts[0] });
        await metaverse.setEconomy(economy.address, { from: accounts[0] });
        await metaverse.setBrandRegistry(contract.address, { from: accounts[0] });
        await metaverse.addPlugin(plugin.address, { from: accounts[0] });
    });

});