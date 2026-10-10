import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clampInt, parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 用户交互网络图（A）：
 * - reply_to_comment：评论回复 -> 被回复评论的作者（如果 parent_id 可对应 comment_id）
 * - comment_to_author：评论者 -> 话题作者（topics.user）
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get('limit'), { min: 50, max: 2000, fallback: 300 });
    const includeAuthorEdges = url.searchParams.get('includeAuthorEdges') !== '0';
    const { start, endExclusive } = parseDateRange(request, { defaultDays: 30 });

    const edgesResult = await db.execute(sql`
      WITH reply_edges AS (
        SELECT child."user" AS src,
               parent."user" AS dst,
               COUNT(*)::int AS weight,
               'reply_to_comment'::text AS type
        FROM topics_comments child
        JOIN topics_comments parent
          ON parent.comment_id = child.parent_id
        WHERE child.create_time IS NOT NULL
          AND child.create_time >= ${start.toISOString()}
          AND child.create_time < ${endExclusive.toISOString()}
          AND child."user" IS NOT NULL AND child."user" != '匿名用户'
          AND parent."user" IS NOT NULL AND parent."user" != '匿名用户'
          AND child."user" <> parent."user"
        GROUP BY child."user", parent."user"
      ), author_edges AS (
        SELECT c."user" AS src,
               t."user" AS dst,
               COUNT(*)::int AS weight,
               'comment_to_author'::text AS type
        FROM topics_comments c
        JOIN topics t ON t.id = c.topic_id
        WHERE ${includeAuthorEdges}
          AND c.create_time IS NOT NULL
          AND c.create_time >= ${start.toISOString()}
          AND c.create_time < ${endExclusive.toISOString()}
          AND c."user" IS NOT NULL AND c."user" != '匿名用户'
          AND t."user" IS NOT NULL AND t."user" != '匿名用户'
          AND c."user" <> t."user"
        GROUP BY c."user", t."user"
      ), all_edges AS (
        SELECT * FROM reply_edges
        UNION ALL
        SELECT * FROM author_edges
      )
      SELECT src, dst, type, weight
      FROM all_edges
      WHERE src IS NOT NULL AND dst IS NOT NULL
      ORDER BY weight DESC
      LIMIT ${limit};
    `);

    const edges = Array.isArray(edgesResult?.rows) ? edgesResult.rows : edgesResult;

    // 2. Re-calculate nodes from edges to ensure consistency (avoid "node not found" error)
    // The previous SQL approach caused race conditions where edges query and nodes query
    // returned different sets due to sort instability, leading to orphan edges.
    
    // In-memory aggregation
    const nodeStats = new Map(); // id -> { inWeight, outWeight }
    const nodeNeighbors = new Map(); // id -> { in: Set, out: Set }

    const ensureNode = (id) => {
      if (!nodeStats.has(id)) {
        nodeStats.set(id, { id, inWeight: 0, outWeight: 0 });
        nodeNeighbors.set(id, { in: new Set(), out: new Set() });
      }
      return nodeStats.get(id);
    };

    const safeEdges = Array.isArray(edges) ? edges : [];

    safeEdges.forEach((e) => {
      const src = ensureNode(e.src);
      const dst = ensureNode(e.dst);
      const w = Number(e.weight || 0);

      src.outWeight += w;
      dst.inWeight += w;
      
      nodeNeighbors.get(e.src).out.add(e.dst);
      nodeNeighbors.get(e.dst).in.add(e.src);
    });

    const nodeIds = Array.from(nodeStats.keys());
    
    // 3. Fetch Avatars
    const avatarMap = new Map();
    if (nodeIds.length > 0) {
      try {
        const avatarsResult = await db.execute(sql`
          SELECT DISTINCT ON ("user") "user", avatar
          FROM topics_comments
          WHERE "user" = ANY(${nodeIds})
            AND avatar IS NOT NULL
          ORDER BY "user", create_time DESC
        `);
        const rows = Array.isArray(avatarsResult?.rows) ? avatarsResult.rows : avatarsResult;
        if (Array.isArray(rows)) {
          rows.forEach(r => avatarMap.set(r.user, r.avatar));
        }
      } catch (err) {}
    }

    // 4. Build final nodes array
    const nodes = nodeIds.map(id => {
      const stats = nodeStats.get(id);
      const neighbors = nodeNeighbors.get(id);
      return {
        id: id,
        inWeight: stats.inWeight,
        outWeight: stats.outWeight,
        inDeg: neighbors.in.size,
        outDeg: neighbors.out.size,
        weight: stats.inWeight + stats.outWeight,
        avatar: avatarMap.get(id) || null
      };
    });

    // Sort by total weight desc
    nodes.sort((a, b) => b.weight - a.weight);

    return NextResponse.json({
      success: true,
      range: {
        start: start.toISOString(),
        endExclusive: endExclusive.toISOString(),
      },
      meta: {
        nodes: nodes.length,
        links: safeEdges.length,
        includeAuthorEdges,
        note:
          'questions 表缺少作者字段，因此网络图当前只基于 topics_comments（回复关系 + 评论->话题作者）构建。',
      },
      nodes: nodes,
      links: safeEdges.map((e) => ({
        source: e.src,
        target: e.dst,
        value: e.weight ?? 0,
        type: e.type,
      })),
    });
  } catch (error) {
    console.error('Huawei network API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: '获取华为用户交互网络失败',
        details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined,
      },
      { status: 500 }
    );
  }
}
