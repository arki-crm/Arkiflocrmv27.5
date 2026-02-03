import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  ArrowLeft,
  Users,
  AlertCircle,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Target
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SOURCE_COLORS = {
  'Meta': 'bg-blue-500',
  'Walk-in': 'bg-emerald-500',
  'Referral': 'bg-purple-500',
  'Website': 'bg-cyan-500',
  'Others': 'bg-slate-500',
  'Unknown': 'bg-gray-400'
};

const LeadReport = () => {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // PreSales can view lead reports, others need admin.view_reports
    if (user && !hasPermission('admin.view_reports') && !hasPermission('presales.view')) {
      navigate('/reports');
      return;
    }
    fetchData();
  }, [user, navigate, hasPermission]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/reports/leads`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch lead report:', err);
      setError(err.response?.data?.detail || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
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
            <Users className="h-6 w-6 text-purple-600" />
            Lead Conversion
          </h1>
          <p className="text-sm text-slate-500">Lead analytics and conversion performance</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Total Leads</p>
            <p className="text-2xl font-bold text-slate-900">{data?.total_leads || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Qualified</p>
            <p className="text-2xl font-bold text-blue-600">{data?.qualified_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Converted</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.converted_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Lost</p>
            <p className="text-2xl font-bold text-red-600">{data?.lost_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Conversion Rate</p>
            <p className="text-2xl font-bold text-purple-600">{data?.conversion_rate || 0}%</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Avg Cycle Time</p>
            <p className="text-2xl font-bold text-amber-600">{data?.avg_cycle_time || 0} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel & Source Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion Funnel */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-600" />
              Conversion Funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">Total → Qualified</span>
                  <span className="text-sm font-semibold">
                    {data?.total_leads > 0 ? Math.round((data.qualified_count / data.total_leads) * 100) : 0}%
                  </span>
                </div>
                <Progress 
                  value={data?.total_leads > 0 ? (data.qualified_count / data.total_leads) * 100 : 0} 
                  className="h-2" 
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-600">Qualified → Converted</span>
                  <span className="text-sm font-semibold">
                    {data?.qualified_count > 0 ? Math.round((data.converted_count / data.qualified_count) * 100) : 0}%
                  </span>
                </div>
                <Progress 
                  value={data?.qualified_count > 0 ? (data.converted_count / data.qualified_count) * 100 : 0} 
                  className="h-2" 
                />
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-2">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">{data?.total_leads || 0}</p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                  <div>
                    <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">{data?.converted_count || 0}</p>
                    <p className="text-xs text-slate-500">Converted</p>
                  </div>
                  <div>
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-2">
                      <XCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <p className="text-lg font-bold text-slate-900">{data?.lost_count || 0}</p>
                    <p className="text-xs text-slate-500">Lost</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Source Performance */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Source Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.source_performance && Object.keys(data.source_performance).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.source_performance).map(([source, stats]) => (
                  <div key={source} className="p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('w-3 h-3 rounded-full', SOURCE_COLORS[source] || 'bg-slate-400')} />
                      <span className="text-sm font-medium text-slate-700">{source}</span>
                      <Badge variant="secondary" className="ml-auto">{stats.total}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-slate-500">Qualified</p>
                        <p className="font-semibold text-blue-600">{stats.qualified}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Converted</p>
                        <p className="font-semibold text-emerald-600">{stats.converted}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Conv. Rate</p>
                        <p className="font-semibold text-purple-600">
                          {stats.total > 0 ? Math.round((stats.converted / stats.total) * 100) : 0}%
                        </p>
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
      </div>

      {/* PreSales Performance Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Pre-Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.presales_performance?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Name</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Assigned</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Qualified</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Converted</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Lost</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.presales_performance.map((person) => (
                    <tr key={person.user_id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-3 font-medium text-slate-900">{person.name}</td>
                      <td className="py-3 px-3 text-right text-slate-600">{person.assigned}</td>
                      <td className="py-3 px-3 text-right text-blue-600">{person.qualified}</td>
                      <td className="py-3 px-3 text-right text-emerald-600 font-semibold">{person.converted}</td>
                      <td className="py-3 px-3 text-right text-red-600">{person.lost}</td>
                      <td className="py-3 px-3 text-right">
                        <Badge className={cn(
                          'text-xs',
                          person.conversion_rate >= 30 ? 'bg-emerald-100 text-emerald-700' :
                          person.conversion_rate >= 15 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        )}>
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {person.conversion_rate}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Users className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p>No pre-sales data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LeadReport;
