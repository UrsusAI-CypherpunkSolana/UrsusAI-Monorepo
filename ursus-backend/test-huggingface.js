require('dotenv').config();

async function testHuggingFace() {
  console.log('🧪 Testing HuggingFace Inference API...\n');
  
  const hfApiKey = process.env.HUGGINGFACE_API_KEY || 'hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
  
  try {
    console.log('📡 Sending request to HuggingFace...');
    
    const fullPrompt = `You are a professional crypto market analyst.\n\nUser: Provide a brief market analysis for Bitcoin (BTC). Include current trend and a short-term outlook.\n\nAssistant:`;
    
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/mistralai/Mistral-7B-Instruct-v0.2',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${hfApiKey}`
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: {
            max_new_tokens: 500,
            temperature: 0.7,
            top_p: 0.95,
            return_full_text: false
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HuggingFace API error: ${response.status} ${response.statusText}\n${errorText}`);
    }

    const data = await response.json();
    const result = data[0]?.generated_text || 'No response generated';
    
    console.log('\n✅ HuggingFace API Response:\n');
    console.log('─'.repeat(80));
    console.log(result);
    console.log('─'.repeat(80));
    console.log('\n✅ Test successful! HuggingFace API is working perfectly! 🎉\n');
    
  } catch (error) {
    console.error('\n❌ HuggingFace API Error:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testHuggingFace();

