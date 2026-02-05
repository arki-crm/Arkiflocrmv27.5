import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import {
  Loader2,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  AlertCircle,
  User,
  Building2
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TimelineApprovalsPanel = ({ onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingTimelines, setPendingTimelines] = useState([]);
  const [selectedTimeline, setSelectedTimeline] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timelineDetails, setTimelineDetails] = useState(null);

  useEffect(() => {
    fetchPendingApprovals();
  }, []);

  const fetchPendingApprovals = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/timelines/pending-approvals`, {
        withCredentials: true
      });
      setPendingTimelines(res.data.timelines || []);
    } catch (err) {
      console.error('Failed to fetch pending approvals:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimelineDetails = async (projectId) => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}/timeline`, {
        withCredentials: true
      });
      setTimelineDetails(res.data);
    } catch (err) {
      console.error('Failed to fetch timeline details:', err);
    }
  };

  const handleOpenReview = async (timeline) => {
    setSelectedTimeline(timeline);
    setReviewNotes('');
    await fetchTimelineDetails(timeline.project_id);
    setShowReviewModal(true);
  };

  const handleReview = async (approved) => {
    if (!selectedTimeline) return;
    
    try {
      setSubmitting(true);
      await axios.put(
        `${API}/projects/${selectedTimeline.project_id}/timeline/review`,
        { approved, review_notes: reviewNotes },
        { withCredentials: true }
      );
      
      toast.success(approved ? 'Timeline approved' : 'Timeline rejected');
      setShowReviewModal(false);
      setSelectedTimeline(null);
      setTimelineDetails(null);
      fetchPendingApprovals();
      
      if (onUpdate) onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to review timeline');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'fast_track':
        return 'bg-red-100 text-red-700';
      case 'vip':
        return 'bg-purple-100 text-purple-700';
      case 'referral':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  if (loading) {
    return (
      <Card className="border-slate-200">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
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
            <Clock className="w-5 h-5 text-amber-600" />
            Timeline Approvals
            {pendingTimelines.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700 ml-2">
                {pendingTimelines.length}
              </Badge>
            )}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchPendingApprovals}>
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {pendingTimelines.length === 0 ? (
          <div className="text-center py-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-500">No pending timeline approvals</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTimelines.map((timeline) => (
              <div
                key={timeline.timeline_id}
                className={cn(
                  "p-3 rounded-lg border cursor-pointer transition-colors hover:border-purple-300",
                  timeline.type === 'manual_override' 
                    ? "bg-amber-50 border-amber-200" 
                    : "bg-white border-slate-200"
                )}
                onClick={() => handleOpenReview(timeline)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-slate-800 truncate">
                        {timeline.project_name}
                      </h4>
                      <Badge variant="outline" className="text-xs shrink-0">
                        v{timeline.version}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {timeline.designer_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {timeline.client_name}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {timeline.scope_type}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {timeline.project_tier}
                      </Badge>
                      {timeline.priority_tag !== 'normal' && (
                        <Badge className={cn("text-xs", getPriorityColor(timeline.priority_tag))}>
                          {timeline.priority_tag}
                        </Badge>
                      )}
                      <Badge className={cn(
                        "text-xs",
                        timeline.type === 'manual_override' 
                          ? "bg-amber-100 text-amber-700" 
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {timeline.type === 'manual_override' ? 'Override' : 'New'}
                      </Badge>
                    </div>
                  </div>
                  
                  <ArrowRight className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                </div>
                
                <p className="text-xs text-slate-500 mt-2">
                  by {timeline.created_by_name} • {formatDate(timeline.created_at)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Review Modal */}
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Timeline</DialogTitle>
            </DialogHeader>

            {selectedTimeline && (
              <div className="space-y-4 py-4">
                {/* Project Info */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <h4 className="font-medium text-slate-800">{selectedTimeline.project_name}</h4>
                  <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                    <span>Client: {selectedTimeline.client_name}</span>
                    <span>Designer: {selectedTimeline.designer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {selectedTimeline.scope_type}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {selectedTimeline.project_tier}
                    </Badge>
                    {selectedTimeline.priority_tag !== 'normal' && (
                      <Badge className={cn("text-xs", getPriorityColor(selectedTimeline.priority_tag))}>
                        {selectedTimeline.priority_tag}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Override Reason */}
                {timelineDetails?.pending_approval?.calculation_inputs?.override_reason && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-700">Override Reason</p>
                        <p className="text-sm text-amber-600 mt-1">
                          {timelineDetails.pending_approval.calculation_inputs.override_reason}
                        </p>
                        {timelineDetails.pending_approval.calculation_inputs.override_notes && (
                          <p className="text-xs text-amber-500 mt-1">
                            Notes: {timelineDetails.pending_approval.calculation_inputs.override_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Milestones */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Proposed Milestones</h4>
                  <div className="space-y-1 max-h-60 overflow-y-auto">
                    {timelineDetails?.pending_approval?.milestones?.map((m, idx) => (
                      <div
                        key={m.milestone_key}
                        className={cn(
                          "flex items-center justify-between p-2 rounded text-sm",
                          m.is_customer_facing ? "bg-white border" : "bg-slate-50"
                        )}
                      >
                        <span className={cn(
                          m.is_customer_facing ? "text-slate-800" : "text-slate-500"
                        )}>
                          {m.milestone_name}
                          {!m.is_customer_facing && (
                            <span className="text-xs text-slate-400 ml-2">(Internal)</span>
                          )}
                        </span>
                        <span className="font-medium">{formatDate(m.planned_date)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Calculation Factors */}
                {timelineDetails?.pending_approval?.calculation_inputs && (
                  <div className="p-3 bg-purple-50 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">Calculation Factors</h4>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <span className="text-purple-600">Skill Level:</span>
                      <span className="font-medium">
                        {timelineDetails.pending_approval.calculation_inputs.skill_label}
                      </span>
                      <span className="text-purple-600">Workload:</span>
                      <span className="font-medium">
                        {timelineDetails.pending_approval.calculation_inputs.designer_active_projects} projects
                        ({timelineDetails.pending_approval.calculation_inputs.workload_level})
                      </span>
                      <span className="text-purple-600">Design Multiplier:</span>
                      <span className="font-medium">
                        ×{timelineDetails.pending_approval.calculation_inputs.design_multiplier}
                      </span>
                    </div>
                  </div>
                )}

                {/* Review Notes */}
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    Review Notes (optional)
                  </label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add notes for approval or rejection reason..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setShowReviewModal(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => handleReview(false)}
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <XCircle className="w-4 h-4 mr-2" />
                Reject
              </Button>
              <Button 
                onClick={() => handleReview(true)}
                disabled={submitting}
              >
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default TimelineApprovalsPanel;
