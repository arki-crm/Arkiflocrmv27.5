import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { 
  IndianRupee, 
  Lock, 
  Unlock, 
  AlertTriangle,
  Check,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  Edit2,
  BadgePercent
} from 'lucide-react';
import { cn } from '../../lib/utils';
import axios from 'axios';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ValueLifecycleCard = ({
  projectId,
  inquiryValue = 0,
  bookedValue = 0,
  contractValue = 0,
  isContractLocked = false,
  lockedAt = null,
  lockedByName = null,
  discountAmount = 0,
  discountReason = null,
  discountApprovedByName = null,
  currentStage = '',
  userRole = '',
  onDataUpdated
}) => {
  const [showLockModal, setShowLockModal] = useState(false);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [overrideData, setOverrideData] = useState({ new_value: '', reason: '' });
  const [discountData, setDiscountData] = useState({ discount_amount: '', reason: '' });

  // Check if user can lock - visible only at Design Sign-off / Production transition
  const canShowLockButton = () => {
    // Only show at specific stages: "Design Finalization" when moving to Production
    // Or "Production Preparation" stage
    const lockableStages = ['Design Finalization', 'Production Preparation'];
    return lockableStages.includes(currentStage) && !isContractLocked;
  };

  // Only Admin/Founder can override or apply discount
  const isAdminOrFounder = ['Admin', 'Founder'].includes(userRole);

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '₹0';
    return `₹${Number(amount).toLocaleString('en-IN')}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getValueTrend = (from, to) => {
    if (!from || !to || from === to) return { icon: Minus, color: 'text-slate-400', label: 'No change' };
    if (to > from) return { icon: TrendingUp, color: 'text-green-600', label: `+${formatCurrency(to - from)}` };
    return { icon: TrendingDown, color: 'text-red-600', label: formatCurrency(to - from) };
  };

  const handleLockContract = async () => {
    try {
      setIsSubmitting(true);
      await axios.post(`${API}/projects/${projectId}/lock-contract-value`, {}, {
        withCredentials: true
      });
      toast.success('Contract value locked successfully');
      setShowLockModal(false);
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Failed to lock contract:', err);
      toast.error(err.response?.data?.detail || 'Failed to lock contract value');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOverrideContract = async () => {
    const value = parseFloat(overrideData.new_value);
    if (isNaN(value) || value <= 0) {
      toast.error('Please enter a valid contract value');
      return;
    }
    if (!overrideData.reason.trim()) {
      toast.error('Please provide a reason for the override');
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(`${API}/projects/${projectId}/override-contract-value`, {
        new_value: value,
        reason: overrideData.reason.trim()
      }, { withCredentials: true });
      toast.success('Contract value overridden successfully');
      setShowOverrideModal(false);
      setOverrideData({ new_value: '', reason: '' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Failed to override contract:', err);
      toast.error(err.response?.data?.detail || 'Failed to override contract value');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApplyDiscount = async () => {
    const amount = parseFloat(discountData.discount_amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid discount amount');
      return;
    }
    if (!discountData.reason.trim()) {
      toast.error('Please provide a reason for the discount');
      return;
    }

    try {
      setIsSubmitting(true);
      await axios.post(`${API}/projects/${projectId}/apply-discount`, {
        discount_amount: amount,
        reason: discountData.reason.trim()
      }, { withCredentials: true });
      toast.success('Discount applied successfully');
      setShowDiscountModal(false);
      setDiscountData({ discount_amount: '', reason: '' });
      if (onDataUpdated) onDataUpdated();
    } catch (err) {
      console.error('Failed to apply discount:', err);
      toast.error(err.response?.data?.detail || 'Failed to apply discount');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inquiryToBookedTrend = getValueTrend(inquiryValue, bookedValue);
  const bookedToContractTrend = getValueTrend(bookedValue, contractValue);
  const finalValue = contractValue - discountAmount;

  return (
    <>
      <Card className="border-slate-200" data-testid="value-lifecycle-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <IndianRupee className="h-4 w-4 text-emerald-600" />
              Project Value Lifecycle
            </CardTitle>
            {isContractLocked && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
                <Lock className="h-3 w-3" />
                Contract Locked
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Value Summary Grid */}
          <div className="grid grid-cols-3 gap-3">
            {/* Inquiry Value */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Inquiry/Expected</p>
              <p className="text-lg font-bold text-slate-700" data-testid="inquiry-value">
                {formatCurrency(inquiryValue)}
              </p>
            </div>
            
            {/* Booked Value */}
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-600 mb-1">Booked Value</p>
              <p className="text-lg font-bold text-blue-700" data-testid="booked-value">
                {formatCurrency(bookedValue)}
              </p>
              {bookedValue !== inquiryValue && (
                <div className={cn("flex items-center gap-1 text-xs mt-1", inquiryToBookedTrend.color)}>
                  <inquiryToBookedTrend.icon className="h-3 w-3" />
                  <span>{inquiryToBookedTrend.label}</span>
                </div>
              )}
            </div>
            
            {/* Contract Value */}
            <div className={cn(
              "p-3 rounded-lg border",
              isContractLocked ? "bg-green-50 border-green-200" : "bg-emerald-50 border-emerald-200"
            )}>
              <div className="flex items-center justify-between">
                <p className={cn("text-xs mb-1", isContractLocked ? "text-green-600" : "text-emerald-600")}>
                  Contract Value
                </p>
                {isContractLocked && <Lock className="h-3 w-3 text-green-600" />}
              </div>
              <p className={cn(
                "text-lg font-bold",
                isContractLocked ? "text-green-700" : "text-emerald-700"
              )} data-testid="contract-value">
                {formatCurrency(contractValue)}
              </p>
              {bookedValue !== contractValue && (
                <div className={cn("flex items-center gap-1 text-xs mt-1", bookedToContractTrend.color)}>
                  <bookedToContractTrend.icon className="h-3 w-3" />
                  <span>{bookedToContractTrend.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Discount Section */}
          {discountAmount > 0 && (
            <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <BadgePercent className="h-3 w-3" />
                    Approved Discount
                  </p>
                  <p className="text-lg font-bold text-amber-700" data-testid="discount-value">
                    -{formatCurrency(discountAmount)}
                  </p>
                  {discountReason && (
                    <p className="text-xs text-amber-600 mt-1">Reason: {discountReason}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Final Value</p>
                  <p className="text-xl font-bold text-emerald-700">{formatCurrency(finalValue)}</p>
                </div>
              </div>
              {discountApprovedByName && (
                <p className="text-xs text-slate-500 mt-2">Approved by: {discountApprovedByName}</p>
              )}
            </div>
          )}

          {/* Lock Status Display */}
          {isContractLocked && lockedAt && (
            <div className="p-2 bg-slate-100 rounded-lg text-xs text-slate-600">
              <span className="font-medium">Locked:</span> {formatDate(lockedAt)} by {lockedByName || 'System'}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
            {/* Lock Button - Only visible at specific stages */}
            {canShowLockButton() && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowLockModal(true)}
                className="text-amber-600 border-amber-300 hover:bg-amber-50"
                data-testid="lock-contract-btn"
              >
                <Lock className="h-3.5 w-3.5 mr-1" />
                Lock Contract Value
              </Button>
            )}
            
            {/* Override Button - Admin/Founder only, visible when locked */}
            {isContractLocked && isAdminOrFounder && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setOverrideData({ new_value: contractValue.toString(), reason: '' });
                  setShowOverrideModal(true);
                }}
                className="text-red-600 border-red-300 hover:bg-red-50"
                data-testid="override-contract-btn"
              >
                <Unlock className="h-3.5 w-3.5 mr-1" />
                Override Lock
              </Button>
            )}
            
            {/* Apply Discount - Admin/Founder only */}
            {isAdminOrFounder && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDiscountModal(true)}
                className="text-purple-600 border-purple-300 hover:bg-purple-50"
                data-testid="apply-discount-btn"
              >
                <BadgePercent className="h-3.5 w-3.5 mr-1" />
                Apply Discount
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lock Contract Modal */}
      <Dialog open={showLockModal} onOpenChange={setShowLockModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-600" />
              Lock Contract Value
            </DialogTitle>
            <DialogDescription>
              Once locked, the contract value can only be changed by Admin/Founder with a mandatory reason.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="text-sm text-slate-600">Contract Value to Lock:</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(contractValue)}</p>
            </div>
            
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                <div className="text-sm text-amber-700">
                  <p className="font-medium">This action is irreversible by regular users.</p>
                  <p className="text-xs mt-1">Only Admin/Founder can override after locking.</p>
                </div>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLockModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleLockContract}
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700"
              data-testid="confirm-lock-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Locking...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Lock Contract
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Override Contract Modal */}
      <Dialog open={showOverrideModal} onOpenChange={setShowOverrideModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Override Contract Value
            </DialogTitle>
            <DialogDescription>
              This action is audited. A mandatory reason is required.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Current Contract Value</p>
              <p className="text-lg font-bold text-slate-700">{formatCurrency(contractValue)}</p>
            </div>
            
            <div>
              <Label htmlFor="new-value">New Contract Value *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  id="new-value"
                  type="number"
                  value={overrideData.new_value}
                  onChange={(e) => setOverrideData(prev => ({ ...prev, new_value: e.target.value }))}
                  placeholder="0"
                  className="pl-8"
                  data-testid="override-value-input"
                />
              </div>
            </div>
            
            <div>
              <Label htmlFor="override-reason">Reason for Override *</Label>
              <Textarea
                id="override-reason"
                value={overrideData.reason}
                onChange={(e) => setOverrideData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Client requested scope change after sign-off"
                rows={3}
                data-testid="override-reason-input"
              />
            </div>
            
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">
                This override will be logged with your name, timestamp, and reason for audit purposes.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOverrideModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleOverrideContract}
              disabled={isSubmitting || !overrideData.new_value || !overrideData.reason.trim()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirm-override-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Overriding...
                </>
              ) : (
                'Override Value'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Discount Modal */}
      <Dialog open={showDiscountModal} onOpenChange={setShowDiscountModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-600">
              <BadgePercent className="h-5 w-5" />
              Apply Discount
            </DialogTitle>
            <DialogDescription>
              Record an approved discount for this project.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-slate-500">Contract Value</p>
              <p className="text-lg font-bold text-slate-700">{formatCurrency(contractValue)}</p>
            </div>
            
            <div>
              <Label htmlFor="discount-amount">Discount Amount *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">₹</span>
                <Input
                  id="discount-amount"
                  type="number"
                  value={discountData.discount_amount}
                  onChange={(e) => setDiscountData(prev => ({ ...prev, discount_amount: e.target.value }))}
                  placeholder="0"
                  className="pl-8"
                  data-testid="discount-amount-input"
                />
              </div>
              {discountData.discount_amount && (
                <p className="text-xs text-emerald-600 mt-1">
                  Final Value: {formatCurrency(contractValue - parseFloat(discountData.discount_amount || 0))}
                </p>
              )}
            </div>
            
            <div>
              <Label htmlFor="discount-reason">Reason / Approval Details *</Label>
              <Textarea
                id="discount-reason"
                value={discountData.reason}
                onChange={(e) => setDiscountData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Approved by founder due to delayed delivery"
                rows={3}
                data-testid="discount-reason-input"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDiscountModal(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleApplyDiscount}
              disabled={isSubmitting || !discountData.discount_amount || !discountData.reason.trim()}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="confirm-discount-btn"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Applying...
                </>
              ) : (
                'Apply Discount'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ValueLifecycleCard;
