'use client';

import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, X, Check, AlertCircle, FileText } from 'lucide-react';

/**
 * 文件上传组件 — 支持 CSV / XLSX / XLS / TSV
 * 在浏览器端使用 SheetJS 解析，不上传原始文件到服务端
 *
 * @param {Function} onDataParsed - 回调，接收 { fileName, columns, data }
 * @param {boolean} disabled
 */
export default function FileUploader({ onDataParsed, disabled = false }) {
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState(null); // { fileName, columns, data, totalRows }
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const ACCEPT = '.csv,.xlsx,.xls,.tsv';
  const MAX_SIZE = 20 * 1024 * 1024; // 20MB

  const parseFile = async (file) => {
    setError(null);
    setParsing(true);
    setPreview(null);

    try {
      if (file.size > MAX_SIZE) {
        throw new Error(`文件大小超过 20MB 限制 (${(file.size / 1024 / 1024).toFixed(1)} MB)`);
      }

      // 动态导入 xlsx（减小首屏包体积）
      const XLSX = await import('xlsx');

      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });

      // 默认读取第一个 Sheet
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // 转为 JSON 数组
      const rawData = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawData.length === 0) {
        throw new Error('文件内容为空或无法识别');
      }

      // 推断列定义
      const firstRow = rawData[0];
      const columns = Object.keys(firstRow).map((key) => {
        // 尝试推断类型
        const sampleValues = rawData.slice(0, 50).map((r) => r[key]);
        const type = inferColumnType(sampleValues);
        return { key, title: key, type };
      });

      // 给每行加一个内部 _rowId
      const data = rawData.map((row, idx) => ({ _rowId: idx + 1, ...row }));

      setPreview({
        fileName: file.name,
        columns,
        data,
        totalRows: data.length,
        previewRows: data.slice(0, 10),
      });
    } catch (e) {
      setError(e.message || '文件解析失败');
    } finally {
      setParsing(false);
    }
  };

  const inferColumnType = (values) => {
    const nonEmpty = values.filter((v) => v !== '' && v !== null && v !== undefined);
    if (nonEmpty.length === 0) return 'text';

    const isNumber = nonEmpty.every((v) => !isNaN(Number(v)));
    if (isNumber) return 'number';

    const isDate = nonEmpty.every((v) => v instanceof Date || !isNaN(Date.parse(String(v))));
    if (isDate && nonEmpty.some((v) => v instanceof Date)) return 'date';

    return 'text';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = ''; // 允许重复选择同文件
  };

  const handleConfirm = () => {
    if (preview && onDataParsed) {
      onDataParsed({
        fileName: preview.fileName,
        columns: preview.columns,
        data: preview.data,
      });
    }
    setPreview(null);
  };

  const handleCancel = () => {
    setPreview(null);
    setError(null);
  };

  return (
    <div className="space-y-4">
      {/* 拖拽上传区域 */}
      {!preview && (
        <div
          className={`
            relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer
            ${dragOver
              ? 'border-teal-400 bg-teal-50/50 scale-[1.01]'
              : 'border-slate-200 hover:border-teal-300 hover:bg-teal-50/30'
            }
            ${disabled ? 'opacity-50 pointer-events-none' : ''}
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleFileChange}
            className="hidden"
          />

          {parsing ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-3 border-teal-200 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-sm text-slate-500">正在解析文件...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 flex items-center justify-center">
                <Upload className="w-7 h-7 text-teal-500" />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-700">
                  拖拽文件到此处，或 <span className="text-teal-600">点击选择</span>
                </p>
                <p className="text-sm text-slate-400 mt-1">
                  支持 CSV、Excel (XLSX/XLS)、TSV 格式，最大 20MB
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
          <p className="text-sm text-rose-600">{error}</p>
          <button onClick={handleCancel} className="ml-auto p-1 text-rose-400 hover:text-rose-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 解析预览 */}
      {preview && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* 文件信息 */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-xl">
                <FileSpreadsheet className="w-5 h-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{preview.fileName}</p>
                <p className="text-sm text-slate-500">
                  {preview.totalRows} 行 × {preview.columns.length} 列
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" /> 确认导入
              </button>
            </div>
          </div>

          {/* 列信息 */}
          <div className="px-6 py-3 border-b border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500 mb-2">列定义（前 10 行预览）</p>
            <div className="flex flex-wrap gap-2">
              {preview.columns.map((col) => (
                <span
                  key={col.key}
                  className={`px-2 py-1 text-xs rounded-lg border font-medium ${col.type === 'number'
                      ? 'bg-blue-50 text-blue-600 border-blue-200'
                      : col.type === 'date'
                        ? 'bg-amber-50 text-amber-600 border-amber-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                >
                  {col.title}
                  <span className="ml-1 opacity-60">({col.type})</span>
                </span>
              ))}
            </div>
          </div>

          {/* 数据预览表格 */}
          <div className="overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-500 w-12">#</th>
                  {preview.columns.map((col) => (
                    <th key={col.key} className="px-3 py-2 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">
                      {col.title}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {preview.previewRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 text-xs text-slate-400">{idx + 1}</td>
                    {preview.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-slate-700 max-w-[200px] truncate whitespace-nowrap">
                        {row[col.key] instanceof Date
                          ? row[col.key].toLocaleDateString('zh-CN')
                          : String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.totalRows > 10 && (
            <div className="px-6 py-2 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
              仅展示前 10 行，共 {preview.totalRows} 行
            </div>
          )}
        </div>
      )}
    </div>
  );
}
