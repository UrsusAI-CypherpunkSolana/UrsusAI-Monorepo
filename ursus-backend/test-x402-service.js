require('dotenv').config();
const X402Service = require('./services/X402Service');

async function testX402Service() {
  console.log('🧪 Testing X402 Service...\n');
  
  const x402Service = new X402Service();
  
  const testAgent = {
    name: 'TestBot',
    model: 'llama3-8b-8192',
    instructions: 'You are a professional crypto analyst.',
    category: 'trading'
  };
  
  try {
    console.log('📊 Testing Market Analysis Service...\n');
    const result = await x402Service.executeService('market_analysis', testAgent, {});
    
    console.log('✅ Service Result:\n');
    console.log('─'.repeat(80));
    console.log('Service ID:', result.service_id);
    console.log('Agent Name:', result.agent_name);
    console.log('Timestamp:', result.timestamp);
    console.log('Paid:', result.paid);
    console.log('\nResult:');
    console.log(result.result);
    console.log('─'.repeat(80));
    console.log('\n✅ Test successful! X402 Service is working! 🎉\n');
    
  } catch (error) {
    console.error('\n❌ X402 Service Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testX402Service();

