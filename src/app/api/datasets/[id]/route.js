import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadedDatasets } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/datasets/[id] - 获取单个数据集（含行数据）
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const datasetId = parseInt(id);

    if (isNaN(datasetId)) {
      return NextResponse.json(
        { success: false, error: '无效的数据集 ID' },
        { status: 400 }
      );
    }

    const [dataset] = await db
      .select()
      .from(uploadedDatasets)
      .where(eq(uploadedDatasets.id, datasetId))
      .limit(1);

    if (!dataset) {
      return NextResponse.json(
        { success: false, error: '数据集不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: dataset });
  } catch (error) {
    console.error('获取数据集失败:', error);
    return NextResponse.json(
      { success: false, error: '获取数据集失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/datasets/[id] - 更新数据集（行数据、名称等）
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const datasetId = parseInt(id);
    const body = await request.json();

    if (isNaN(datasetId)) {
      return NextResponse.json(
        { success: false, error: '无效的数据集 ID' },
        { status: 400 }
      );
    }

    const updateFields = {};
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.description !== undefined) updateFields.description = body.description;
    if (body.columns !== undefined) updateFields.columns = body.columns;
    if (body.data !== undefined) {
      updateFields.data = body.data;
      updateFields.rowCount = Array.isArray(body.data) ? body.data.length : 0;
    }
    updateFields.updatedAt = new Date();

    const [updated] = await db
      .update(uploadedDatasets)
      .set(updateFields)
      .where(eq(uploadedDatasets.id, datasetId))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { success: false, error: '数据集不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('更新数据集失败:', error);
    return NextResponse.json(
      { success: false, error: '更新数据集失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/datasets/[id] - 删除数据集
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const datasetId = parseInt(id);

    if (isNaN(datasetId)) {
      return NextResponse.json(
        { success: false, error: '无效的数据集 ID' },
        { status: 400 }
      );
    }

    const [deleted] = await db
      .delete(uploadedDatasets)
      .where(eq(uploadedDatasets.id, datasetId))
      .returning({ id: uploadedDatasets.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '数据集不存在' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除数据集失败:', error);
    return NextResponse.json(
      { success: false, error: '删除数据集失败' },
      { status: 500 }
    );
  }
}
