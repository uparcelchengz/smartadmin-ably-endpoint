import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

// GET - Retrieve all bans or check if specific value is banned
export async function GET(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get('check');
    const type = searchParams.get('type') as 'ip' | 'email';

    client = await connectToDatabase();

    // Ensure bans table exists
    await ensureBansTableExists(client);

    if (check && type) {
      // Check if specific value is banned
      console.log(`[Ban Check] Checking if ${type} "${check}" is banned`);
      
      const result = await client.query(
        'SELECT * FROM bans WHERE type = $1 AND value = $2 LIMIT 1',
        [type, check]
      );

      const banned = result.rows.length > 0;
      
      return NextResponse.json({
        success: true,
        banned,
        data: banned ? {
          id: result.rows[0].id,
          type: result.rows[0].type,
          value: result.rows[0].value,
          reason: result.rows[0].reason,
          createdAt: result.rows[0].created_at
        } : null
      });
    }

    // Get all bans
    const result = await client.query(
      'SELECT * FROM bans ORDER BY created_at DESC'
    );

    const bans = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      value: row.value,
      reason: row.reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: bans,
      count: bans.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Bans API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// POST - Create a new ban
export async function POST(request: NextRequest) {
  let client;
  try {
    const { type, value, reason } = await request.json();

    if (!type || !value) {
      return NextResponse.json({
        success: false,
        error: 'Type and value are required'
      }, { status: 400 });
    }

    if (!['ip', 'email'].includes(type)) {
      return NextResponse.json({
        success: false,
        error: 'Type must be "ip" or "email"'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    // Ensure bans table exists
    await ensureBansTableExists(client);

    // Check if already banned
    const existingResult = await client.query(
      'SELECT id FROM bans WHERE type = $1 AND value = $2 LIMIT 1',
      [type, value]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `${type.toUpperCase()} ${value} is already banned`
      }, { status: 409 });
    }

    // Create new ban
    const insertResult = await client.query(
      'INSERT INTO bans (type, value, reason) VALUES ($1, $2, $3) RETURNING *',
      [type, value, reason || null]
    );

    const newBan = insertResult.rows[0];
    console.log(`[Bans API] ✓ Created ban: ${type} ${value}`);

    return NextResponse.json({
      success: true,
      data: {
        id: newBan.id,
        type: newBan.type,
        value: newBan.value,
        reason: newBan.reason,
        createdAt: newBan.created_at,
        updatedAt: newBan.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Bans API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// PATCH - Update ban reason
export async function PATCH(request: NextRequest) {
  let client;
  try {
    const { id, reason } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Missing ban ID'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    const updateResult = await client.query(
      'UPDATE bans SET reason = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [reason, parseInt(id)]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ban not found'
      }, { status: 404 });
    }

    const updatedBan = updateResult.rows[0];
    console.log(`[Bans API] ✓ Updated ban: ${updatedBan.id}`);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedBan.id,
        type: updatedBan.type,
        value: updatedBan.value,
        reason: updatedBan.reason,
        createdAt: updatedBan.created_at,
        updatedAt: updatedBan.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Bans API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// DELETE - Remove a ban
export async function DELETE(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const value = searchParams.get('value');

    client = await connectToDatabase();

    let deleteQuery;
    let deleteParams;

    if (id) {
      deleteQuery = 'DELETE FROM bans WHERE id = $1 RETURNING *';
      deleteParams = [parseInt(id)];
    } else if (type && value) {
      deleteQuery = 'DELETE FROM bans WHERE type = $1 AND value = $2 RETURNING *';
      deleteParams = [type, value];
    } else {
      return NextResponse.json({
        success: false,
        error: 'Either id or both type and value are required'
      }, { status: 400 });
    }

    const result = await client.query(deleteQuery, deleteParams);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Ban not found'
      }, { status: 404 });
    }

    const deletedBan = result.rows[0];
    console.log(`[Bans API] ✓ Deleted ban: ${deletedBan.type} ${deletedBan.value}`);

    return NextResponse.json({
      success: true,
      message: 'Ban removed',
      data: {
        id: deletedBan.id,
        type: deletedBan.type,
        value: deletedBan.value,
        reason: deletedBan.reason
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Bans API] Error:', errorMessage);
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Helper function to ensure bans table exists
async function ensureBansTableExists(client: any) {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS bans (
        id SERIAL PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('ip', 'email')),
        value VARCHAR(255) NOT NULL,
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(type, value)
      );
    `;
    
    await client.query(createTableQuery);
    
    // Create indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_bans_type_value ON bans(type, value);');
    await client.query('CREATE INDEX IF NOT EXISTS idx_bans_created_at ON bans(created_at);');
    
    console.log('[Bans API] Bans table ensured');
  } catch (error) {
    console.error('[Bans API] Error creating bans table:', error);
    throw error;
  }
}