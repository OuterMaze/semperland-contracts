const Metaverse = artifacts.require("Metaverse");
const Economy = artifacts.require("Economy");
const BrandRegistry = artifacts.require("BrandRegistry");

module.exports = async function(_deployer, network, accounts) {
    await _deployer.deploy(Metaverse);
    await _deployer.deploy(Economy, (await Metaverse.deployed()).address);
    await _deployer.deploy(BrandRegistry, (await Metaverse.deployed()).address, accounts[0], 450);
};
