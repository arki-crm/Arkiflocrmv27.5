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
  FolderKanban,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  IndianRupee
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const STAGE_COLORS = {
  'Design Finalization': 'bg-slate-500',
  'Production Preparation': 'bg-amber-500',
  'Production': 'bg-blue-500',
  'Delivery': 'bg-cyan-500',
  'Installation': 'bg-purple-500',
  'Handover': 'bg-emerald-500'
};

const ProjectReport = () => {
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
      const response = await axios.get(`${API}/reports/projects`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch project report:', err);
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

  const getDelayStatusColor = (status) => {
    switch (status) {
      case 'Critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'Delayed': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    }
  };

  const getDelayStatusIcon = (status) => {
    switch (status) {
      case 'Critical': return <AlertCircle className="w-3 h-3 mr-1" />;
      case 'Delayed': return <AlertTriangle className="w-3 h-3 mr-1" />;
      default: return <CheckCircle2 className="w-3 h-3 mr-1" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
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

  const onTrackPercentage = data?.total_projects > 0 
    ? Math.round((data.on_track_count / data.total_projects) * 100) 
    : 100;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/reports')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <FolderKanban className="h-6 w-6 text-blue-600" />
            Project Health
          </h1>
          <p className="text-sm text-slate-500">Active projects, delays, and completion tracking</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Total Projects</p>
            <p className="text-2xl font-bold text-slate-900">{data?.total_projects || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Active</p>
            <p className="text-2xl font-bold text-blue-600">{data?.total_active || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">On Track</p>
            <p className="text-2xl font-bold text-emerald-600">{data?.on_track_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Delayed</p>
            <p className="text-2xl font-bold text-amber-600">{data?.delayed_count || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs text-slate-500 uppercase">Avg Delay</p>
            <p className="text-2xl font-bold text-red-600">{data?.avg_delay_days || 0} days</p>
          </CardContent>
        </Card>
      </div>

      {/* Health Progress & Stage Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Health Progress */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overall Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-slate-600">Projects On Track</span>
                  <span className="text-sm font-semibold text-emerald-600">{onTrackPercentage}%</span>
                </div>
                <Progress value={onTrackPercentage} className="h-3" />
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{data?.production_count || 0}</p>
                  <p className="text-xs text-slate-500">In Production</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{data?.installation_count || 0}</p>
                  <p className="text-xs text-slate-500">Installation</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-600">{data?.pending_payment_count || 0}</p>
                  <p className="text-xs text-slate-500">Pending Payment</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stage Distribution */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Stage Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.projects_by_stage && Object.keys(data.projects_by_stage).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(data.projects_by_stage).map(([stage, count]) => (
                  <div key={stage} className="flex items-center gap-3">
                    <div className={cn('w-3 h-3 rounded-full', STAGE_COLORS[stage] || 'bg-slate-400')} />
                    <span className="flex-1 text-sm text-slate-700">{stage}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">No data available</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Project Details Table */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.project_details?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Project</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Designer</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Stage</th>
                    <th className="text-center py-3 px-3 font-medium text-slate-500">Delay Status</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Delay Days</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Payment</th>
                    <th className="text-right py-3 px-3 font-medium text-slate-500">Value</th>
                    <th className="text-left py-3 px-3 font-medium text-slate-500">Handover</th>
                  </tr>
                </thead>
                <tbody>
                  {data.project_details.map((project) => (
                    <tr 
                      key={project.project_id} 
                      className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer"
                      onClick={() => navigate(`/projects/${project.project_id}`)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-900">{project.project_name}</span>
                          <ArrowUpRight className="w-3 h-3 text-slate-400" />
                        </div>
                        <p className="text-xs text-slate-500">{project.client_name}</p>
                      </td>
                      <td className="py-3 px-3 text-slate-600">{project.designer || '-'}</td>
                      <td className="py-3 px-3">
                        <Badge variant="secondary" className="text-xs">{project.stage}</Badge>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge className={cn('text-xs', getDelayStatusColor(project.delay_status))}>
                          {getDelayStatusIcon(project.delay_status)}
                          {project.delay_status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {project.delay_days > 0 ? (
                          <span className="text-red-600 font-medium">{project.delay_days}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          'text-xs font-medium',
                          project.payment_status === 'Complete' ? 'text-emerald-600' : 'text-amber-600'
                        )}>
                          {project.payment_status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-900">
                        {formatCurrency(project.project_value)}
                      </td>
                      <td className="py-3 px-3 text-slate-600">
                        {formatDate(project.expected_handover)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <FolderKanban className="w-10 h-10 mx-auto text-slate-300 mb-3" />
              <p>No projects found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectReport;
