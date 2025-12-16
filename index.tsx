import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit2,
  Trash2,
  Settings,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  Briefcase
} from 'lucide-react';

// --- Types & Enums ---

enum Status {
  APPLIED = 'Applied',
  CONTACTED = 'Contacted',
  INTERVIEW = 'Interview',
  OFFER = 'Offer',
  REJECTED = 'Rejected',
  GHOSTED = 'Ghosted'
}

type SheetName = 'Didil' | 'Sabil';

interface Job {
  id: string; // Internal ID for React keys
  rowIndex?: number; // For Google Sheets sync
  company: string;
  position: string;
  status: Status;
  salary: string;
  location: string;
  applyVia: string;
  applyDate: string;
  notes: string;
}

// --- Configuration ---

const STATUS_COLORS: Record<Status, string> = {
  [Status.APPLIED]: 'bg-blue-100 text-blue-700 border-blue-200',
  [Status.CONTACTED]: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  [Status.INTERVIEW]: 'bg-purple-100 text-purple-700 border-purple-200',
  [Status.OFFER]: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  [Status.REJECTED]: 'bg-red-100 text-red-700 border-red-200',
  [Status.GHOSTED]: 'bg-slate-200 text-slate-600 border-slate-300',
};

const SHEET_NAMES: SheetName[] = ['Didil', 'Sabil'];

// --- Google Apps Script Template ---
// Template code diperbarui agar sesuai dengan perubahan di Kode.gs (disederhanakan)
const GAS_CODE = `
// ----------------------------------------------------------------
// PASTE THIS INTO EXTENSIONS > APPS SCRIPT IN YOUR GOOGLE SHEET
// DEPLOY AS WEB APP > ACCESS: ANYONE (Mendukung GET, POST, OPTIONS untuk CORS)
// ----------------------------------------------------------------

function doGet(e) {
  // Hanya melayani aksi 'read'
  if (e.parameter.action === 'read') return handleRead(e);
  return jsonResponse({ success: false, error: 'Invalid GET request action' });
}

function doPost(e) {
  // Melayani aksi 'create', 'update', 'delete'
  return handleRequest(e);
}

function doOptions(e) {
  return ContentService.createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleRead(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = e.parameter.sheet || 'Didil';
    let sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Nama Perusahaan', 'Posisi', 'Status', 'Salary', 'Lokasi', 'Apply via', 'Apply date', 'Notes']);
      return jsonResponse({ success: true, data: [] });
    }
    
    const data = sheet.getDataRange().getValues();
    data.shift(); 
    
    const rows = data.map((row, index) => ({
      rowIndex: index + 2,
      company: row[0], position: row[1], status: row[2], salary: row[3],
      location: row[4], applyVia: row[5], applyDate: row[6], notes: row[7]
    }));
    return jsonResponse({ success: true, data: rows });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Apps Script Read Error: ' + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const sheetName = body.sheet || 'Didil';
    
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['Nama Perusahaan', 'Posisi', 'Status', 'Salary', 'Lokasi', 'Apply via', 'Apply date', 'Notes']);
    }

    if (action === 'create' || action === 'update') {
      const rowData = [
        body.company, body.position, body.status, body.salary, 
        body.location, body.applyVia, body.applyDate, body.notes
      ];
      
      if (action === 'create') {
        sheet.appendRow(rowData);
      } else { // 'update'
        const rowIndex = parseInt(body.rowIndex);
        if (rowIndex > 1) {
          sheet.getRange(rowIndex, 1, 1, 8).setValues([rowData]);
        } else {
          return jsonResponse({ success: false, error: 'Invalid Row Index for update' });
        }
      }
      return jsonResponse({ success: true });
    }

    if (action === 'delete') {
      const rowIndex = parseInt(body.rowIndex);
      if (rowIndex > 1) {
        sheet.deleteRow(rowIndex);
        return jsonResponse({ success: true });
      }
      return jsonResponse({ success: false, error: 'Invalid Row Index for delete' });
    }
    
    return jsonResponse({ success: false, error: 'Invalid action in POST body' });

  } catch (err) {
    return jsonResponse({ success: false, error: 'Apps Script Write Error: ' + err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  output.setHeader('Access-Control-Allow-Origin', '*'); 
  output.setHeader('Access-Control-Allow-Headers', 'Content-Type'); 
  return output;
}
`;

