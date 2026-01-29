import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { History, Search, Filter, ChevronLeft, ChevronRight, Eye, Calendar, User, FileText } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

const ENTITY_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'cashbook', label: 'Cashbook' },
  { value: 'receipt', label: 'Receipts' },
  { value: 'liability', label: 'Liabilities' },
  { value: 'project_finance', label: 'Project Finance' },
  { value: 'recurring_template', label: 'Recurring Templates' },
  { value: 'payment_reminder', label: 'Payment Reminders' },
  { value: 'system', label: 'System' }
];

const ACTION_TYPES = [
  { value: 'all', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'edit', label: 'Edit' },
  { value: 'delete', label: 'Delete' },
  { value: 'verify', label: 'Verify' },
  { value: 'settle', label: 'Settle' },
  { value: 'freeze', label: 'Freeze/Unfreeze' },
  { value: 'lock_override', label: 'Lock Override' },
  { value: 'allow_overrun', label: 'Allow Overrun' },
  { value: 'backup_created', label: 'Backup Created' },
  { value: 'backup_restored', label: 'Backup Restored' }
];

const getActionBadgeColor = (action) => {
  switch (action) {
    case 'create': return 'bg-green-100 text-green-800';
    case 'edit': return 'bg-blue-100 text-blue-800';
    case 'delete': return 'bg-red-100 text-red-800';
    case 'verify': return 'bg-purple-100 text-purple-800';
    case 'settle': return 'bg-emerald-100 text-emerald-800';
    case 'freeze': return 'bg-orange-100 text-orange-800';
    case 'lock_override': return 'bg-yellow-100 text-yellow-800';
    case 'allow_overrun': return 'bg-amber-100 text-amber-800';
    case 'backup_created': return 'bg-cyan-100 text-cyan-800';
    case 'backup_restored': return 'bg-indigo-100 text-indigo-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getEntityIcon = (entityType) => {
  switch (entityType) {
    case 'cashbook': return '💰';
    case 'receipt': return '🧾';
    case 'liability': return '📋';
    case 'project_finance': return '📊';
    case 'recurring_template': return '🔄';
    case 'payment_reminder': return '📧';
    case 'system': return '⚙️';
    default: return '📄';
  }
};

export default function AuditTrail() {
  const { token, user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [selectedEntry, setSelectedEntry] = useState(null);
  
  // Filters
  const [entityType, setEntityType] = useState('all');
  const [action, setAction] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchUserId, setSearchUserId] = useState('');
  
  // Pagination
  const [page, setPage] = useState(0);
  const limit = 50;

  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (entityType !== 'all') params.append('entity_type', entityType);
      if (action !== 'all') params.append('action', action);
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);
      if (searchUserId) params.append('user_id', searchUserId);
      params.append('limit', limit.toString());
      params.append('skip', (page * limit).toString());
      
      const res = await fetch(`${API}/api/finance/audit-log?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch audit log');
      }
      
      const data = await res.json();
      setEntries(data.entries || []);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLog();
  }, [page, entityType, action, dateFrom, dateTo]);

  const handleSearch = () => {
    setPage(0);
    fetchAuditLog();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const totalPages = Math.ceil(total / limit);

  // Access check
  if (!user || !['Admin', 'Founder'].includes(user.role)) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Access Denied. Only Admin and Founder can view the audit trail.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="audit-trail-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Audit Trail</h1>
            <p className="text-sm text-slate-500">Track all finance-related actions</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm">
          {total.toLocaleString()} entries
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Entity Type</label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger data-testid="filter-entity-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">Action</label>
              <Select value={action} onValueChange={setAction}>
                <SelectTrigger data-testid="filter-action">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">From Date</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                data-testid="filter-date-from"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">To Date</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                data-testid="filter-date-to"
              />
            </div>
            
            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">User ID</label>
              <Input
                placeholder="User ID..."
                value={searchUserId}
                onChange={(e) => setSearchUserId(e.target.value)}
                data-testid="filter-user-id"
              />
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full" data-testid="search-btn">
                <Search className="w-4 h-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading audit trail...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No audit entries found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium text-slate-600">Timestamp</th>
                    <th className="text-left p-3 font-medium text-slate-600">Entity</th>
                    <th className="text-left p-3 font-medium text-slate-600">Action</th>
                    <th className="text-left p-3 font-medium text-slate-600">User</th>
                    <th className="text-left p-3 font-medium text-slate-600">Details</th>
                    <th className="text-center p-3 font-medium text-slate-600">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry, idx) => (
                    <tr key={entry.audit_id || idx} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-600 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formatDate(entry.timestamp)}
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span>{getEntityIcon(entry.entity_type)}</span>
                          <div>
                            <div className="font-medium text-slate-700 capitalize">
                              {entry.entity_type?.replace('_', ' ')}
                            </div>
                            <div className="text-xs text-slate-400 font-mono">
                              {entry.entity_id}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={`${getActionBadgeColor(entry.action)} capitalize`}>
                          {entry.action?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          <div>
                            <div className="text-slate-700">{entry.user_name || '-'}</div>
                            <div className="text-xs text-slate-400">{entry.user_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-slate-600 max-w-xs truncate">
                        {entry.details || '-'}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedEntry(entry)}
                          data-testid={`view-entry-${idx}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-slate-500">
                Showing {page * limit + 1} - {Math.min((page + 1) * limit, total)} of {total}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-600">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Audit Entry Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500">Audit ID</label>
                  <p className="font-mono text-sm">{selectedEntry.audit_id}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Timestamp</label>
                  <p className="text-sm">{formatDate(selectedEntry.timestamp)}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Entity Type</label>
                  <p className="text-sm capitalize">{selectedEntry.entity_type?.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Entity ID</label>
                  <p className="font-mono text-sm">{selectedEntry.entity_id}</p>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Action</label>
                  <Badge className={getActionBadgeColor(selectedEntry.action)}>
                    {selectedEntry.action}
                  </Badge>
                </div>
                <div>
                  <label className="text-xs text-slate-500">User</label>
                  <p className="text-sm">{selectedEntry.user_name} ({selectedEntry.user_id})</p>
                </div>
              </div>
              
              {selectedEntry.details && (
                <div>
                  <label className="text-xs text-slate-500">Details</label>
                  <p className="text-sm bg-slate-50 p-3 rounded mt-1">{selectedEntry.details}</p>
                </div>
              )}
              
              {selectedEntry.old_value && Object.keys(selectedEntry.old_value).length > 0 && (
                <div>
                  <label className="text-xs text-slate-500">Previous Values</label>
                  <pre className="text-xs bg-red-50 text-red-800 p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedEntry.old_value, null, 2)}
                  </pre>
                </div>
              )}
              
              {selectedEntry.new_value && Object.keys(selectedEntry.new_value).length > 0 && (
                <div>
                  <label className="text-xs text-slate-500">New Values</label>
                  <pre className="text-xs bg-green-50 text-green-800 p-3 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(selectedEntry.new_value, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => setSelectedEntry(null)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
