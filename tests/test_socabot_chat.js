const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });
const socaAiService = require('../backend/services/socaAiService');

async function testSocaBot() {
  console.log('--- 🧪 Testing SocaBot Chat AI Engine with Config ---');
  try {
    const reply = await socaAiService.chatWithSocaPa('hello, what is Legal OS in 1 sentence?', [], null, []);
    console.log('✅ SocaBot AI Response:\n', reply);
    console.log('\n🎉 SocaBot is functioning properly!');
    process.exit(0);
  } catch (err) {
    console.error('❌ SocaBot chat failed:', err.message);
    process.exit(1);
  }
}

testSocaBot();
