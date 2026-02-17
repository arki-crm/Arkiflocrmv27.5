import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import {
  Loader2,
  Upload,
  FileText,
  Image,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Eye,
  Send,
  RefreshCw,
  Calendar,
  ChevronRight,
  Shield,
  History,
  Link
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DesignApprovalPanel = ({ projectId, canSubmit = false, isManager = false, onStatusChange }) => {
  const [loading, setLoading] = useState(true);
  const [approvalStatus, setApprovalStatus] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [checklistTemplate, setChecklistTemplate] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Submission form state
  const [submitForm, setSubmitForm] = useState({
    files: [],
    checklist: [],
    design_notes: '',
    concept_summary: '',
    constraints_notes: '',
    drive_link: ''
  });

  // Review form state
  const [reviewForm, setReviewForm] = useState({
    approved: false,
    review_notes: '',
    improvement_areas: []
  });

  useEffect(() => {
    fetchApprovalStatus();
  }, [projectId]);

  const fetchApprovalStatus = async () => {
    try {
      setLoading(true);
      const [statusRes, submissionsRes] = await Promise.all([
        axios.get(`${API}/projects/${projectId}/design-approval-status`, { withCredentials: true }),
        axios.get(`${API}/projects/${projectId}/design-submissions`, { withCredentials: true })
      ]);
      setApprovalStatus(statusRes.data);
      setSubmissions(submissionsRes.data);
    } catch (err) {
      console.error('Failed to fetch approval status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchChecklist = async (milestoneKey) => {
    try {
      const res = await axios.get(`${API}/design-approval/checklist/${milestoneKey}`, {
        withCredentials: true
      });
      const template = res.data.checklist.map(item => ({
        ...item,
        checked: false,
        notes: ''
      }));
      setChecklistTemplate(res.data.checklist);
      setSubmitForm(prev => ({ ...prev, checklist: template }));
    } catch (err) {
      toast.error('Failed to load checklist');
    }
  };

  const handleOpenSubmit = async (milestone) => {
    setSelectedMilestone(milestone);
    await fetchChecklist(milestone.milestone_key);
    setSubmitForm({
      files: [],
      checklist: checklistTemplate.map(item => ({ ...item, checked: false, notes: '' })),
      design_notes: '',
      concept_summary: '',
      constraints_notes: ''
    });
    setShowSubmitModal(true);
  };

  const handleOpenReview = async (submissionId) => {
    try {
      const res = await axios.get(`${API}/projects/${projectId}/design-submissions/${submissionId}`, {
        withCredentials: true
      });
      setSelectedSubmission(res.data.submission);
      setReviewForm({ approved: false, review_notes: '', improvement_areas: [] });
      setShowReviewModal(true);
    } catch (err) {
      toast.error('Failed to load submission');
    }
  };

  const handleFileUpload = (e) => {
    const newFiles = Array.from(e.target.files).map(file => ({
      file_id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      file_name: file.name,
      file_url: URL.createObjectURL(file), // Temporary URL
      file_type: file.type.includes('image') ? 'render' : 'document',
      file_size: file.size,
      uploaded_at: new Date().toISOString(),
      _file: file // Keep reference for actual upload
    }));
    setSubmitForm(prev => ({ ...prev, files: [...prev.files, ...newFiles] }));
  };

  const handleRemoveFile = (fileId) => {
    setSubmitForm(prev => ({
      ...prev,
      files: prev.files.filter(f => f.file_id !== fileId)
    }));
  };

  const handleChecklistChange = (index, field, value) => {
    setSubmitForm(prev => ({
      ...prev,
      checklist: prev.checklist.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    }));
  };

  const handleSubmit = async () => {
    // Validate required fields
    const requiredChecked = submitForm.checklist.filter(c => c.required && c.checked).length;
    const totalRequired = submitForm.checklist.filter(c => c.required).length;
    
    if (requiredChecked < totalRequired) {
      toast.error('Please complete all required checklist items');
      return;
    }
    
    if (!submitForm.design_notes.trim()) {
      toast.error('Please provide design notes');
      return;
    }
    
    // Drive link required for all gates
    if (!submitForm.drive_link.trim()) {
      toast.error('Please provide a Google Drive link');
      return;
    }
    
    // PDF required only for KWS Sign Off Document
    if (selectedMilestone?.milestone_key === 'kws_signoff_document' && submitForm.files.length === 0) {
      toast.error('Please upload the signed KWS PDF document');
      return;
    }

    try {
      setSubmitting(true);
      
      // For now, use placeholder URLs (in production, files would be uploaded to storage first)
      const filesForSubmission = submitForm.files.map(f => ({
        file_id: f.file_id,
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
        file_size: f.file_size,
        uploaded_at: f.uploaded_at
      }));

      await axios.post(`${API}/projects/${projectId}/design-submissions`, {
        milestone_key: selectedMilestone.milestone_key,
        files: filesForSubmission,
        checklist: submitForm.checklist,
        design_notes: submitForm.design_notes,
        concept_summary: submitForm.concept_summary,
        constraints_notes: submitForm.constraints_notes,
        drive_link: submitForm.drive_link
      }, { withCredentials: true });

      toast.success('Design submission created successfully');
      setShowSubmitModal(false);
      fetchApprovalStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create submission');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (approved) => {
    if (!approved && reviewForm.review_notes.length < 10) {
      toast.error('Please provide detailed feedback for rejection (minimum 10 characters)');
      return;
    }

    try {
      setSubmitting(true);
      await axios.put(
        `${API}/projects/${projectId}/design-submissions/${selectedSubmission.submission_id}/review`,
        { ...reviewForm, approved },
        { withCredentials: true }
      );
      toast.success(approved ? 'Design approved' : 'Design returned for revision');
      setShowReviewModal(false);
      fetchApprovalStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to review submission');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      not_submitted: 'bg-slate-100 text-slate-600',
      pending_review: 'bg-amber-100 text-amber-700',
      approved: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      revision_required: 'bg-orange-100 text-orange-700'
    };
    
    const labels = {
      not_submitted: 'Not Submitted',
      pending_review: 'Pending Review',
      approved: 'Approved',
      rejected: 'Rejected',
      revision_required: 'Revision Required'
    };
    
    return (
      <Badge className={cn('text-xs', styles[status] || styles.not_submitted)}>
        {labels[status] || status}
      </Badge>
    );
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
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
            <Shield className="w-5 h-5 text-indigo-600" />
            Design Approval Gate
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchApprovalStatus}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-sm text-slate-500 mt-1">
          Manager approval required before client presentations
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Milestone Status Cards */}
        {approvalStatus?.milestones?.map((milestone) => (
          <div
            key={milestone.milestone_key}
            className={cn(
              "p-4 rounded-lg border transition-colors",
              milestone.status === 'approved'
                ? "bg-emerald-50 border-emerald-200"
                : milestone.status === 'pending_review'
                  ? "bg-amber-50 border-amber-200"
                  : milestone.status === 'revision_required'
                    ? "bg-orange-50 border-orange-200"
                    : "bg-white border-slate-200"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-slate-800">
                    {milestone.milestone_name}
                  </h4>
                  {getStatusBadge(milestone.status)}
                </div>
                <p className="text-xs text-slate-500">{milestone.description}</p>
                
                {/* Deadline info */}
                {milestone.deadline && (
                  <div className={cn(
                    "flex items-center gap-1 mt-2 text-xs",
                    milestone.deadline_status?.is_overdue
                      ? "text-red-600"
                      : milestone.deadline_status?.is_due_soon
                        ? "text-amber-600"
                        : "text-slate-500"
                  )}>
                    <Calendar className="w-3 h-3" />
                    <span>Due: {formatDate(milestone.deadline)}</span>
                    {milestone.deadline_status?.is_overdue && (
                      <Badge className="bg-red-100 text-red-700 text-xs ml-1">Overdue</Badge>
                    )}
                  </div>
                )}
                
                {/* Submission info */}
                {milestone.latest_submission && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                    <History className="w-3 h-3" />
                    <span>
                      v{milestone.latest_submission.version} submitted {formatDate(milestone.latest_submission.submitted_at)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 ml-4">
                {milestone.status === 'approved' ? (
                  <Button variant="ghost" size="sm" disabled>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </Button>
                ) : milestone.status === 'pending_review' ? (
                  isManager ? (
                    <Button
                      size="sm"
                      onClick={() => handleOpenReview(milestone.pending_submission_id)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Review
                    </Button>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700">
                      <Clock className="w-3 h-3 mr-1" />
                      Awaiting Review
                    </Badge>
                  )
                ) : (
                  canSubmit && (
                    <Button
                      size="sm"
                      variant={milestone.status === 'revision_required' ? 'default' : 'outline'}
                      onClick={() => handleOpenSubmit(milestone)}
                    >
                      {milestone.status === 'revision_required' ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-1" />
                          Resubmit
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-1" />
                          Submit
                        </>
                      )}
                    </Button>
                  )
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Overall status */}
        {approvalStatus?.all_approved && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">All design approvals complete</span>
            </div>
          </div>
        )}

        {/* Submit Modal */}
        <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Submit Design for Approval
                {selectedMilestone && (
                  <span className="block text-sm font-normal text-slate-500 mt-1">
                    {selectedMilestone.milestone_name}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Drive Link Input (Required for all gates) */}
              <div>
                <Label className="text-sm font-medium">Google Drive Link *</Label>
                <p className="text-xs text-slate-500 mb-2">Share folder link with design files</p>
                <Input
                  type="url"
                  value={submitForm.drive_link}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, drive_link: e.target.value }))}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="font-mono text-sm"
                />
              </div>
              
              {/* File Upload - Only enabled for KWS Sign Off Document */}
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  PDF Upload
                  {selectedMilestone?.milestone_key === 'kws_signoff_document' ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <Badge variant="outline" className="text-xs text-slate-400">Optional</Badge>
                  )}
                </Label>
                <p className="text-xs text-slate-500 mb-2">
                  {selectedMilestone?.milestone_key === 'kws_signoff_document' 
                    ? 'Upload signed KWS document (PDF required)'
                    : 'PDF upload disabled - use Drive Link above'}
                </p>
                
                <div className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center transition-colors",
                  selectedMilestone?.milestone_key === 'kws_signoff_document'
                    ? "border-slate-200 hover:border-indigo-300 cursor-pointer"
                    : "border-slate-100 bg-slate-50 cursor-not-allowed opacity-60"
                )}>
                  <Input
                    type="file"
                    multiple
                    accept="image/*,.pdf,.dwg,.dxf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="design-file-upload"
                    disabled={selectedMilestone?.milestone_key !== 'kws_signoff_document'}
                  />
                  <label 
                    htmlFor="design-file-upload" 
                    className={selectedMilestone?.milestone_key === 'kws_signoff_document' ? "cursor-pointer" : "cursor-not-allowed"}
                  >
                    <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-sm text-slate-600">
                      {selectedMilestone?.milestone_key === 'kws_signoff_document' 
                        ? 'Click to upload signed PDF'
                        : 'Upload disabled for this gate'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {selectedMilestone?.milestone_key === 'kws_signoff_document' 
                        ? 'Signed KWS document required'
                        : 'Use Drive Link instead'}
                    </p>
                  </label>
                </div>

                {submitForm.files.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {submitForm.files.map((file) => (
                      <div key={file.file_id} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                        <div className="flex items-center gap-2">
                          {file.file_type === 'render' ? (
                            <Image className="w-4 h-4 text-slate-500" />
                          ) : (
                            <FileText className="w-4 h-4 text-slate-500" />
                          )}
                          <span className="text-sm truncate max-w-[200px]">{file.file_name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(file.file_id)}
                        >
                          <XCircle className="w-4 h-4 text-slate-400" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div>
                <Label className="text-sm font-medium">Design Checklist *</Label>
                <p className="text-xs text-slate-500 mb-2">Complete all required items</p>
                
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {submitForm.checklist.map((item, index) => (
                    <div key={item.key} className="flex items-start gap-3 p-2 bg-slate-50 rounded">
                      <Checkbox
                        id={item.key}
                        checked={item.checked}
                        onCheckedChange={(checked) => handleChecklistChange(index, 'checked', checked)}
                      />
                      <div className="flex-1">
                        <Label htmlFor={item.key} className="text-sm cursor-pointer">
                          {item.label}
                          {item.required && <span className="text-red-500 ml-1">*</span>}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Design Notes */}
              <div>
                <Label className="text-sm font-medium">Design Notes *</Label>
                <Textarea
                  value={submitForm.design_notes}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, design_notes: e.target.value }))}
                  placeholder="Describe the design concept, key decisions, and any important details..."
                  rows={3}
                />
              </div>

              {/* Concept Summary */}
              <div>
                <Label className="text-sm font-medium">Concept Summary</Label>
                <Textarea
                  value={submitForm.concept_summary}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, concept_summary: e.target.value }))}
                  placeholder="Brief summary of the design concept for the client..."
                  rows={2}
                />
              </div>

              {/* Constraints Notes */}
              <div>
                <Label className="text-sm font-medium">Constraints & Limitations</Label>
                <Textarea
                  value={submitForm.constraints_notes}
                  onChange={(e) => setSubmitForm(prev => ({ ...prev, constraints_notes: e.target.value }))}
                  placeholder="Any constraints, limitations, or special considerations..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSubmitModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <Send className="w-4 h-4 mr-2" />
                Submit for Approval
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Review Modal */}
        <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Review Design Submission</DialogTitle>
            </DialogHeader>

            {selectedSubmission && (
              <div className="space-y-4 py-4">
                {/* Submission Info */}
                <div className="p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{selectedSubmission.milestone_name}</h4>
                    <Badge variant="outline">v{selectedSubmission.version}</Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Submitted by {selectedSubmission.submitted_by_name} on {formatDate(selectedSubmission.submitted_at)}
                  </p>
                </div>

                {/* Files */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Uploaded Files</Label>
                  <div className="space-y-1">
                    {selectedSubmission.files?.map((file) => (
                      <a
                        key={file.file_id}
                        href={file.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 p-2 bg-slate-50 rounded hover:bg-slate-100"
                      >
                        {file.file_type === 'render' ? (
                          <Image className="w-4 h-4 text-indigo-500" />
                        ) : (
                          <FileText className="w-4 h-4 text-indigo-500" />
                        )}
                        <span className="text-sm text-indigo-600 hover:underline">{file.file_name}</span>
                      </a>
                    ))}
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Checklist Status</Label>
                  <div className="space-y-1">
                    {selectedSubmission.checklist?.map((item) => (
                      <div key={item.key} className="flex items-center gap-2 text-sm">
                        {item.checked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-300" />
                        )}
                        <span className={item.checked ? "text-slate-700" : "text-slate-400"}>
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Design Notes */}
                <div>
                  <Label className="text-sm font-medium mb-1 block">Design Notes</Label>
                  <p className="text-sm text-slate-600 p-2 bg-slate-50 rounded">
                    {selectedSubmission.design_notes || '-'}
                  </p>
                </div>

                {selectedSubmission.concept_summary && (
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Concept Summary</Label>
                    <p className="text-sm text-slate-600 p-2 bg-slate-50 rounded">
                      {selectedSubmission.concept_summary}
                    </p>
                  </div>
                )}

                {selectedSubmission.constraints_notes && (
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Constraints</Label>
                    <p className="text-sm text-slate-600 p-2 bg-slate-50 rounded">
                      {selectedSubmission.constraints_notes}
                    </p>
                  </div>
                )}

                {/* Review Notes */}
                <div>
                  <Label className="text-sm font-medium mb-1 block">
                    Review Feedback {!reviewForm.approved && '*'}
                  </Label>
                  <Textarea
                    value={reviewForm.review_notes}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, review_notes: e.target.value }))}
                    placeholder="Provide feedback for the designer..."
                    rows={3}
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
                Request Revision
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

export default DesignApprovalPanel;
