import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedDatasets } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

/**
 * GET /api/datasets - 获取数据集列表（不含行数据，节省流量）
 */
export async function GET() {
  try {
    const rows = await db
      .select({
        id: uploadedDatasets.id,
        name: uploadedDatasets.name,
        description: uploadedDatasets.description,
        fileName: uploadedDatasets.fileName,
        columns: uploadedDatasets.columns,
        rowCount: uploadedDatasets.rowCount,
        uploadedBy: uploadedDatasets.uploadedBy,
        createdAt: uploadedDatasets.createdAt,
        updatedAt: uploadedDatasets.updatedAt,
      })
      .from(uploadedDatasets)
      .orderBy(desc(uploadedDatasets.createdAt));

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取数据集列表失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据集列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/datasets - 创建新数据集（上传）
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, description, fileName, columns, data, uploadedBy } = body;

    if (!name || !columns || !data) {
      return NextResponse.json(
        { success: false, error: '缺少必要参数 (name, columns, data)' },
        { status: 400 }
      );
    }

    const [inserted] = await db
      .insert(uploadedDatasets)
      .values({
        name,
        description: description || '',
        fileName: fileName || '',
        columns,
        data,
        rowCount: Array.isArray(data) ? data.length : 0,
        uploadedBy: uploadedBy || 'unknown',
      })
      .returning();

    return NextResponse.json({ success: true, data: inserted });
  } catch (error) {
    console.error('创建数据集失败:', error);
    return NextResponse.json(
      { success: false, error: '创建数据集失败' },
      { status: 500 }
    );
  }
}
