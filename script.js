// script.js - Client-side login system

let usersData = [];

// Load users from CSV on page load
async function loadUsers() {
    try {
        const response = await fetch('users.csv');
        const csvText = await response.text();
        
        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                usersData = results.data;
                console.log('Users loaded:', usersData.length);
            }
        });
    } catch (error) {
        console.error('Error loading users:', error);
        showError('Failed to load user data. Please refresh the page.');
    }
}

// Authenticate user
function authenticateUser(userId, password) {
    const user = usersData.find(u => 
        u.user_id === userId && u.password === password
    );
    return user || null;
}

// Show error message
function showError(message) {
    let errorDiv = document.getElementById('login-error');
    
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'login-error';
        errorDiv.style.cssText = `
            color: #dc3545;
            background: #f8d7da;
            border: 1px solid #f5c6cb;
            padding: 12px;
            border-radius: 8px;
            margin-top: 15px;
            font-size: 14px;
            text-align: center;
        `;
        
        const form = document.getElementById('loginForm');
        form.parentNode.insertBefore(errorDiv, form.nextSibling);
    }
    
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
}

// Hide error message
function hideError() {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// Handle login
function handleLogin(e) {
    e.preventDefault();
    hideError();
    
    const userId = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    
    if (!userId || !password) {
        showError('Please enter both user ID and password.');
        return;
    }

    // Check if account is locked
    const lockoutData = JSON.parse(localStorage.getItem('loginLockout_' + userId)) || {};
    if (lockoutData.locked && Date.now() < lockoutData.lockUntil) {
        const remainingMinutes = Math.ceil((lockoutData.lockUntil - Date.now()) / 60000);
        showError(`Account locked due to too many failed attempts. Try again in ${remainingMinutes} minute(s).`);
        return;
    } else if (lockoutData.locked && Date.now() >= lockoutData.lockUntil) {
        // Unlock account
        localStorage.removeItem('loginLockout_' + userId);
    }
    
    const user = authenticateUser(userId, password);
    
    if (user) {
        // Clear failed login attempts
        localStorage.removeItem('loginLockout_' + userId);
        
        // Check MFA requirement
        const settings = JSON.parse(localStorage.getItem('systemSettings')) || {
            mfa: 'required',
            failedLoginAttempts: '5',
            mfaEmail: ''
        };
        
        if (settings.mfa === 'required' || settings.mfa === 'optional') {
            // Generate 6-digit OTP
            const generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
            const timestamp = new Date().toLocaleTimeString();
            
            // Store OTP temporarily (expires in 5 minutes)
            const otpData = {
                code: generatedOTP,
                generatedAt: Date.now(),
                expiresAt: Date.now() + (5 * 60 * 1000),
                userId: userId
            };
            sessionStorage.setItem('currentOTP', JSON.stringify(otpData));
            
            // Simulate email sending
            const maskedEmail = settings.mfaEmail ? 
                settings.mfaEmail.replace(/(.{3})(.*)(@.*)/, '$1***$3') : 
                'your email';
            
            console.log('═══════════════════════════════════════════════════');
            console.log('📧 SIMULATED EMAIL - MFA OTP CODE');
            console.log('═══════════════════════════════════════════════════');
            console.log(`To: ${settings.mfaEmail || 'Not configured in System Settings'}`);
            console.log(`From: PULSE Analytics <noreply@pulse.kjo.com>`);
            console.log(`Subject: Your PULSE Login Verification Code`);
            console.log(`Time: ${timestamp}`);
            console.log('───────────────────────────────────────────────────');
            console.log(`Your verification code is: ${generatedOTP}`);
            console.log('This code will expire in 5 minutes.');
            console.log('───────────────────────────────────────────────────');
            console.log('⚠️  PROTOTYPE MODE: In production, this would be');
            console.log('   sent via SendGrid/Mailgun/Gmail SMTP');
            console.log('═══════════════════════════════════════════════════');
            
            // Show OTP in alert (since console might not be open)
            alert(`📧 SIMULATED EMAIL - OTP CODE\n\n` +
                  `To: ${settings.mfaEmail || 'Not configured'}\n` +
                  `From: PULSE Analytics\n` +
                  `Time: ${timestamp}\n\n` +
                  `═══════════════════════\n` +
                  `YOUR VERIFICATION CODE:\n` +
                  `${generatedOTP}\n` +
                  `═══════════════════════\n\n` +
                  `⏱️  Expires in 5 minutes\n\n` +
                  `💡 PROTOTYPE: This simulates email OTP.\n` +
                  `In production, this would be sent to your email.\n\n` +
                  `Copy the code above and enter it in the next prompt.`);
            
            const mfaCode = prompt('🔐 Multi-Factor Authentication\n\n' +
                                  `Enter the 6-digit OTP code from the previous message:\n` +
                                  `(Sent to ${maskedEmail})`);
            
            if (settings.mfa === 'required' && !mfaCode) {
                sessionStorage.removeItem('currentOTP');
                showError('MFA code is required for login.');
                return;
            }
            
            if (mfaCode) {
                // Verify OTP
                const storedOTP = JSON.parse(sessionStorage.getItem('currentOTP'));
                
                if (!storedOTP) {
                    showError('OTP session expired. Please login again.');
                    return;
                }
                
                if (Date.now() > storedOTP.expiresAt) {
                    sessionStorage.removeItem('currentOTP');
                    showError('OTP has expired (5 min limit). Please login again.');
                    return;
                }
                
                if (mfaCode !== storedOTP.code) {
                    sessionStorage.removeItem('currentOTP');
                    showError('Invalid OTP code. Please login again to receive a new code.');
                    return;
                }
                
                // OTP verified successfully
                sessionStorage.removeItem('currentOTP');
                console.log('✅ OTP Verified Successfully!');
                
            } else if (settings.mfa === 'required') {
                sessionStorage.removeItem('currentOTP');
                showError('MFA code is required for login.');
                return;
            }
        }
        
        // Store user in localStorage
        localStorage.setItem('currentUser', JSON.stringify({
            user_id: user.user_id,
            role: user.role,
            loginTime: Date.now()
        }));
        
        // Redirect based on role
        if (user.role === 'principal') {
            window.location.href = 'admin.html';
        } else if (user.role === 'master') {
            window.location.href = 'master.html';
        } else if (user.role === 'business_user') {
            window.location.href = 'dashboard.html';
        } else {
            showError('Invalid user role.');
        }
    } else {
        // Track failed login attempts
        const settings = JSON.parse(localStorage.getItem('systemSettings')) || {
            failedLoginAttempts: '5'
        };
        const maxAttempts = parseInt(settings.failedLoginAttempts);
        
        const lockoutData = JSON.parse(localStorage.getItem('loginLockout_' + userId)) || {
            attempts: 0,
            locked: false
        };
        
        lockoutData.attempts = (lockoutData.attempts || 0) + 1;
        
        if (lockoutData.attempts >= maxAttempts) {
            lockoutData.locked = true;
            lockoutData.lockUntil = Date.now() + (15 * 60 * 1000); // Lock for 15 minutes
            localStorage.setItem('loginLockout_' + userId, JSON.stringify(lockoutData));
            showError(`Too many failed attempts (${maxAttempts}). Account locked for 15 minutes.`);
        } else {
            localStorage.setItem('loginLockout_' + userId, JSON.stringify(lockoutData));
            const remaining = maxAttempts - lockoutData.attempts;
            showError(`Invalid user ID or password. ${remaining} attempt(s) remaining before lockout.`);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadUsers();
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});
