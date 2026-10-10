import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { clampInt, parseDateRange } from '../_utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 昇腾用户交互网络图
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const limit = clampInt(url.searchParams.get('limit'), { min: 50, max: 2000, fallback: 300 });
    const includeAuthorEdges = url.searchParams.get('includeAuthorEdges') !== '0';
    const { start, endExclusive } = parseDateRange(request, { defaultDays: 30 });
    const startTs = start.toISOString().slice(0, 10).replace(/-/g, '') + '000000';
    const endTs = endExclusive.toISOString().slice(0, 10).replace(/-/g, '') + '000000';

    const edgesResult = await db.execute(sql`
      WITH reply_edges AS (
        SELECT COALESCE(NULLIF(uc.nick_name, ''), NULLIF(child.author_display_name, ''), child.author_id) AS src,
               COALESCE(NULLIF(up.nick_name, ''), NULLIF(parent.author_display_name, ''), parent.author_id) AS dst,
               COUNT(*)::int AS weight,
               'reply_to_comment'::text AS type
        FROM ascend_comments child
        JOIN ascend_comments parent
          ON parent.comment_id = child.parent_comment_id
        LEFT JOIN ascend_users uc ON child.author_id = uc.uid
        LEFT JOIN ascend_users up ON parent.author_id = up.uid
        WHERE child.create_time IS NOT NULL
          AND child.create_time >= ${startTs}
          AND child.create_time < ${endTs}
          AND COALESCE(NULLIF(child.author_display_name, ''), child.author_id) IS NOT NULL
          AND COALESCE(NULLIF(parent.author_display_name, ''), parent.author_id) IS NOT NULL
          AND COALESCE(NULLIF(uc.nick_name, ''), NULLIF(child.author_display_name, ''), child.author_id) <> COALESCE(NULLIF(up.nick_name, ''), NULLIF(parent.author_display_name, ''), parent.author_id)
        GROUP BY 1, 2
      ), author_edges AS (
        SELECT COALESCE(NULLIF(uc.nick_name, ''), NULLIF(c.author_display_name, ''), c.author_id) AS src,
               COALESCE(NULLIF(ut.nick_name, ''), NULLIF(t.author_nickname, ''), t.author_id) AS dst,
               COUNT(*)::int AS weight,
               'comment_to_author'::text AS type
        FROM ascend_comments c
        JOIN ascend_topics t ON t.topic_id = c.topic_id
        LEFT JOIN ascend_users uc ON c.author_id = uc.uid
        LEFT JOIN ascend_users ut ON t.author_id = ut.uid
        WHERE ${includeAuthorEdges}
          AND c.create_time IS NOT NULL
          AND c.create_time >= ${startTs}
          AND c.create_time < ${endTs}
          AND COALESCE(NULLIF(c.author_display_name, ''), c.author_id) IS NOT NULL
          AND COALESCE(NULLIF(t.author_nickname, ''), t.author_id) IS NOT NULL
          AND COALESCE(NULLIF(uc.nick_name, ''), NULLIF(c.author_display_name, ''), c.author_id) <> COALESCE(NULLIF(ut.nick_name, ''), NULLIF(t.author_nickname, ''), t.author_id)
        GROUP BY 1, 2
      ), all_edges AS (
        SELECT * FROM reply_edges
        UNION ALL
        SELECT * FROM author_edges
      )
      SELECT src, dst, type, weight
      FROM all_edges
      WHERE src IS NOT NULL AND dst IS NOT NULL
        AND src != '' AND dst != ''
        AND src != '?' AND dst != '?'
        AND src NOT ILIKE '%匿名用户%'
        AND dst NOT ILIKE '%匿名用户%'
      ORDER BY weight DESC
      LIMIT ${limit};
    `);

    const edges = Array.isArray(edgesResult?.rows) ? edgesResult.rows : edgesResult;
    const nodeStats = new Map();
    const nodeNeighbors = new Map();

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
    const nodes = nodeIds.map(id => {
      const stats = nodeStats.get(id);
      const neighbors = nodeNeighbors.get(id);
      return {
        id,
        inWeight: stats.inWeight,
        outWeight: stats.outWeight,
        inDeg: neighbors.in.size,
        outDeg: neighbors.out.size,
        weight: stats.inWeight + stats.outWeight,
        avatar: null
      };
    });

    nodes.sort((a, b) => b.weight - a.weight);

    return NextResponse.json({
      success: true,
      range: { start: start.toISOString(), endExclusive: endExclusive.toISOString() },
      meta: {
        nodes: nodes.length,
        links: safeEdges.length,
        includeAuthorEdges,
        note: '昇腾社区用户交互网络图（评论回复 + 评论→话题作者）',
      },
      nodes,
      links: safeEdges.map((e) => ({
        source: e.src,
        target: e.dst,
        value: e.weight ?? 0,
        type: e.type,
      })),
    });
  } catch (error) {
    console.error('Ascend network API error:', error);
    return NextResponse.json(
      { success: false, error: '获取昇腾用户交互网络失败', details: process.env.NODE_ENV === 'development' ? String(error?.stack || error) : undefined },
      { status: 500 }
    );
  }
}
