const IdUtils = artifacts.require("IdUtils");

module.exports = function(_deployer) {
  _deployer.deploy(IdUtils);
};
