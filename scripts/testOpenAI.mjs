/**
 * Quick test script for OpenAI integration
 * 
 * Run with: node scripts/testOpenAI.mjs
 */

import 'dotenv/config';
import OpenAI from 'openai';

async function testOpenAI() {
  console.log('🔑 Checking OpenAI configuration...\n');

  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.log('   Make sure your .env file contains: OPENAI_API_KEY=sk-...');
    process.exit(1);
  }

  console.log('✅ API key found (starts with:', apiKey.slice(0, 10) + '...)');
  console.log('\n📡 Testing API connection...\n');

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful safety assistant.' },
        { role: 'user', content: 'In one sentence, what is the most important safety rule for tree work?' }
      ],
      max_tokens: 100,
    });

    console.log('✅ OpenAI API connection successful!\n');
    console.log('📝 Test response:');
    console.log('   Model:', response.model);
    console.log('   Message:', response.choices[0]?.message?.content);
    console.log('\n   Tokens used:', response.usage?.total_tokens);
    console.log('\n🎉 OpenAI integration is working correctly!');
  } catch (error) {
    console.error('❌ API call failed:', error.message);
    
    if (error.status === 401) {
      console.log('\n   Your API key appears to be invalid or expired.');
      console.log('   Get a new key at: https://platform.openai.com/account/api-keys');
    } else if (error.status === 429) {
      console.log('\n   Rate limit exceeded or quota reached.');
      console.log('   Check your usage at: https://platform.openai.com/usage');
    }
    process.exit(1);
  }
}

testOpenAI();
