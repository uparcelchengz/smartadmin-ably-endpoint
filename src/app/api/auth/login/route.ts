import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // Get credentials from environment
    const validUsername = process.env.ADMIN_USERNAME;
    const validPassword = process.env.ADMIN_PASSWORD;

    if (!validUsername || !validPassword) {
      console.error('[Auth] Missing environment variables: ADMIN_USERNAME or ADMIN_PASSWORD');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }

    // Validate credentials
    if (username === validUsername && password === validPassword) {
      // Generate JWT token
      const token = jwt.sign(
        { username, isAdmin: true },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      console.log(`[Auth] ✓ User "${username}" logged in successfully`);
      
      return NextResponse.json({
        success: true,
        token,
        message: 'Login successful'
      });
    } else {
      console.log(`[Auth] ✗ Invalid login attempt for username: "${username}"`);
      
      return NextResponse.json({
        success: false,
        error: 'Invalid username or password'
      }, { status: 401 });
    }
  } catch (error) {
    console.error('[Auth] Login error:', error);
    return NextResponse.json({
      success: false,
      error: 'Login failed'
    }, { status: 500 });
  }
}