const { ethers } = require("hardhat");

async function main() {
  console.log("🧪 Testing agent creation on Core DAO Testnet...");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Using account:", deployer.address);
  
  // AgentFactory address from deployment
  const factoryAddress = "0xD5601a869aBD254E26F1BbAAF0423b9235831235";
  
  // Get contract instance
  const AgentFactory = await ethers.getContractFactory("AgentFactory");
  const agentFactory = AgentFactory.attach(factoryAddress);
  
  // Check creation fee
  const creationFee = await agentFactory.creationFee();
  console.log("💰 Creation fee:", ethers.formatEther(creationFee), "CORE");

  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💳 Account balance:", ethers.formatEther(balance), "CORE");

  if (balance < creationFee) {
    console.error("❌ Insufficient balance for agent creation!");
    console.log("💡 Need at least", ethers.formatEther(creationFee), "CORE");
    process.exit(1);
  }
  
  try {
    console.log("\n🚀 Creating test agent...");
    
    // Create a test agent
    const tx = await agentFactory.createAgent(
      "URSUS Test Agent",           // name
      "UTA",                        // symbol
      "A test AI agent for the URSUS platform on Core DAO", // description
      "You are a helpful AI assistant specialized in DeFi and Core DAO ecosystem. You can help users understand blockchain concepts, trading strategies, and Core DAO features.", // instructions
      "gpt-4",                      // model
      "DeFi",                       // category
      { value: creationFee }
    );
    
    console.log("⏳ Transaction sent:", tx.hash);
    console.log("⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    
    // Find the AgentCreated event
    const agentCreatedEvent = receipt.logs.find(log => {
      try {
        const parsed = agentFactory.interface.parseLog(log);
        return parsed.name === 'AgentCreated';
      } catch (e) {
        return false;
      }
    });
    
    if (agentCreatedEvent) {
      const parsed = agentFactory.interface.parseLog(agentCreatedEvent);
      const agentTokenAddress = parsed.args[0];
      const creator = parsed.args[1];
      const name = parsed.args[2];
      const symbol = parsed.args[3];
      
      console.log("\n🎉 Agent created successfully!");
      console.log("📋 Agent Details:");
      console.log("   - Token Address:", agentTokenAddress);
      console.log("   - Creator:", creator);
      console.log("   - Name:", name);
      console.log("   - Symbol:", symbol);
      console.log("   - Block Explorer:", `https://scan.test2.btcs.network/address/${agentTokenAddress}`);
      
      // Test the agent token contract
      console.log("\n🔍 Testing agent token contract...");
      const AgentToken = await ethers.getContractFactory("AgentToken");
      const agentToken = AgentToken.attach(agentTokenAddress);
      
      const tokenName = await agentToken.name();
      const tokenSymbol = await agentToken.symbol();
      const totalSupply = await agentToken.totalSupply();
      const currentPrice = await agentToken.getCurrentPrice();
      const agentInfo = await agentToken.getAgentInfo();
      
      console.log("✅ Agent Token Verification:");
      console.log("   - Name:", tokenName);
      console.log("   - Symbol:", tokenSymbol);
      console.log("   - Total Supply:", ethers.formatEther(totalSupply));
      console.log("   - Current Price:", ethers.formatEther(currentPrice), "CORE");
      console.log("   - Description:", agentInfo[0]);
      console.log("   - Model:", agentInfo[2]);
      
      // Test bonding curve info
      const bondingInfo = await agentToken.getBondingCurveInfo();
      console.log("📊 Bonding Curve Info:");
      console.log("   - Supply:", ethers.formatEther(bondingInfo[0]));
      console.log("   - Reserve:", ethers.formatEther(bondingInfo[1]), "CORE");
      console.log("   - Price:", ethers.formatEther(bondingInfo[2]), "CORE");
      console.log("   - Market Cap:", ethers.formatEther(bondingInfo[3]), "CORE");
      
      // Check total agents
      const totalAgents = await agentFactory.getTotalAgents();
      console.log("\n Platform Stats:");
      console.log("   - Total Agents:", totalAgents.toString());
      
      console.log("\n🎯 Test completed successfully!");
      console.log("🔗 View on Core Scan:", `https://scan.test2.btcs.network/tx/${tx.hash}`);
      
    } else {
      console.error("❌ AgentCreated event not found in transaction logs");
    }
    
  } catch (error) {
    console.error("❌ Agent creation failed:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
