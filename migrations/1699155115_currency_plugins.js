const Metaverse = artifacts.require("Metaverse");
const Economy = artifacts.require("Economy");
const BrandRegistry = artifacts.require("BrandRegistry");
const CurrencyDefinitionPlugin = artifacts.require("CurrencyDefinitionPlugin");
const CurrencyMintingPlugin = artifacts.require("CurrencyMintingPlugin");

module.exports = async function(_deployer, network, accounts) {
    let metaverseAddress = (await Metaverse.deployed()).address;
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
    let definitionPluginAddress = (await CurrencyDefinitionPlugin.deployed()).address;
    await _deployer.deploy(
        CurrencyMintingPlugin, metaverseAddress, definitionPluginAddress, accounts[0], 450
    );
};
