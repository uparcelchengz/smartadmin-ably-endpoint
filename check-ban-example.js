// Test script to check if IP or email is banned
// Add this to your Electron client

/**
 * Check if current IP or email is banned
 */
async function checkIfBanned() {
    const clientIP = 'YOUR_CLIENT_IP'; // Replace with actual IP detection
    const clientEmail = 'user@example.com'; // Replace with actual email
    
    try {
        // Check IP
        const ipResponse = await fetch(`http://localhost:3000/api/bans?check=${clientIP}&type=ip`);
        const ipData = await ipResponse.json();
        
        if (ipData.success && ipData.banned) {
            console.error('❌ IP is banned:', ipData.data.reason);
            return { banned: true, type: 'ip', reason: ipData.data.reason };
        }
        
        // Check email
        const emailResponse = await fetch(`http://localhost:3000/api/bans?check=${clientEmail}&type=email`);
        const emailData = await emailResponse.json();
        
        if (emailData.success && emailData.banned) {
            console.error('❌ Email is banned:', emailData.data.reason);
            return { banned: true, type: 'email', reason: emailData.data.reason };
        }
        
        console.log('✓ Not banned');
        return { banned: false };
    } catch (error) {
        console.error('Error checking ban status:', error);
        return { banned: false, error: true };
    }
}

// Usage in your Electron client
async function initAblyWithBanCheck() {
    const banStatus = await checkIfBanned();
    
    if (banStatus.banned) {
        // Show error message to user
        alert(`Access denied: ${banStatus.reason || 'You are banned from this service'}`);
        app.quit();
        return;
    }
    
    // Continue with normal Ably initialization
    await initAbly();
}

export { checkIfBanned };
