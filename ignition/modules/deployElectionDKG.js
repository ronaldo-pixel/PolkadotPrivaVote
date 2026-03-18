// ignition/modules/deployPrivateVoting.js
const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("PrivateVoting", (m) => {
    // Deploy PrivateVoting with a placeholder verifier address.
    // Groth16Verifier uses BN128 precompiles unavailable on PolkaVM —
    // ZK proof verification needs a separate solution for this target.
    const privateVoting = m.contract("PrivateVoting", [
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "0x0000000000000000000000000000000000000001", // placeholder
    ]);
    return { privateVoting };
});