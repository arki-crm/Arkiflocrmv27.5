import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
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
  Landmark,
  Calendar,
  Wallet,
  Building2,
  Smartphone,
  CircleDollarSign,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  User,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

// Account type icons and colors
const TYPE_CONFIG = {
  cash: { 
    icon: Wallet, 
    label: 'Cash', 
    bgColor: 'bg-green-50', 
    borderColor: 'border-green-200',
    textColor: 'text-green-700',
    iconBg: 'bg-green-100'
  },
  bank: { 
    icon: Building2, 
    label: 'Bank', 
    bgColor: 'bg-blue-50', 
    borderColor: 'border-blue-200',
    textColor: 'text-blue-700',
    iconBg: 'bg-blue-100'
  },
  upi_wallet: { 
    icon: Smartphone, 
    label: 'UPI / Wallet', 
    bgColor: 'bg-purple-50', 
    borderColor: 'border-purple-200',
    textColor: 'text-purple-700',
    iconBg: 'bg-purple-100'
  },
  other: { 
    icon: CircleDollarSign, 
    label: 'Other', 
    bgColor: 'bg-gray-50', 
    borderColor: 'border-gray-200',
    textColor: 'text-gray-700',
    iconBg: 'bg-gray-100'
  }
};

export default function DailyClosingSnapshot() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '—';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const res = await axios.get(`${API}/finance/daily-snapshot?date=${selectedDate}`, { 
        withCredentials: true 
      });
      setData(res.data);
    } catch (err) {
      console.error('Failed to fetch daily snapshot:', err);
      if (err.response?.status === 403) {
        setError('Access denied. This page is restricted to Founder, CEO, and Finance Manager roles.');
      } else if (err.response?.status === 401) {
        setError('Please log in to view this page.');
      } else {
        setError('Failed to load daily closing snapshot.');
      }
      toast.error(error || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const navigateDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Render account type section
  const AccountTypeSection = ({ type, accounts, total }) => {
    if (!accounts || accounts.length === 0) return null;
    
    const config = TYPE_CONFIG[type] || TYPE_CONFIG.other;
    const Icon = config.icon;
    
    return (
      <Card className={cn("mb-4", config.borderColor, config.bgColor)} data-testid={`account-type-${type}`}>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", config.iconBg)}>
                <Icon className={cn("w-5 h-5", config.textColor)} />
              </div>
              <div>
                <CardTitle className={cn("text-lg", config.textColor)}>
                  {config.label}
                </CardTitle>
                <p className="text-sm text-gray-500">{accounts.length} account{accounts.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Total</p>
              <p className={cn("text-xl font-bold", config.textColor)}>
                {formatCurrency(total)}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40%]">Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Closing Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc, idx) => (
                <TableRow key={acc.account_id || idx} className="hover:bg-white/50">
                  <TableCell>
                    <div>
                      <p className="font-medium">{acc.account_name}</p>
                      {acc.bank_name && (
                        <p className="text-xs text-gray-500">{acc.bank_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {acc.account_type_display}
                    </Badge>
                  </TableCell>
                  <TableCell className={cn(
                    "text-right font-mono font-medium",
                    acc.closing_balance < 0 ? "text-red-600" : ""
                  )}>
                    {formatCurrency(acc.closing_balance)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="daily-snapshot-loading">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto" data-testid="daily-snapshot-error">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-700">{error}</h3>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={fetchData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto" data-testid="daily-snapshot-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Landmark className="w-7 h-7 text-blue-600" />
            Daily Closing Snapshot
          </h1>
          <p className="text-gray-500 mt-1">
            Founder liquidity view - Account balances as of selected date
          </p>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          data-testid="refresh-snapshot"
        >
          <RefreshCw className={cn("w-4 h-4 mr-1", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Date Selector */}
      <Card className="mb-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigateDate(-1)}
                data-testid="prev-date-btn"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-400" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-40"
                  max={new Date().toISOString().split('T')[0]}
                  data-testid="date-selector"
                />
              </div>
              
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigateDate(1)}
                disabled={selectedDate >= new Date().toISOString().split('T')[0]}
                data-testid="next-date-btn"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3">
              {data?.is_today && (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  Today
                </Badge>
              )}
              {!data?.is_today && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={goToToday}
                  data-testid="go-to-today-btn"
                >
                  Go to Today
                </Button>
              )}
              <span className="text-lg font-semibold text-gray-700">
                {data?.date_display}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" data-testid="summary-cards">
          <Card className="bg-green-50 border-green-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet className="w-4 h-4 text-green-600" />
                <p className="text-xs text-green-600 uppercase tracking-wide font-medium">Cash</p>
              </div>
              <p className="text-xl font-bold text-green-700">
                {formatCurrency(data.summary.total_cash)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 className="w-4 h-4 text-blue-600" />
                <p className="text-xs text-blue-600 uppercase tracking-wide font-medium">Bank</p>
              </div>
              <p className="text-xl font-bold text-blue-700">
                {formatCurrency(data.summary.total_bank)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-purple-50 border-purple-200">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Smartphone className="w-4 h-4 text-purple-600" />
                <p className="text-xs text-purple-600 uppercase tracking-wide font-medium">UPI/Wallet</p>
              </div>
              <p className="text-xl font-bold text-purple-700">
                {formatCurrency(data.summary.total_upi_wallet)}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-indigo-500 to-blue-600 border-0">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <Landmark className="w-4 h-4 text-indigo-100" />
                <p className="text-xs text-indigo-100 uppercase tracking-wide font-medium">Total Liquidity</p>
              </div>
              <p className="text-2xl font-bold text-white">
                {formatCurrency(data.summary.total_liquidity || data.summary.grand_total || 0)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* DAILY CASH POSITION - Grouped by Holder */}
      {data && data.by_holder && data.by_holder.length > 0 && (
        <Card className="mb-6" data-testid="cash-position-by-holder">
          <CardHeader className="py-4 bg-gradient-to-r from-slate-50 to-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-slate-600" />
                <CardTitle className="text-lg">Daily Cash Position</CardTitle>
              </div>
              <Badge variant="outline" className="text-xs">
                Grouped by Holder
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.by_holder.map((holderGroup, idx) => (
              <div key={holderGroup.holder || idx} className={cn(
                "border-b last:border-b-0",
                idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
              )}>
                {/* Holder Header */}
                <div className="px-4 py-3 bg-slate-100/80 border-b flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{holderGroup.holder}</span>
                  <span className="text-sm text-slate-500">
                    {holderGroup.accounts.length} account{holderGroup.accounts.length !== 1 ? 's' : ''}
                  </span>
                </div>
                
                {/* Accounts under this holder */}
                <Table>
                  <TableBody>
                    {holderGroup.accounts.map((acc, accIdx) => (
                      <TableRow key={acc.account_id || accIdx} className="hover:bg-slate-50">
                        <TableCell className="pl-8 py-2">
                          <div className="flex items-center gap-2">
                            {acc.account_type === 'bank' && <Building2 className="w-4 h-4 text-blue-500" />}
                            {acc.account_type === 'cash' && <Wallet className="w-4 h-4 text-green-500" />}
                            {acc.account_type === 'upi_wallet' && <Smartphone className="w-4 h-4 text-purple-500" />}
                            <span className="font-medium">{acc.account_name}</span>
                            {acc.bank_name && (
                              <span className="text-xs text-gray-400">({acc.bank_name})</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <span className={cn(
                            "font-mono font-medium",
                            acc.closing_balance < 0 ? "text-red-600" : "text-gray-900"
                          )}>
                            {formatCurrency(acc.closing_balance)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    
                    {/* Subtotal row */}
                    <TableRow className="bg-slate-100/50 border-t">
                      <TableCell className="pl-8 py-2 font-medium text-slate-600">
                        Subtotal
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <span className={cn(
                          "font-mono font-bold",
                          holderGroup.subtotal < 0 ? "text-red-600" : "text-slate-800"
                        )}>
                          {formatCurrency(holderGroup.subtotal)}
                        </span>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
            
            {/* Grand Total */}
            <div className="px-4 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 flex justify-between items-center">
              <span className="text-white font-semibold">Total Liquidity</span>
              <span className="text-white font-bold text-xl font-mono">
                {formatCurrency(data.total_liquidity || data.summary.total_liquidity || 0)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Details by Type (Legacy view - collapsible) */}
      {data && data.by_type && Object.keys(data.by_type).length > 0 && (
        <details className="mb-6" data-testid="accounts-by-type">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
            View by Account Type
          </summary>
          {['cash', 'bank', 'upi_wallet'].map(type => {
            const typeData = data.by_type[type];
            if (!typeData) return null;
            return (
              <AccountTypeSection 
                key={type}
                type={type}
                accounts={typeData.accounts}
                total={typeData.total}
              />
            );
          })}
        </details>
      )}

      {/* Empty State */}
      {data && data.account_count === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Landmark className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600">No accounts found</h3>
            <p className="text-gray-500 mt-1">
              No finance accounts have been set up yet.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Footer Info */}
      {data && (
        <div className="mt-6 text-center text-sm text-gray-400">
          <p>
            Generated at {new Date(data.generated_at).toLocaleString()} · 
            {data.account_count} account{data.account_count !== 1 ? 's' : ''} · 
            Read-only ledger snapshot
          </p>
        </div>
      )}
    </div>
  );
}
