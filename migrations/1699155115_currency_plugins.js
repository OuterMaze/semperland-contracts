const Metaverse = artifacts.require("Metaverse");
const Economy = artifacts.require("Economy");
const BrandRegistry = artifacts.require("BrandRegistry");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");

module.exports = async function(_deployer, network, accounts) {
    let metaverse = await Metaverse.deployed();
    let metaverseAddress = metaverse.address;
    // Adding the currency definition plugin with default arguments.
    // We can change these later.
    await _deployer.deploy(
        CurrencyDefinitionPlugin, metaverseAddress, accounts[0],
        // WMATIC's image, icon16, icon32, icon64.
        "about:blank", "about:blank", "about:blank", "about:blank",
        // BEAT's image, icon16, icon32, icon64.
        "about:blank", "about:blank", "about:blank", "about:blank",
        // Sponsor timeout (7m30s minutes).
        450
    );
    let currencyDefinitionPlugin = await CurrencyDefinitionPlugin.deployed();
    let currencyDefinitionPluginAddress = currencyDefinitionPlugin.address;
    await metaverse.addPlugin(currencyDefinitionPluginAddress);
    await _deployer.deploy(
        CurrencyMintingPlugin, metaverseAddress, currencyDefinitionPluginAddress, accounts[0], 450
    );
    let currencyMintingPlugin = await CurrencyMintingPlugin.deployed();
    let currencyMintingPluginAddress = currencyMintingPlugin.address;
    await metaverse.addPlugin(currencyMintingPluginAddress);
    // FURTHER MIGRATIONS MUST SET:
    // - Images for WMATIC and BEAT.
    // - Currency definition cost.
    // - Currency minting cost.
    // - Currency minting amount.
};
