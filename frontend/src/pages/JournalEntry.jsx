import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Textarea } from '../components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Loader2, 
  FileText,
  Plus,
  Search,
  Download,
  Eye,
  RotateCcw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function JournalEntry() {
  const { user } = useAuth();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showReverseDialog, setShowReverseDialog] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Create form state
  const [jeDate, setJeDate] = useState(new Date().toISOString().split('T')[0]);
  const [jeNarration, setJeNarration] = useState('');
  const [jeLines, setJeLines] = useState([
    { account_id: '', debit: '', credit: '', narration: '' },
    { account_id: '', debit: '', credit: '', narration: '' }
  ]);
  
  // Reversal form state
  const [reversalReason, setReversalReason] = useState('');
  const [reversalDate, setReversalDate] = useState(new Date().toISOString().split('T')[0]);

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === 0 || val === '') return '—';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('page', page);
      params.append('limit', 20);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (searchQuery) params.append('search', searchQuery);
      
      const res = await axios.get(`${API}/finance/journal-entries?${params}`, { 
        withCredentials: true 
      });
      setEntries(res.data.entries || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.total_pages || 1);
    } catch (err) {
      console.error('Failed to fetch journal entries:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied - You do not have permission to view Journal Entries');
      } else {
        toast.error('Failed to load journal entries');
      }
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, startDate, endDate, searchQuery]);

  const fetchAccounts = useCallback(async () => {
    try {
      const [accountsRes, categoriesRes] = await Promise.all([
        axios.get(`${API}/finance/accounts`, { withCredentials: true }).catch(() => ({ data: [] })),
        axios.get(`${API}/finance/categories`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setAccounts(accountsRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
    fetchAccounts();
  }, [fetchEntries, fetchAccounts]);

  // Calculate totals for JE form
  const totalDebit = jeLines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
  const totalCredit = jeLines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
  const hasDebitAndCredit = jeLines.some(l => parseFloat(l.debit) > 0) && jeLines.some(l => parseFloat(l.credit) > 0);

  const addLine = () => {
    setJeLines([...jeLines, { account_id: '', debit: '', credit: '', narration: '' }]);
  };

  const removeLine = (index) => {
    if (jeLines.length <= 2) {
      toast.error('Minimum 2 lines required');
      return;
    }
    setJeLines(jeLines.filter((_, i) => i !== index));
  };

  const updateLine = (index, field, value) => {
    const newLines = [...jeLines];
    newLines[index][field] = value;
    
    // Auto-clear opposite field when entering amount
    if (field === 'debit' && value) {
      newLines[index].credit = '';
    } else if (field === 'credit' && value) {
      newLines[index].debit = '';
    }
    
    setJeLines(newLines);
  };

  const resetForm = () => {
    setJeDate(new Date().toISOString().split('T')[0]);
    setJeNarration('');
    setJeLines([
      { account_id: '', debit: '', credit: '', narration: '' },
      { account_id: '', debit: '', credit: '', narration: '' }
    ]);
  };

  const handleCreate = async () => {
    if (!jeNarration.trim()) {
      toast.error('Narration is required');
      return;
    }
    if (!isBalanced) {
      toast.error('Total Debit must equal Total Credit');
      return;
    }
    if (!hasDebitAndCredit) {
      toast.error('Must have at least one Debit and one Credit line');
      return;
    }
    
    // Validate all lines have account selected
    const invalidLines = jeLines.filter(l => !l.account_id || (!l.debit && !l.credit));
    if (invalidLines.length > 0) {
      toast.error('All lines must have an account and amount');
      return;
    }
    
    try {
      setSubmitting(true);
      const payload = {
        date: jeDate,
        narration: jeNarration,
        lines: jeLines.map(l => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          narration: l.narration
        }))
      };
      
      const res = await axios.post(`${API}/finance/journal-entries`, payload, {
        withCredentials: true
      });
      
      toast.success(res.data.message || 'Journal Entry created successfully');
      setShowCreateDialog(false);
      resetForm();
      fetchEntries();
    } catch (err) {
      console.error('Failed to create JE:', err);
      toast.error(err.response?.data?.detail || 'Failed to create Journal Entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReverse = async () => {
    if (!selectedEntry) return;
    if (!reversalReason.trim()) {
      toast.error('Reversal reason is required');
      return;
    }
    
    try {
      setSubmitting(true);
      const res = await axios.post(
        `${API}/finance/journal-entries/${selectedEntry.je_id}/reverse`,
        { reason: reversalReason, date: reversalDate },
        { withCredentials: true }
      );
      
      toast.success(res.data.message || 'Reversal entry created successfully');
      setShowReverseDialog(false);
      setSelectedEntry(null);
      setReversalReason('');
      fetchEntries();
    } catch (err) {
      console.error('Failed to reverse JE:', err);
      toast.error(err.response?.data?.detail || 'Failed to create reversal');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      
      const res = await axios.get(`${API}/finance/journal-entries/export/excel?${params}`, {
        withCredentials: true
      });
      
      // Build CSV
      const rows = res.data.rows || [];
      if (rows.length === 0) {
        toast.error('No data to export');
        return;
      }
      
      const headers = ['Reference', 'Date', 'Narration', 'Account', 'Debit', 'Credit', 'Status', 'Created By', 'Created Date'];
      const csvRows = [headers.join(',')];
      
      rows.forEach(row => {
        csvRows.push([
          row.reference_number,
          row.date,
          `"${(row.narration || '').replace(/"/g, '""')}"`,
          `"${(row.account_name || '').replace(/"/g, '""')}"`,
          row.debit || 0,
          row.credit || 0,
          row.status,
          row.created_by,
          row.created_at
        ].join(','));
      });
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `journal_entries_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      
      toast.success('Export downloaded');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export');
    }
  };

  const getAccountOptions = () => {
    const options = [];
    
    // Add finance accounts
    accounts.forEach(acc => {
      options.push({
        id: acc.account_id,
        name: acc.account_name || acc.name,
        type: 'Account'
      });
    });
    
    // Add categories as accounts
    categories.forEach(cat => {
      options.push({
        id: cat.category_id,
        name: cat.name,
        type: 'Category'
      });
    });
    
    return options;
  };

  const viewEntry = (entry) => {
    setSelectedEntry(entry);
    setShowViewDialog(true);
  };

  const openReverseDialog = (entry) => {
    setSelectedEntry(entry);
    setReversalDate(new Date().toISOString().split('T')[0]);
    setReversalReason('');
    setShowReverseDialog(true);
  };

  if (loading && entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="je-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="journal-entry-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-blue-600" />
            Journal Entry
          </h1>
          <p className="text-gray-500 mt-1">
            Manual accounting adjustments
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchEntries}
            disabled={loading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-testid="export-btn"
          >
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            data-testid="create-je-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Journal Entry
          </Button>
        </div>
      </div>

      {/* Warning Banner */}
      <Alert className="mb-6 border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>Warning:</strong> Do NOT use Journal Entry for operational transactions (sales, purchase, salary, receipts). 
          Use the respective modules for those transactions.
        </AlertDescription>
      </Alert>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-40">
              <Label className="text-sm text-gray-600 mb-1.5 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="status-filter">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="reversed">Reversed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <Label className="text-sm text-gray-600 mb-1.5 block">From Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="start-date-filter"
              />
            </div>
            
            <div className="w-40">
              <Label className="text-sm text-gray-600 mb-1.5 block">To Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="end-date-filter"
              />
            </div>
            
            <div className="flex-1 min-w-[200px]">
              <Label className="text-sm text-gray-600 mb-1.5 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by reference or narration..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                  data-testid="search-input"
                />
              </div>
            </div>
            
            <Button 
              variant="outline" 
              onClick={() => {
                setStatusFilter('all');
                setStartDate('');
                setEndDate('');
                setSearchQuery('');
                setPage(1);
              }}
            >
              <Filter className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entries Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-[30%]">Narration</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    No journal entries found
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.je_id} className={cn(entry.is_reversed && "opacity-60")}>
                    <TableCell className="font-mono font-medium">
                      {entry.reference_number}
                    </TableCell>
                    <TableCell>{entry.date}</TableCell>
                    <TableCell className="truncate max-w-[300px]" title={entry.narration}>
                      {entry.narration}
                      {entry.reversal_of_je && (
                        <Badge variant="outline" className="ml-2 text-xs">Reversal</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(entry.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(entry.total_credit)}
                    </TableCell>
                    <TableCell>
                      {entry.is_reversed ? (
                        <Badge variant="destructive" className="text-xs">
                          <XCircle className="w-3 h-3 mr-1" />
                          Reversed
                        </Badge>
                      ) : (
                        <Badge variant="default" className="bg-green-100 text-green-700 text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Posted
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {entry.created_by_name}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => viewEntry(entry)}
                          data-testid={`view-je-${entry.je_id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {!entry.is_reversed && !entry.reversal_of_je && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openReverseDialog(entry)}
                            className="text-amber-600 hover:text-amber-700"
                            data-testid={`reverse-je-${entry.je_id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-gray-500">
                Showing {entries.length} of {total} entries
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Journal Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              New Journal Entry
            </DialogTitle>
            <DialogDescription>
              Create a manual accounting adjustment. All entries are auto-posted.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Warning */}
            <Alert className="border-amber-200 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm">
                Do NOT use for operational transactions. Use Receipt, Purchase, or Salary modules instead.
              </AlertDescription>
            </Alert>
            
            {/* Date & Narration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={jeDate}
                  onChange={(e) => setJeDate(e.target.value)}
                  data-testid="je-date"
                />
              </div>
              <div>
                <Label>Narration *</Label>
                <Input
                  placeholder="Description of the adjustment..."
                  value={jeNarration}
                  onChange={(e) => setJeNarration(e.target.value)}
                  data-testid="je-narration"
                />
              </div>
            </div>
            
            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Line Items</Label>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Line
                </Button>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[35%]">Account</TableHead>
                    <TableHead className="w-[15%]">Debit</TableHead>
                    <TableHead className="w-[15%]">Credit</TableHead>
                    <TableHead className="w-[25%]">Line Narration</TableHead>
                    <TableHead className="w-[10%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jeLines.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <Select
                          value={line.account_id}
                          onValueChange={(val) => updateLine(idx, 'account_id', val)}
                        >
                          <SelectTrigger data-testid={`je-line-${idx}-account`}>
                            <SelectValue placeholder="Select account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {getAccountOptions().map(opt => (
                              <SelectItem key={opt.id} value={opt.id}>
                                {opt.name} <span className="text-gray-400 text-xs">({opt.type})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.debit}
                          onChange={(e) => updateLine(idx, 'debit', e.target.value)}
                          className="text-right"
                          data-testid={`je-line-${idx}-debit`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          placeholder="0"
                          value={line.credit}
                          onChange={(e) => updateLine(idx, 'credit', e.target.value)}
                          className="text-right"
                          data-testid={`je-line-${idx}-credit`}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          placeholder="Optional note..."
                          value={line.narration}
                          onChange={(e) => updateLine(idx, 'narration', e.target.value)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(idx)}
                          disabled={jeLines.length <= 2}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Totals Row */}
              <div className={cn(
                "flex justify-end mt-2 p-3 rounded-lg",
                isBalanced && hasDebitAndCredit ? "bg-green-50" : "bg-red-50"
              )}>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Debit</p>
                    <p className="font-mono font-bold">{formatCurrency(totalDebit)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total Credit</p>
                    <p className="font-mono font-bold">{formatCurrency(totalCredit)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBalanced && hasDebitAndCredit ? (
                      <Badge className="bg-green-100 text-green-700">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Balanced
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        {!hasDebitAndCredit ? 'Need Debit & Credit' : `Diff: ${formatCurrency(Math.abs(totalDebit - totalCredit))}`}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={submitting || !isBalanced || !hasDebitAndCredit || !jeNarration}
              data-testid="submit-je-btn"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Post Journal Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Journal Entry Dialog */}
      <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              {selectedEntry?.reference_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium">{selectedEntry.date}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  {selectedEntry.is_reversed ? (
                    <Badge variant="destructive">Reversed</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-700">Posted</Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created By</p>
                  <p className="font-medium">{selectedEntry.created_by_name}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-gray-500">Narration</p>
                <p className="font-medium">{selectedEntry.narration}</p>
              </div>
              
              {selectedEntry.reversal_of_je && (
                <Alert className="border-blue-200 bg-blue-50">
                  <AlertDescription className="text-blue-800">
                    This is a reversal entry for {selectedEntry.reversal_of_je}
                  </AlertDescription>
                </Alert>
              )}
              
              {selectedEntry.reversed_by_je && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertDescription className="text-amber-800">
                    Reversed by {selectedEntry.reversed_by_je} on {selectedEntry.reversed_at?.split('T')[0]}
                  </AlertDescription>
                </Alert>
              )}
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEntry.lines?.map((line, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{line.account_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {line.debit > 0 ? formatCurrency(line.debit) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {line.credit > 0 ? formatCurrency(line.credit) : '—'}
                      </TableCell>
                      <TableCell className="text-gray-600 text-sm">{line.narration || '—'}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-gray-50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(selectedEntry.total_debit)}</TableCell>
                    <TableCell className="text-right font-mono">{formatCurrency(selectedEntry.total_credit)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <div className="text-xs text-gray-400 pt-2 border-t">
                Created: {selectedEntry.created_at} by {selectedEntry.created_by_name}
                {selectedEntry.reversed_at && (
                  <> · Reversed: {selectedEntry.reversed_at} by {selectedEntry.reversed_by_name}</>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reverse Confirmation Dialog */}
      <AlertDialog open={showReverseDialog} onOpenChange={setShowReverseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-amber-600" />
              Reverse Journal Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will create a reversal entry with opposite debit/credit amounts. 
              The original entry will be marked as reversed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedEntry && (
            <div className="space-y-4 py-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="font-mono font-medium">{selectedEntry.reference_number}</p>
                <p className="text-sm text-gray-600">{selectedEntry.narration}</p>
                <p className="text-sm font-medium mt-1">
                  Amount: {formatCurrency(selectedEntry.total_debit)}
                </p>
              </div>
              
              <div>
                <Label>Reversal Date</Label>
                <Input
                  type="date"
                  value={reversalDate}
                  onChange={(e) => setReversalDate(e.target.value)}
                />
              </div>
              
              <div>
                <Label>Reason for Reversal *</Label>
                <Textarea
                  placeholder="Explain why this entry is being reversed..."
                  value={reversalReason}
                  onChange={(e) => setReversalReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReverse}
              disabled={submitting || !reversalReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Reversal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
