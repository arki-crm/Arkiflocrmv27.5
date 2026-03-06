import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Calendar } from '../components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
import { 
  RefreshCw, 
  CalendarIcon,
  Wallet,
  Building2,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Landmark
} from 'lucide-react';
import { format, subDays, addDays } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DailyClosingSnapshot() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);

  const formatCurrency = (val) => {
    if (val === null || val === undefined) return '₹0';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(val);
  };

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const response = await fetch(`${API}/api/finance/daily-snapshot?date=${dateStr}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot');
      }
      
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load daily snapshot');
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  const goToPreviousDay = () => {
    setSelectedDate(prev => subDays(prev, 1));
  };

  const goToNextDay = () => {
    const tomorrow = addDays(selectedDate, 1);
    if (tomorrow <= new Date()) {
      setSelectedDate(tomorrow);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="p-6 max-w-4xl mx-auto" data-testid="daily-closing-snapshot">
      {/* Header - Clean layout with title left, refresh right */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Closing Snapshot</h1>
          <p className="text-sm text-gray-500">Founder liquidity view - Account balances by holder</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchSnapshot}
          disabled={loading}
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Date Navigation - Centered */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
          <ChevronLeft className="w-5 h-5" />
        </Button>
        
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="min-w-[140px]">
              <CalendarIcon className="w-4 h-4 mr-2" />
              {format(selectedDate, 'dd/MM/yyyy')}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => {
                if (date) {
                  setSelectedDate(date);
                  setCalendarOpen(false);
                }
              }}
              disabled={(date) => date > new Date()}
            />
          </PopoverContent>
        </Popover>
        
        {!isToday && (
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
        )}
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={goToNextDay}
          disabled={isToday}
        >
          <ChevronRight className="w-5 h-5" />
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : data ? (
        <>
          {/* Summary Row - Cash | Bank | UPI Wallet | Total */}
          <div className="grid grid-cols-4 gap-3 mb-6" data-testid="summary-row">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-medium text-green-600 uppercase">Cash</span>
                </div>
                <p className="text-lg font-bold text-green-700">
                  {formatCurrency(data.summary?.total_cash || 0)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-medium text-blue-600 uppercase">Bank</span>
                </div>
                <p className="text-lg font-bold text-blue-700">
                  {formatCurrency(data.summary?.total_bank || 0)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="w-4 h-4 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600 uppercase">UPI Wallet</span>
                </div>
                <p className="text-lg font-bold text-purple-700">
                  {formatCurrency(data.summary?.total_upi_wallet || 0)}
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-indigo-600 border-0">
              <CardContent className="py-3 px-4">
                <div className="flex items-center gap-2 mb-1">
                  <Landmark className="w-4 h-4 text-indigo-200" />
                  <span className="text-xs font-medium text-indigo-200 uppercase">Total</span>
                </div>
                <p className="text-lg font-bold text-white">
                  {formatCurrency(data.total_liquidity || 0)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Accounts Grouped by Holder */}
          <Card data-testid="accounts-by-holder">
            <CardHeader className="py-3 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Accounts by Holder</CardTitle>
                <Badge variant="outline" className="text-xs">
                  {data.account_count} accounts
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.by_holder && data.by_holder.length > 0 ? (
                <>
                  {data.by_holder.map((holderGroup, idx) => (
                    <div key={holderGroup.holder || idx} className="border-b last:border-b-0">
                      {/* Holder Name Header */}
                      <div className="px-4 py-2 bg-slate-100 font-semibold text-slate-700 flex justify-between items-center">
                        <span>{holderGroup.holder}</span>
                        <span className="text-xs text-slate-500 font-normal">
                          {holderGroup.accounts?.length || 0} account{(holderGroup.accounts?.length || 0) !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      {/* Accounts List */}
                      <div className="divide-y divide-gray-100">
                        {holderGroup.accounts?.map((acc, accIdx) => (
                          <div 
                            key={acc.account_id || accIdx} 
                            className="px-4 py-2 flex justify-between items-center hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              {acc.account_type === 'bank' && <Building2 className="w-4 h-4 text-blue-500" />}
                              {acc.account_type === 'cash' && <Wallet className="w-4 h-4 text-green-500" />}
                              {acc.account_type === 'upi_wallet' && <Smartphone className="w-4 h-4 text-purple-500" />}
                              <span className="text-sm">{acc.account_name}</span>
                            </div>
                            <span className={cn(
                              "font-mono text-sm font-medium",
                              acc.closing_balance < 0 ? "text-red-600" : "text-gray-900"
                            )}>
                              {formatCurrency(acc.closing_balance)}
                            </span>
                          </div>
                        ))}
                        
                        {/* Subtotal Row */}
                        <div className="px-4 py-2 bg-slate-50 flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-600">Subtotal</span>
                          <span className={cn(
                            "font-mono text-sm font-bold",
                            holderGroup.subtotal < 0 ? "text-red-600" : "text-slate-800"
                          )}>
                            {formatCurrency(holderGroup.subtotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Grand Total */}
                  <div className="px-4 py-3 bg-indigo-600 flex justify-between items-center">
                    <span className="font-semibold text-white">Total Liquidity</span>
                    <span className="font-mono text-lg font-bold text-white">
                      {formatCurrency(data.total_liquidity || 0)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-gray-500">
                  No liquidity accounts found. Add accounts in Finance Settings.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Note */}
          <p className="text-xs text-gray-400 mt-4 text-center">
            To edit account names and holders, go to Finance Settings → Accounts
          </p>
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">
          No data available
        </div>
      )}
    </div>
  );
}
