# SmartAdmin Dashboard - Channel Rules Setup Script
# This script configures Ably channel rules for 72-hour message retention

param(
    [string]$DashboardUrl = "http://localhost:3000",
    [switch]$Help
)

if ($Help) {
    Write-Host "SmartAdmin Dashboard - Channel Rules Setup" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\setup-channel-rules.ps1 [-DashboardUrl <url>] [-Help]"
    Write-Host ""
    Write-Host "Parameters:"
    Write-Host "  -DashboardUrl    URL of your dashboard (default: http://localhost:3000)"
    Write-Host "  -Help           Show this help message"
    Write-Host ""
    Write-Host "This script configures Ably channel rules for 72-hour message retention"
    Write-Host "and sets up automatic MongoDB logging for unlimited message history."
    exit 0
}

Write-Host "🔧 SmartAdmin Dashboard - Channel Rules Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📡 Setting up Ably channel rules for enhanced message retention..." -ForegroundColor Yellow

try {
    # Setup channel rules
    $setupBody = @{
        pattern = "smartadmin-*"
        ttlHours = 72
    } | ConvertTo-Json

    $setupResponse = Invoke-RestMethod -Uri "$DashboardUrl/api/ably/channel-rules" -Method Post -ContentType "application/json" -Body $setupBody

    if ($setupResponse.success) {
        Write-Host "✅ Channel rules configured successfully!" -ForegroundColor Green
        Write-Host "📊 Pattern: smartadmin-*" -ForegroundColor White
        Write-Host "⏰ Retention: 72 hours (maximum)" -ForegroundColor White
        Write-Host "💾 History: Enabled" -ForegroundColor White
        Write-Host ""

        # Verify the configuration
        Write-Host "🔍 Verifying configuration..." -ForegroundColor Yellow
        $verifyResponse = Invoke-RestMethod -Uri "$DashboardUrl/api/ably/channel-rules" -Method Get

        if ($verifyResponse.success -and $verifyResponse.data.Count -gt 0) {
            Write-Host "✅ Configuration verified successfully!" -ForegroundColor Green
            Write-Host "📈 Found $($verifyResponse.data.Count) channel rule(s)" -ForegroundColor White
            Write-Host ""

            for ($i = 0; $i -lt $verifyResponse.data.Count; $i++) {
                $rule = $verifyResponse.data[$i]
                Write-Host "   Rule $($i + 1):" -ForegroundColor Gray
                Write-Host "   └─ Pattern: $($rule.pattern)" -ForegroundColor Gray
                Write-Host "   └─ History: $($rule.options.history.enabled ? 'Enabled' : 'Disabled')" -ForegroundColor Gray
                if ($rule.options.history.ttl) {
                    Write-Host "   └─ TTL: $($rule.options.history.ttl / 3600) hours" -ForegroundColor Gray
                }
                Write-Host ""
            }

            Write-Host "🎉 Setup Complete!" -ForegroundColor Green
            Write-Host "==================" -ForegroundColor Green
            Write-Host ""
            Write-Host "📋 What happens now:" -ForegroundColor Cyan
            Write-Host "  • Recent messages (72 hours): Fast access via Ably channels" -ForegroundColor White
            Write-Host "  • Older messages: Unlimited storage in MongoDB" -ForegroundColor White
            Write-Host "  • All messages: Auto-logged for long-term persistence" -ForegroundColor White
            Write-Host "  • Client reconnections: Automatic message recovery" -ForegroundColor White
            Write-Host ""
            Write-Host "🚀 Your SmartAdmin Dashboard now has enhanced message retention!" -ForegroundColor Green
            Write-Host "   Visit your dashboard to see the updated status." -ForegroundColor White

        } else {
            Write-Host "⚠️  Configuration created but verification failed" -ForegroundColor Yellow
            Write-Host "   Please check the dashboard manually" -ForegroundColor White
        }
    } else {
        Write-Host "❌ Failed to setup channel rules:" -ForegroundColor Red
        Write-Host "   Error: $($setupResponse.error)" -ForegroundColor Red
        Write-Host ""
        Write-Host "🔧 Troubleshooting:" -ForegroundColor Cyan
        Write-Host "  • Check that your dashboard is running" -ForegroundColor White
        Write-Host "  • Verify the Ably API key is correct" -ForegroundColor White
        Write-Host "  • Ensure MongoDB connection is working" -ForegroundColor White
        exit 1
    }
} catch {
    Write-Host "❌ Error setting up channel rules:" -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting:" -ForegroundColor Cyan
    Write-Host "  • Make sure your dashboard is running at: $DashboardUrl" -ForegroundColor White
    Write-Host "  • Check network connectivity" -ForegroundColor White
    Write-Host "  • Verify PowerShell execution policy allows scripts" -ForegroundColor White
    exit 1
}