// --- Components ---
const StatusBadge = ({ status }: { status: Status }) => (
  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
    {status}
  </span>
);

const StatCard = ({ title, count, status }: { title: string, count: number, status: Status }) => {
  const colorClass = STATUS_COLORS[status];
  const bgClass = colorClass.split(' ')[0];
  const textClass = colorClass.split(' ')[1];

  return (
    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between">
      <div>
        <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider">{title}</p>
        <h3 className="text-2xl font-bold text-slate-800 mt-1">{count}</h3>
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass}`}>
        <span className={`text-lg font-bold ${textClass}`}>{title.charAt(0)}</span>
      </div>
    </div>
  );
};

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-500">
            <XCircle size={24} />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};


// --- Main App Component ---

const App = () => {
  // State
  const [activeSheet, setActiveSheet] = useState<SheetName>('Didil');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState<string>(''); // Google Apps Script URL
  const [showConfig, setShowConfig] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  // Filter/Sort State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<Status | 'ALL'>('ALL');

  // Form State
  const [formData, setFormData] = useState<Partial<Job>>({});

  // Initialize
  useEffect(() => {
    const savedEndpoint = localStorage.getItem('gas_endpoint');
    if (savedEndpoint) setApiEndpoint(savedEndpoint);

    // Load local data initially if no endpoint
    if (!savedEndpoint) {
      const localData = localStorage.getItem(`jobs_${activeSheet}`);
      if (localData) {
        setJobs(JSON.parse(localData));
      } else {
        setJobs([]);
      }
    } else {
      fetchJobs(savedEndpoint, activeSheet);
    }
  }, []);

  // Effect to handle sheet switching
  useEffect(() => {
    if (apiEndpoint) {
      fetchJobs(apiEndpoint, activeSheet);
    } else {
      const localData = localStorage.getItem(`jobs_${activeSheet}`);
      setJobs(localData ? JSON.parse(localData) : []);
    }
  }, [activeSheet]);

  // --- API Handlers ---

  const fetchJobs = async (endpoint: string, sheet: string) => {
    if (!endpoint) return;
    setIsLoading(true);

    // KODE PERBAIKAN CORS MENGGUNAKAN XHR (XMLHttpRequest)
    // Ini adalah solusi paling andal untuk menghindari masalah 302 redirect CORS pada Apps Script
    return new Promise((resolve, reject) => {
      const url = `${endpoint}?action=read&sheet=${sheet}`;
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);

      // Penting: Mengatasi masalah 302 Redirect yang memblokir CORS
      xhr.withCredentials = true;
      xhr.responseType = 'json';

      xhr.onload = function () {
        setIsLoading(false);
        if (xhr.status === 200) {
          const result = xhr.response;
          if (result && result.success) {
            const mapped: Job[] = result.data.map((r: any) => ({
              ...r,
              id: Math.random().toString(36).substr(2, 9)
            }));
            setJobs(mapped);
            resolve(true);
          } else {
            alert("Error fetching data: " + (result?.error || "Unknown error."));
            reject(new Error(result?.error || "Unknown error."));
          }
        } else {
          alert(`Failed to fetch data. HTTP Status: ${xhr.status}. Check your Apps Script deployment.`);
          reject(new Error(`HTTP Error: ${xhr.status}`));
        }
      };

      xhr.onerror = function () {
        setIsLoading(false);
        console.error("XHR Network Error", xhr);
        alert('Network error when trying to fetch data from Google Sheet.');
        reject(new Error('Network error'));
      };

      xhr.send();
    });
  };

  const saveJob = async (jobData: Partial<Job>) => {
    setIsLoading(true);
    const isEdit = !!editingJob;

    const payload = {
      ...jobData,
      status: jobData.status || Status.APPLIED,
    };

    if (apiEndpoint) {
      // SEND TO GOOGLE SHEETS
      try {
        const action = isEdit ? 'update' : 'create';
        const body = {
          action,
          sheet: activeSheet,
          rowIndex: isEdit ? editingJob.rowIndex : undefined,
          ...payload
        };

        // Menggunakan fetch standar untuk POST, karena header Content-Type sudah cukup
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json' // PENTING: Header untuk POST
          },
          body: JSON.stringify(body)
        });

        const result = await response.json();
        if (result.success) {
          fetchJobs(apiEndpoint, activeSheet);
          closeForm();
        } else {
          alert('Failed to save: ' + result.error);
        }
      } catch (e) {
        console.error(e);
        alert('Network error saving to Google Sheet.');
      }
    } else {
      // SAVE LOCAL
      let newJobs = [...jobs];
      if (isEdit && editingJob) {
        newJobs = newJobs.map(j => j.id === editingJob.id ? { ...j, ...payload } as Job : j);
      } else {
        newJobs.push({
          ...payload,
          id: Math.random().toString(36).substr(2, 9),
          rowIndex: 0
        } as Job);
      }
      setJobs(newJobs);
      localStorage.setItem(`jobs_${activeSheet}`, JSON.stringify(newJobs));
      closeForm();
    }
    setIsLoading(false);
  };

  const deleteJob = async (job: Job) => {
    if (!confirm('Are you sure you want to delete this application?')) return;

    if (apiEndpoint && job.rowIndex) {
      setIsLoading(true);
      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json' // PENTING: Header untuk POST
          },
          body: JSON.stringify({
            action: 'delete',
            sheet: activeSheet,
            rowIndex: job.rowIndex
          })
        });
        const result = await response.json();
        if (result.success) {
          fetchJobs(apiEndpoint, activeSheet);
        }
      } catch (e) {
        alert("Failed to delete remote");
      } finally {
        setIsLoading(false);
      }
    } else {
      const newJobs = jobs.filter(j => j.id !== job.id);
      setJobs(newJobs);
      localStorage.setItem(`jobs_${activeSheet}`, JSON.stringify(newJobs));
    }
  };

  // --- UI Helpers ---

  const openForm = (job?: Job) => {
    if (job) {
      setEditingJob(job);
      setFormData(job);
    } else {
      setEditingJob(null);
      setFormData({
        status: Status.APPLIED,
        applyDate: new Date().toISOString().split('T')[0],
        location: 'Remote',
      });
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingJob(null);
    setFormData({});
  };

  const saveConfig = (url: string) => {
    setApiEndpoint(url);
    localStorage.setItem('gas_endpoint', url);
    if (url) {
      fetchJobs(url, activeSheet);
    }
    setShowConfig(false);
  };

  // --- Derived State ---

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch =
        job.company.toLowerCase().includes(search.toLowerCase()) ||
        job.position.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || job.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  const stats = useMemo(() => {
    const counts = {
      [Status.APPLIED]: 0,
      [Status.CONTACTED]: 0,
      [Status.INTERVIEW]: 0,
      [Status.OFFER]: 0,
      [Status.REJECTED]: 0,
      [Status.GHOSTED]: 0,
    };
    jobs.forEach(j => {
      if (counts[j.status] !== undefined) counts[j.status]++;
    });
    return counts;
  }, [jobs]);

  return (
    <div className="min-h-screen pb-12">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Briefcase size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">JobTrack</h1>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg">
            {SHEET_NAMES.map(name => (
              <button
                key={name}
                onClick={() => setActiveSheet(name)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeSheet === name
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {name}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowConfig(true)}
            className={`p-2 rounded-full hover:bg-slate-100 ${!apiEndpoint ? 'text-orange-500 animate-pulse' : 'text-slate-500'}`}
            title="Connection Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">

        {/* Connection Warning */}
        {!apiEndpoint && (
          <div className="mb-8 bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <HelpCircle className="text-orange-500 shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className="font-semibold text-orange-800">Local Mode</h3>
              <p className="text-sm text-orange-700 mt-1">
                Currently running in local demo mode. Data is saved to your browser.
                To sync with Google Sheets, click the gear icon (top right) and connect your sheet.
              </p>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {Object.entries(stats).map(([status, count]) => (
            <StatCard key={status} title={status} count={count} status={status as Status} />
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as Status | 'ALL')}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button
              onClick={() => apiEndpoint ? fetchJobs(apiEndpoint, activeSheet) : null}
              className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 flex items-center gap-2"
            >
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => openForm()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-md shadow-indigo-200 flex items-center gap-2 w-full md:w-auto justify-center"
            >
              <Plus size={18} />
              Add Application
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold tracking-wider">
                  <th className="px-6 py-4">Company & Position</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Notes</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredJobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Database size={32} className="text-slate-300" />
                        <p>No applications found.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{job.company}</div>
                        <div className="text-sm text-slate-500">{job.position}</div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={job.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-700 flex flex-col gap-0.5">
                          <span className="flex items-center gap-1.5"><span className="text-slate-400">Loc:</span> {job.location}</span>
                          <span className="flex items-center gap-1.5"><span className="text-slate-400">Sal:</span> {job.salary || '-'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {job.applyDate}
                        <div className="text-xs text-slate-400 mt-0.5">Via {job.applyVia}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate" title={job.notes}>
                        {job.notes || '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openForm(job)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => deleteJob(job)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Edit/Add Modal */}
      <Modal
        isOpen={showForm}
        onClose={closeForm}
        title={editingJob ? "Edit Application" : "New Application"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Company</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.company || ''}
                onChange={e => setFormData({ ...formData, company: e.target.value })}
                placeholder="Google, etc."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Position</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.position || ''}
                onChange={e => setFormData({ ...formData, position: e.target.value })}
                placeholder="Frontend Engineer"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
              <select
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.status || Status.APPLIED}
                onChange={e => setFormData({ ...formData, status: e.target.value as Status })}
              >
                {Object.values(Status).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Salary</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.salary || ''}
                onChange={e => setFormData({ ...formData, salary: e.target.value })}
                placeholder="e.g. $100k - $120k"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.location || ''}
                onChange={e => setFormData({ ...formData, location: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Apply Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={formData.applyDate || ''}
                onChange={e => setFormData({ ...formData, applyDate: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Apply Via</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              value={formData.applyVia || ''}
              onChange={e => setFormData({ ...formData, applyVia: e.target.value })}
              placeholder="LinkedIn, Referral, etc."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Notes</label>
            <textarea
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none h-24 resize-none"
              value={formData.notes || ''}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Interview details, specific requirements..."
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button onClick={closeForm} className="flex-1 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={() => saveJob(formData)}
              className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md shadow-indigo-200 transition-colors flex justify-center items-center gap-2"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Application'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Config Modal */}
      <Modal isOpen={showConfig} onClose={() => setShowConfig(false)} title="Google Sheet Connection">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            To connect this app to your Google Sheet, you need to create a simple Apps Script bridge. This allows secure access without complex OAuth setup.
          </p>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-sm">
            <ol className="list-decimal list-inside space-y-2 text-slate-700">
              <li>Open your Google Sheet.</li>
              <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Paste the code below into the editor (replace existing code).</li>
              <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
              <li>Select <strong>Type: Web App</strong>.</li>
              <li>Set <strong>Who has access: Anyone</strong>.</li>
              <li>Click Deploy and copy the <strong>Web App URL</strong>.</li>
            </ol>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Apps Script Code</label>
            <div className="relative">
              <textarea
                readOnly
                className="w-full h-32 px-3 py-2 bg-slate-900 text-slate-200 text-xs font-mono rounded-lg outline-none resize-none p-4"
                value={GAS_CODE}
              />
              <button
                onClick={() => navigator.clipboard.writeText(GAS_CODE)}
                className="absolute top-2 right-2 p-1 bg-white/10 text-white rounded hover:bg-white/20 text-xs"
              >
                Copy
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Web App URL</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="https://script.google.com/macros/s/..."
              value={apiEndpoint}
              onChange={e => setApiEndpoint(e.target.value)}
            />
          </div>

          <div className="pt-4">
            <button
              onClick={() => saveConfig(apiEndpoint)}
              className="w-full py-2.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors"
            >
              Save Connection
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

// Mount
const root = createRoot(document.getElementById('root')!);
root.render(<App />);

export default App;