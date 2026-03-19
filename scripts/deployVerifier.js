require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL   = "https://eth-rpc-testnet.polkadot.io/";
const BUILD_DIR = path.join(__dirname, "..", "build");

async function main() {
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet   = new ethers.Wallet(process.env.PASEO_PK, provider);


console.log("Deployer:", wallet.address);

const balance = await provider.getBalance(wallet.address);
console.log("Balance:", ethers.formatEther(balance), "PAS");

if (balance === 0n) {
    console.error("No balance. Get from faucet:");
    console.error("https://faucet.polkadot.io/?parachain=1111");
    process.exit(1);
}
console.log(BUILD_DIR);
// ✅ Correct filenames based on your compile
const pvmPath = path.join(BUILD_DIR, "Verifier.sol:Groth16Verifier.pvm");
const abiPath = path.join(BUILD_DIR, "Groth16Verifier.abi");
if (!fs.existsSync(pvmPath) || !fs.existsSync(abiPath)) {
    console.error("Build files missing. Check build/ folder.");
    process.exit(1);
}

const bytecode = "0x" + fs.readFileSync(pvmPath).toString("hex");
const abi      = JSON.parse(fs.readFileSync(abiPath, "utf8"));

console.log("Bytecode size:", (bytecode.length / 2 - 1), "bytes");

console.log("\nDeploying Verifier...");

const factory  = new ethers.ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy({
    gasLimit: 15_000_000n,
});

console.log("Tx:", contract.deploymentTransaction().hash);

await contract.waitForDeployment();

const address = await contract.getAddress();

console.log("\n✅ Deployed at:", address);

fs.writeFileSync(
    path.join(BUILD_DIR, "verifierAddress.json"),
    JSON.stringify({ Groth16Verifier: address }, null, 2)
);


}

main().catch(console.error);
