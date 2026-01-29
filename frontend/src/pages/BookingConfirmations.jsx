import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle, Clock, User, Phone, IndianRupee, AlertCircle, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BookingConfirmations = () => {
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
      const response = await fetch(`${API_URL}/api/finance/pending-booking-confirmations`, {
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

  const handleConfirmPayment = async (leadId, customerName) => {
    try {
      setConfirmingId(leadId);
      const response = await fetch(`${API_URL}/api/leads/${leadId}/confirm-booking-payment`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to confirm payment');
      }

      toast.success(`Booking payment confirmed for ${customerName}`);
      
      // Remove from list
      setPendingConfirmations(prev => prev.filter(lead => lead.lead_id !== leadId));
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

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
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

  if (loading) {
    return (
      <div className="p-6" data-testid="booking-confirmations-page">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="booking-confirmations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Booking Payment Confirmations</h1>
          <p className="text-gray-600 mt-1">
            Confirm booking payments received from customers before leads can be converted to projects
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
      </div>

      {/* Pending Confirmations List */}
      {pendingConfirmations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
            <p className="text-gray-600 mt-1">
              No pending booking payment confirmations at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingConfirmations.map((lead) => (
            <Card 
              key={lead.lead_id} 
              className="hover:shadow-md transition-shadow"
              data-testid={`confirmation-card-${lead.lead_id}`}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  {/* Lead Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {lead.customer_name}
                      </h3>
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Waiting for Booking
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      {/* Phone */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone className="h-4 w-4" />
                        <span className="text-sm">{lead.customer_phone || '—'}</span>
                      </div>
                      
                      {/* Budget */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <IndianRupee className="h-4 w-4" />
                        <span className="text-sm font-medium">{formatCurrency(lead.budget)}</span>
                      </div>
                      
                      {/* Designer */}
                      <div className="flex items-center gap-2 text-gray-600">
                        <User className="h-4 w-4" />
                        <span className="text-sm">{lead.designer_name}</span>
                      </div>
                      
                      {/* Time */}
                      <div className="flex items-center gap-2 text-gray-500">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">{getTimeSince(lead.updated_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="ml-6">
                    <Button
                      onClick={() => handleConfirmPayment(lead.lead_id, lead.customer_name)}
                      disabled={confirmingId === lead.lead_id}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid={`confirm-btn-${lead.lead_id}`}
                    >
                      {confirmingId === lead.lead_id ? (
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
                When the Sales team moves a lead to "Waiting for Booking" stage, it appears here for payment confirmation. 
                Once you confirm the payment has been received, the lead can be converted to a project by the Sales Manager.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BookingConfirmations;
