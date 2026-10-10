'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database, Upload, Table2, BarChart3, Trash2, Clock, FileSpreadsheet,
  Save, ChevronRight, RefreshCw, HardDrive, Plus
} from 'lucide-react';
import FileUploader from './FileUploader';
import DataTableView from './DataTableView';
import BIExplorer from './BIExplorer';
import { useAuth } from '@/context/AuthContext';

/**
 * 数据工作台 — 主页面组件
 * Tab 页：上传数据 | 数据表格 | BI 探索
 * 左侧：已上传的数据集列表
 */
export default function DataWorkbench() {
  const { role } = useAuth();
  const [datasets, setDatasets] = useState([]); // 已保存的数据集列表（不含行数据）
  const [activeDataset, setActiveDataset] = useState(null); // 当前选中的完整数据集
  const [activeTab, setActiveTab] = useState('upload'); // upload | table | bi
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localChanges, setLocalChanges] = useState(false);

  // 获取数据集列表
  const fetchDatasets = useCallback(async () => {
    try {
      const res = await fetch('/api/datasets');
      const json = await res.json();
      if (json.success) setDatasets(json.data || []);
    } catch (e) {
      console.error('获取数据集列表失败:', e);
    }
  }, []);

  // 加载单个数据集
  const loadDataset = useCallback(async (id) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/datasets/${id}`);
      const json = await res.json();
      if (json.success) {
        // 确保行数据有 _rowId
        const data = (json.data.data || []).map((row, idx) => ({
          _rowId: row._rowId || idx + 1,
          ...row,
        }));
        setActiveDataset({ ...json.data, data });
        setActiveTab('table');
        setLocalChanges(false);
      }
    } catch (e) {
      console.error('加载数据集失败:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 保存数据变更
  const saveChanges = useCallback(async () => {
    if (!activeDataset) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/datasets/${activeDataset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: activeDataset.data,
          columns: activeDataset.columns,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setLocalChanges(false);
        fetchDatasets(); // 刷新列表中的 rowCount
      }
    } catch (e) {
      console.error('保存失败:', e);
    } finally {
      setSaving(false);
    }
  }, [activeDataset, fetchDatasets]);

  // 删除数据集
  const deleteDataset = async (id) => {
    if (!confirm('确定删除此数据集？此操作不可恢复。')) return;
    try {
      await fetch(`/api/datasets/${id}`, { method: 'DELETE' });
      if (activeDataset?.id === id) {
        setActiveDataset(null);
        setActiveTab('upload');
      }
      fetchDatasets();
    } catch (e) {
      console.error('删除失败:', e);
    }
  };

  // 文件解析后上传
  const handleDataParsed = async ({ fileName, columns, data }) => {
    setSaving(true);
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fileName.replace(/\.[^.]+$/, ''), // 去掉扩展名
          description: '',
          fileName,
          columns,
          data,
          uploadedBy: role || 'unknown',
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchDatasets();
        // 自动切换到表格视图
        loadDataset(json.data.id);
      }
    } catch (e) {
      console.error('上传失败:', e);
    } finally {
      setSaving(false);
    }
  };

  // 数据变更
  const handleDataChange = (newData) => {
    if (!activeDataset) return;
    setActiveDataset((prev) => ({ ...prev, data: newData }));
    setLocalChanges(true);
  };

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const tabs = [
    { id: 'upload', label: '上传数据', icon: Upload },
    { id: 'table', label: '数据表格', icon: Table2, disabled: !activeDataset },
    { id: 'bi', label: 'BI 探索', icon: BarChart3, disabled: !activeDataset },
  ];

  return (
    <div className="min-h-screen relative">
      {/* 顶部标题栏 */}
      <div className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-slate-200/80 shadow-sm">
        <div className="px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">数据工作台</h1>
              <p className="text-xs text-slate-500">上传 · 管理 · 可视化探索</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {localChanges && (
              <button
                onClick={saveChanges}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors shadow-md shadow-teal-200 disabled:opacity-50"
              >
                {saving ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                保存修改
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 主内容 — 左右布局 */}
      <div className="px-6 py-6 flex gap-6" style={{ height: 'calc(100vh - 65px)' }}>
        {/* 左侧：数据集列表 */}
        <aside className="w-[260px] shrink-0 h-full flex flex-col">
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-lg flex flex-col h-full">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-teal-500" />
                  数据集
                </h3>
                <button
                  onClick={() => { setActiveDataset(null); setActiveTab('upload'); }}
                  className="p-1.5 rounded-lg hover:bg-teal-50 text-teal-600 transition-colors"
                  title="上传新数据"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-slate-400">{datasets.length} 个数据集</p>
            </div>

            {/* 数据集列表 */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {datasets.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  暂无数据集<br />请上传文件
                </div>
              ) : (
                datasets.map((ds) => (
                  <div
                    key={ds.id}
                    className={`group flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-1 cursor-pointer transition-all ${activeDataset?.id === ds.id
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/20'
                        : 'hover:bg-teal-50 text-slate-700'
                      }`}
                    onClick={() => loadDataset(ds.id)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${activeDataset?.id === ds.id ? 'bg-white/20' : 'bg-teal-100'
                      }`}>
                      <FileSpreadsheet className={`w-4 h-4 ${activeDataset?.id === ds.id ? 'text-white' : 'text-teal-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${activeDataset?.id === ds.id ? 'text-white' : 'text-slate-800'}`}>
                        {ds.name}
                      </p>
                      <p className={`text-xs ${activeDataset?.id === ds.id ? 'text-white/70' : 'text-slate-400'}`}>
                        {ds.rowCount || 0} 行 · {(ds.columns || []).length} 列
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteDataset(ds.id); }}
                      className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${activeDataset?.id === ds.id
                          ? 'text-white/60 hover:text-white hover:bg-white/10'
                          : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50'
                        }`}
                      title="删除数据集"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>

        {/* 右侧：主内容 */}
        <main className="flex-1 min-w-0 flex flex-col min-h-0 h-full">
          {/* Tab 切换 */}
          <div className="flex items-center gap-1 mb-5 p-1 bg-slate-100 rounded-xl w-fit shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${activeTab === tab.id
                      ? 'bg-white text-teal-600 shadow-sm'
                      : tab.disabled
                        ? 'text-slate-300 cursor-not-allowed'
                        : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 内容 */}
          {activeTab === 'upload' && (
            <div className="space-y-6 flex-1 min-h-0 overflow-y-auto pr-2 pb-6">
              <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-2xl border border-teal-100 p-6">
                <h2 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2">
                  <Upload className="w-5 h-5 text-teal-600" />
                  上传表格数据
                </h2>
                <p className="text-sm text-slate-600 mb-4">
                  导入社区运营数据，系统将自动解析列结构，支持在线编辑和可视化分析。
                </p>
                <FileUploader onDataParsed={handleDataParsed} disabled={saving} />
              </div>

              {/* 最近上传 */}
              {datasets.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-slate-600 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" /> 最近上传的数据集
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {datasets.slice(0, 6).map((ds) => (
                      <div
                        key={ds.id}
                        onClick={() => loadDataset(ds.id)}
                        className="group p-4 bg-white rounded-xl border border-slate-200 hover:border-teal-200 hover:shadow-md cursor-pointer transition-all"
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-teal-50 rounded-lg">
                            <FileSpreadsheet className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-slate-800 truncate text-sm">{ds.name}</p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-teal-400 transition-colors" />
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                          <span>{ds.rowCount || 0} 行</span>
                          <span>{(ds.columns || []).length} 列</span>
                          <span>{ds.createdAt ? new Date(ds.createdAt).toLocaleDateString('zh-CN') : ''}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'table' && activeDataset && (
            <div className="flex-1 min-h-0 flex flex-col pb-4">
              <DataTableView
                columns={activeDataset.columns || []}
                data={activeDataset.data || []}
                onDataChange={handleDataChange}
              />
            </div>
          )}

          {activeTab === 'bi' && activeDataset && (
            <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-6">
              <BIExplorer
                columns={activeDataset.columns || []}
                data={activeDataset.data || []}
              />
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-3 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
                <p className="text-sm text-slate-500">加载数据中...</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
