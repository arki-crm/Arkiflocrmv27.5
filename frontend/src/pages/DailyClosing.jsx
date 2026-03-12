import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
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
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  Loader2, 
  ChevronLeft,
  ChevronRight,
  Lock,
  CheckCircle,
  Calendar,
  TrendingUp,
  TrendingDown,
  Eye,
  Download,
  Printer,
  FileSpreadsheet,
  Filter,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, getLocalDateString } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { 
    weekday: 'long',
    day: '2-digit', 
    month: 'long', 
    year: 'numeric' 
  });
};

const DailyClosing = () => {
  const { hasPermission } = useAuth();
  // P2-FIX: Use getLocalDateString for correct local date
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [history, setHistory] = useState([]);
  
  // Detailed view state
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [detailedDate, setDetailedDate] = useState(null);
  const [detailedData, setDetailedData] = useState(null);
  const [loadingDetailed, setLoadingDetailed] = useState(false);
  const [detailFilter, setDetailFilter] = useState({
    account: 'all',
    type: 'all',
    search: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [closingRes, historyRes] = await Promise.all([
        axios.get(`${API}/finance/daily-closing`, {
          params: { date: selectedDate },
          withCredentials: true
        }),
        axios.get(`${API}/finance/daily-closing/history`, {
          params: { limit: 10 },
          withCredentials: true
        })
      ]);
      setData(closingRes.data);
      setHistory(historyRes.data);
    } catch (error) {
      console.error('Failed to fetch daily closing:', error);
      toast.error('Failed to load daily closing data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch detailed transactions for a specific date
  const fetchDetailedTransactions = async (date) => {
    try {
      setLoadingDetailed(true);
      setDetailedDate(date);
      setShowDetailedView(true);
      setDetailFilter({ account: 'all', type: 'all', search: '' });
      
      const response = await axios.get(`${API}/finance/daily-closing/${date}/transactions`, {
        withCredentials: true
      });
      setDetailedData(response.data);
    } catch (error) {
      console.error('Failed to fetch detailed transactions:', error);
      toast.error('Failed to load transaction details');
      setShowDetailedView(false);
    } finally {
      setLoadingDetailed(false);
    }
  };

  // Filter transactions in detailed view
  const getFilteredTransactions = () => {
    if (!detailedData?.transactions) return [];
    
    return detailedData.transactions.filter(txn => {
      // Account filter
      if (detailFilter.account !== 'all' && txn.account_id !== detailFilter.account) return false;
      
      // Type filter (inflow/outflow)
      if (detailFilter.type === 'inflow' && txn.transaction_type !== 'inflow') return false;
      if (detailFilter.type === 'outflow' && txn.transaction_type !== 'outflow') return false;
      
      // Search filter
      if (detailFilter.search) {
        const searchLower = detailFilter.search.toLowerCase();
        const searchFields = [
          txn.account_name,
          txn.reference,
          txn.category_name,
          txn.purpose,
          txn.counterparty,
          txn.mode
        ].filter(Boolean).join(' ').toLowerCase();
        
        if (!searchFields.includes(searchLower)) return false;
      }
      
      return true;
    });
  };

  // Export to CSV
  const exportToCSV = () => {
    const transactions = getFilteredTransactions();
    if (transactions.length === 0) {
      toast.error('No transactions to export');
      return;
    }
    
    const headers = ['Time', 'Account', 'Reference', 'Category/Purpose', 'Project/Vendor', 'Mode', 'Inflow', 'Outflow', 'Recorded By'];
    const rows = transactions.map(txn => [
      new Date(txn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      txn.account_name,
      txn.reference,
      txn.purpose || txn.category_name,
      txn.counterparty || '-',
      txn.mode,
      txn.inflow || '',
      txn.outflow || '',
      txn.recorded_by
    ]);
    
    const csvContent = [
      `Daybook - ${detailedDate}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `daybook_${detailedDate}.csv`;
    link.click();
    toast.success('Exported to CSV');
  };

  // Print daybook
  const printDaybook = () => {
    const printWindow = window.open('', '_blank');
    const transactions = getFilteredTransactions();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daybook - ${detailedDate}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 5px; }
          h2 { font-size: 14px; color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .inflow { color: green; }
          .outflow { color: red; }
          .summary { margin-top: 20px; padding: 10px; background: #f9f9f9; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>Daybook</h1>
        <h2>${formatDate(detailedDate)}</h2>
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Account</th>
              <th>Reference</th>
              <th>Category/Purpose</th>
              <th>Project/Vendor</th>
              <th>Mode</th>
              <th>Inflow</th>
              <th>Outflow</th>
            </tr>
          </thead>
          <tbody>
            ${transactions.map(txn => `
              <tr>
                <td>${new Date(txn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${txn.account_name}</td>
                <td>${txn.reference}</td>
                <td>${txn.purpose || txn.category_name}</td>
                <td>${txn.counterparty || '-'}</td>
                <td>${txn.mode}</td>
                <td class="inflow">${txn.inflow ? formatCurrency(txn.inflow) : ''}</td>
                <td class="outflow">${txn.outflow ? formatCurrency(txn.outflow) : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="summary">
          <strong>Summary:</strong> 
          ${transactions.length} transactions | 
          Inflow: ${formatCurrency(transactions.reduce((s, t) => s + (t.inflow || 0), 0))} | 
          Outflow: ${formatCurrency(transactions.reduce((s, t) => s + (t.outflow || 0), 0))} | 
          Net: ${formatCurrency(transactions.reduce((s, t) => s + (t.inflow || 0) - (t.outflow || 0), 0))}
        </div>
        <script>window.print();</script>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleCloseDay = async () => {
    try {
      setClosing(true);
      await axios.post(`${API}/finance/daily-closing/${selectedDate}/close`, {}, {
        withCredentials: true
      });
      toast.success(`Day ${selectedDate} has been closed and locked`);
      fetchData();
    } catch (error) {
      console.error('Failed to close day:', error);
      toast.error(error.response?.data?.detail || 'Failed to close day');
    } finally {
      setClosing(false);
    }
  };

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(getLocalDateString(current));  // P2-FIX
  };

  const isToday = selectedDate === getLocalDateString();  // P2-FIX
  const isFuture = new Date(selectedDate) > new Date();

  if (!hasPermission('finance.daily_closing') && !hasPermission('finance.view_dashboard')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-500">You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-slate-50 min-h-screen" data-testid="daybook-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Daybook
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Daily summary for verification and closing
          </p>
        </div>
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" onClick={() => navigateDate(-1)}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-0 outline-none bg-transparent text-slate-900 font-medium"
          />
        </div>
        <Button variant="outline" size="icon" onClick={() => navigateDate(1)} disabled={isFuture}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        {!isToday && (
          <Button variant="outline" onClick={() => setSelectedDate(getLocalDateString())}>
            Today
          </Button>
        )}
      </div>

      {/* Status Banner */}
      {data?.is_closed && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
          <Lock className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-800">Day Closed</p>
            <p className="text-sm text-green-600">
              Closed by {data.closed_by} on {new Date(data.closed_at).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-slate-500 mb-1">Opening Balance</p>
                <p className="text-xl font-bold text-slate-900">
                  {formatCurrency(data?.totals?.opening)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-green-600 mb-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Inflow
                </p>
                <p className="text-xl font-bold text-green-600">
                  +{formatCurrency(data?.totals?.inflow)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200">
              <CardContent className="p-4">
                <p className="text-xs text-red-600 mb-1 flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" /> Outflow
                </p>
                <p className="text-xl font-bold text-red-600">
                  -{formatCurrency(data?.totals?.outflow)}
                </p>
              </CardContent>
            </Card>
            <Card className="border-slate-200 bg-slate-900">
              <CardContent className="p-4">
                <p className="text-xs text-slate-400 mb-1">Closing Balance</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(data?.totals?.closing)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Account-wise Breakdown */}
          <Card className="border-slate-200">
            <CardHeader className="border-b border-slate-200 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-semibold">
                Account-wise Summary — {formatDate(selectedDate)}
              </CardTitle>
              {data?.accounts?.some(acc => acc.transaction_count > 0) && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fetchDetailedTransactions(selectedDate)}
                  data-testid="view-daybook-btn"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  View Daybook
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {data?.accounts?.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-slate-500">No accounts configured</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Opening</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">In</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Out</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Closing</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Txns</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {data?.accounts?.map((acc) => (
                        <tr key={acc.account_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{acc.account_name}</p>
                            <p className="text-xs text-slate-500 capitalize">{acc.account_type}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-slate-600">
                            {formatCurrency(acc.opening_balance)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-green-600 font-medium">
                            +{formatCurrency(acc.inflow)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm text-red-600 font-medium">
                            -{formatCurrency(acc.outflow)}
                          </td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-slate-900">
                            {formatCurrency(acc.closing_balance)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {acc.transaction_count > 0 ? (
                              <Badge 
                                variant="outline" 
                                className="text-xs cursor-pointer hover:bg-blue-50 hover:border-blue-300"
                                onClick={() => fetchDetailedTransactions(selectedDate)}
                              >
                                {acc.transaction_count}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs text-slate-400">
                                0
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-slate-700">Total</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatCurrency(data?.totals?.opening)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          +{formatCurrency(data?.totals?.inflow)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          -{formatCurrency(data?.totals?.outflow)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-slate-900">
                          {formatCurrency(data?.totals?.closing)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Close Day Button */}
          {!data?.is_closed && hasPermission('finance.close_day') && !isFuture && (
            <div className="flex justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="bg-green-600 hover:bg-green-700" data-testid="close-day-btn">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Close Day
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Close Day?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently lock all transactions for {formatDate(selectedDate)}. 
                      No further edits will be allowed. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleCloseDay}
                      disabled={closing}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {closing && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      Confirm Close
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {/* Recent Closings History */}
          {history.length > 0 && (
            <Card className="border-slate-200">
              <CardHeader className="border-b border-slate-200">
                <CardTitle className="text-lg font-semibold">Recent Closings</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-slate-200">
                  {history.map((closingItem) => (
                    <div 
                      key={closingItem.date}
                      className={cn(
                        "p-4 flex items-center justify-between hover:bg-slate-50",
                        closingItem.date === selectedDate && "bg-blue-50"
                      )}
                    >
                      <div 
                        className="flex items-center gap-3 cursor-pointer flex-1"
                        onClick={() => setSelectedDate(closingItem.date)}
                      >
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{closingItem.date}</p>
                          <p className="text-xs text-slate-500">
                            Closed by {closingItem.closed_by_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <button 
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            onClick={(e) => { e.stopPropagation(); fetchDetailedTransactions(closingItem.date); }}
                            data-testid={`view-daybook-${closingItem.date}`}
                          >
                            {closingItem.transaction_count} transactions
                          </button>
                          <p className={cn(
                            "text-sm font-medium",
                            closingItem.net_change >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {closingItem.net_change >= 0 ? '+' : ''}{formatCurrency(closingItem.net_change)}
                          </p>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); fetchDetailedTransactions(closingItem.date); }}
                          title="View Daybook"
                        >
                          <Eye className="w-4 h-4 text-slate-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Detailed Daybook Dialog */}
      <Dialog open={showDetailedView} onOpenChange={setShowDetailedView}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                <span>Daybook — {detailedDate && formatDate(detailedDate)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV} disabled={loadingDetailed}>
                  <Download className="w-4 h-4 mr-1" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={printDaybook} disabled={loadingDetailed}>
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>

          {loadingDetailed ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : detailedData ? (
            <>
              {/* Summary Bar - Human readable cash movement */}
              <div className="flex-shrink-0 grid grid-cols-4 gap-4 p-3 bg-slate-50 rounded-lg mb-4">
                <div className="text-center">
                  <p className="text-xs text-slate-500">Transactions</p>
                  <p className="text-lg font-bold text-slate-900">{detailedData.summary.count}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-green-600">Money In</p>
                  <p className="text-lg font-bold text-green-600">+{formatCurrency(detailedData.summary.money_in || detailedData.summary.total_inflow)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-red-600">Money Out</p>
                  <p className="text-lg font-bold text-red-600">-{formatCurrency(detailedData.summary.money_out || detailedData.summary.total_outflow)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500">Net Cash Movement</p>
                  <p className={cn(
                    "text-lg font-bold",
                    (detailedData.summary.net_cash_movement || detailedData.summary.net) >= 0 ? "text-green-600" : "text-red-600"
                  )}>
                    {(detailedData.summary.net_cash_movement || detailedData.summary.net) >= 0 ? '+' : ''}{formatCurrency(detailedData.summary.net_cash_movement || detailedData.summary.net)}
                  </p>
                </div>
              </div>

              {/* Filters */}
              <div className="flex-shrink-0 flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <Select 
                    value={detailFilter.account} 
                    onValueChange={(v) => setDetailFilter(p => ({ ...p, account: v }))}
                  >
                    <SelectTrigger className="w-[180px] h-8 text-sm">
                      <SelectValue placeholder="All Accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {[...new Map(detailedData.transactions.map(t => [t.account_id, { id: t.account_id, name: t.account_name }])).values()].map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Select 
                  value={detailFilter.type} 
                  onValueChange={(v) => setDetailFilter(p => ({ ...p, type: v }))}
                >
                  <SelectTrigger className="w-[130px] h-8 text-sm">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="inflow">Inflow Only</SelectItem>
                    <SelectItem value="outflow">Outflow Only</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Input
                    placeholder="Search reference, category, vendor..."
                    value={detailFilter.search}
                    onChange={(e) => setDetailFilter(p => ({ ...p, search: e.target.value }))}
                    className="h-8 text-sm pr-8"
                  />
                  {detailFilter.search && (
                    <button 
                      className="absolute right-2 top-1/2 -translate-y-1/2"
                      onClick={() => setDetailFilter(p => ({ ...p, search: '' }))}
                    >
                      <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  )}
                </div>
              </div>

              {/* Transactions Table - One row per business transaction */}
              <div className="flex-1 overflow-auto border rounded-lg">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Time</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Account</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Category</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Project / Vendor</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 uppercase">Mode</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">Narration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {getFilteredTransactions().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                          No transactions match the current filters
                        </td>
                      </tr>
                    ) : (
                      getFilteredTransactions().map((txn) => (
                        <tr key={txn.transaction_id} className="hover:bg-slate-50">
                          <td className="px-3 py-2 text-sm text-slate-600">
                            {new Date(txn.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-3 py-2">
                            <Badge 
                              variant={txn.transaction_type === 'inflow' ? 'default' : 'destructive'}
                              className={cn(
                                "text-xs",
                                txn.transaction_type === 'inflow' 
                                  ? "bg-green-100 text-green-700 hover:bg-green-100" 
                                  : "bg-red-100 text-red-700 hover:bg-red-100"
                              )}
                            >
                              {txn.type || (txn.transaction_type === 'inflow' ? 'Receipt' : 'Expense')}
                            </Badge>
                          </td>
                          <td className={cn(
                            "px-3 py-2 text-right text-sm font-semibold",
                            txn.transaction_type === 'inflow' ? "text-green-600" : "text-red-600"
                          )}>
                            {txn.transaction_type === 'inflow' ? '+' : '-'}₹{(txn.amount || txn.inflow || txn.outflow || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm font-medium text-slate-900">{txn.account_name}</p>
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-sm text-slate-900">{txn.purpose || txn.category_name}</p>
                          </td>
                          <td className="px-3 py-2">
                            {txn.counterparty ? (
                              <span className="text-sm text-slate-600 max-w-[150px] truncate block" title={txn.counterparty}>
                                {txn.counterparty}
                              </span>
                            ) : (
                              <span className="text-sm text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant="secondary" className="text-xs capitalize">
                              {txn.mode}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-sm text-slate-600 max-w-[180px] truncate" title={txn.reference}>
                            {txn.reference}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {getFilteredTransactions().length > 0 && (
                    <tfoot className="bg-slate-100 sticky bottom-0">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 text-sm font-semibold text-slate-700">
                          Total ({getFilteredTransactions().length} transactions)
                        </td>
                        <td colSpan={6} className="px-3 py-2 text-right text-sm">
                          <span className="text-green-600 font-semibold mr-4">
                            In: {formatCurrency(getFilteredTransactions().reduce((s, t) => s + (t.inflow || 0), 0))}
                          </span>
                          <span className="text-red-600 font-semibold">
                            Out: {formatCurrency(getFilteredTransactions().reduce((s, t) => s + (t.outflow || 0), 0))}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
                        <td className="px-3 py-2 text-right text-sm font-bold text-red-600">
                          {formatCurrency(getFilteredTransactions().reduce((s, t) => s + (t.outflow || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DailyClosing;
