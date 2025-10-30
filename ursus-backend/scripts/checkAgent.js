const mongoose = require('mongoose');
const Agent = require('../models/Agent');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ursus', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function checkAgent() {
  try {
    const agentAddress = '0x36f73a86b59e4e5dc80ad84fbeb2cc3d8e55856d';
    
    const agent = await Agent.findOne({ 
      contractAddress: agentAddress.toLowerCase() 
    });
    
    if (agent) {
      console.log('📊 Agent found:');
      console.log(JSON.stringify(agent, null, 2));
    } else {
      console.log('❌ Agent not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.disconnect();
  }
}

checkAgent();
