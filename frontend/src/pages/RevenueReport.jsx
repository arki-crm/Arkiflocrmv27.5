import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  TrendingUp,
  Wallet,
  CalendarDays,
  AlertCircle,
  Loader2,
  IndianRupee,
  ArrowUpRight,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const RevenueReport = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user && !hasPermission('admin.view_reports')) {
      navigate('/reports');
      return;
    }
    fetchData();
  }, [user, navigate, hasPermission]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/revenue`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch revenue report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '₹0';
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'red': return 'bg-red-100 text-red-700 border-red-200';
      case 'orange': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'green': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'red': return 'Overdue';
      case 'orange': return 'Due Soon';
      case 'green': return 'Complete';
      default: return 'Upcoming';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate('/reports')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Reports
        </Button>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-emerald-600" />
            Revenue Forecast
          </h1>
          <p className="text-sm text-slate-500">Revenue projections and pending collections</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span className="text-xs text-slate-500 uppercase">Total Forecast</span>
            </div>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrency(data?.total_forecast)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Weighted by stage probability</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-blue-600" />
              <span className="text-xs text-slate-500 uppercase">Expected This Month</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">
              {formatCurrency(data?.expected_this_month)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-slate-500 uppercase">Total Pending</span>
            </div>
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(data?.total_pending)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <IndianRupee className="h-4 w-4 text-slate-600" />
              <span className="text-xs text-slate-500 uppercase">Projects</span>
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {data?.projects_count || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Stage-wise Revenue & Milestone Projection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stage-wise Revenue */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Stage-wise Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.stage_wise_revenue && Object.keys(data.stage_wise_revenue).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.stage_wise_revenue).map(([stage, info]) => (
                  <div key={stage} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">{stage}</span>
                      <Badge variant="secondary">{info.count} projects</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Total Value</p>
                        <p className="font-semibold text-slate-900">{formatCurrency(info.value)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Weighted</p>
                        <p className="font-semibold text-emerald-600">{formatCurrency(info.weighted)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Milestone Projection */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Milestone Projection</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.milestone_projection ? (
              <div className="space-y-3">
                {Object.entries(data.milestone_projection).map(([stage, amount]) => (
                  <div key={stage} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-700">{stage}</span>
                    <span className="text-lg font-bold text-emerald-600">{formatCurrency(amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pending Collections Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pending Collections</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.pending_collections?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Project</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Client</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Project Value</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Collected</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Pending</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Next Stage</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Expected</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pending_collections.map((item) => (
                    <tr 
                      key={item.project_id} 
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/projects/${item.project_id}`)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{item.project_name}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{item.client_name}</td>
                      <td className="py-3 px-3 text-right text-slate-900">{formatCurrency(item.project_value)}</td>
                      <td className="py-3 px-3 text-right text-emerald-600">{formatCurrency(item.collected)}</td>
                      <td className="py-3 px-3 text-right font-semibold text-amber-600">{formatCurrency(item.pending)}</td>
                      <td className="py-3 px-3 text-slate-600">
                        {item.next_stage || '-'}
                        {item.next_amount > 0 && (
                          <span className="text-xs text-slate-400 ml-1">({formatCurrency(item.next_amount)})</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{formatDate(item.expected_date)}</td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={cn('text-xs', getStatusColor(item.status_color))}>
                          {item.status_color === 'green' ? (
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                          ) : item.status_color === 'red' ? (
                            <AlertCircle className="w-3 h-3 mr-1" />
                          ) : (
                            <Clock className="w-3 h-3 mr-1" />
                          )}
                          {getStatusLabel(item.status_color)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-3" />
              <p>All collections are complete!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default RevenueReport;
