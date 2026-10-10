'use client';

import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Drawer, Input, Slider, Switch, Tag, Empty, Button, Tooltip, Divider } from 'antd';
import { ZoomIn, Award, Users, MessageCircle } from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

function getNodeId(nodeOrId) {
  if (!nodeOrId) return '';
  if (typeof nodeOrId === 'string') return nodeOrId;
  return nodeOrId.id || '';
}

/**
 * 用户交互网络图 Tab
 * 展示基于评论交互的用户关系力导向图
 */
export default function NetworkGraphTab({ network, includeAuthorEdges, setIncludeAuthorEdges }) {
  const containerRef = useRef(null);
  const fgRef = useRef(null);
  const [networkSize, setNetworkSize] = useState({ width: 900, height: 600 });

  const [minEdgeWeight, setMinEdgeWeight] = useState(1);
  const [searchUser, setSearchUser] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [onlyNeighborhood, setOnlyNeighborhood] = useState(false);

  // 监听容器尺寸变化
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const width = Math.max(520, el.clientWidth);
      setNetworkSize({ width, height: 600 });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 构建图数据
  const rawGraphData = useMemo(() => {
    if (!network?.nodes || !network?.links) return { nodes: [], links: [] };
    return {
      nodes: network.nodes.map((n) => ({
        id: n.id,
        weight: n.weight ?? 0,
        inWeight: n.inWeight ?? 0,
        outWeight: n.outWeight ?? 0,
        inDeg: n.inDeg ?? 0,
        outDeg: n.outDeg ?? 0,
        avatar: n.avatar,
      })),
      links: network.links.map((l) => ({
        source: l.source,
        target: l.target,
        value: l.value ?? 0,
        type: l.type,
      })),
    };
  }, [network]);

  const maxEdgeWeight = useMemo(() => {
    const links = rawGraphData.links || [];
    if (!links.length) return 10;
    return Math.max(1, ...links.map((l) => Number(l.value || 0)));
  }, [rawGraphData.links]);

  useEffect(() => {
    setMinEdgeWeight(1);
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, [includeAuthorEdges]);

  // 根据最小边权重过滤 links；可选仅看选中节点邻居子图
  const graphData = useMemo(() => {
    const links = (rawGraphData.links || []).filter((l) => Number(l.value || 0) >= minEdgeWeight);
    if (!onlyNeighborhood || !selectedNodeId) {
      return { nodes: rawGraphData.nodes || [], links };
    }

    const neighborIds = new Set([selectedNodeId]);
    links.forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      if (s === selectedNodeId) neighborIds.add(t);
      if (t === selectedNodeId) neighborIds.add(s);
    });

    const nodes = (rawGraphData.nodes || []).filter((n) => neighborIds.has(n.id));
    const subLinks = links.filter((l) => neighborIds.has(getNodeId(l.source)) && neighborIds.has(getNodeId(l.target)));
    return { nodes, links: subLinks };
  }, [minEdgeWeight, onlyNeighborhood, rawGraphData.links, rawGraphData.nodes, selectedNodeId]);

  const adjacency = useMemo(() => {
    const neighbors = new Map(); // id -> Set<id>
    const neighborWeights = new Map(); // id -> Map<neighborId, weightSum>

    const ensure = (id) => {
      if (!neighbors.has(id)) neighbors.set(id, new Set());
      if (!neighborWeights.has(id)) neighborWeights.set(id, new Map());
    };

    (graphData.links || []).forEach((l) => {
      const s = getNodeId(l.source);
      const t = getNodeId(l.target);
      const w = Number(l.value || 0);
      if (!s || !t) return;
      ensure(s);
      ensure(t);
      neighbors.get(s).add(t);
      neighbors.get(t).add(s);
      neighborWeights.get(s).set(t, (neighborWeights.get(s).get(t) || 0) + w);
      neighborWeights.get(t).set(s, (neighborWeights.get(t).get(s) || 0) + w);
    });

    return { neighbors, neighborWeights };
  }, [graphData.links]);

  const highlightSet = useMemo(() => {
    if (!selectedNodeId) return null;
    const s = new Set([selectedNodeId]);
    const ns = adjacency.neighbors.get(selectedNodeId);
    if (ns) ns.forEach((id) => s.add(id));
    return s;
  }, [adjacency.neighbors, selectedNodeId]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return (rawGraphData.nodes || []).find((n) => n.id === selectedNodeId) || null;
  }, [rawGraphData.nodes, selectedNodeId]);

  const selectedTopNeighbors = useMemo(() => {
    if (!selectedNodeId) return [];
    const m = adjacency.neighborWeights.get(selectedNodeId);
    if (!m) return [];
    return Array.from(m.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([id, w]) => ({ id, weight: w }));
  }, [adjacency.neighborWeights, selectedNodeId]);

  // 生成雷达图数据
  const getRadarData = useCallback((node) => {
    if (!node) return [];
    // 将权重归一化到 0-10 范围使雷达图更易读
    const maxWeight = Math.max(1, ...((rawGraphData.nodes || []).map(n => n.weight || 0)));
    const normalize = (val, max) => Math.min(10, (val / Math.max(1, max)) * 10);

    return [
      { dimension: '影响力', value: normalize(node.weight || 0, maxWeight) },
      { dimension: '入度', value: normalize(node.inDeg || 0, 50) },
      { dimension: '出度', value: normalize(node.outDeg || 0, 50) },
      { dimension: '被引用', value: normalize(node.inWeight || 0, maxWeight / 2) },
      { dimension: '活跃度', value: normalize(node.outWeight || 0, maxWeight / 2) },
    ];
  }, [rawGraphData.nodes]);

  // 根据用户属性生成徽章
  const getUserBadge = useCallback((node) => {
    if (!node) return null;
    const weight = node.weight || 0;
    const inDeg = node.inDeg || 0;
    const outDeg = node.outDeg || 0;

    // 简单规则判断用户类型
    if (weight > 100 && inDeg > 20) {
      return <Tag color="gold" icon={<Award className="w-3 h-3 inline" />}>核心影响者</Tag>;
    } else if (outDeg > inDeg * 2 && outDeg > 10) {
      return <Tag color="cyan" icon={<MessageCircle className="w-3 h-3 inline" />}>活跃评论者</Tag>;
    } else if (inDeg > outDeg * 2 && inDeg > 10) {
      return <Tag color="purple" icon={<Users className="w-3 h-3 inline" />}>意见领袖</Tag>;
    }
    return null;
  }, []);

  // 聚焦邻居节点
  const handleFocusNeighbor = useCallback((neighborId) => {
    const node = (graphData.nodes || []).find(n => n.id === neighborId);
    if (node && fgRef.current) {
      setSelectedNodeId(neighborId);
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(3.2, 800);
    }
  }, [graphData.nodes]);

  // 节点绘制函数
  const paintNode = useMemo(() => {
    const colorPalette = [
      '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
      '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
    ];

    const getColorForName = (name) => {
      let hash = 0;
      for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
      }
      return colorPalette[Math.abs(hash) % colorPalette.length];
    };

    return (node, ctx, globalScale) => {
      const isSelected = selectedNodeId && node.id === selectedNodeId;
      const isNeighbor = highlightSet && highlightSet.has(node.id);
      const shouldDim = highlightSet && !isNeighbor;

      const prevAlpha = ctx.globalAlpha;
      ctx.globalAlpha = shouldDim ? 0.12 : 1;

      const size = Math.max(4, Math.log10((node.weight || 1) + 1) * 5);

      const drawLabel = () => {
        if (globalScale >= 1.2) {
          const label = node.id;
          const fontSize = 12 / globalScale;
          ctx.font = `${fontSize}px Sans-Serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#475569';
          ctx.fillText(label, node.x, node.y + size + 2);
        }
      };

      // 尝试绘制头像
      if (node.avatar && !node.imgFailed) {
        let img = node.img;
        if (!img) {
          img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => { node.imgLoaded = true; };
          img.onerror = () => { node.imgFailed = true; };
          img.src = node.avatar;
          node.img = img;
        }

        if (img.complete && img.naturalHeight !== 0 && node.imgLoaded) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.clip();
          ctx.drawImage(img, node.x - size, node.y - size, size * 2, size * 2);
          ctx.restore();

          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 1.5 / globalScale;
          ctx.stroke();

          if (isSelected) {
            ctx.beginPath();
            ctx.arc(node.x, node.y, size + 3 / globalScale, 0, 2 * Math.PI, false);
            ctx.strokeStyle = 'rgba(244,63,94,0.9)';
            ctx.lineWidth = 2.5 / globalScale;
            ctx.stroke();
          }

          drawLabel();
          ctx.globalAlpha = prevAlpha;
          return;
        }
      }

      // Fallback: 彩色圆形 + 首字
      const color = getColorForName(node.id);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI, false);
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3 / globalScale, 0, 2 * Math.PI, false);
        ctx.strokeStyle = 'rgba(244,63,94,0.9)';
        ctx.lineWidth = 2.5 / globalScale;
        ctx.stroke();
      }

      const initial = (node.id || '?')[0]?.toUpperCase();
      const fontSize = size * 1.2;
      ctx.font = `bold ${fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'white';
      ctx.fillText(initial, node.x, node.y);

      drawLabel();
      ctx.globalAlpha = prevAlpha;
    };
  }, [highlightSet, selectedNodeId]);

  const handleSearch = useCallback(() => {
    const q = (searchUser || '').trim();
    if (!q) return;
    const node = (graphData.nodes || []).find((n) => n.id === q);
    if (!node) {
      // 允许模糊匹配一个
      const fuzzy = (graphData.nodes || []).find((n) => n.id?.includes(q));
      if (!fuzzy) return;
      setSelectedNodeId(fuzzy.id);
      setDrawerOpen(true);
      fgRef.current?.centerAt?.(fuzzy.x, fuzzy.y, 800);
      fgRef.current?.zoom?.(3.2, 800);
      return;
    }
    setSelectedNodeId(node.id);
    setDrawerOpen(true);
    fgRef.current?.centerAt?.(node.x, node.y, 800);
    fgRef.current?.zoom?.(3.2, 800);
  }, [graphData.nodes, searchUser]);

  const handleNodeClick = useCallback((node) => {
    if (!node?.id) return;
    setSelectedNodeId(node.id);
    setDrawerOpen(true);
  }, []);

  const handleNodeRightClick = useCallback((node) => {
    if (!node) return;
    // 右键 pin/unpin
    if (node.fx != null || node.fy != null) {
      node.fx = null;
      node.fy = null;
    } else {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* 控制栏 */}
      <div className="flex items-center justify-between bg-white/80 backdrop-blur rounded-2xl border border-white/60 shadow-lg p-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">用户交互网络图（A）</h2>
          <p className="text-sm text-slate-500">
            边包含：回复评论（reply_to_comment）{includeAuthorEdges ? ' + 评论→话题作者（comment_to_author）' : ''}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-end">
          <Input.Search
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
            onSearch={handleSearch}
            allowClear
            placeholder="搜索并定位用户"
            style={{ width: 240 }}
          />

          <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
            <div className="text-xs text-slate-600">边阈值</div>
            <div style={{ width: 160 }}>
              <Slider
                min={1}
                max={Math.max(2, maxEdgeWeight)}
                value={minEdgeWeight}
                onChange={setMinEdgeWeight}
                tooltip={{ formatter: (v) => `≥ ${v}` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
            <Switch size="small" checked={onlyNeighborhood} onChange={setOnlyNeighborhood} />
            <span className="text-sm text-slate-700">只看邻居子图</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white">
            <Switch
              size="small"
              checked={includeAuthorEdges}
              onChange={setIncludeAuthorEdges}
            />
            <span className="text-sm text-slate-700">包含评论→作者边</span>
          </div>

          <div className="text-xs text-slate-500">
            nodes: {network?.meta?.nodes ?? '-'} / links: {network?.meta?.links ?? '-'}
          </div>
        </div>
      </div>

      {/* 网络图 */}
      <div
        ref={containerRef}
        className="bg-white/80 backdrop-blur rounded-3xl border border-white/60 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.3)] p-4"
      >
        <div className="rounded-2xl border border-slate-100 overflow-hidden bg-slate-50" style={{ height: networkSize.height }}>
          <ForceGraph2D
            ref={fgRef}
            width={networkSize.width}
            height={networkSize.height}
            graphData={graphData}
            nodeLabel={(n) => {
              const pinned = n.fx != null || n.fy != null;
              return `${n.id}\n总权重: ${Number(n.weight || 0).toFixed(0)}\n入/出: ${n.inWeight ?? 0} / ${n.outWeight ?? 0}${pinned ? '\n(已固定)' : ''}`;
            }}
            nodeCanvasObject={paintNode}
            linkWidth={(l) => {
              const base = Math.max(0.5, Math.log10((l.value || 1) + 1));
              if (!selectedNodeId) return base;
              const s = getNodeId(l.source);
              const t = getNodeId(l.target);
              const isRelated = s === selectedNodeId || t === selectedNodeId;
              return isRelated ? base * 1.8 : base;
            }}
            linkDirectionalArrowLength={3}
            linkDirectionalArrowRelPos={1}
            linkColor={(l) => {
              const base = l.type === 'reply_to_comment' ? [99, 102, 241] : [16, 185, 129];
              if (!selectedNodeId) return `rgba(${base[0]},${base[1]},${base[2]},0.55)`;
              const s = getNodeId(l.source);
              const t = getNodeId(l.target);
              const isRelated = s === selectedNodeId || t === selectedNodeId;
              return isRelated
                ? `rgba(${base[0]},${base[1]},${base[2]},0.9)`
                : `rgba(${base[0]},${base[1]},${base[2]},0.08)`;
            }}
            linkLabel={(l) => {
              const s = getNodeId(l.source);
              const t = getNodeId(l.target);
              return `${s} → ${t}\n${l.type}\n权重: ${l.value ?? 0}`;
            }}
            onNodeClick={handleNodeClick}
            onNodeRightClick={handleNodeRightClick}
            onNodeDragEnd={(node) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
            cooldownTicks={80}
          />
        </div>

        {network?.meta?.note && <div className="text-xs text-slate-500 mt-3">{network.meta.note}</div>}
      </div>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        // width={480}
        size={480}
        title={
          <div className="flex items-center gap-2">
            <span>用户：{selectedNodeId}</span>
            {selectedNode && getUserBadge(selectedNode)}
          </div>
        }
      >
        {!selectedNode ? (
          <Empty description="未选择节点" />
        ) : (
          <div className="space-y-5">
            {/* 指标总览 */}
            <div className="flex flex-wrap gap-2">
              <Tag color="blue">总权重 {selectedNode.weight ?? 0}</Tag>
              <Tag color="geekblue">入权重 {selectedNode.inWeight ?? 0}</Tag>
              <Tag color="purple">出权重 {selectedNode.outWeight ?? 0}</Tag>
              <Tag color="gold">入度 {selectedNode.inDeg ?? 0}</Tag>
              <Tag color="orange">出度 {selectedNode.outDeg ?? 0}</Tag>
              {(selectedNode.fx != null || selectedNode.fy != null) && <Tag color="red">已固定</Tag>}
            </div>

            {/* 雷达图 - 多维评分 */}
            <div>
              <Divider
                // orientation="left"
                titlePlacement='left'
                plain className="!my-2">
                <span className="text-sm font-medium text-slate-700">用户能力雷达图</span>
              </Divider>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={getRadarData(selectedNode)} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fill: '#64748b', fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                    <Radar
                      name="评分"
                      dataKey="value"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.4}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="text-xs text-slate-500 text-center">
                综合影响力由 PageRank、入度、介数中心性、内容质量、创新度等指标综合计算
              </div>
            </div>

            {/* Top 邻居 */}
            <div>
              <Divider
                // orientation="left"
                titlePlacement='left'
                plain className="!my-2">
                <span className="text-sm font-medium text-slate-700">Top 邻居（按边权重）</span>
              </Divider>
              {!selectedTopNeighbors.length ? (
                <Empty description="无邻居" />
              ) : (
                <div className="space-y-2">
                  {selectedTopNeighbors.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-white hover:bg-slate-50 transition-colors group"
                    >
                      <div className="truncate text-slate-800">{n.id}</div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">权重 {n.weight}</span>
                        <Tooltip title="聚焦该用户">
                          <Button
                            type="text"
                            size="small"
                            icon={<ZoomIn className="w-3.5 h-3.5" />}
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleFocusNeighbor(n.id)}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 小技巧 */}
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
              <div className="font-medium text-slate-700 mb-1">小技巧：</div>
              <div>1) 点击节点查看详情并高亮邻居</div>
              <div>2) 右键节点可固定/解固定位置</div>
              <div>3) 拖动节点后会自动固定</div>
              <div>4) 点击邻居右侧的放大镜可快速聚焦</div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
