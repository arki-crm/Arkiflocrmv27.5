import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import { 
  Shield, 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertTriangle, 
  Clock,
  DollarSign,
  Loader2,
  ChevronRight,
  UserCheck,
  FileWarning
} from 'lucide-react';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const formatCurrency = (val) => {
  if (!val) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

export default function FinancialGatesCard({ projectId, userRole, onGateCleared }) {
  const [gatesData, setGatesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedGate, setSelectedGate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Override request form
  const [overrideForm, setOverrideForm] = useState({
    reason: '',
    expected_payment_date: '',
    notes: ''
  });
  
  // Payment confirmation form
  const [confirmForm, setConfirmForm] = useState({
    milestone_name: '',
    amount_received: '',
    notes: ''
  });

  const fetchGates = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API}/api/projects/${projectId}/financial-gates`, {
        withCredentials: true
      });
      setGatesData(res.data);
    } catch (err) {
      console.error('Failed to fetch financial gates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchGates();
    }
  }, [projectId]);

  const canApproveOverrides = ['Admin', 'Founder'].includes(userRole);
  const canConfirmPayments = ['Admin', 'Founder', 'Accountant', 'JuniorAccountant', 'SeniorAccountant', 'FinanceManager', 'CharteredAccountant'].includes(userRole);

  const handleRequestOverride = async () => {
    if (!overrideForm.reason || !overrideForm.expected_payment_date) {
      toast.error('Please fill in reason and expected payment date');
      return;
    }
    
    try {
      setSubmitting(true);
      await axios.post(`${API}/api/projects/${projectId}/gate-override`, overrideForm, {
        withCredentials: true
      });
      toast.success('Override request submitted. Awaiting Admin/Founder approval.');
      setShowOverrideModal(false);
      setOverrideForm({ reason: '', expected_payment_date: '', notes: '' });
      fetchGates();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit override request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveOverride = async (overrideId, approved) => {
    try {
      setSubmitting(true);
      await axios.put(`${API}/api/projects/${projectId}/gate-override/${overrideId}`, {
        approved,
        approval_notes: approved ? 'Approved' : 'Rejected'
      }, { withCredentials: true });
      toast.success(`Override ${approved ? 'approved' : 'rejected'}`);
      fetchGates();
      if (onGateCleared) onGateCleared();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process override');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmForm.milestone_name || !confirmForm.amount_received) {
      toast.error('Please select milestone and enter amount');
      return;
    }
    
    try {
      setSubmitting(true);
      const res = await axios.post(`${API}/api/projects/${projectId}/confirm-payment-milestone`, {
        ...confirmForm,
        amount_received: parseFloat(confirmForm.amount_received)
      }, { withCredentials: true });
      
      toast.success(res.data.message);
      if (res.data.gates_cleared?.length > 0) {
        toast.success(`Gates cleared: ${res.data.gates_cleared.join(', ')}`);
      }
      setShowConfirmModal(false);
      setConfirmForm({ milestone_name: '', amount_received: '', notes: '' });
      fetchGates();
      if (onGateCleared) onGateCleared();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to confirm payment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-amber-200 bg-amber-50/30">
        <CardContent className="p-4 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
        </CardContent>
      </Card>
    );
  }

  if (!gatesData?.gates?.length) return null;

  // Find the next blocking gate or current gate
  const nextBlockedGate = gatesData.gates.find(g => g.blocked && !g.is_passed);
  const hasAnyPendingOverride = gatesData.gates.some(g => g.pending_override);
  const allGatesPassed = gatesData.gates.every(g => g.is_passed || !g.blocked);

  return (
    <>
      <Card className={`border-2 ${nextBlockedGate ? 'border-amber-400 bg-amber-50/50' : 'border-green-300 bg-green-50/30'}`}>
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Shield className={`h-4 w-4 ${nextBlockedGate ? 'text-amber-600' : 'text-green-600'}`} />
            Financial Gates
            {allGatesPassed && <Badge className="bg-green-100 text-green-700 text-xs ml-2">All Clear</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="space-y-2">
            {gatesData.gates.map((gate) => {
              const isPassed = gate.is_passed || gate.milestone_confirmed || gate.percentage_met || gate.has_approved_override;
              const isBlocked = gate.blocked && !isPassed;
              const hasPending = gate.pending_override;
              
              let statusIcon, statusColor, statusText;
              if (isPassed) {
                statusIcon = <CheckCircle className="h-4 w-4" />;
                statusColor = 'text-green-600 bg-green-100';
                statusText = gate.has_approved_override ? 'Override' : 'Cleared';
              } else if (hasPending) {
                statusIcon = <Clock className="h-4 w-4" />;
                statusColor = 'text-blue-600 bg-blue-100';
                statusText = 'Pending';
              } else if (isBlocked) {
                statusIcon = <Lock className="h-4 w-4" />;
                statusColor = 'text-amber-600 bg-amber-100';
                statusText = 'Blocked';
              } else {
                statusIcon = <ChevronRight className="h-4 w-4" />;
                statusColor = 'text-gray-500 bg-gray-100';
                statusText = 'Upcoming';
              }
              
              return (
                <div 
                  key={gate.stage} 
                  className={`flex items-center justify-between p-2 rounded-lg ${isBlocked ? 'bg-amber-100/50' : 'bg-white/50'}`}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={`${statusColor} text-xs px-2`}>
                      {statusIcon}
                      <span className="ml-1">{statusText}</span>
                    </Badge>
                    <span className="text-sm font-medium">{gate.gate_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {gate.payment_status?.received_percentage || 0}% / {gate.min_percentage_required}%
                    </span>
                    
                    {/* Show pending override info */}
                    {hasPending && canApproveOverrides && (
                      <div className="flex gap-1">
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-6 text-xs px-2 border-green-300 text-green-700 hover:bg-green-50"
                          onClick={() => handleApproveOverride(gate.pending_override.override_id, true)}
                          disabled={submitting}
                        >
                          Approve
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="h-6 text-xs px-2 border-red-300 text-red-700 hover:bg-red-50"
                          onClick={() => handleApproveOverride(gate.pending_override.override_id, false)}
                          disabled={submitting}
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-2 mt-3 pt-3 border-t">
            {nextBlockedGate && !hasAnyPendingOverride && (
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs"
                onClick={() => {
                  setSelectedGate(nextBlockedGate);
                  setShowOverrideModal(true);
                }}
              >
                <FileWarning className="h-3 w-3 mr-1" />
                Request Override
              </Button>
            )}
            
            {canConfirmPayments && (
              <Button 
                size="sm" 
                variant="outline"
                className="text-xs text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => setShowConfirmModal(true)}
              >
                <DollarSign className="h-3 w-3 mr-1" />
                Confirm Payment
              </Button>
            )}
          </div>
          
          {/* Payment Confirmations Summary */}
          {gatesData.payment_confirmations?.length > 0 && (
            <div className="mt-3 pt-2 border-t text-xs text-gray-500">
              <span className="font-medium">Confirmed:</span>{' '}
              {gatesData.payment_confirmations.map(pc => pc.milestone_name).join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Override Request Modal */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-amber-600" />
              Request Gate Override
            </DialogTitle>
            <DialogDescription>
              Request approval to bypass {selectedGate?.gate_name} without full payment confirmation.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <p className="font-medium text-amber-800">⚠️ This requires Admin/Founder approval</p>
              <p className="text-amber-700 mt-1">
                Current: {selectedGate?.payment_status?.received_percentage || 0}% | 
                Required: {selectedGate?.min_percentage_required}%
              </p>
            </div>
            
            <div>
              <Label>Reason for Override <span className="text-red-500">*</span></Label>
              <Textarea
                value={overrideForm.reason}
                onChange={(e) => setOverrideForm(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="Why is this override needed? Be specific..."
                rows={3}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Expected Payment Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={overrideForm.expected_payment_date}
                onChange={(e) => setOverrideForm(prev => ({ ...prev, expected_payment_date: e.target.value }))}
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Additional Notes</Label>
              <Input
                value={overrideForm.notes}
                onChange={(e) => setOverrideForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Any additional context..."
                className="mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideModal(false)}>Cancel</Button>
            <Button onClick={handleRequestOverride} disabled={submitting} className="bg-amber-600 hover:bg-amber-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Confirm Payment Milestone
            </DialogTitle>
            <DialogDescription>
              Accounts team confirmation of payment received.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label>Payment Milestone <span className="text-red-500">*</span></Label>
              <select
                value={confirmForm.milestone_name}
                onChange={(e) => setConfirmForm(prev => ({ ...prev, milestone_name: e.target.value }))}
                className="w-full mt-1 p-2 border rounded-md text-sm"
              >
                <option value="">Select milestone...</option>
                <option value="Design Booking">Design Booking (10%)</option>
                <option value="Production Start">Production Start (50%)</option>
                <option value="Before Installation">Before Installation (Remaining)</option>
              </select>
            </div>
            
            <div>
              <Label>Amount Received <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={confirmForm.amount_received}
                onChange={(e) => setConfirmForm(prev => ({ ...prev, amount_received: e.target.value }))}
                placeholder="Enter amount"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Notes</Label>
              <Input
                value={confirmForm.notes}
                onChange={(e) => setConfirmForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Receipt reference, bank details, etc."
                className="mt-1"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmPayment} disabled={submitting} className="bg-green-600 hover:bg-green-700">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
