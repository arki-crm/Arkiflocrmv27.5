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
  Scale,
  Download,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Account group icons and colors
const GROUP_CONFIG = {
  assets: { 
    icon: Wallet, 
    label: 'Assets', 
    bgColor: 'bg-blue-50', 
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    headerBg: 'bg-blue-100'
  },
  liabilities: { 
    icon: Building2, 
    label: 'Liabilities', 
    bgColor: 'bg-orange-50', 
    borderColor: 'border-orange-200',
    textColor: 'text-orange-700',
    headerBg: 'bg-orange-100'
  },
  income: { 
    icon: TrendingUp, 
    label: 'Income', 
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    headerBg: 'bg-green-100'
  },
  expenses: { 
    icon: TrendingDown, 
    label: 'Expenses', 
    bgColor: 'bg-red-50', 
    borderColor: 'border-red-200',
    textColor: 'text-red-700',
    headerBg: 'bg-red-100'
  },
  equity: { 
    icon: DollarSign, 
    label: 'Equity', 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    headerBg: 'bg-purple-100'
  }
};

export default function TrialBalance() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [period, setPeriod] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const formatCurrency = (val) => {
    if (val === null || val === undefined || val === 0) return '—';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      let url = `${API}/finance/trial-balance?period=${period}`;
      if (period === 'custom' && customStart && customEnd) {
        url += `&start_date=${customStart}&end_date=${customEnd}`;
      }
      
      const res = await axios.get(url, { withCredentials: true });
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch trial balance:', error);
      toast.error('Failed to load trial balance');
    } finally {
      setLoading(false);
    }
  }, [period, customStart, customEnd]);

  useEffect(() => {
    if (period !== 'custom' || (customStart && customEnd)) {
      fetchData();
    }
  }, [period, fetchData, customStart, customEnd]);

  const handleCustomDateApply = () => {
    if (customStart && customEnd) {
      fetchData();
    } else {
      toast.error('Please select both start and end dates');
    }
  };

  const exportToExcel = () => {
    if (!data) return;
    
    setExporting(true);
    
    try {
      // Build CSV content
      const rows = [];
      rows.push(['TRIAL BALANCE']);
      rows.push([`Period: ${data.period_label}`]);
      rows.push([`From: ${data.start_date} To: ${data.end_date}`]);
      rows.push([`Generated: ${new Date(data.generated_at).toLocaleString()}`]);
      rows.push([]);
      rows.push(['Account Name', 'Debit (₹)', 'Credit (₹)']);
      rows.push([]);
      
      // Add each group
      const groups = ['assets', 'liabilities', 'income', 'expenses', 'equity'];
      groups.forEach(group => {
        const items = data.trial_balance[group] || [];
        if (items.length > 0) {
          rows.push([GROUP_CONFIG[group].label.toUpperCase()]);
          items.forEach(item => {
            rows.push([
              item.account_name,
              item.debit || '',
              item.credit || ''
            ]);
          });
          // Group subtotal
          const groupDebit = items.reduce((sum, item) => sum + (item.debit || 0), 0);
          const groupCredit = items.reduce((sum, item) => sum + (item.credit || 0), 0);
          rows.push([`Total ${GROUP_CONFIG[group].label}`, groupDebit, groupCredit]);
          rows.push([]);
        }
      });
      
      // Totals
      rows.push([]);
      rows.push(['TOTAL', data.totals.total_debit, data.totals.total_credit]);
      rows.push(['Difference', data.totals.difference, '']);
      rows.push(['Status', data.totals.is_balanced ? 'BALANCED' : 'UNBALANCED', '']);
      
      // Convert to CSV string
      const csvContent = rows.map(row => 
        row.map(cell => {
          if (typeof cell === 'number') return cell.toString();
          if (typeof cell === 'string' && cell.includes(',')) return `"${cell}"`;
          return cell || '';
        }).join(',')
      ).join('\n');
      
      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `trial_balance_${data.period_label.replace(/\s+/g, '_')}.csv`;
      link.click();
      
      toast.success('Excel export downloaded');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export');
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    if (!data) return;
    
    setExporting(true);
    
    try {
      // Create printable HTML
      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Trial Balance - ${data.period_label}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #666; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; font-weight: bold; }
            .group-header { background-color: #e8e8e8; font-weight: bold; }
            .subtotal { font-weight: bold; background-color: #f9f9f9; }
            .total-row { font-weight: bold; background-color: #333; color: white; }
            .debit { text-align: right; }
            .credit { text-align: right; }
            .balanced { color: green; font-weight: bold; }
            .unbalanced { color: red; font-weight: bold; }
            .meta { color: #666; font-size: 11px; margin-bottom: 10px; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Trial Balance</h1>
          <h2>${data.period_label}</h2>
          <p class="meta">Period: ${data.start_date} to ${data.end_date} | Generated: ${new Date(data.generated_at).toLocaleString()}</p>
          
          <table>
            <thead>
              <tr>
                <th style="width: 60%">Account Name</th>
                <th class="debit" style="width: 20%">Debit (₹)</th>
                <th class="credit" style="width: 20%">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${['assets', 'liabilities', 'income', 'expenses', 'equity'].map(group => {
                const items = data.trial_balance[group] || [];
                if (items.length === 0) return '';
                
                const groupDebit = items.reduce((sum, item) => sum + (item.debit || 0), 0);
                const groupCredit = items.reduce((sum, item) => sum + (item.credit || 0), 0);
                
                return `
                  <tr class="group-header">
                    <td colspan="3">${GROUP_CONFIG[group].label.toUpperCase()}</td>
                  </tr>
                  ${items.map(item => `
                    <tr>
                      <td>${item.account_name}</td>
                      <td class="debit">${item.debit ? item.debit.toLocaleString('en-IN') : '—'}</td>
                      <td class="credit">${item.credit ? item.credit.toLocaleString('en-IN') : '—'}</td>
                    </tr>
                  `).join('')}
                  <tr class="subtotal">
                    <td>Total ${GROUP_CONFIG[group].label}</td>
                    <td class="debit">${groupDebit.toLocaleString('en-IN')}</td>
                    <td class="credit">${groupCredit.toLocaleString('en-IN')}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td>GRAND TOTAL</td>
                <td class="debit">${data.totals.total_debit.toLocaleString('en-IN')}</td>
                <td class="credit">${data.totals.total_credit.toLocaleString('en-IN')}</td>
              </tr>
            </tbody>
          </table>
          
          <p style="margin-top: 20px;">
            <strong>Difference:</strong> ₹${data.totals.difference.toLocaleString('en-IN')} | 
            <strong>Status:</strong> <span class="${data.totals.is_balanced ? 'balanced' : 'unbalanced'}">
              ${data.totals.is_balanced ? '✓ BALANCED' : '✗ UNBALANCED'}
            </span>
          </p>
          
          <p class="meta" style="margin-top: 30px;">
            Net Profit/Loss: ₹${data.summary.net_profit_loss.toLocaleString('en-IN')}
          </p>
        </body>
        </html>
      `;
      
      // Open print dialog
      const printWindow = window.open('', '_blank');
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
      
      toast.success('PDF print dialog opened');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to generate PDF');
    } finally {
      setExporting(false);
    }
  };

  const AccountGroup = ({ group, items }) => {
    if (!items || items.length === 0) return null;
    
    const config = GROUP_CONFIG[group];
    const Icon = config.icon;
    
    const groupDebit = items.reduce((sum, item) => sum + (item.debit || 0), 0);
    const groupCredit = items.reduce((sum, item) => sum + (item.credit || 0), 0);
    
    return (
      <div className={cn("rounded-lg border mb-4", config.borderColor, config.bgColor)}>
        <div className={cn("flex items-center gap-2 px-4 py-3 rounded-t-lg", config.headerBg)}>
          <Icon className={cn("w-5 h-5", config.textColor)} />
          <span className={cn("font-semibold", config.textColor)}>{config.label}</span>
          <Badge variant="outline" className="ml-auto">
            {items.length} account{items.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[50%]">Account Name</TableHead>
              <TableHead className="text-right w-[25%]">Debit</TableHead>
              <TableHead className="text-right w-[25%]">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={idx} className="hover:bg-white/50">
                <TableCell className="font-medium">{item.account_name}</TableCell>
                <TableCell className="text-right font-mono">
                  {item.debit > 0 ? formatCurrency(item.debit) : '—'}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {item.credit > 0 ? formatCurrency(item.credit) : '—'}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className={cn("font-semibold", config.headerBg, "hover:bg-transparent")}>
              <TableCell>Total {config.label}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(groupDebit)}</TableCell>
              <TableCell className="text-right font-mono">{formatCurrency(groupCredit)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="trial-balance-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto" data-testid="trial-balance-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="w-7 h-7 text-blue-600" />
            Trial Balance
          </h1>
          <p className="text-gray-500 mt-1">
            Double-entry accounting verification report
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            data-testid="refresh-trial-balance"
          >
            <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={exporting || !data}
            data-testid="export-excel-btn"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToPDF}
            disabled={exporting || !data}
            data-testid="export-pdf-btn"
          >
            <FileText className="w-4 h-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="w-48">
              <Label className="text-sm text-gray-600 mb-1.5 block">Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger data-testid="period-select">
                  <SelectValue placeholder="Select period" />
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
                <div className="w-40">
                  <Label className="text-sm text-gray-600 mb-1.5 block">From Date</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    data-testid="custom-start-date"
                  />
                </div>
                <div className="w-40">
                  <Label className="text-sm text-gray-600 mb-1.5 block">To Date</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    data-testid="custom-end-date"
                  />
                </div>
                <Button 
                  onClick={handleCustomDateApply}
                  disabled={!customStart || !customEnd}
                  data-testid="apply-custom-dates"
                >
                  Apply
                </Button>
              </>
            )}
            
            {data && (
              <div className="ml-auto text-sm text-gray-500">
                Period: <span className="font-medium text-gray-700">{data.period_label}</span>
                <span className="mx-2">|</span>
                {data.start_date} to {data.end_date}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Income</p>
              <p className="text-xl font-bold text-green-600">
                {formatCurrency(data.summary.total_income)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Expenses</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(data.summary.total_expenses)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Net Profit/Loss</p>
              <p className={cn(
                "text-xl font-bold",
                data.summary.net_profit_loss >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {formatCurrency(data.summary.net_profit_loss)}
              </p>
            </CardContent>
          </Card>
          <Card className={cn(
            data.totals.is_balanced ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
          )}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Balance Status</p>
              <div className="flex items-center gap-2 mt-1">
                {data.totals.is_balanced ? (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <span className="text-lg font-bold text-green-700">Balanced</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <span className="text-lg font-bold text-red-700">Mismatch</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Trial Balance Table */}
      {data && (
        <div data-testid="trial-balance-content">
          {/* Account Groups */}
          <AccountGroup group="assets" items={data.trial_balance.assets} />
          <AccountGroup group="liabilities" items={data.trial_balance.liabilities} />
          <AccountGroup group="income" items={data.trial_balance.income} />
          <AccountGroup group="expenses" items={data.trial_balance.expenses} />
          <AccountGroup group="equity" items={data.trial_balance.equity} />
          
          {/* Grand Totals */}
          <Card className={cn(
            "mt-6",
            data.totals.is_balanced 
              ? "border-2 border-green-500 bg-green-50" 
              : "border-2 border-red-500 bg-red-50"
          )}>
            <CardContent className="py-4">
              <Table>
                <TableBody>
                  <TableRow className="hover:bg-transparent border-none">
                    <TableCell className="w-[50%] text-lg font-bold">GRAND TOTAL</TableCell>
                    <TableCell className="text-right w-[25%] text-lg font-bold font-mono">
                      {formatCurrency(data.totals.total_debit)}
                    </TableCell>
                    <TableCell className="text-right w-[25%] text-lg font-bold font-mono">
                      {formatCurrency(data.totals.total_credit)}
                    </TableCell>
                  </TableRow>
                  {!data.totals.is_balanced && (
                    <TableRow className="hover:bg-transparent border-none">
                      <TableCell className="text-red-600 font-semibold">Difference</TableCell>
                      <TableCell className="text-right text-red-600 font-mono font-semibold" colSpan={2}>
                        {formatCurrency(Math.abs(data.totals.difference))}
                        <span className="text-sm ml-2">
                          ({data.totals.difference > 0 ? 'Debit excess' : 'Credit excess'})
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {data && Object.values(data.trial_balance).every(arr => arr.length === 0) && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Scale className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No transactions found</h3>
            <p className="text-gray-500 mt-1">
              No accounting transactions exist for the selected period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
