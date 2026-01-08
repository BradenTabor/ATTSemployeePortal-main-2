/**
 * Test the Safety Announcement Generator (Multi-Source)
 * 
 * Now analyzes data from:
 * - JSA (Job Safety Analysis) forms
 * - DVIR (Daily Vehicle Inspection Reports)
 * - Daily Equipment Inspections
 * 
 * Run with: node scripts/testAnnouncement.mjs
 */

import 'dotenv/config';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Simulated data from multiple sources (in production this comes from Supabase)
const mockData = {
  date: new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }),
  
  // JSA Data
  jsa: {
    count: 12,
    topHazards: [
      { hazard: 'Falls from height', count: 6 },
      { hazard: 'Electrical contact', count: 4 },
      { hazard: 'Struck by falling limbs', count: 3 },
    ],
    topPPE: [
      { item: 'Hard hat', count: 10 },
      { item: 'Safety glasses', count: 9 },
      { item: 'Chainsaw chaps', count: 7 },
    ],
    nearMisses: 1,
    weather: 'Cold (35°F), Windy',
  },
  
  // DVIR Data
  dvir: {
    count: 8,
    deficiencies: 2,
    vehicleIssues: [
      { issue: 'Brake lights', count: 2 },
      { issue: 'Tire pressure low', count: 1 },
    ],
  },
  
  // Equipment Inspection Data
  equipment: {
    count: 6,
    equipmentTypes: ['Bucket truck', 'Chipper', 'Chainsaw'],
    issues: [
      { issue: 'Hydraulic fluid level', count: 2 },
      { issue: 'Safety guard loose', count: 1 },
    ],
  },
};

const systemPrompt = `You are a safety communication assistant for ATTS, a tree services company. 
Generate concise, actionable safety announcements based on data from multiple sources:
- JSA (Job Safety Analysis) forms
- DVIR (Daily Vehicle Inspection Reports)
- Daily Equipment Inspections

CRITICAL CHARACTER LIMITS:
- body: Target 238 chars, MAX 283 chars
- summary: MAX 240 chars

Output JSON format:
{
  "title": "Safety Update - {date}",
  "body": "Main message under 283 chars - synthesize insights from all data sources",
  "summary": "One sentence for push notifications under 240 chars"
}`;

async function generateAnnouncement() {
  console.log('🌳 ATTS Safety Announcement Generator (Multi-Source)\n');
  console.log('━'.repeat(60));
  
  // Display input data from all sources
  console.log('\n📊 DATA SOURCES:\n');
  
  console.log('📋 JSA Forms:', mockData.jsa.count, 'submissions');
  console.log(`   Top hazard: ${mockData.jsa.topHazards[0].hazard} (${mockData.jsa.topHazards[0].count} reports)`);
  console.log(`   Near-misses: ${mockData.jsa.nearMisses}`);
  console.log(`   Weather: ${mockData.jsa.weather}`);
  
  console.log('\n🚛 DVIR Reports:', mockData.dvir.count, 'inspections');
  console.log(`   Deficiencies found: ${mockData.dvir.deficiencies}`);
  if (mockData.dvir.vehicleIssues.length > 0) {
    console.log(`   Top issue: ${mockData.dvir.vehicleIssues[0].issue} (${mockData.dvir.vehicleIssues[0].count})`);
  }
  
  console.log('\n🔧 Equipment Inspections:', mockData.equipment.count, 'inspections');
  console.log(`   Equipment types: ${mockData.equipment.equipmentTypes.join(', ')}`);
  if (mockData.equipment.issues.length > 0) {
    console.log(`   Top issue: ${mockData.equipment.issues[0].issue} (${mockData.equipment.issues[0].count})`);
  }

  const totalSubmissions = mockData.jsa.count + mockData.dvir.count + mockData.equipment.count;
  console.log('\n📈 TOTAL SUBMISSIONS:', totalSubmissions);
  console.log('━'.repeat(60));

  const userPrompt = `Date: ${mockData.date}
Window: Last 24 hours

=== SUBMISSION COUNTS ===
JSA Forms: ${mockData.jsa.count}
DVIR Reports: ${mockData.dvir.count}
Equipment Inspections: ${mockData.equipment.count}
Total Submissions: ${totalSubmissions}

=== JSA DATA ===
Top Hazards Identified:
${mockData.jsa.topHazards.map((h, i) => `${i + 1}. ${h.hazard} - ${h.count} mentions`).join('\n')}

PPE Requirements Noted:
${mockData.jsa.topPPE.map((p, i) => `${i + 1}. ${p.item} - ${p.count} mentions`).join('\n')}

Near-misses: ${mockData.jsa.nearMisses} reported
Weather: ${mockData.jsa.weather}

=== DVIR DATA ===
Vehicles inspected: ${mockData.dvir.count}
Deficiencies found: ${mockData.dvir.deficiencies}
Vehicle Issues:
${mockData.dvir.vehicleIssues.map((i, idx) => `${idx + 1}. ${i.issue} - ${i.count} reports`).join('\n')}

=== EQUIPMENT INSPECTION DATA ===
Equipment inspected: ${mockData.equipment.count}
Equipment types: ${mockData.equipment.equipmentTypes.join(', ')}
Equipment Issues Found:
${mockData.equipment.issues.map((i, idx) => `${idx + 1}. ${i.issue} - ${i.count} reports`).join('\n')}

Generate a safety announcement synthesizing insights from ALL data sources. Remember: body max 283 chars, summary max 240 chars.`;

  console.log('\n🤖 Calling OpenAI...\n');

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 500,
    });

    const announcement = JSON.parse(response.choices[0].message.content);
    
    console.log('✅ Announcement Generated!\n');
    console.log('━'.repeat(60));
    console.log(`📢 ${announcement.title}`);
    console.log('━'.repeat(60));
    console.log(`\n${announcement.body}\n`);
    console.log(`   📝 Body length: ${announcement.body.length} chars (max 283)`);
    console.log('━'.repeat(60));
    console.log(`\n💬 Summary (for push/SMS):\n   "${announcement.summary}"`);
    console.log(`   📝 Summary length: ${announcement.summary.length} chars (max 240)`);
    console.log('━'.repeat(60));
    console.log(`\n📈 Token usage: ${response.usage.total_tokens} tokens`);
    console.log(`💰 Est. cost: $${((response.usage.prompt_tokens * 0.00015 + response.usage.completion_tokens * 0.0006) / 1000).toFixed(6)}`);
    
    console.log('\n✅ Multi-source safety announcement generation working correctly!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

generateAnnouncement();
