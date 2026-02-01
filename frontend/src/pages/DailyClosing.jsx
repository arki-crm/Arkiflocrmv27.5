import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
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
  Loader2, 
  ChevronLeft,
  ChevronRight,
  Lock,
  CheckCircle,
  Calendar,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

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
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [history, setHistory] = useState([]);

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
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
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
          <Button variant="outline" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}>
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
            <CardHeader className="border-b border-slate-200">
              <CardTitle className="text-lg font-semibold">
                Account-wise Summary — {formatDate(selectedDate)}
              </CardTitle>
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
                            <Badge variant="outline" className="text-xs">
                              {acc.transaction_count}
                            </Badge>
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
                  {history.map((closing) => (
                    <div 
                      key={closing.date}
                      className={cn(
                        "p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer",
                        closing.date === selectedDate && "bg-blue-50"
                      )}
                      onClick={() => setSelectedDate(closing.date)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">{closing.date}</p>
                          <p className="text-xs text-slate-500">
                            Closed by {closing.closed_by_name}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-600">
                          {closing.transaction_count} transactions
                        </p>
                        <p className={cn(
                          "text-sm font-medium",
                          closing.net_change >= 0 ? "text-green-600" : "text-red-600"
                        )}>
                          {closing.net_change >= 0 ? '+' : ''}{formatCurrency(closing.net_change)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default DailyClosing;
