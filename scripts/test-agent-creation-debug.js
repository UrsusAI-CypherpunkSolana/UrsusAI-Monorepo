const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing agent creation with debug...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  
  // AgentFactory address from deployment
  const factoryAddress = "0xC783aC13244Cc2454dF4393c556b10ECE4820B1F";
  
  // Get contract instance
  const AgentFactory = await ethers.getContractFactory("AgentFactory");
  const agentFactory = AgentFactory.attach(factoryAddress);
  
  try {
    // Check current fee first
    const currentFee = await agentFactory.creationFee();
    console.log("💰 Current creation fee:", ethers.formatEther(currentFee), "CORE");
    
    // Test parameters
    const testParams = {
      name: "TestAgent",
      symbol: "TEST",
      description: "A test agent",
      instructions: "You are a test agent",
      model: "gpt-4",
      category: "Test"
    };
    
    console.log("🔧 Test parameters:", testParams);
    
    // Estimate gas first
    console.log("⛽ Estimating gas...");
    try {
      const gasEstimate = await agentFactory.createAgent.estimateGas(
        testParams.name,
        testParams.symbol,
        testParams.description,
        testParams.instructions,
        testParams.model,
        testParams.category,
        { value: currentFee }
      );
      console.log("⛽ Gas estimate:", gasEstimate.toString());
    } catch (gasError) {
      console.error("❌ Gas estimation failed:", gasError.message);
      
      // Try to get more details
      if (gasError.data) {
        console.log("🔍 Error data:", gasError.data);
      }
      
      // Try to decode the revert reason
      try {
        const errorData = gasError.data;
        if (errorData && errorData.startsWith('0x08c379a0')) {
          // Standard revert reason
          const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + errorData.slice(10))[0];
          console.log("🚫 Revert reason:", reason);
        }
      } catch (decodeError) {
        console.log("❌ Could not decode revert reason");
      }
      
      return;
    }
    
    // Try the actual transaction
    console.log("🚀 Attempting to create agent...");
    const tx = await agentFactory.createAgent(
      testParams.name,
      testParams.symbol,
      testParams.description,
      testParams.instructions,
      testParams.model,
      testParams.category,
      { 
        value: currentFee,
        gasLimit: 5000000 // Much higher gas limit
      }
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log("⛽ Gas used:", receipt.gasUsed.toString());
    
    // Get the new agent address from events
    const events = receipt.logs;
    console.log("📋 Events:", events.length);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    
    if (error.data) {
      console.log("🔍 Error data:", error.data);
    }
    
    // Try to decode the revert reason
    try {
      const errorData = error.data;
      if (errorData && errorData.startsWith('0x08c379a0')) {
        // Standard revert reason
        const reason = ethers.AbiCoder.defaultAbiCoder().decode(['string'], '0x' + errorData.slice(10))[0];
        console.log("🚫 Revert reason:", reason);
      }
    } catch (decodeError) {
      console.log("❌ Could not decode revert reason");
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
