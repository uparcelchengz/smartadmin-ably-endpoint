import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Ban from '@/models/Ban';

// GET - Retrieve all bans or check if specific value is banned
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const checkValue = searchParams.get('check');
    const checkType = searchParams.get('type');

    // Check if specific value is banned
    if (checkValue && checkType) {
      const ban = await Ban.findOne({ type: checkType, value: checkValue }).lean();
      return NextResponse.json({ 
        success: true, 
        banned: !!ban,
        data: ban || null
      });
    }

    // Get all bans
    const bans = await Ban.find({}).sort({ createdAt: -1 }).lean();
    
    return NextResponse.json({ 
      success: true, 
      data: bans,
      count: bans.length
    });
  } catch (error: any) {
    console.error('[Ban API] GET Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST - Add new ban
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    
    const data = await request.json();
    console.log('[Ban API] Creating ban:', data);

    // Validate required fields
    if (!data.type || !data.value) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields: type and value' 
      }, { status: 400 });
    }

    // Check if already banned
    const existing = await Ban.findOne({ type: data.type, value: data.value });
    if (existing) {
      return NextResponse.json({ 
        success: false, 
        error: 'This value is already banned' 
      }, { status: 409 });
    }

    const ban = await Ban.create(data);
    console.log('[Ban API] ✓ Ban created:', ban._id);
    
    return NextResponse.json({ success: true, data: ban }, { status: 201 });
  } catch (error: any) {
    console.error('[Ban API] POST Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// PATCH - Update ban reason
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    
    const { id, reason } = await request.json();
    console.log('[Ban API] Updating ban:', id);

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing ban ID' 
      }, { status: 400 });
    }

    const ban = await Ban.findByIdAndUpdate(
      id, 
      { reason }, 
      { new: true }
    );

    if (!ban) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ban not found' 
      }, { status: 404 });
    }

    console.log('[Ban API] ✓ Ban updated');
    return NextResponse.json({ success: true, data: ban });
  } catch (error: any) {
    console.error('[Ban API] PATCH Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE - Remove ban
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    console.log('[Ban API] Deleting ban:', id);

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing ban ID' 
      }, { status: 400 });
    }

    const ban = await Ban.findByIdAndDelete(id);

    if (!ban) {
      return NextResponse.json({ 
        success: false, 
        error: 'Ban not found' 
      }, { status: 404 });
    }

    console.log('[Ban API] ✓ Ban deleted');
    return NextResponse.json({ success: true, message: 'Ban removed' });
  } catch (error: any) {
    console.error('[Ban API] DELETE Error:', error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
