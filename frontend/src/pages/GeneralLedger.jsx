import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  Loader2, 
  BookOpen,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

export default function GeneralLedger() {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [controlAccounts, setControlAccounts] = useState([]);
  const [partyFilters, setPartyFilters] = useState({ customers: [], vendors: [], employees: [], projects: [] });
  const [allAccountsOption, setAllAccountsOption] = useState(null);
  const [error, setError] = useState(null);
  
  // Filters
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedParty, setSelectedParty] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === '' || val === 0) return '—';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  // Fetch available accounts for dropdown
  const fetchAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const res = await axios.get(`${API}/finance/general-ledger/accounts`, {
        withCredentials: true
      });
      setAccounts(res.data.accounts || []);
      setCategories(res.data.categories || []);
      setControlAccounts(res.data.control_accounts || []);
      setAllAccountsOption(res.data.all_accounts_option || null);
      setPartyFilters(res.data.party_filters || { customers: [], vendors: [], employees: [], projects: [] });
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
      if (err.response?.status === 403) {
        setError('Access denied - You do not have permission to view General Ledger');
      }
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  // Fetch ledger data
  const fetchLedger = useCallback(async () => {
    if (!selectedAccount) return;
    
    try {
      setLoading(true);
      setError(null);
      
      let url = `${API}/finance/general-ledger?account_id=${selectedAccount}&period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      // Add party filter if selected (not __all__)
      if (selectedParty && selectedParty !== '__all__') {
        const [partyType, partyId] = selectedParty.split(':');
        url += `&party_id=${partyId}&party_type=${partyType}`;
      }
      // Add project filter if selected (not __all__)
      if (selectedProject && selectedProject !== '__all__') {
        url += `&project_id=${selectedProject}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setLedgerData(res.data);
    } catch (err) {
      console.error('Failed to fetch ledger:', err);
      if (err.response?.status === 403) {
        setError('Access denied');
      } else if (err.response?.status === 404) {
        setError('Account not found');
      } else {
        setError('Failed to load ledger data');
      }
      toast.error(error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedAccount, period, customStart, customEnd]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (selectedAccount && (period !== 'custom' || (customStart && customEnd))) {
      fetchLedger();
    }
  }, [selectedAccount, period, fetchLedger, customStart, customEnd]);

  const handleExport = async () => {
    if (!selectedAccount) return;
    
    try {
      let url = `${API}/finance/general-ledger/export?account_id=${selectedAccount}&period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      const data = res.data;
      
      // Build CSV
      const headers = ['Date', 'Reference', 'Source', 'Narration', 'Debit', 'Credit', 'Balance'];
      const csvRows = [
        [`General Ledger - ${data.account_name}`],
        [`Period: ${data.period_label} (${data.start_date} to ${data.end_date})`],
        [],
        headers.join(',')
      ];
      
      data.rows.forEach(row => {
        csvRows.push([
          row.date,
          row.reference,
          row.source_module,
          `"${(row.narration || '').replace(/"/g, '""')}"`,
          row.debit || '',
          row.credit || '',
          row.balance
        ].join(','));
      });
      
      // Download
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `general_ledger_${data.account_name.replace(/\s+/g, '_')}_${data.period_label.replace(/\s+/g, '_')}.csv`;
      link.click();
      
      toast.success('Export downloaded');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export');
    }
  };

  const getAccountLabel = (id) => {
    const acc = accounts.find(a => a.id === id);
    if (acc) return acc.name;
    const cat = categories.find(c => c.id === id);
    if (cat) return cat.name;
    return id;
  };

  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="ledger-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error && !selectedAccount) {
    return (
      <div className="p-6 max-w-5xl mx-auto" data-testid="ledger-error">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-700">{error}</h3>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="general-ledger-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-blue-600" />
            General Ledger
          </h1>
          <p className="text-gray-500 mt-1">
            Account-wise transaction history with running balance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchLedger}
            disabled={loading || !selectedAccount}
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!ledgerData || loading}
            data-testid="export-btn"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-72">
              <Label className="text-sm text-gray-600 mb-1.5 block">
                Account
              </Label>
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger data-testid="account-select">
                  <SelectValue placeholder="Select an account..." />
                </SelectTrigger>
                <SelectContent>
                  {/* All Accounts Option */}
                  {allAccountsOption && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50">
                        📊 Combined View
                      </div>
                      <SelectItem key={allAccountsOption.id} value={allAccountsOption.id}>
                        <span className="font-medium">{allAccountsOption.name}</span>
                      </SelectItem>
                    </>
                  )}
                  
                  {/* Bank & Cash Accounts (Real Accounts) */}
                  {accounts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-green-600 bg-green-50 mt-1">
                        Bank & Cash Accounts
                      </div>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} <span className="text-gray-400 text-xs">({acc.type})</span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Control Accounts (Customer Advance, Accounts Payable, etc.) */}
                  {controlAccounts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 mt-1">
                        Control Accounts
                      </div>
                      {controlAccounts.map(ctrl => (
                        <SelectItem key={ctrl.id} value={ctrl.id}>
                          {ctrl.name} <span className="text-gray-400 text-xs">{formatCurrency(ctrl.balance)}</span>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  
                  {/* Expense/Income Categories */}
                  {categories.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 bg-gray-50 mt-1">
                        Expense/Income Categories
                      </div>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Party Filter */}
            <div className="w-56">
              <Label className="text-sm text-gray-600 mb-1.5 block">
                Party (Customer/Vendor/Employee)
              </Label>
              <Select value={selectedParty} onValueChange={setSelectedParty}>
                <SelectTrigger data-testid="party-select">
                  <SelectValue placeholder="All Parties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Parties</SelectItem>
                  {partyFilters.customers?.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 mt-1">
                        Customers
                      </div>
                      {partyFilters.customers.map(c => (
                        <SelectItem key={c.id} value={`customer:${c.id}`}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {partyFilters.vendors?.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-orange-600 bg-orange-50 mt-1">
                        Vendors
                      </div>
                      {partyFilters.vendors.map(v => (
                        <SelectItem key={v.id} value={`vendor:${v.id}`}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {partyFilters.employees?.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-purple-600 bg-purple-50 mt-1">
                        Employees
                      </div>
                      {partyFilters.employees.map(e => (
                        <SelectItem key={e.id} value={`employee:${e.id}`}>
                          {e.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            {/* Project Filter */}
            <div className="w-56">
              <Label className="text-sm text-gray-600 mb-1.5 block">
                Project
              </Label>
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger data-testid="project-select">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Projects</SelectItem>
                  {partyFilters.projects?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="w-40">
              <Label className="text-sm text-gray-600 mb-1.5 block">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="fy">Financial Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {period === 'custom' && (
              <>
                <div className="w-36">
                  <Label className="text-sm text-gray-600 mb-1.5 block">From Date</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    data-testid="start-date"
                  />
                </div>
                <div className="w-36">
                  <Label className="text-sm text-gray-600 mb-1.5 block">To Date</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    data-testid="end-date"
                  />
                </div>
              </>
            )}
            
            {ledgerData && (
              <div className="ml-auto text-sm text-gray-500">
                <span className="font-medium text-gray-700">{ledgerData.period_label}</span>
                <span className="mx-2">|</span>
                {ledgerData.start_date} to {ledgerData.end_date}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No Account Selected */}
      {!selectedAccount && (
        <Card className="py-16">
          <CardContent className="text-center">
            <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">Select an Account</h3>
            <p className="text-gray-500 mt-1">
              Choose an account from the dropdown above to view its ledger
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && selectedAccount && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Ledger Data */}
      {!loading && ledgerData && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="summary-cards">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-4">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Opening Balance</p>
                <p className={cn(
                  "text-xl font-bold",
                  ledgerData.summary.opening_balance >= 0 ? "text-blue-700" : "text-red-600"
                )}>
                  {formatCurrency(ledgerData.summary.opening_balance)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-red-50 border-red-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                  <p className="text-xs text-red-600 uppercase tracking-wide font-medium">Total Debit</p>
                </div>
                <p className="text-xl font-bold text-red-700">
                  {formatCurrency(ledgerData.summary.total_debit)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-4">
                <div className="flex items-center gap-1 mb-1">
                  <ArrowUpRight className="w-4 h-4 text-green-600" />
                  <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Total Credit</p>
                </div>
                <p className="text-xl font-bold text-green-700">
                  {formatCurrency(ledgerData.summary.total_credit)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 border-0">
              <CardContent className="py-4">
                <p className="text-xs text-indigo-100 uppercase tracking-wide font-medium">Closing Balance</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(ledgerData.summary.closing_balance)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Account Info */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                {ledgerData.account_name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline">{ledgerData.account_type}</Badge>
                <span className="text-sm text-gray-500">{ledgerData.entry_count} transactions</span>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[100px]">Date</TableHead>
                    <TableHead className="w-[120px]">Reference</TableHead>
                    <TableHead className="w-[100px]">Source</TableHead>
                    <TableHead>Narration</TableHead>
                    <TableHead className="text-right w-[120px]">Debit</TableHead>
                    <TableHead className="text-right w-[120px]">Credit</TableHead>
                    <TableHead className="text-right w-[130px]">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  <TableRow className="bg-blue-50 font-medium">
                    <TableCell>{ledgerData.start_date}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell>Opening Balance</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className={cn(
                      "text-right font-mono font-bold",
                      ledgerData.summary.opening_balance < 0 && "text-red-600"
                    )}>
                      {formatCurrency(ledgerData.summary.opening_balance)}
                    </TableCell>
                  </TableRow>
                  
                  {/* Transaction Rows */}
                  {ledgerData.entries.map((entry, idx) => (
                    <TableRow key={entry.transaction_id || idx} className="hover:bg-gray-50">
                      <TableCell className="text-sm">{entry.date}</TableCell>
                      <TableCell className="font-mono text-xs">{entry.reference}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {entry.source_module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[300px] truncate" title={entry.narration}>
                        {entry.narration || '—'}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono",
                        entry.debit > 0 && "text-red-600 font-medium"
                      )}>
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '—'}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono",
                        entry.credit > 0 && "text-green-600 font-medium"
                      )}>
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '—'}
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-mono font-medium",
                        entry.running_balance < 0 && "text-red-600"
                      )}>
                        {formatCurrency(entry.running_balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  
                  {/* Totals/Closing Row */}
                  <TableRow className="bg-gray-100 font-bold border-t-2">
                    <TableCell colSpan={4} className="text-right">TOTALS / CLOSING</TableCell>
                    <TableCell className="text-right font-mono text-red-700">
                      {formatCurrency(ledgerData.summary.total_debit)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-green-700">
                      {formatCurrency(ledgerData.summary.total_credit)}
                    </TableCell>
                    <TableCell className={cn(
                      "text-right font-mono text-lg",
                      ledgerData.summary.closing_balance < 0 ? "text-red-700" : "text-blue-700"
                    )}>
                      {formatCurrency(ledgerData.summary.closing_balance)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              {/* Empty State */}
              {ledgerData.entries.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No transactions found for this period
                </div>
              )}
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="mt-4 text-center text-sm text-gray-400">
            Generated at {new Date(ledgerData.generated_at).toLocaleString()} · 
            Closing = Opening ({formatCurrency(ledgerData.summary.opening_balance)}) + 
            Credit ({formatCurrency(ledgerData.summary.total_credit)}) − 
            Debit ({formatCurrency(ledgerData.summary.total_debit)})
          </div>
        </>
      )}
    </div>
  );
}
