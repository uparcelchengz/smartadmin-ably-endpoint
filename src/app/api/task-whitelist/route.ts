import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/database';

// GET - Retrieve all whitelist entries or check if specific value is whitelisted
export async function GET(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const check = searchParams.get('check');
    const type = searchParams.get('type') as 'ip' | 'email';

    client = await connectToDatabase();

    if (check && type) {
      // Check if specific value is whitelisted
      console.log(`[Task Whitelist] Checking if ${type} "${check}" is whitelisted`);
      
      const result = await client.query(
        'SELECT * FROM task_whitelist WHERE type = $1 AND value = $2 LIMIT 1',
        [type, check]
      );

      const whitelisted = result.rows.length > 0;
      
      return NextResponse.json({
        success: true,
        whitelisted,
        data: whitelisted ? {
          id: result.rows[0].id,
          type: result.rows[0].type,
          value: result.rows[0].value,
          description: result.rows[0].description,
          createdAt: result.rows[0].created_at
        } : null
      });
    }

    // Get all whitelist entries
    const result = await client.query(
      'SELECT * FROM task_whitelist ORDER BY created_at DESC'
    );

    const entries = result.rows.map(row => ({
      id: row.id,
      type: row.type,
      value: row.value,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    return NextResponse.json({
      success: true,
      data: entries,
      count: entries.length
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Whitelist API] Error:', errorMessage);
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

// POST - Create a new whitelist entry
export async function POST(request: NextRequest) {
  let client;
  try {
    const { type, value, description } = await request.json();

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

    // Check if already exists
    const existingResult = await client.query(
      'SELECT id FROM task_whitelist WHERE type = $1 AND value = $2 LIMIT 1',
      [type, value]
    );

    if (existingResult.rows.length > 0) {
      return NextResponse.json({
        success: false,
        error: `${type.toUpperCase()} ${value} is already in whitelist`
      }, { status: 409 });
    }

    // Create new whitelist entry
    const insertResult = await client.query(
      'INSERT INTO task_whitelist (type, value, description) VALUES ($1, $2, $3) RETURNING *',
      [type, value, description || null]
    );

    const newEntry = insertResult.rows[0];
    console.log(`[Task Whitelist API] ✓ Created whitelist entry: ${type} ${value}`);

    return NextResponse.json({
      success: true,
      data: {
        id: newEntry.id,
        type: newEntry.type,
        value: newEntry.value,
        description: newEntry.description,
        createdAt: newEntry.created_at,
        updatedAt: newEntry.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Whitelist API] Error:', errorMessage);
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

// PATCH - Update whitelist entry description
export async function PATCH(request: NextRequest) {
  let client;
  try {
    const { id, description } = await request.json();

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Missing entry ID'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    const updateResult = await client.query(
      'UPDATE task_whitelist SET description = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [description, parseInt(id)]
    );

    if (updateResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Whitelist entry not found'
      }, { status: 404 });
    }

    const updatedEntry = updateResult.rows[0];
    console.log(`[Task Whitelist API] ✓ Updated whitelist entry: ${updatedEntry.id}`);

    return NextResponse.json({
      success: true,
      data: {
        id: updatedEntry.id,
        type: updatedEntry.type,
        value: updatedEntry.value,
        description: updatedEntry.description,
        createdAt: updatedEntry.created_at,
        updatedAt: updatedEntry.updated_at
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Whitelist API] Error:', errorMessage);
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

// DELETE - Remove a whitelist entry
export async function DELETE(request: NextRequest) {
  let client;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        success: false,
        error: 'Entry ID is required'
      }, { status: 400 });
    }

    client = await connectToDatabase();

    const result = await client.query(
      'DELETE FROM task_whitelist WHERE id = $1 RETURNING *',
      [parseInt(id)]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Whitelist entry not found'
      }, { status: 404 });
    }

    const deletedEntry = result.rows[0];
    console.log(`[Task Whitelist API] ✓ Deleted whitelist entry: ${deletedEntry.type} ${deletedEntry.value}`);

    return NextResponse.json({
      success: true,
      message: 'Whitelist entry removed',
      data: {
        id: deletedEntry.id,
        type: deletedEntry.type,
        value: deletedEntry.value,
        description: deletedEntry.description
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('[Task Whitelist API] Error:', errorMessage);
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