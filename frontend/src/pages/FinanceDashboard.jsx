import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  Loader2,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Download
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function FinanceDashboard() {
  const navigate = useNavigate();
  const { hasPermission, user } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('fy');
  const [customDates, setCustomDates] = useState({ from: '', to: '' });

  useEffect(() => {
    fetchDashboard();
  }, [period]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      let url = `${API}/dashboards/finance?period=${period}`;
      
      if (period === 'custom' && customDates.from && customDates.to) {
        url += `&from_date=${customDates.from}&to_date=${customDates.to}`;
      }
      
      const response = await axios.get(url, { withCredentials: true });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch finance dashboard:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied. Finance Dashboard requires finance permissions.');
      } else {
        toast.error('Failed to load finance dashboard');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    if (amount >= 10000000) {
      return `₹${(amount / 10000000).toFixed(2)} Cr`;
    } else if (amount >= 100000) {
      return `₹${(amount / 100000).toFixed(2)} L`;
    }
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getCollectionColor = (pct) => {
    if (pct >= 80) return 'text-green-600';
    if (pct >= 50) return 'text-amber-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="finance-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Finance Dashboard</h1>
            <p className="text-sm text-slate-500">{data?.period?.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fy">Financial Year</SelectItem>
              <SelectItem value="qtd">Quarter to Date</SelectItem>
              <SelectItem value="mtd">Month to Date</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                className="w-36 h-9"
                value={customDates.from}
                onChange={(e) => setCustomDates(prev => ({ ...prev, from: e.target.value }))}
              />
              <span className="text-slate-400">to</span>
              <Input
                type="date"
                className="w-36 h-9"
                value={customDates.to}
                onChange={(e) => setCustomDates(prev => ({ ...prev, to: e.target.value }))}
              />
              <Button size="sm" onClick={fetchDashboard}>Apply</Button>
            </div>
          )}
        </div>
      </div>

      {/* Value Source Indicator */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Sign-Off Value Only</p>
          <p className="text-xs text-blue-600">{data?.value_source_tooltip}</p>
        </div>
      </div>

      {/* Summary Cards - Clean & Minimal */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Sign-Off Value</p>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.total_signoff_value)}</p>
            <p className="text-xs text-slate-400 mt-1">{summary.project_count} projects</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Collected</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.amount_collected)}</p>
            <p className="text-xs text-slate-400 mt-1">Received payments</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(summary.amount_pending)}</p>
            <p className="text-xs text-slate-400 mt-1">Yet to collect</p>
          </CardContent>
        </Card>
        
        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 mb-1">Collection %</p>
            <p className={`text-2xl font-bold ${getCollectionColor(summary.collection_percentage)}`}>
              {summary.collection_percentage}%
            </p>
            <p className="text-xs text-slate-400 mt-1">Against Sign-Off</p>
          </CardContent>
        </Card>
      </div>

      {/* Project Payment Status - Text-based, Minimal */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b bg-slate-50">
            <h2 className="text-sm font-semibold text-slate-700">Project Payment Status</h2>
          </div>
          
          {data?.projects?.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No projects with locked Sign-Off Value</p>
              <p className="text-sm mt-1">Projects appear here after Design Sign-Off</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">PID</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Client</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Stage</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Sign-Off Value</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Collected</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Pending</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Collection %</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.projects.map((project) => (
                    <tr 
                      key={project.project_id} 
                      className="hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                      data-testid={`project-row-${project.project_id}`}
                    >
                      <td className="p-3">
                        <span className="font-mono text-sm text-blue-600">{project.pid || '-'}</span>
                      </td>
                      <td className="p-3">
                        <p className="text-sm font-medium text-slate-900">{project.client_name}</p>
                        {project.primary_designer && (
                          <p className="text-xs text-slate-400">Designer: {project.primary_designer}</p>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-xs">{project.stage}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <p className="text-sm font-medium">{formatCurrency(project.net_signoff_value)}</p>
                        {project.discount > 0 && (
                          <p className="text-xs text-slate-400">Discount: {formatCurrency(project.discount)}</p>
                        )}
                      </td>
                      <td className="p-3 text-right text-sm text-green-600 font-medium">
                        {formatCurrency(project.amount_collected)}
                      </td>
                      <td className="p-3 text-right text-sm text-amber-600 font-medium">
                        {formatCurrency(project.amount_pending)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`text-sm font-medium ${getCollectionColor(project.collection_percentage)}`}>
                          {project.collection_percentage}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer with timestamp */}
      <div className="text-center text-xs text-slate-400">
        Generated at {new Date(data?.generated_at).toLocaleString('en-IN')}
      </div>
    </div>
  );
}
