const Metaverse = artifacts.require("Metaverse");
const Economy = artifacts.require("Economy");
const BrandRegistry = artifacts.require("BrandRegistry");
const SponsorRegistry = artifacts.require("SponsorRegistry");
const SimpleECDSASignatureVerifier = artifacts.require("SimpleECDSASignatureVerifier");
const MetaverseSignatureVerifier = artifacts.require("MetaverseSignatureVerifier");


module.exports = async function(_deployer, network, accounts) {
    await _deployer.deploy(Metaverse);
    const metaverse = await Metaverse.deployed();
    const metaverseAddress = metaverse.address;
    await _deployer.deploy(Economy, metaverseAddress);
    await _deployer.deploy(SponsorRegistry, metaverseAddress);
    await _deployer.deploy(BrandRegistry, metaverseAddress, accounts[0], 450);
    const brandRegistry = await BrandRegistry.deployed();
    await _deployer.deploy(SimpleECDSASignatureVerifier);
    const simpleECDSASignatureVerifier = await SimpleECDSASignatureVerifier.deployed();
    const simpleSignatureVerifierAddress = simpleECDSASignatureVerifier.address;
    await _deployer.deploy(MetaverseSignatureVerifier, metaverseAddress, ["ECDSA"], [simpleSignatureVerifierAddress]);
    const metaverseSignatureVerifier = await MetaverseSignatureVerifier.deployed();
    const metaverseSignatureVerifierAddress = metaverseSignatureVerifier.address;
    await metaverse.setBrandRegistry((await BrandRegistry.deployed()).address);
    await metaverse.setEconomy((await Economy.deployed()).address);
    await metaverse.setSponsorRegistry((await SponsorRegistry.deployed()).address);
    await metaverse.setSignatureVerifier(metaverseSignatureVerifierAddress);
    await brandRegistry.setBrandRegistrationCost("10000000000000000000");
};
