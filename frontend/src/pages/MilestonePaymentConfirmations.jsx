import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, Clock, User, Building2, AlertCircle, RefreshCw, IndianRupee, FileText } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const MilestonePaymentConfirmations = () => {
  const { user } = useAuth();
  const [pendingConfirmations, setPendingConfirmations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState(null);

  useEffect(() => {
    fetchPendingConfirmations();
  }, []);

  const fetchPendingConfirmations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/finance/pending-milestone-confirmations`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending confirmations');
      }

      const data = await response.json();
      setPendingConfirmations(data.pending_confirmations || []);
    } catch (error) {
      console.error('Error fetching pending confirmations:', error);
      toast.error('Failed to load pending confirmations');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async (projectId, milestoneId, projectName, milestoneName) => {
    try {
      setConfirmingId(`${projectId}-${milestoneId}`);
      const response = await fetch(`${API_URL}/api/projects/${projectId}/confirm-milestone-payment/${milestoneId}`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to confirm payment');
      }

      toast.success(`Payment confirmed: ${milestoneName} for ${projectName}`);
      
      // Remove from list
      setPendingConfirmations(prev => 
        prev.filter(item => !(item.project_id === projectId && item.milestone_id === milestoneId))
      );
    } catch (error) {
      console.error('Error confirming payment:', error);
      toast.error(error.message || 'Failed to confirm payment');
    } finally {
      setConfirmingId(null);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '—';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getTimeSince = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMins > 0) return `${diffMins}m ago`;
    return 'Just now';
  };

  const getMilestoneBadgeColor = (milestoneId) => {
    if (milestoneId === 'payment_collection_50') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-purple-50 text-purple-700 border-purple-200';
  };

  if (loading) {
    return (
      <div className="p-6" data-testid="milestone-confirmations-page">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="milestone-confirmations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Milestone Payment Confirmations</h1>
          <p className="text-gray-600 mt-1">
            Confirm payments received before project milestones can be completed
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchPendingConfirmations}
          data-testid="refresh-confirmations"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Pending Confirmations</p>
                <p className="text-2xl font-bold text-gray-900">{pendingConfirmations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">50% Collection</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingConfirmations.filter(p => p.milestone_id === 'payment_collection_50').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">45% Collection</p>
                <p className="text-2xl font-bold text-gray-900">
                  {pendingConfirmations.filter(p => p.milestone_id === 'full_order_confirmation_45').length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Confirmations List */}
      {pendingConfirmations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-600 mt-1">
              No pending milestone payment confirmations at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingConfirmations.map((item) => (
            <Card 
              key={`${item.project_id}-${item.milestone_id}`} 
              className="hover:shadow-md transition-shadow"
              data-testid={`confirmation-card-${item.project_id}-${item.milestone_id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Project Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {item.project_name}
                      </h3>
                      <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                        {item.pid}
                      </Badge>
                      <Badge variant="outline" className={getMilestoneBadgeColor(item.milestone_id)}>
                        {item.milestone_name}
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {/* Client */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span className="text-sm">{item.client_name || '—'}</span>
                      </div>
                      
                      {/* Contract Value */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <IndianRupee className="h-4 w-4" />
                        <span className="text-sm font-medium">{formatCurrency(item.contract_value)}</span>
                      </div>
                      
                      {/* Stage */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Building2 className="h-4 w-4" />
                        <span className="text-sm">{item.stage}</span>
                      </div>
                      
                      {/* Time */}
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{getTimeSince(item.requested_at)}</span>
                      </div>
                    </div>

                    {/* Requested By */}
                    {item.requested_by_name && (
                      <div className="mt-3 text-sm text-gray-500">
                        Requested by: <span className="font-medium">{item.requested_by_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="ml-6">
                    <Button
                      onClick={() => handleConfirmPayment(
                        item.project_id, 
                        item.milestone_id, 
                        item.project_name,
                        item.milestone_name
                      )}
                      disabled={confirmingId === `${item.project_id}-${item.milestone_id}`}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid={`confirm-btn-${item.project_id}-${item.milestone_id}`}
                    >
                      {confirmingId === `${item.project_id}-${item.milestone_id}` ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Confirming...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirm Payment
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Note */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-900">How this works</h4>
              <p className="text-sm text-blue-700 mt-1">
                When a Designer or Operations Manager attempts to complete a payment-gated milestone 
                (50% Payment Collection or 45% Full Order Confirmation), the request appears here. 
                Once you confirm the payment has been received, the milestone can be completed by the project team.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MilestonePaymentConfirmations;
