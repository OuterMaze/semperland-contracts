const Metaverse = artifacts.require("Metaverse");
const Economy = artifacts.require("Economy");
const BrandRegistry = artifacts.require("BrandRegistry");
const SponsorRegistry = artifacts.require("SponsorRegistry");

module.exports = async function(_deployer, network, accounts) {
    await _deployer.deploy(Metaverse);
    let metaverse = await Metaverse.deployed();
    let metaverseAddress = metaverse.address;
    await _deployer.deploy(Economy, metaverseAddress);
    await _deployer.deploy(SponsorRegistry, metaverseAddress);
    await _deployer.deploy(BrandRegistry, metaverseAddress, accounts[0], 450);
    await metaverse.setBrandRegistry((await BrandRegistry.deployed()).address);
    await metaverse.setEconomy((await Economy.deployed()).address);
    await metaverse.setSponsorRegistry((await SponsorRegistry.deployed()).address);
    // FURTHER MIGRATIONS MUST SET:
    // - Brand registration costs.
};
