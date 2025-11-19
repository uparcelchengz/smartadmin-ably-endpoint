import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No token provided'
      }, { status: 401 });
    }

    if (!process.env.JWT_SECRET) {
      console.error('[Auth] Missing JWT_SECRET environment variable');
      return NextResponse.json({
        success: false,
        error: 'Server configuration error'
      }, { status: 500 });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    console.log(`[Auth] ✓ Token verified for user: ${decoded.username}`);
    
    return NextResponse.json({
      success: true,
      user: {
        username: decoded.username,
        isAdmin: decoded.isAdmin
      }
    });
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    return NextResponse.json({
      success: false,
      error: 'Invalid token'
    }, { status: 401 });
  }
}