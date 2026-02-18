import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { 
  ArrowLeft, 
  Loader2, 
  AlertCircle, 
  AlertTriangle,
  Check, 
  FileText,
  StickyNote,
  Users,
  LayoutDashboard,
  Plus,
  X,
  CalendarDays,
  IndianRupee,
  Wallet,
  Receipt,
  Edit2,
  Trash2,
  Pause,
  Play,
  Power,
  ChevronDown,
  Shield,
  Wrench,
  Settings,
  Clock,
  History,
  Package,
  Lock,
  ExternalLink,
  Grid
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { Textarea } from '../components/ui/textarea';
import { Switch } from '../components/ui/switch';
import CustomerDetailsSection from '../components/CustomerDetailsSection';
import DesignerAssignmentPanel from '../components/DesignerAssignmentPanel';
import TimelineIntelligencePanel from '../components/TimelineIntelligencePanel';
import DesignApprovalPanel from '../components/DesignApprovalPanel';
import {
  QuotationValuePrompt,
  ValueChangePrompt,
  SignOffConfirmation
} from '../components/MilestoneValuePrompts';

// Import extracted components
import { 
  TimelinePanel, 
  CommentsPanel, 
  StagesPanel, 
  FilesTab, 
  NotesTab, 
  CollaboratorsTab,
  CustomPaymentScheduleEditor,
  QuotationHistorySection,
  ValueLifecycleCard,
  STAGES,
  STAGE_COLORS,
  ROLE_BADGE_STYLES,
  formatRelativeTime 
} from '../components/project';
import MeetingModal from '../components/MeetingModal';
import MeetingCard from '../components/MeetingCard';
import TimelineAdjustmentModal, { TimelineHistoryModal } from '../components/TimelineAdjustmentModal';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Milestones that require quotation value entry
// These match substage names OR substage IDs in MILESTONE_GROUPS
const BOQ_MILESTONES = ['first_boq', 'boq_shared', 'First BOQ', 'BOQ Shared', 'Quotation'];
const REVISION_MILESTONES = ['revised_boq', 'Revised BOQ', 'Design Revision', 'design_revision'];
const SIGNOFF_MILESTONES = ['kws_signoff', 'KWS Sign-Off', 'design_signoff', 'Design Sign-Off'];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);
  
  // Sub-stage progression state
  const [completedSubStages, setCompletedSubStages] = useState([]);
  const [percentageSubStages, setPercentageSubStages] = useState({});
  
  // User milestone permissions (per-group)
  const [userMilestonePermissions, setUserMilestonePermissions] = useState({});
  
  // Files and Notes state
  const [files, setFiles] = useState([]);
  const [signoffDocuments, setSignoffDocuments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  
  // Meetings state
  const [meetings, setMeetings] = useState([]);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  
  // Financials state
  const [financials, setFinancials] = useState(null);
  const [loadingFinancials, setLoadingFinancials] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [editingProjectValue, setEditingProjectValue] = useState(false);
  const [newProjectValue, setNewProjectValue] = useState('');
  const [newPayment, setNewPayment] = useState({
    amount: '',
    mode: 'Bank',
    reference: '',
    date: new Date().toISOString().split('T')[0]
  });
  
  // Hold/Activate/Deactivate state
  const [showHoldModal, setShowHoldModal] = useState(false);
  const [holdAction, setHoldAction] = useState(null); // 'Hold', 'Activate', 'Deactivate'
  const [holdReason, setHoldReason] = useState('');
  const [isUpdatingHoldStatus, setIsUpdatingHoldStatus] = useState(false);
  
  // Milestone Value Prompts state
  const [showQuotationPrompt, setShowQuotationPrompt] = useState(false);
  const [showValueChangePrompt, setShowValueChangePrompt] = useState(false);
  const [showSignOffConfirmation, setShowSignOffConfirmation] = useState(false);
  const [pendingMilestone, setPendingMilestone] = useState(null); // { substageId, substageName, groupName }
  
  // Timeline Adjustment state
  const [showTimelineAdjustmentModal, setShowTimelineAdjustmentModal] = useState(false);
  const [showTimelineHistoryModal, setShowTimelineHistoryModal] = useState(false);
  const [isAdjustingTimeline, setIsAdjustingTimeline] = useState(false);
  const [timelineHistory, setTimelineHistory] = useState([]);
  
  // BOQ Builder state
  const [boqSummary, setBoqSummary] = useState(null);
  
  // Settings state
  const [gstApplicable, setGstApplicable] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // PreSales redirect
  useEffect(() => {
    if (user?.role === 'PreSales') {
      toast.error('Access denied');
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch project
  const fetchProject = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/projects/${id}`, {
        withCredentials: true
      });
      setProject(response.data);
      setFiles(response.data.files || []);
      setNotes(response.data.notes || []);
      setCollaborators(response.data.collaborators || []);
      setCompletedSubStages(response.data.completed_substages || []);
      setPercentageSubStages(response.data.percentage_substages || {});
      // Load GST settings
      setGstApplicable(response.data.gst_applicable || false);
      setGstNumber(response.data.gst_number || '');
      
      // Fetch BOQ summary
      try {
        const boqRes = await axios.get(`${API}/projects/${id}/boq/summary`, {
          withCredentials: true
        });
        setBoqSummary(boqRes.data);
      } catch (boqErr) {
        // BOQ might not exist yet, which is fine
        setBoqSummary(null);
      }
      
      // Fetch user milestone permissions from substages endpoint
      try {
        const substagesRes = await axios.get(`${API}/projects/${id}/substages`, {
          withCredentials: true
        });
        setUserMilestonePermissions(substagesRes.data.user_milestone_permissions || {});
      } catch (permErr) {
        console.error('Failed to fetch milestone permissions:', permErr);
        // Fallback: empty permissions means frontend falls back to canChangeStage
        setUserMilestonePermissions({});
      }
    } catch (err) {
      console.error('Failed to fetch project:', err);
      if (err.response?.status === 403) {
        toast.error('Access denied');
        navigate('/dashboard', { replace: true });
      } else {
        setError(err.response?.data?.detail || 'Failed to load project');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id && user?.role !== 'PreSales') {
      fetchProject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Fetch files for this project (includes sign-off documents)
  const fetchFiles = async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}/files`, {
        withCredentials: true
      });
      setFiles(response.data.files || []);
      setSignoffDocuments(response.data.signoff_documents || []);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  };

  // Fetch files when tab changes to files
  useEffect(() => {
    if (activeTab === 'files' && id && user?.role !== 'PreSales') {
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Fetch meetings for this project
  const fetchMeetings = async () => {
    try {
      setLoadingMeetings(true);
      const response = await axios.get(`${API}/projects/${id}/meetings`, {
        withCredentials: true
      });
      setMeetings(response.data || []);
    } catch (err) {
      console.error('Failed to fetch meetings:', err);
    } finally {
      setLoadingMeetings(false);
    }
  };

  // Fetch meetings when tab changes to meetings
  useEffect(() => {
    if (activeTab === 'meetings' && id) {
      fetchMeetings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Handle meeting status update
  const handleMeetingStatusUpdate = async (meetingId, status) => {
    try {
      await axios.put(`${API}/meetings/${meetingId}`, { status }, {
        withCredentials: true
      });
      toast.success(`Meeting ${status.toLowerCase()}`);
      fetchMeetings();
    } catch (err) {
      console.error('Failed to update meeting:', err);
      toast.error('Failed to update meeting');
    }
  };

  // Fetch financials for this project
  const fetchFinancials = async () => {
    try {
      setLoadingFinancials(true);
      const response = await axios.get(`${API}/projects/${id}/financials`, {
        withCredentials: true
      });
      setFinancials(response.data);
      setNewProjectValue(response.data.project_value?.toString() || '');
    } catch (err) {
      console.error('Failed to fetch financials:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoadingFinancials(false);
    }
  };

  // Fetch financials when tab changes to financials
  useEffect(() => {
    if (activeTab === 'financials' && id && user?.role !== 'PreSales') {
      fetchFinancials();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, id]);

  // Update project value
  const handleUpdateProjectValue = async () => {
    const value = parseFloat(newProjectValue);
    if (isNaN(value) || value < 0) {
      toast.error('Please enter a valid project value');
      return;
    }
    
    try {
      await axios.put(`${API}/projects/${id}/financials`, {
        project_value: value
      }, { withCredentials: true });
      
      toast.success('Project value updated');
      setEditingProjectValue(false);
      fetchFinancials();
    } catch (err) {
      console.error('Failed to update project value:', err);
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  // Save GST settings
  const handleSaveGstSettings = async () => {
    try {
      setSavingSettings(true);
      await axios.put(`${API}/projects/${id}/settings`, {
        gst_applicable: gstApplicable,
        gst_number: gstNumber || null
      }, { withCredentials: true });
      
      toast.success('Settings saved successfully');
      // Update local project state
      setProject(prev => ({ ...prev, gst_applicable: gstApplicable, gst_number: gstNumber }));
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add payment
  const handleAddPayment = async () => {
    const amount = parseFloat(newPayment.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    try {
      await axios.post(`${API}/projects/${id}/payments`, {
        amount,
        mode: newPayment.mode,
        reference: newPayment.reference,
        date: newPayment.date
      }, { withCredentials: true });
      
      toast.success('Payment added');
      setShowAddPaymentModal(false);
      setNewPayment({
        amount: '',
        mode: 'Bank',
        reference: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchFinancials();
    } catch (err) {
      console.error('Failed to add payment:', err);
      toast.error(err.response?.data?.detail || 'Failed to add payment');
    }
  };

  // Delete payment (Admin only)
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm('Are you sure you want to delete this payment?')) return;
    
    try {
      await axios.delete(`${API}/projects/${id}/payments/${paymentId}`, {
        withCredentials: true
      });
      
      toast.success('Payment deleted');
      fetchFinancials();
    } catch (err) {
      console.error('Failed to delete payment:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete payment');
    }
  };

  // Add comment
  const handleAddComment = async (message) => {
    try {
      setIsSubmittingComment(true);
      const response = await axios.post(`${API}/projects/${id}/comments`, 
        { message },
        { withCredentials: true }
      );
      
      // Add new comment to local state
      setProject(prev => ({
        ...prev,
        comments: [...(prev.comments || []), response.data]
      }));
      
      toast.success('Comment added');
    } catch (err) {
      console.error('Failed to add comment:', err);
      toast.error('Failed to add comment');
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Update stage (legacy - kept for backward compatibility)
  const handleStageChange = async (newStage) => {
    if (newStage === project?.stage) return;
    
    try {
      setIsUpdatingStage(true);
      await axios.put(`${API}/projects/${id}/stage`,
        { stage: newStage },
        { withCredentials: true }
      );
      
      // Refetch project to get updated timeline and comments
      await fetchProject();
      toast.success(`Stage updated to "${newStage}"`);
    } catch (err) {
      console.error('Failed to update stage:', err);
      toast.error(err.response?.data?.detail || 'Failed to update stage');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Check if milestone requires value prompt before completion
  const checkMilestoneValuePrompt = (substageId, substageName, groupName) => {
    const currentQuotationValue = project?.quotation_history?.length > 0
      ? project.quotation_history[project.quotation_history.length - 1].quoted_value
      : 0;

    // Helper to check if any milestone pattern matches
    const matchesMilestone = (patterns) => {
      return patterns.some(m => {
        const mLower = m.toLowerCase();
        return substageId.toLowerCase().includes(mLower) || 
               substageName.toLowerCase().includes(mLower) || 
               groupName.toLowerCase().includes(mLower);
      });
    };

    // BOQ milestones - require quotation value entry (only if no quotation exists)
    if (matchesMilestone(BOQ_MILESTONES)) {
      if (currentQuotationValue <= 0) {
        setPendingMilestone({ substageId, substageName, groupName });
        setShowQuotationPrompt(true);
        return true;
      }
    }

    // Revision milestones - ask if value changed (only if quotation exists)
    if (matchesMilestone(REVISION_MILESTONES)) {
      if (currentQuotationValue > 0) {
        setPendingMilestone({ substageId, substageName, groupName });
        setShowValueChangePrompt(true);
        return true;
      }
    }

    // Sign-off milestones - require confirmation before locking
    if (matchesMilestone(SIGNOFF_MILESTONES)) {
      if (!project?.signoff_locked) {
        setPendingMilestone({ substageId, substageName, groupName });
        setShowSignOffConfirmation(true);
        return true;
      }
    }

    return false;
  };

  // Actually complete the milestone (called after value prompt)
  const executeSubStageComplete = async (substageId, substageName, groupName) => {
    try {
      setIsUpdatingStage(true);
      const response = await axios.post(`${API}/projects/${id}/substage/complete`,
        { 
          substage_id: substageId,
          substage_name: substageName,
          group_name: groupName
        },
        { withCredentials: true }
      );
      
      // Update local state FIRST
      const newCompletedSubStages = response.data.completed_substages || [];
      setCompletedSubStages(newCompletedSubStages);
      
      // Also update the project state to include the new substages
      setProject(prev => prev ? {
        ...prev,
        completed_substages: newCompletedSubStages,
        stage: response.data.current_stage || prev.stage
      } : prev);
      
      // Show success message
      if (response.data.group_complete) {
        toast.success(`🎉 Milestone "${groupName}" completed!`);
      } else {
        toast.success(`✅ "${substageName}" completed`);
      }
      
      // Refetch to get updated comments and quotation history
      await fetchProject();
    } catch (err) {
      console.error('Failed to complete sub-stage:', err);
      toast.error(err.response?.data?.detail || 'Failed to complete step');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Complete a sub-stage (new sub-stage progression system)
  const handleSubStageComplete = async (substageId, substageName, groupName) => {
    // Check if this milestone requires a value prompt
    if (checkMilestoneValuePrompt(substageId, substageName, groupName)) {
      return; // Prompt will handle completion
    }

    // No prompt needed - complete directly
    await executeSubStageComplete(substageId, substageName, groupName);
  };

  // Handle quotation prompt completion
  const handleQuotationPromptComplete = async (quotationValue) => {
    setShowQuotationPrompt(false);
    if (pendingMilestone) {
      await executeSubStageComplete(
        pendingMilestone.substageId,
        pendingMilestone.substageName,
        pendingMilestone.groupName
      );
      setPendingMilestone(null);
    }
  };

  // Handle value change prompt completion
  const handleValueChangePromptComplete = async (quotationValue) => {
    setShowValueChangePrompt(false);
    if (pendingMilestone) {
      await executeSubStageComplete(
        pendingMilestone.substageId,
        pendingMilestone.substageName,
        pendingMilestone.groupName
      );
      setPendingMilestone(null);
    }
  };

  // Handle sign-off confirmation completion
  const handleSignOffConfirmationComplete = async (signoffValue) => {
    setShowSignOffConfirmation(false);
    if (pendingMilestone) {
      await executeSubStageComplete(
        pendingMilestone.substageId,
        pendingMilestone.substageName,
        pendingMilestone.groupName
      );
      setPendingMilestone(null);
    }
    // Refresh to show locked value
    await fetchProject();
  };

  // Cancel any value prompt
  const handleValuePromptCancel = () => {
    setShowQuotationPrompt(false);
    setShowValueChangePrompt(false);
    setShowSignOffConfirmation(false);
    setPendingMilestone(null);
    toast.info('Milestone completion cancelled');
  };

  // Update a percentage-based sub-stage (Non-Modular Dependency Works)
  const handlePercentageUpdate = async (substageId, substageName, groupName, percentage, comment) => {
    try {
      setIsUpdatingStage(true);
      const response = await axios.post(`${API}/projects/${id}/substage/percentage`,
        { 
          substage_id: substageId,
          percentage: percentage,
          comment: comment
        },
        { withCredentials: true }
      );
      
      // Update local state
      const newPercentageSubStages = response.data.percentage_substages || {};
      setPercentageSubStages(newPercentageSubStages);
      
      // If auto-completed, also update completed substages
      if (response.data.auto_completed) {
        const newCompletedSubStages = response.data.completed_substages || [];
        setCompletedSubStages(newCompletedSubStages);
        
        setProject(prev => prev ? {
          ...prev,
          completed_substages: newCompletedSubStages,
          percentage_substages: newPercentageSubStages
        } : prev);
        
        if (response.data.group_complete) {
          toast.success(`🎉 Milestone "${groupName}" completed!`);
        } else {
          toast.success(`✅ "${substageName}" completed at 100%`);
        }
      } else {
        setProject(prev => prev ? {
          ...prev,
          percentage_substages: newPercentageSubStages
        } : prev);
        
        toast.success(`📊 Progress updated to ${percentage}%`);
      }
      
      // Refetch to get updated comments
      const commentsResponse = await axios.get(`${API}/projects/${id}`, {
        withCredentials: true
      });
      if (commentsResponse.data) {
        setProject(prev => prev ? {
          ...prev,
          comments: commentsResponse.data.comments || [],
          completed_substages: response.data.auto_completed ? response.data.completed_substages : prev.completed_substages,
          percentage_substages: newPercentageSubStages
        } : prev);
      }
    } catch (err) {
      console.error('Failed to update percentage:', err);
      toast.error(err.response?.data?.detail || 'Failed to update progress');
    } finally {
      setIsUpdatingStage(false);
    }
  };

  // Update customer details on project (Admin/SalesManager only)
  const handleUpdateCustomerDetails = async (updatedData) => {
    try {
      await axios.put(`${API}/projects/${id}/customer-details`, updatedData, {
        withCredentials: true
      });
      toast.success('Customer details updated');
      fetchProject(); // Refresh project data
    } catch (err) {
      console.error('Failed to update customer details:', err);
      toast.error(err.response?.data?.detail || 'Failed to update customer details');
      throw err;
    }
  };
  
  // Can edit customer details on project (Admin/SalesManager only)
  const canEditProjectCustomerDetails = () => {
    return user?.role === 'Admin' || user?.role === 'SalesManager';
  };

  // Check if user can change stage
  const canChangeStage = () => {
    if (!user || !project) return false;
    // Users with projects.update permission can change stage
    if (hasPermission('projects.update') || hasPermission('milestones.update.design')) return true;
    // Collaborators on the project can also change stage
    if (project.collaborators?.some(c => c.user_id === user.user_id)) return true;
    return false;
  };
  
  // Hold/Activate/Deactivate permission checks
  const canHold = () => {
    if (!user) return false;
    return hasPermission('projects.hold');
  };
  
  const canActivateOrDeactivate = () => {
    if (!user) return false;
    return hasPermission('projects.activate') || hasPermission('projects.deactivate');
  };
  
  // Handle hold status actions
  const openHoldModal = (action) => {
    setHoldAction(action);
    setHoldReason('');
    setShowHoldModal(true);
  };
  
  const handleHoldStatusUpdate = async () => {
    if (!holdReason.trim()) {
      toast.error('Please provide a reason for this action');
      return;
    }
    
    try {
      setIsUpdatingHoldStatus(true);
      await axios.put(`${API}/projects/${id}/hold-status`, {
        action: holdAction,
        reason: holdReason.trim()
      }, { withCredentials: true });
      
      toast.success(`Project ${holdAction.toLowerCase()}d successfully`);
      setShowHoldModal(false);
      setHoldReason('');
      setHoldAction(null);
      await fetchProject();
    } catch (err) {
      console.error('Failed to update hold status:', err);
      toast.error(err.response?.data?.detail || 'Failed to update status');
    } finally {
      setIsUpdatingHoldStatus(false);
    }
  };

  // Timeline adjustment handlers
  const handleTimelineAdjustment = async (formData) => {
    try {
      setIsAdjustingTimeline(true);
      await axios.post(`${API}/projects/${id}/adjust-timeline`, {
        reason: formData.reason,
        remarks: formData.remarks,
        effective_date: formData.effective_date,
        adjustment_type: formData.adjustment_type,
        shift_days: formData.shift_days || null,
        new_completion_date: formData.new_completion_date || null
      }, { withCredentials: true });
      
      toast.success('Timeline adjusted successfully');
      setShowTimelineAdjustmentModal(false);
      await fetchProject();
    } catch (err) {
      console.error('Failed to adjust timeline:', err);
      toast.error(err.response?.data?.detail || 'Failed to adjust timeline');
    } finally {
      setIsAdjustingTimeline(false);
    }
  };
  
  const fetchTimelineHistory = async () => {
    try {
      const response = await axios.get(`${API}/projects/${id}/timeline-history`, {
        withCredentials: true
      });
      setTimelineHistory(response.data.timeline_adjustments || []);
      setShowTimelineHistoryModal(true);
    } catch (err) {
      console.error('Failed to fetch timeline history:', err);
      toast.error('Failed to load timeline history');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16" data-testid="project-loading">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6" data-testid="project-error">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate('/projects')}
          className="text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Projects
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
    <div className="space-y-6" data-testid="project-details-page">
      {/* Back Button */}
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => navigate('/projects')}
        className="text-slate-600 hover:text-slate-900 -ml-2"
        data-testid="back-to-projects-btn"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Projects
      </Button>

      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* PID Badge - Always visible if exists */}
            {project?.pid && (
              <span 
                className="inline-flex items-center rounded-md bg-slate-900 px-2.5 py-1 text-sm font-mono font-bold text-white"
                data-testid="project-pid-badge"
              >
                {project.pid.replace('ARKI-', '')}
              </span>
            )}
            <h1 
              className="text-2xl font-bold tracking-tight text-slate-900"
              style={{ fontFamily: 'Manrope, sans-serif' }}
            >
              {project?.project_name}
            </h1>
            {/* Hold Status Badge */}
            {project?.hold_status && project.hold_status !== 'Active' && (
              <span 
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  project.hold_status === 'Hold' && 'bg-amber-100 text-amber-700',
                  project.hold_status === 'Deactivated' && 'bg-red-100 text-red-700'
                )}
                data-testid="project-hold-status-badge"
              >
                {project.hold_status === 'Hold' && <Pause className="w-3 h-3 mr-1" />}
                {project.hold_status === 'Deactivated' && <Power className="w-3 h-3 mr-1" />}
                {project.hold_status}
              </span>
            )}
            {user?.role && (
              <span 
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  ROLE_BADGE_STYLES[user.role] || 'bg-slate-100 text-slate-700'
                )}
                data-testid="user-role-badge"
              >
                {user.role}
              </span>
            )}
          </div>
          <p className="text-slate-500 mt-1">
            {project?.pid && <span className="font-medium text-slate-700">{project.pid.replace('ARKI-', '')} • </span>}
            Client: {project?.client_name} • Last updated {formatRelativeTime(project?.updated_at)}
          </p>
        </div>
        
        {/* Right side: Stage Badge + Finance + Status Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Finance Details Button */}
          <Button
            variant="outline"
            size="sm"
            className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            onClick={() => navigate(`/finance/project-finance/${project?.project_id}`)}
            data-testid="project-finance-btn"
          >
            <IndianRupee className="w-3.5 h-3.5 mr-1" />
            Finance Details
          </Button>
          
          {/* Status Dropdown */}
          {(canHold() || canActivateOrDeactivate()) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-slate-600 border-slate-300 hover:bg-slate-50"
                  data-testid="status-dropdown-btn"
                >
                  Status
                  <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {/* Show Hold option if status is Active and user can hold */}
                {project?.hold_status !== 'Hold' && project?.hold_status !== 'Deactivated' && canHold() && (
                  <DropdownMenuItem
                    onClick={() => openHoldModal('Hold')}
                    className="text-amber-600 cursor-pointer"
                    data-testid="hold-option"
                  >
                    <Pause className="w-4 h-4 mr-2" />
                    Hold
                  </DropdownMenuItem>
                )}
                {/* Show Activate option if status is Hold or Deactivated */}
                {(project?.hold_status === 'Hold' || project?.hold_status === 'Deactivated') && canActivateOrDeactivate() && (
                  <DropdownMenuItem
                    onClick={() => openHoldModal('Activate')}
                    className="text-green-600 cursor-pointer"
                    data-testid="activate-option"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Activate
                  </DropdownMenuItem>
                )}
                {/* Show Deactivate option if status is not already Deactivated */}
                {project?.hold_status !== 'Deactivated' && canActivateOrDeactivate() && (
                  <DropdownMenuItem
                    onClick={() => openHoldModal('Deactivate')}
                    className="text-red-600 cursor-pointer"
                    data-testid="deactivate-option"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    Deactivate
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          
          {/* Timeline Adjustment Buttons */}
          {hasPermission('timeline.adjust') && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimelineAdjustmentModal(true)}
                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                data-testid="adjust-timeline-btn"
              >
                <Clock className="w-4 h-4 mr-1.5" />
                {project?.current_timeline?.on_hold ? 'Resume Timeline' : 'Adjust Timeline'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchTimelineHistory}
                className="text-slate-500 hover:text-slate-700"
                data-testid="timeline-history-btn"
                title="View Timeline History"
              >
                <History className="w-4 h-4" />
              </Button>
            </div>
          )}
          
          {/* Composer Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/projects/${id}/spatial-boq`)}
            className="text-violet-600 border-violet-300 hover:bg-violet-50"
            data-testid="open-composer-btn"
          >
            <Grid className="w-4 h-4 mr-1.5" />
            Open Composer
          </Button>
          
          {/* Current Stage Badge */}
          {project?.stage && (
            <span 
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-medium",
                STAGE_COLORS[project.stage]?.bg,
                STAGE_COLORS[project.stage]?.text
              )}
              data-testid="project-stage-badge"
            >
              {project.stage}
            </span>
          )}
        </div>
      </div>

      {/* Customer Details Section - Visible on all project views */}
      <CustomerDetailsSection
        data={project}
        canEdit={canEditProjectCustomerDetails()}
        onSave={handleUpdateCustomerDetails}
        isProject={true}
      />

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger 
            value="overview" 
            className="data-[state=active]:bg-white"
            data-testid="tab-overview"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger 
            value="files" 
            className="data-[state=active]:bg-white"
            data-testid="tab-files"
          >
            <FileText className="w-4 h-4 mr-2" />
            Files
          </TabsTrigger>
          <TabsTrigger 
            value="notes" 
            className="data-[state=active]:bg-white"
            data-testid="tab-notes"
          >
            <StickyNote className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger 
            value="collaborators" 
            className="data-[state=active]:bg-white"
            data-testid="tab-collaborators"
          >
            <Users className="w-4 h-4 mr-2" />
            Team
          </TabsTrigger>
          <TabsTrigger 
            value="meetings" 
            className="data-[state=active]:bg-white"
            data-testid="tab-meetings"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Meetings
          </TabsTrigger>
          {user?.role !== 'PreSales' && (
            <TabsTrigger 
              value="financials" 
              className="data-[state=active]:bg-white"
              data-testid="tab-financials"
            >
              <IndianRupee className="w-4 h-4 mr-2" />
              Financials
            </TabsTrigger>
          )}
          {user?.role !== 'PreSales' && (
            <TabsTrigger 
              value="warranty" 
              className="data-[state=active]:bg-white"
              data-testid="tab-warranty"
            >
              <Shield className="w-4 h-4 mr-2" />
              Warranty & Service
            </TabsTrigger>
          )}
          {['Admin', 'Founder', 'ProjectManager'].includes(user?.role) && (
            <TabsTrigger 
              value="settings" 
              className="data-[state=active]:bg-white"
              data-testid="tab-settings"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" data-testid="overview-tab">
            {/* Left Column - Timeline (25%) */}
            <Card className="border-slate-200 lg:col-span-1">
              <CardContent className="p-4">
                <TimelinePanel timeline={project?.timeline || []} currentStage={project?.stage} />
              </CardContent>
            </Card>

            {/* Center Column - Comments (50%) */}
            <Card className="border-slate-200 lg:col-span-2 flex flex-col" style={{ minHeight: '500px' }}>
              <CardContent className="p-4 flex-1 flex flex-col">
                <CommentsPanel 
                  comments={project?.comments || []}
                  onAddComment={handleAddComment}
                  isSubmitting={isSubmittingComment}
                  showLeadHistory={!!project?.lead_id}
                  leadId={project?.lead_id}
                />
              </CardContent>
            </Card>

            {/* Right Column - Milestones (25%) */}
            <div className="lg:col-span-1 space-y-4">
              <Card className="border-slate-200">
                <CardContent className="p-4">
                  <StagesPanel 
                    currentStage={project?.stage}
                    completedSubStages={completedSubStages}
                    percentageSubStages={percentageSubStages}
                    onSubStageComplete={handleSubStageComplete}
                    onPercentageUpdate={handlePercentageUpdate}
                    canChangeStage={canChangeStage()}
                    isUpdating={isUpdatingStage}
                    userRole={user?.role}
                    holdStatus={project?.hold_status || 'Active'}
                    userMilestonePermissions={userMilestonePermissions}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Value Lifecycle & Quotation History - Below main grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ValueLifecycleCard
              projectId={id}
              inquiryValue={project?.budget || project?.inquiry_value || 0}
              bookedValue={project?.booked_value || 0}
              contractValue={project?.contract_value || project?.project_value || 0}
              isContractLocked={project?.contract_value_locked || false}
              lockedAt={project?.contract_value_locked_at}
              lockedByName={project?.contract_value_locked_by_name}
              discountAmount={project?.discount_amount || 0}
              discountReason={project?.discount_reason}
              discountApprovedByName={project?.discount_approved_by_name}
              currentStage={project?.stage}
              userRole={user?.role}
              onDataUpdated={fetchProject}
            />
            <QuotationHistorySection
              entityType="project"
              entityId={id}
              quotationHistory={project?.quotation_history || []}
              canAddEntry={canChangeStage() || user?.role === 'Admin' || user?.role === 'Founder'}
              onHistoryUpdated={fetchProject}
            />
          </div>

          {/* BOQ Builder Section */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-slate-600" />
                  <CardTitle className="text-lg">Bill of Quantities (BOQ)</CardTitle>
                </div>
                <Button
                  onClick={() => navigate(`/projects/${id}/boq`)}
                  data-testid="open-boq-builder"
                >
                  {boqSummary?.has_boq ? (
                    <>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open BOQ
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Create BOQ
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {boqSummary?.has_boq ? (
                <div className="space-y-4">
                  {/* BOQ Status Badge */}
                  <div className="flex items-center gap-2">
                    <Badge className={
                      boqSummary.status === 'locked' ? 'bg-green-100 text-green-800' :
                      boqSummary.status === 'under_review' ? 'bg-amber-100 text-amber-800' :
                      'bg-slate-100 text-slate-700'
                    }>
                      {boqSummary.status === 'locked' && <Lock className="h-3 w-3 mr-1" />}
                      {boqSummary.status === 'locked' ? 'Locked' :
                       boqSummary.status === 'under_review' ? 'Under Review' : 'Draft'}
                    </Badge>
                    <span className="text-sm text-slate-500">Version {boqSummary.version}</span>
                  </div>

                  {/* BOQ Summary */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase">Grand Total</p>
                      <p className="text-lg font-semibold">
                        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(boqSummary.grand_total || 0)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase">Rooms</p>
                      <p className="text-lg font-semibold">{boqSummary.room_count || 0}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500 uppercase">Items</p>
                      <p className="text-lg font-semibold">{boqSummary.item_count || 0}</p>
                    </div>
                  </div>

                  {/* Room Summary */}
                  {boqSummary.room_summary && boqSummary.room_summary.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-slate-700">Room Breakdown</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {boqSummary.room_summary.slice(0, 6).map((room, idx) => (
                          <div key={idx} className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="text-slate-600">{room.name}</span>
                            <span className="font-medium">
                              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(room.subtotal || 0)}
                            </span>
                          </div>
                        ))}
                        {boqSummary.room_summary.length > 6 && (
                          <div className="col-span-2 text-center text-slate-500 text-xs">
                            +{boqSummary.room_summary.length - 6} more rooms
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Last Updated */}
                  {boqSummary.updated_at && (
                    <p className="text-xs text-slate-400">
                      Last updated: {new Date(boqSummary.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {boqSummary.updated_by_name && ` by ${boqSummary.updated_by_name}`}
                    </p>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                  <p className="text-slate-500">No BOQ created yet</p>
                  <p className="text-sm text-slate-400">Create a detailed Bill of Quantities for this project</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Intelligence Panel */}
          <TimelineIntelligencePanel
            projectId={id}
            canManage={canChangeStage() || user?.role === 'Admin' || user?.role === 'Founder' || project?.primary_designer_id === user?.user_id}
            isManager={user?.role === 'DesignManager' || user?.role === 'Admin' || user?.role === 'Founder' || user?.role === 'Manager'}
          />

          {/* Design Approval Gate Panel */}
          <DesignApprovalPanel
            projectId={id}
            canSubmit={canChangeStage() || project?.primary_designer_id === user?.user_id}
            isManager={user?.role === 'DesignManager' || user?.role === 'Admin' || user?.role === 'Founder' || user?.role === 'Manager'}
            onStatusChange={fetchProject}
          />
        </div>
      )}

      {activeTab === 'files' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <FilesTab 
              projectId={id}
              files={files}
              onFilesChange={setFiles}
              userRole={user?.role}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'notes' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <NotesTab 
              projectId={id}
              notes={notes}
              onNotesChange={setNotes}
              userRole={user?.role}
              currentUserId={user?.user_id}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'collaborators' && (
        <div className="space-y-6">
          {/* Designer Assignment Panel - Primary at top */}
          <DesignerAssignmentPanel 
            projectId={id}
            currentPrimaryDesigner={project?.primary_designer_name}
            onUpdate={fetchProject}
          />
          
          {/* Team Collaborators */}
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <CollaboratorsTab 
                projectId={id}
                collaborators={collaborators}
                onCollaboratorsChange={setCollaborators}
                userRole={user?.role}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'meetings' && (
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Project Meetings</h3>
              <Button 
                onClick={() => setShowMeetingModal(true)}
                className="bg-purple-600 hover:bg-purple-700"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-2" />
                Schedule Meeting
              </Button>
            </div>
            
            {loadingMeetings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
              </div>
            ) : meetings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <CalendarDays className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p>No meetings scheduled for this project</p>
                <Button 
                  variant="link" 
                  onClick={() => setShowMeetingModal(true)}
                  className="text-purple-600 mt-2"
                >
                  Schedule your first meeting
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map(meeting => (
                  <MeetingCard
                    key={meeting.id}
                    meeting={meeting}
                    showProject={false}
                    onMarkCompleted={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Completed')}
                    onCancel={(meetingId) => handleMeetingStatusUpdate(meetingId, 'Cancelled')}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Financials Tab */}
      {activeTab === 'financials' && user?.role !== 'PreSales' && (
        <div className="space-y-6">
          {loadingFinancials ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            </div>
          ) : financials ? (
            <>
              {/* Sign-off Pending Banner */}
              {financials.finance_status === 'signoff_pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800">Sign-off Pending</p>
                      <p className="text-sm text-amber-600">Financial calculations require sign-off lock. Complete design sign-off to enable payment milestones.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sign-off Value Card (Execution Revenue Baseline) */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-500">Sign-off Value</span>
                      {financials.signoff_locked && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Locked</span>
                      )}
                    </div>
                    {financials.signoff_value > 0 ? (
                      <p className="text-2xl font-bold text-slate-900">
                        ₹{financials.signoff_value?.toLocaleString('en-IN')}
                      </p>
                    ) : (
                      <p className="text-lg font-medium text-amber-600">Sign-off Pending</p>
                    )}
                    {financials.presales_budget > 0 && financials.presales_budget !== financials.signoff_value && (
                      <p className="text-xs text-slate-400 mt-1">
                        Pre-sales estimate: ₹{financials.presales_budget?.toLocaleString('en-IN')}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Total Collected Card */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-emerald-600" />
                      <span className="text-sm text-slate-500">Total Collected</span>
                    </div>
                    <p className="text-2xl font-bold text-emerald-600">
                      ₹{financials.total_collected?.toLocaleString('en-IN') || '0'}
                    </p>
                  </CardContent>
                </Card>

                {/* Balance Pending Card */}
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="h-4 w-4 text-amber-600" />
                      <span className="text-sm text-slate-500">Balance Pending</span>
                    </div>
                    {financials.signoff_value > 0 ? (
                      <p className={cn(
                        "text-2xl font-bold",
                        financials.balance_pending <= 0 ? "text-emerald-600" : "text-amber-600",
                        financials.balance_pending < 0 && "text-red-600"
                      )}>
                        ₹{Math.abs(financials.balance_pending)?.toLocaleString('en-IN') || '0'}
                        {financials.balance_pending < 0 && <span className="text-sm ml-1">(Overpaid)</span>}
                      </p>
                    ) : (
                      <p className="text-lg font-medium text-slate-400">—</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Payment Schedule */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <IndianRupee className="h-5 w-5 text-emerald-600" />
                      Payment Milestones
                    </CardTitle>
                    {financials.can_edit && (
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={financials.custom_payment_schedule_enabled || false}
                            onChange={async (e) => {
                              try {
                                await axios.put(`${API}/projects/${id}/financials`, {
                                  custom_payment_schedule_enabled: e.target.checked
                                }, { withCredentials: true });
                                toast.success(e.target.checked ? 'Custom schedule enabled' : 'Using default schedule');
                                fetchFinancials();
                              } catch (err) {
                                toast.error('Failed to update');
                              }
                            }}
                            className="rounded border-slate-300"
                          />
                          <span className="text-slate-600">Use Custom Schedule</span>
                        </label>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Sign-off Pending Message for Milestones */}
                  {financials.finance_status === 'signoff_pending' && (
                    <div className="text-center py-8 text-slate-500">
                      <AlertTriangle className="h-10 w-10 mx-auto text-amber-400 mb-3" />
                      <p className="font-medium">Payment milestones unavailable</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Complete design sign-off to calculate payment milestones
                      </p>
                    </div>
                  )}
                  
                  {/* Default Schedule Display - Only when signoff is locked */}
                  {financials.finance_status !== 'signoff_pending' && !financials.custom_payment_schedule_enabled && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {financials.payment_schedule?.map((milestone, index) => (
                          <div key={index} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-sm font-semibold text-slate-700">{milestone.stage}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {milestone.type === 'fixed' && `Fixed: ₹${milestone.fixedAmount?.toLocaleString('en-IN')}`}
                              {milestone.type === 'percentage' && `${milestone.percentage}% of sign-off value`}
                              {milestone.type === 'remaining' && 'Remaining balance'}
                            </p>
                            <p className="text-xl font-bold text-emerald-600 mt-2">
                              ₹{milestone.amount?.toLocaleString('en-IN') || '0'}
                            </p>
                          </div>
                        ))}
                      </div>
                      
                      {/* Edit Default Schedule for Admin/Manager */}
                      {financials.can_edit && (
                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <p className="text-sm font-medium text-blue-700 mb-3">
                            Edit Design Booking Type
                          </p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="bookingType"
                                checked={financials.default_payment_schedule?.[0]?.type === 'fixed'}
                                onChange={async () => {
                                  const newSchedule = [...(financials.default_payment_schedule || [])];
                                  newSchedule[0] = { ...newSchedule[0], type: 'fixed' };
                                  try {
                                    await axios.put(`${API}/projects/${id}/financials`, {
                                      payment_schedule: newSchedule
                                    }, { withCredentials: true });
                                    toast.success('Changed to fixed ₹25,000');
                                    fetchFinancials();
                                  } catch (err) {
                                    toast.error('Failed to update');
                                  }
                                }}
                                className="text-emerald-600"
                              />
                              <span>Fixed ₹25,000</span>
                            </label>
                            <label className="flex items-center gap-2 text-sm cursor-pointer">
                              <input
                                type="radio"
                                name="bookingType"
                                checked={financials.default_payment_schedule?.[0]?.type === 'percentage'}
                                onChange={async () => {
                                  const newSchedule = [...(financials.default_payment_schedule || [])];
                                  newSchedule[0] = { ...newSchedule[0], type: 'percentage' };
                                  try {
                                    await axios.put(`${API}/projects/${id}/financials`, {
                                      payment_schedule: newSchedule
                                    }, { withCredentials: true });
                                    toast.success('Changed to 10% of project value');
                                    fetchFinancials();
                                  } catch (err) {
                                    toast.error('Failed to update');
                                  }
                                }}
                                className="text-emerald-600"
                              />
                              <span>10% of Sign-off Value</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Custom Schedule Editor - Only when signoff is locked */}
                  {financials.finance_status !== 'signoff_pending' && financials.custom_payment_schedule_enabled && (
                    <CustomPaymentScheduleEditor
                      schedule={financials.custom_payment_schedule || []}
                      projectValue={financials.signoff_value || 0}
                      canEdit={financials.can_edit}
                      onSave={async (newSchedule) => {
                        try {
                          await axios.put(`${API}/projects/${id}/financials`, {
                            custom_payment_schedule: newSchedule
                          }, { withCredentials: true });
                          toast.success('Custom schedule saved');
                          fetchFinancials();
                        } catch (err) {
                          toast.error(err.response?.data?.detail || 'Failed to save');
                        }
                      }}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-emerald-600" />
                      Payment History
                    </CardTitle>
                    {/* Add Payment button removed - payments via CashBook only */}
                  </div>
                </CardHeader>
                <CardContent>
                  {financials.payments?.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Receipt className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                      <p>No payments recorded yet</p>
                      <p className="text-xs text-slate-400 mt-2">
                        Payments are recorded via CashBook and linked to this project
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Date</th>
                            <th className="text-right py-2 px-3 text-slate-500 font-medium">Amount</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Mode</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Reference</th>
                            <th className="text-left py-2 px-3 text-slate-500 font-medium">Added By</th>
                            {financials.can_delete_payments && (
                              <th className="text-center py-2 px-3 text-slate-500 font-medium">Actions</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {financials.payments?.map((payment) => (
                            <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="py-3 px-3 text-slate-700">
                                {new Date(payment.date).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </td>
                              <td className="py-3 px-3 text-right font-medium text-emerald-600">
                                ₹{payment.amount?.toLocaleString('en-IN')}
                              </td>
                              <td className="py-3 px-3">
                                <Badge variant="secondary" className="text-xs">
                                  {payment.mode}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {payment.reference || '-'}
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {payment.added_by_name || 'Unknown'}
                              </td>
                              {financials.can_delete_payments && (
                                <td className="py-3 px-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePayment(payment.id)}
                                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Unable to load financial data</p>
            </div>
          )}
        </div>
      )}

      {/* Warranty & Service Tab */}
      {activeTab === 'warranty' && user?.role !== 'PreSales' && (
        <WarrantyServiceTab projectId={id} pid={project?.pid} />
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && ['Admin', 'Founder', 'ProjectManager'].includes(user?.role) && (
        <div className="space-y-6" data-testid="settings-tab">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-slate-600" />
                Project Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GST Settings Section */}
              <div className="border rounded-lg p-4 bg-slate-50">
                <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4 text-blue-600" />
                  GST Settings (Customer Invoices)
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="gst-toggle" className="text-sm font-medium">
                        GST Applicable
                      </Label>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enable GST for customer tax invoices generated for this project
                      </p>
                    </div>
                    <Switch
                      id="gst-toggle"
                      checked={gstApplicable}
                      onCheckedChange={setGstApplicable}
                      data-testid="gst-toggle"
                    />
                  </div>
                  
                  {gstApplicable && (
                    <div>
                      <Label htmlFor="gst-number" className="text-sm font-medium">
                        GST Number (optional)
                      </Label>
                      <Input
                        id="gst-number"
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                        placeholder="e.g., 22AAAAA0000A1Z5"
                        className="mt-1.5 max-w-sm"
                        maxLength={15}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Client&apos;s GST number for tax invoice generation
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <strong>Note:</strong> The GST toggle affects <strong>customer tax invoices</strong> generated for this project. 
                It does not affect <strong>purchase invoices</strong> (vendor bills), which have their own line-item GST handling.
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button 
                  onClick={handleSaveGstSettings}
                  disabled={savingSettings}
                  data-testid="save-settings-btn"
                >
                  {savingSettings ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Save Settings
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Payment Modal */}
      <Dialog open={showAddPaymentModal} onOpenChange={setShowAddPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5 text-emerald-600" />
              Add Payment
            </DialogTitle>
            <DialogDescription>
              Record a new payment for this project
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="payment-amount">Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  id="payment-amount"
                  type="number"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0"
                  className="pl-8"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="payment-mode">Payment Mode</Label>
              <Select
                value={newPayment.mode}
                onValueChange={(value) => setNewPayment(prev => ({ ...prev, mode: value }))}
              >
                <SelectTrigger id="payment-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Bank">Bank Transfer</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="payment-date">Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment(prev => ({ ...prev, date: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="payment-reference">Reference (Optional)</Label>
              <Input
                id="payment-reference"
                value={newPayment.reference}
                onChange={(e) => setNewPayment(prev => ({ ...prev, reference: e.target.value }))}
                placeholder="Transaction ID or cheque number"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPaymentModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddPayment} className="bg-emerald-600 hover:bg-emerald-700">
              Add Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting Modal */}
      <MeetingModal
        open={showMeetingModal}
        onOpenChange={setShowMeetingModal}
        onSuccess={fetchMeetings}
        initialProjectId={id}
      />
      
      {/* Hold/Activate/Deactivate Modal */}
      <Dialog open={showHoldModal} onOpenChange={setShowHoldModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {holdAction === 'Hold' && <Pause className="h-5 w-5 text-amber-600" />}
              {holdAction === 'Activate' && <Play className="h-5 w-5 text-green-600" />}
              {holdAction === 'Deactivate' && <Power className="h-5 w-5 text-red-600" />}
              {holdAction} Project
            </DialogTitle>
            <DialogDescription>
              {holdAction === 'Hold' && 'Placing this project on hold will pause milestone progression and alerts.'}
              {holdAction === 'Activate' && 'Reactivating this project will resume milestone progression and alerts.'}
              {holdAction === 'Deactivate' && 'Deactivating this project will disable all actions. This is typically used for cancelled projects.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="hold-reason">Reason *</Label>
              <Textarea
                id="hold-reason"
                value={holdReason}
                onChange={(e) => setHoldReason(e.target.value)}
                placeholder={`Please provide a reason for ${holdAction?.toLowerCase()}ing this project...`}
                rows={3}
                data-testid="hold-reason-input"
              />
            </div>
            
            {holdAction === 'Deactivate' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700 font-medium">⚠️ Warning</p>
                <p className="text-xs text-red-600 mt-1">
                  Deactivating a project is a significant action. The project will no longer appear in active lists.
                </p>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowHoldModal(false)}
              disabled={isUpdatingHoldStatus}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleHoldStatusUpdate}
              disabled={!holdReason.trim() || isUpdatingHoldStatus}
              className={cn(
                holdAction === 'Hold' && 'bg-amber-600 hover:bg-amber-700',
                holdAction === 'Activate' && 'bg-green-600 hover:bg-green-700',
                holdAction === 'Deactivate' && 'bg-red-600 hover:bg-red-700'
              )}
              data-testid="confirm-hold-action-btn"
            >
              {isUpdatingHoldStatus ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Confirm {holdAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Timeline Adjustment Modal */}
      <TimelineAdjustmentModal
        open={showTimelineAdjustmentModal}
        onClose={() => setShowTimelineAdjustmentModal(false)}
        onSubmit={handleTimelineAdjustment}
        entityType="project"
        entityId={id}
        entityName={project?.customer_name}
        currentTimeline={project?.current_timeline}
        isOnHold={project?.current_timeline?.on_hold || false}
        loading={isAdjustingTimeline}
      />
      
      {/* Timeline History Modal */}
      <TimelineHistoryModal
        open={showTimelineHistoryModal}
        onClose={() => setShowTimelineHistoryModal(false)}
        history={timelineHistory}
        entityType="project"
      />

      {/* Milestone Value Prompts */}
      <QuotationValuePrompt
        open={showQuotationPrompt}
        onOpenChange={setShowQuotationPrompt}
        entityType="project"
        entityId={id}
        milestoneName={pendingMilestone?.substageName || pendingMilestone?.groupName || ''}
        currentQuotationValue={
          project?.quotation_history?.length > 0
            ? project.quotation_history[project.quotation_history.length - 1].quoted_value
            : 0
        }
        onComplete={handleQuotationPromptComplete}
        onCancel={handleValuePromptCancel}
      />

      <ValueChangePrompt
        open={showValueChangePrompt}
        onOpenChange={setShowValueChangePrompt}
        entityType="project"
        entityId={id}
        milestoneName={pendingMilestone?.substageName || pendingMilestone?.groupName || ''}
        currentQuotationValue={
          project?.quotation_history?.length > 0
            ? project.quotation_history[project.quotation_history.length - 1].quoted_value
            : 0
        }
        onComplete={handleValueChangePromptComplete}
        onCancel={handleValuePromptCancel}
      />

      <SignOffConfirmation
        open={showSignOffConfirmation}
        onOpenChange={setShowSignOffConfirmation}
        projectId={id}
        quotationHistory={project?.quotation_history || []}
        bookedValue={project?.booked_value}
        inquiryValue={project?.inquiry_value}
        onConfirm={handleSignOffConfirmationComplete}
        onCancel={handleValuePromptCancel}
      />
    </div>
  );
};

// Warranty & Service Tab Component
const WarrantyServiceTab = ({ projectId, pid }) => {
  const navigate = useNavigate();
  const [warranty, setWarranty] = useState(null);
  const [serviceRequests, setServiceRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [warrantyRes, srRes] = await Promise.all([
        axios.get(`${API}/warranties/by-project/${projectId}`, { withCredentials: true }).catch(() => ({ data: null })),
        axios.get(`${API}/service-requests/by-project/${projectId}`, { withCredentials: true }).catch(() => ({ data: [] }))
      ]);
      setWarranty(warrantyRes.data);
      setServiceRequests(srRes.data || []);
    } catch (err) {
      console.error('Failed to fetch warranty data:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="warranty-service-tab">
      {/* Warranty Card */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="h-5 w-5 text-green-600" />
            Warranty Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          {warranty ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Warranty ID</p>
                  <p className="font-medium">{warranty.warranty_id}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    warranty.warranty_status === 'Active' && 'bg-green-100 text-green-700',
                    warranty.warranty_status === 'Expired' && 'bg-red-100 text-red-700'
                  )}>
                    {warranty.warranty_status}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Start Date</p>
                  <p className="font-medium">{formatDate(warranty.warranty_start_date)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">End Date (10 Years)</p>
                  <p className="font-medium">{formatDate(warranty.warranty_end_date)}</p>
                </div>
              </div>
              {warranty.notes && (
                <div>
                  <p className="text-xs text-slate-500">Notes</p>
                  <p className="text-sm text-slate-700">{warranty.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Shield className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>Warranty will be auto-generated when project reaches Closed status</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Requests */}
      <Card className="border-slate-200">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-amber-600" />
              Service Requests
            </CardTitle>
            <Button
              size="sm"
              onClick={() => navigate('/service-requests')}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {serviceRequests.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Wrench className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p>No service requests for this project</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceRequests.map((sr) => (
                <div
                  key={sr.service_request_id}
                  onClick={() => navigate(`/service-requests/${sr.service_request_id}`)}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-slate-900">{sr.service_request_id}</p>
                    <p className="text-sm text-slate-500">{sr.issue_category} • {sr.issue_description?.substring(0, 50)}...</p>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      sr.stage === 'New' && 'bg-blue-100 text-blue-700',
                      sr.stage === 'Completed' && 'bg-green-100 text-green-700',
                      sr.stage === 'Closed' && 'bg-slate-100 text-slate-700',
                      !['New', 'Completed', 'Closed'].includes(sr.stage) && 'bg-amber-100 text-amber-700'
                    )}>
                      {sr.stage}
                    </span>
                    <p className="text-xs text-slate-400 mt-1">{formatDate(sr.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectDetails;
