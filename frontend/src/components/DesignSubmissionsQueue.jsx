import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Loader2,
  FileCheck,
  Clock,
  AlertTriangle,
  ArrowRight,
  Eye,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DesignSubmissionsQueue = ({ onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [stats, setStats] = useState({ pending_count: 0, overdue_count: 0, due_soon_count: 0 });

  useEffect(() => {
    fetchPendingSubmissions();
  }, []);

  const fetchPendingSubmissions = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/design-submissions/pending-approvals`, {
        withCredentials: true
      });
      setPendingSubmissions(res.data.submissions || []);
      setStats({
        pending_count: res.data.pending_count || 0,
        overdue_count: res.data.overdue_count || 0,
        due_soon_count: res.data.due_soon_count || 0
      });
    } catch (err) {
      console.error('Failed to fetch pending submissions:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    });
  };

  const handleNavigateToProject = (projectId) => {
    navigate(`/projects/${projectId}`);
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            Design Approvals
            {stats.pending_count > 0 && (
              <Badge className="bg-indigo-100 text-indigo-700 ml-2">
                {stats.pending_count}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPendingSubmissions}>
            Refresh
          </Button>
        </div>
        
        {/* Stats */}
        {(stats.overdue_count > 0 || stats.due_soon_count > 0) && (
          <div className="flex gap-3 mt-2">
            {stats.overdue_count > 0 && (
              <Badge className="bg-red-100 text-red-700">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {stats.overdue_count} Overdue
              </Badge>
            )}
            {stats.due_soon_count > 0 && (
              <Badge className="bg-amber-100 text-amber-700">
                <Clock className="w-3 h-3 mr-1" />
                {stats.due_soon_count} Due Soon
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {pendingSubmissions.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-500">No pending design approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingSubmissions.map((submission) => (
              <div
                key={submission.submission_id}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-colors hover:border-indigo-300",
                  submission.is_overdue
                    ? "bg-red-50 border-red-200"
                    : submission.is_due_soon
                      ? "bg-amber-50 border-amber-200"
                      : "bg-white border-slate-200"
                )}
                onClick={() => handleNavigateToProject(submission.project_id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-800 truncate">
                        {submission.project_name}
                      </h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        v{submission.version}
                      </Badge>
                    </div>
                    
                    <p className="text-sm text-slate-600 mb-1">
                      {submission.milestone_name}
                    </p>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>By: {submission.submitted_by_name}</span>
                      <span>•</span>
                      <span>{submission.files_count} files</span>
                      <span>•</span>
                      <span>{Math.round(submission.checklist_completion)}% checklist</span>
                    </div>
                    
                    {/* Deadline status */}
                    {submission.deadline && (
                      <div className={cn(
                        "flex items-center gap-1 mt-2 text-xs",
                        submission.is_overdue
                          ? "text-red-600"
                          : submission.is_due_soon
                            ? "text-amber-600"
                            : "text-slate-500"
                      )}>
                        <Calendar className="w-3 h-3" />
                        <span>
                          Due: {formatDate(submission.deadline)}
                          {submission.is_overdue && ` (${Math.abs(submission.days_remaining)} days overdue)`}
                          {submission.is_due_soon && !submission.is_overdue && ` (${submission.days_remaining} days left)`}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <Button variant="ghost" size="sm" className="shrink-0 ml-2">
                    <Eye className="w-4 h-4 mr-1" />
                    Review
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DesignSubmissionsQueue;
