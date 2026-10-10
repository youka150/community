'use client';

import { useState, useMemo } from 'react';
import {
  Plus, Trash2, Save, Search, Download, ChevronUp, ChevronDown,
  Edit3, X, Check
} from 'lucide-react';
import { Pagination } from 'antd';

/**
 * 数据表格组件 — 支持分页、排序、搜索、行内编辑、增删行、导出
 *
 * @param {Array} columns - [{ key, title, type }]
 * @param {Array} data - [{ _rowId, col1: val, ... }]
 * @param {Function} onDataChange - 数据变化回调，接收新的 data 数组
 * @param {boolean} readOnly
 */
export default function DataTableView({ columns = [], data = [], onDataChange, readOnly = false }) {
  const [searchText, setSearchText] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingCell, setEditingCell] = useState(null); // { rowId, colKey }
  const [editValue, setEditValue] = useState('');
  const pageSize = 20;

  // 搜索过滤
  const filteredData = useMemo(() => {
    if (!searchText.trim()) return data;
    const keyword = searchText.toLowerCase();
    return data.filter((row) =>
      columns.some((col) =>
        String(row[col.key] ?? '').toLowerCase().includes(keyword)
      )
    );
  }, [data, searchText, columns]);

  // 排序
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      // 数字排序
      if (!isNaN(Number(va)) && !isNaN(Number(vb))) {
        return sortDir === 'asc' ? Number(va) - Number(vb) : Number(vb) - Number(va);
      }
      // 字符串排序
      const sa = String(va ?? '');
      const sb = String(vb ?? '');
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
    });
  }, [filteredData, sortKey, sortDir]);

  // 分页
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const pagedData = sortedData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setCurrentPage(1);
  };

  // 开始编辑
  const startEdit = (rowId, colKey, currentValue) => {
    if (readOnly) return;
    setEditingCell({ rowId, colKey });
    setEditValue(currentValue instanceof Date ? currentValue.toISOString().split('T')[0] : String(currentValue ?? ''));
  };

  // 确认编辑
  const confirmEdit = () => {
    if (!editingCell) return;
    const newData = data.map((row) => {
      if (row._rowId === editingCell.rowId) {
        return { ...row, [editingCell.colKey]: editValue };
      }
      return row;
    });
    onDataChange?.(newData);
    setEditingCell(null);
    setEditValue('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // 添加行
  const addRow = () => {
    const maxId = data.reduce((max, r) => Math.max(max, r._rowId || 0), 0);
    const newRow = { _rowId: maxId + 1 };
    columns.forEach((col) => { newRow[col.key] = ''; });
    onDataChange?.([...data, newRow]);
    // 跳到最后一页
    const newTotal = Math.ceil((data.length + 1) / pageSize);
    setCurrentPage(newTotal);
  };

  // 删除行
  const deleteRow = (rowId) => {
    onDataChange?.(data.filter((r) => r._rowId !== rowId));
  };

  // 导出 CSV
  const exportCSV = () => {
    const header = columns.map((c) => `"${c.title}"`).join(',');
    const rows = data.map((row) =>
      columns.map((c) => `"${String(row[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full min-h-0 space-y-3">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* 搜索 */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="搜索全部列..."
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300 transition-all"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {!readOnly && (
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" /> 添加行
            </button>
          )}
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" /> 导出 CSV
          </button>
        </div>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-slate-200 flex-1 min-h-0 flex flex-col shadow-sm">
        <div className="overflow-auto flex-1 relative">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 shadow-sm z-10">
              <tr className="border-b border-slate-200">
                <th className="px-3 py-3 text-left text-xs font-semibold text-slate-500 w-12">#</th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-3 text-left text-xs font-semibold text-slate-500 cursor-pointer hover:text-slate-700 whitespace-nowrap select-none group"
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.title}
                      <span className="text-slate-300 group-hover:text-slate-400">
                        {sortKey === col.key ? (
                          sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronUp className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
                        )}
                      </span>
                    </span>
                  </th>
                ))}
                {!readOnly && (
                  <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 w-16">操作</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (readOnly ? 1 : 2)} className="px-6 py-12 text-center text-sm text-slate-400">
                    {searchText ? '没有匹配的数据' : '暂无数据'}
                  </td>
                </tr>
              ) : (
                pagedData.map((row, idx) => (
                  <tr key={row._rowId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-slate-400">
                      {(currentPage - 1) * pageSize + idx + 1}
                    </td>
                    {columns.map((col) => {
                      const isEditing = editingCell?.rowId === row._rowId && editingCell?.colKey === col.key;

                      return (
                        <td
                          key={col.key}
                          className={`px-3 py-2.5 max-w-[240px] ${!readOnly ? 'cursor-pointer' : ''}`}
                          onDoubleClick={() => startEdit(row._rowId, col.key, row[col.key])}
                        >
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                autoFocus
                                type={col.type === 'number' ? 'number' : 'text'}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') confirmEdit();
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                className="w-full px-2 py-1 rounded border border-teal-300 text-sm focus:outline-none focus:ring-1 focus:ring-teal-200"
                              />
                              <button onClick={confirmEdit} className="p-0.5 text-teal-600 hover:text-teal-800">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={cancelEdit} className="p-0.5 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-700 truncate block" title={String(row[col.key] ?? '')}>
                              {row[col.key] instanceof Date
                                ? row[col.key].toLocaleDateString('zh-CN')
                                : String(row[col.key] ?? '')}
                            </span>
                          )}
                        </td>
                      );
                    })}
                    {!readOnly && (
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => deleteRow(row._rowId)}
                          className="p-1 text-slate-400 hover:text-rose-500 transition-colors rounded"
                          title="删除此行"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 分页 */}
        {sortedData.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 shrink-0">
            <span className="text-xs text-slate-500">
              共 {sortedData.length} 条 {searchText && `（筛选自 ${data.length} 条）`}
            </span>
            <Pagination
              current={currentPage}
              pageSize={pageSize}
              total={sortedData.length}
              onChange={setCurrentPage}
              showSizeChanger={false}
              showQuickJumper
            />
          </div>
        )}
      </div>
    </div>
  );
}
