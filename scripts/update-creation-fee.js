const { ethers } = require("hardhat");

async function main() {
  console.log("🔧 Updating creation fee...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  
  // AgentFactory address from deployment
  const factoryAddress = "0xC783aC13244Cc2454dF4393c556b10ECE4820B1F";
  
  // Get contract instance
  const AgentFactory = await ethers.getContractFactory("AgentFactory");
  const agentFactory = AgentFactory.attach(factoryAddress);
  
  // Check current fee
  const currentFee = await agentFactory.creationFee();
  console.log("💰 Current creation fee:", ethers.formatEther(currentFee), "CORE");
  
  // Check if we're the owner
  const owner = await agentFactory.owner();
  console.log("👑 Contract owner:", owner);
  console.log("🔑 Our address:", deployer.address);
  
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Not the contract owner!");
    process.exit(1);
  }
  
  // Set new fee to 0.01 CORE (very affordable for testing)
  const newFee = ethers.parseEther("0.01");
  console.log("🔄 Setting new creation fee to:", ethers.formatEther(newFee), "CORE");
  
  try {
    const tx = await agentFactory.updateCreationFee(newFee);
    console.log("⏳ Transaction sent:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Verify the update
    const updatedFee = await agentFactory.creationFee();
    console.log("✅ New creation fee:", ethers.formatEther(updatedFee), "CORE");
    
    console.log("🎉 Creation fee updated successfully!");
    
  } catch (error) {
    console.error("❌ Failed to update creation fee:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
