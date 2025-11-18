#!/usr/bin/env node

/**
 * Setup Script: Configure Ably Channel Rules for Enhanced Message Retention
 * 
 * This script configures your Ably channels for 72-hour message retention
 * and verifies that the enhanced message persistence system is working.
 */

const DASHBOARD_URL = process.env.DASHBOARD_URL || 'http://localhost:3000';

async function setupChannelRules() {
  console.log('🔧 SmartAdmin Dashboard - Channel Rules Setup');
  console.log('============================================\n');
  
  console.log('📡 Setting up Ably channel rules for enhanced message retention...');
  
  try {
    const response = await fetch(`${DASHBOARD_URL}/api/ably/channel-rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pattern: 'smartadmin-*',
        ttlHours: 72 // Maximum 72 hours retention
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('✅ Channel rules configured successfully!');
      console.log(`📊 Pattern: smartadmin-*`);
      console.log(`⏰ Retention: 72 hours (maximum)`);
      console.log(`💾 History: Enabled\n`);
      
      // Verify the configuration
      console.log('🔍 Verifying configuration...');
      const verifyResponse = await fetch(`${DASHBOARD_URL}/api/ably/channel-rules`);
      const verifyData = await verifyResponse.json();
      
      if (verifyData.success && verifyData.data.length > 0) {
        console.log('✅ Configuration verified successfully!');
        console.log(`📈 Found ${verifyData.data.length} channel rule(s)\n`);
        
        verifyData.data.forEach((rule, index) => {
          console.log(`   Rule ${index + 1}:`);
          console.log(`   └─ Pattern: ${rule.pattern}`);
          console.log(`   └─ History: ${rule.options.history?.enabled ? 'Enabled' : 'Disabled'}`);
          if (rule.options.history?.ttl) {
            console.log(`   └─ TTL: ${rule.options.history.ttl / 3600} hours`);
          }
          console.log('');
        });
        
        console.log('🎉 Setup Complete!');
        console.log('==================');
        console.log('');
        console.log('📋 What happens now:');
        console.log('  • Recent messages (72 hours): Fast access via Ably channels');
        console.log('  • Older messages: Unlimited storage in MongoDB');
        console.log('  • All messages: Auto-logged for long-term persistence');
        console.log('  • Client reconnections: Automatic message recovery');
        console.log('');
        console.log('🚀 Your SmartAdmin Dashboard now has enhanced message retention!');
        console.log('   Visit your dashboard to see the updated status.');
        
      } else {
        console.log('⚠️  Configuration created but verification failed');
        console.log('   Please check the dashboard manually');
      }
    } else {
      console.error('❌ Failed to setup channel rules:');
      console.error(`   Error: ${data.error}`);
      console.log('');
      console.log('🔧 Troubleshooting:');
      console.log('  • Check that your dashboard is running');
      console.log('  • Verify the Ably API key is correct');
      console.log('  • Ensure MongoDB connection is working');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error setting up channel rules:');
    console.error(`   ${error.message}`);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log(`  • Make sure your dashboard is running at: ${DASHBOARD_URL}`);
    console.log('  • Check network connectivity');
    console.log('  • Verify environment variables');
    process.exit(1);
  }
}

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log('SmartAdmin Dashboard - Channel Rules Setup');
  console.log('');
  console.log('Usage: node setup-channel-rules.js [options]');
  console.log('');
  console.log('Options:');
  console.log('  --help, -h     Show this help message');
  console.log('');
  console.log('Environment Variables:');
  console.log('  DASHBOARD_URL  URL of your dashboard (default: http://localhost:3000)');
  console.log('');
  console.log('This script configures Ably channel rules for 72-hour message retention');
  console.log('and sets up automatic MongoDB logging for unlimited message history.');
  process.exit(0);
}

// Run the setup
setupChannelRules().catch(console.error);