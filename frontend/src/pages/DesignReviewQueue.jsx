import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Loader2,
  FileCheck,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Eye,
  RefreshCw,
  Users,
  CalendarClock,
  AlertCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DesignReviewQueue = () => {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [queueData, setQueueData] = useState(null);
  const [upcomingMeetings, setUpcomingMeetings] = useState(null);
  const [overdueReviews, setOverdueReviews] = useState(null);

  useEffect(() => {
    // Check permission
    if (user && !hasPermission('admin.view_reports') && !['Admin', 'DesignManager', 'Manager', 'Founder'].includes(user.role)) {
      navigate('/dashboard');
      return;
    }
    fetchAllData();
  }, [user]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [queueRes, meetingsRes, overdueRes] = await Promise.all([
        axios.get(`${API}/design-manager/review-queue`, { withCredentials: true }),
        axios.get(`${API}/design-manager/upcoming-meetings?days_ahead=14`, { withCredentials: true }),
        axios.get(`${API}/design-manager/overdue-reviews`, { withCredentials: true })
      ]);
      setQueueData(queueRes.data);
      setUpcomingMeetings(meetingsRes.data);
      setOverdueReviews(overdueRes.data);
    } catch (err) {
      console.error('Failed to fetch review queue:', err);
      toast.error('Failed to load review queue');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short'
    });
  };

  const getPriorityBadge = (priority) => {
    const styles = {
      critical: 'bg-red-100 text-red-700',
      high: 'bg-orange-100 text-orange-700',
      medium: 'bg-amber-100 text-amber-700',
      normal: 'bg-slate-100 text-slate-600',
      low: 'bg-slate-100 text-slate-500'
    };
    return <Badge className={cn('text-xs', styles[priority] || styles.normal)}>{priority}</Badge>;
  };

  const getStatusBadge = (status) => {
    const styles = {
      approved: 'bg-emerald-100 text-emerald-700',
      pending_review: 'bg-amber-100 text-amber-700',
      revision_required: 'bg-orange-100 text-orange-700',
      not_submitted: 'bg-slate-100 text-slate-600'
    };
    const labels = {
      approved: 'Ready',
      pending_review: 'Needs Review',
      revision_required: 'Awaiting Revision',
      not_submitted: 'Not Submitted'
    };
    return <Badge className={cn('text-xs', styles[status] || styles.not_submitted)}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  const stats = queueData?.stats || {};

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Review Queue</h1>
            <p className="text-sm text-slate-500 mt-1">
              Design approvals, timeline reviews, and upcoming meetings
            </p>
          </div>
          <Button variant="outline" onClick={fetchAllData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FileCheck className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Pending Designs</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.pending_designs?.total || 0}</p>
                </div>
              </div>
              {stats.pending_designs?.overdue > 0 && (
                <Badge className="bg-red-100 text-red-700 mt-2">
                  {stats.pending_designs.overdue} overdue
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Timeline Approvals</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.pending_timelines?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 rounded-lg">
                  <CalendarClock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Upcoming Meetings</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.upcoming_meetings?.total || 0}</p>
                </div>
              </div>
              {stats.upcoming_meetings?.critical > 0 && (
                <Badge className="bg-red-100 text-red-700 mt-2">
                  {stats.upcoming_meetings.critical} critical
                </Badge>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  stats.total_action_items > 0 ? "bg-red-100" : "bg-emerald-100"
                )}>
                  {stats.total_action_items > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Actions</p>
                  <p className="text-2xl font-bold text-slate-800">{stats.total_action_items || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border">
            <TabsTrigger value="all">All Items</TabsTrigger>
            <TabsTrigger value="designs">
              Design Submissions
              {stats.pending_designs?.total > 0 && (
                <Badge className="ml-2 bg-indigo-100 text-indigo-700">{stats.pending_designs.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="timelines">
              Timelines
              {stats.pending_timelines?.total > 0 && (
                <Badge className="ml-2 bg-purple-100 text-purple-700">{stats.pending_timelines.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="meetings">
              Upcoming Meetings
              {stats.upcoming_meetings?.total > 0 && (
                <Badge className="ml-2 bg-amber-100 text-amber-700">{stats.upcoming_meetings.total}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {overdueReviews?.total_overdue > 0 && (
                <Badge className="ml-2 bg-red-100 text-red-700">{overdueReviews.total_overdue}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* All Items Tab */}
          <TabsContent value="all" className="space-y-4 mt-4">
            {stats.total_action_items === 0 ? (
              <Card className="border-slate-200">
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-slate-700">All Caught Up!</h3>
                  <p className="text-slate-500">No pending reviews or upcoming meetings needing attention.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Critical Items First */}
                {(queueData?.pending_designs?.filter(d => d.is_overdue).length > 0 ||
                  queueData?.upcoming_meetings?.filter(m => m.priority === 'critical').length > 0) && (
                  <Card className="border-red-200 bg-red-50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                        <AlertTriangle className="w-5 h-5" />
                        Critical - Needs Immediate Attention
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {queueData?.pending_designs?.filter(d => d.is_overdue).map(item => (
                        <ReviewItem key={item.submission_id} item={item} type="design" navigate={navigate} />
                      ))}
                      {queueData?.upcoming_meetings?.filter(m => m.priority === 'critical').map(item => (
                        <ReviewItem key={`${item.project_id}-${item.milestone_key}`} item={item} type="meeting" navigate={navigate} />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Pending Designs */}
                {queueData?.pending_designs?.filter(d => !d.is_overdue).length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileCheck className="w-5 h-5 text-indigo-600" />
                        Pending Design Submissions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {queueData?.pending_designs?.filter(d => !d.is_overdue).map(item => (
                        <ReviewItem key={item.submission_id} item={item} type="design" navigate={navigate} />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Pending Timelines */}
                {queueData?.pending_timelines?.length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-purple-600" />
                        Pending Timeline Approvals
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {queueData?.pending_timelines?.map(item => (
                        <ReviewItem key={item.timeline_id} item={item} type="timeline" navigate={navigate} />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Upcoming Meetings */}
                {queueData?.upcoming_meetings?.filter(m => m.priority !== 'critical').length > 0 && (
                  <Card className="border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <CalendarClock className="w-5 h-5 text-amber-600" />
                        Upcoming Meetings Awaiting Approval
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {queueData?.upcoming_meetings?.filter(m => m.priority !== 'critical').map(item => (
                        <ReviewItem key={`${item.project_id}-${item.milestone_key}`} item={item} type="meeting" navigate={navigate} />
                      ))}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          {/* Design Submissions Tab */}
          <TabsContent value="designs" className="mt-4">
            <Card className="border-slate-200">
              <CardContent className="py-4">
                {queueData?.pending_designs?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-slate-500">No pending design submissions</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queueData?.pending_designs?.map(item => (
                      <ReviewItem key={item.submission_id} item={item} type="design" navigate={navigate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timelines Tab */}
          <TabsContent value="timelines" className="mt-4">
            <Card className="border-slate-200">
              <CardContent className="py-4">
                {queueData?.pending_timelines?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-slate-500">No pending timeline approvals</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {queueData?.pending_timelines?.map(item => (
                      <ReviewItem key={item.timeline_id} item={item} type="timeline" navigate={navigate} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upcoming Meetings Tab */}
          <TabsContent value="meetings" className="mt-4">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg">Meetings in Next 14 Days</CardTitle>
              </CardHeader>
              <CardContent>
                {upcomingMeetings?.all_meetings?.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No upcoming meetings</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingMeetings?.all_meetings?.map(meeting => (
                      <div
                        key={`${meeting.project_id}-${meeting.milestone_key}`}
                        className={cn(
                          "p-3 rounded-lg border cursor-pointer transition-colors hover:border-indigo-300",
                          meeting.is_ready
                            ? "bg-emerald-50 border-emerald-200"
                            : meeting.urgency === 'critical'
                              ? "bg-red-50 border-red-200"
                              : meeting.status === 'pending_review'
                                ? "bg-amber-50 border-amber-200"
                                : "bg-white border-slate-200"
                        )}
                        onClick={() => navigate(`/projects/${meeting.project_id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-slate-800">{meeting.project_name}</h4>
                              {getStatusBadge(meeting.status)}
                            </div>
                            <p className="text-sm text-slate-600">{meeting.milestone_name}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                              <span>Client: {meeting.client_name}</span>
                              <span>Designer: {meeting.designer_name}</span>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className={cn(
                              "text-sm font-medium",
                              meeting.urgency === 'critical' ? "text-red-600" : "text-slate-700"
                            )}>
                              {formatShortDate(meeting.meeting_date)}
                            </p>
                            <p className={cn(
                              "text-xs",
                              meeting.urgency === 'critical'
                                ? "text-red-600"
                                : meeting.urgency === 'high'
                                  ? "text-orange-600"
                                  : "text-slate-500"
                            )}>
                              {meeting.days_until_meeting === 0
                                ? "Today"
                                : meeting.days_until_meeting === 1
                                  ? "Tomorrow"
                                  : `${meeting.days_until_meeting} days`}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overdue Tab */}
          <TabsContent value="overdue" className="mt-4">
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-5 h-5" />
                  Overdue Reviews ({overdueReviews?.total_overdue || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {overdueReviews?.overdue_reviews?.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                    <p className="text-slate-500">No overdue reviews</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {overdueReviews?.overdue_reviews?.map(item => (
                      <div
                        key={item.submission_id}
                        className="p-3 rounded-lg bg-red-50 border border-red-200 cursor-pointer hover:border-red-300"
                        onClick={() => navigate(`/projects/${item.project_id}`)}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-slate-800">{item.project_name}</h4>
                              <Badge className="bg-red-100 text-red-700 text-xs">
                                {item.days_overdue} days overdue
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-600">{item.milestone_name} (v{item.version})</p>
                            <p className="text-xs text-slate-500 mt-1">
                              Submitted by {item.submitted_by_name} • Due: {formatShortDate(item.deadline)}
                            </p>
                          </div>
                          <Button size="sm" variant="destructive">
                            Review Now
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

// Helper component for review items
const ReviewItem = ({ item, type, navigate }) => {
  const formatShortDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  if (type === 'design') {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border cursor-pointer transition-colors hover:border-indigo-300",
          item.is_overdue ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
        )}
        onClick={() => navigate(`/projects/${item.project_id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-slate-800">{item.project_name}</h4>
              <Badge variant="outline" className="text-xs">v{item.version}</Badge>
              {item.is_overdue && <Badge className="bg-red-100 text-red-700 text-xs">Overdue</Badge>}
            </div>
            <p className="text-sm text-slate-600">{item.milestone_name}</p>
            <p className="text-xs text-slate-500 mt-1">
              By {item.designer_name} • {formatShortDate(item.submitted_at)}
            </p>
          </div>
          <Button size="sm">
            <Eye className="w-4 h-4 mr-1" />
            Review
          </Button>
        </div>
      </div>
    );
  }

  if (type === 'timeline') {
    return (
      <div
        className="p-3 rounded-lg bg-white border border-slate-200 cursor-pointer hover:border-purple-300"
        onClick={() => navigate(`/projects/${item.project_id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-slate-800">{item.project_name}</h4>
              <Badge variant="outline" className="text-xs">v{item.version}</Badge>
              <Badge className="bg-purple-100 text-purple-700 text-xs">
                {item.version_type === 'manual_override' ? 'Override' : 'New'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500">
              By {item.submitted_by} • {formatShortDate(item.submitted_at)}
            </p>
          </div>
          <Button size="sm" variant="outline">
            <Eye className="w-4 h-4 mr-1" />
            Review
          </Button>
        </div>
      </div>
    );
  }

  if (type === 'meeting') {
    return (
      <div
        className={cn(
          "p-3 rounded-lg border cursor-pointer transition-colors hover:border-amber-300",
          item.priority === 'critical' ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        )}
        onClick={() => navigate(`/projects/${item.project_id}`)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-slate-800">{item.project_name}</h4>
              <Badge className={cn(
                "text-xs",
                item.approval_status === 'pending_review' 
                  ? "bg-amber-100 text-amber-700" 
                  : "bg-slate-100 text-slate-600"
              )}>
                {item.approval_status === 'pending_review' ? 'Needs Review' : 'Not Submitted'}
              </Badge>
            </div>
            <p className="text-sm text-slate-600">{item.milestone_name}</p>
            <p className="text-xs text-slate-500 mt-1">Designer: {item.designer_name}</p>
          </div>
          <div className="text-right">
            <p className={cn(
              "text-sm font-medium",
              item.priority === 'critical' ? "text-red-600" : "text-amber-600"
            )}>
              {item.days_until_meeting === 0 ? "Today" : `${item.days_until_meeting}d`}
            </p>
            <p className="text-xs text-slate-500">{formatShortDate(item.meeting_date)}</p>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default DesignReviewQueue;
