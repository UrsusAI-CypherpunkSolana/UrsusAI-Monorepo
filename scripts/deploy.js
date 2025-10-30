const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Starting URSUS Platform deployment on Core DAO...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying contracts with account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "CORE");
  
  if (balance < ethers.parseEther("10")) {
    console.warn("⚠️  Warning: Low balance. Make sure you have enough CORE for deployment.");
  }
  
  // Deploy AgentFactory
  console.log("\n📦 Deploying AgentFactory...");
  const AgentFactory = await ethers.getContractFactory("AgentFactory");
  const agentFactory = await AgentFactory.deploy(); // No constructor parameters
  await agentFactory.waitForDeployment();

  // Set platform treasury after deployment
  console.log("🏦 Setting platform treasury...");
  await agentFactory.setPlatformTreasury(deployer.address);
  console.log("✅ Platform treasury set to:", deployer.address);
  
  const factoryAddress = await agentFactory.getAddress();
  console.log("✅ AgentFactory deployed to:", factoryAddress);
  
  // Verify deployment
  console.log("\n🔍 Verifying deployment...");
  const totalAgents = await agentFactory.getTotalAgents();
  console.log("📊 Total agents:", totalAgents.toString());
  
  const creationFee = await agentFactory.creationFee();
  console.log("💵 Creation fee:", ethers.formatEther(creationFee), "CORE");
  
  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    contracts: {
      AgentFactory: {
        address: factoryAddress,
        deploymentHash: agentFactory.deploymentTransaction()?.hash,
      }
    },
    timestamp: new Date().toISOString(),
    gasUsed: {
      AgentFactory: (await agentFactory.deploymentTransaction()?.wait())?.gasUsed?.toString() || "0"
    }
  };
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save deployment info to file
  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("\n📄 Deployment info saved to:", deploymentFile);
  
  // Update frontend config
  await updateFrontendConfig(deploymentInfo);

  // Export ABIs to frontend
  await exportFrontendABIs();

  console.log("\n🎉 Deployment completed successfully!");
  console.log("📋 Summary:");
  console.log("  - Network:", hre.network.name);
  console.log("  - AgentFactory:", factoryAddress);
  console.log("  - Deployer:", deployer.address);
  console.log("  - Creation Fee:", ethers.formatEther(creationFee), "CORE");
  
  if (hre.network.name !== "hardhat") {
    console.log("\n🔗 Block Explorer:");
    const explorerUrl = hre.network.name === "coreTestnet" 
      ? "https://scan.test2.btcs.network"
      : "https://scan.coredao.org";
    console.log(`  ${explorerUrl}/address/${factoryAddress}`);
    
    console.log("\n📝 To verify contracts, run:");
    console.log(`  npx hardhat verify --network ${hre.network.name} ${factoryAddress}`);
  }
}

async function exportFrontendABIs() {
  try {
    const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
    const factoryArtifactPath = path.join(artifactsDir, "AgentFactory.sol", "AgentFactory.json");
    const tokenArtifactPath = path.join(artifactsDir, "AgentToken.sol", "AgentToken.json");

    const factoryArtifact = JSON.parse(fs.readFileSync(factoryArtifactPath, 'utf8'));
    const tokenArtifact = JSON.parse(fs.readFileSync(tokenArtifactPath, 'utf8'));

    const frontendAbisDir = path.join(__dirname, "..", "ursus-frontend", "src", "abis");
    if (!fs.existsSync(frontendAbisDir)) fs.mkdirSync(frontendAbisDir, { recursive: true });

    fs.writeFileSync(path.join(frontendAbisDir, "AgentFactory.json"), JSON.stringify({ abi: factoryArtifact.abi }, null, 2));
    fs.writeFileSync(path.join(frontendAbisDir, "AgentToken.json"), JSON.stringify({ abi: tokenArtifact.abi }, null, 2));

    console.log("✅ Frontend ABIs exported to:", frontendAbisDir);
  } catch (error) {
    console.warn("⚠️  Could not export frontend ABIs:", error.message);
  }
}

async function updateFrontendConfig(deploymentInfo) {
  try {
    const configPath = path.join(__dirname, "..", "ursus-frontend", "src", "config", "contracts.ts");
    
    const configContent = `// Auto-generated contract addresses
// Last updated: ${deploymentInfo.timestamp}

export const CONTRACT_ADDRESSES = {
  ${deploymentInfo.network.toUpperCase()}: {
    AGENT_FACTORY: "${deploymentInfo.contracts.AgentFactory.address}",
    CHAIN_ID: ${deploymentInfo.chainId},
  }
} as const;

export const DEPLOYMENT_INFO = ${JSON.stringify(deploymentInfo, null, 2)} as const;
`;
    
    fs.writeFileSync(configPath, configContent);
    console.log("✅ Frontend config updated:", configPath);
  } catch (error) {
    console.warn("⚠️  Could not update frontend config:", error.message);
  }
}

// Handle errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
