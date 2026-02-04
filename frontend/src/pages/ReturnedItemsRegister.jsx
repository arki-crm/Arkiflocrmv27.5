import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import {
  ArrowLeft,
  Package,
  Loader2,
  Warehouse,
  Truck,
  Trash2,
  XCircle,
  AlertTriangle,
  Clock,
  CheckCircle,
  RefreshCw,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  RotateCcw
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ITEM_DISPOSITIONS = [
  { value: 'returned_to_vendor', label: 'Returned to Vendor', icon: Truck },
  { value: 'with_company_office', label: 'With Company - Office', icon: Warehouse },
  { value: 'with_company_site', label: 'With Company - Site', icon: Package },
  { value: 'scrapped', label: 'Scrapped', icon: Trash2 },
  { value: 'vendor_rejected', label: 'Vendor Rejected', icon: XCircle },
  { value: 'reused_other_project', label: 'Reused', icon: RotateCcw },
  { value: 'pending_decision', label: 'Pending Decision', icon: AlertTriangle }
];

const REFUND_STATUSES = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700', icon: Clock },
  partial: { label: 'Partial', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  adjusted: { label: 'Adjusted', color: 'bg-purple-100 text-purple-700', icon: RotateCcw },
  no_refund: { label: 'No Refund', color: 'bg-red-100 text-red-700', icon: XCircle }
};

export default function ReturnedItemsRegister() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  
  const [data, setData] = useState({ items: [], summary: {} });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filters, setFilters] = useState({
    return_type: '',
    item_disposition: '',
    refund_status: '',
    from_date: '',
    to_date: ''
  });

  useEffect(() => {
    fetchRegister();
  }, [filters]);

  const fetchRegister = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.return_type) params.append('return_type', filters.return_type);
      if (filters.item_disposition) params.append('item_disposition', filters.item_disposition);
      if (filters.refund_status) params.append('refund_status', filters.refund_status);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      
      const response = await axios.get(`${API}/finance/returned-items-register?${params}`, {
        withCredentials: true
      });
      setData(response.data);
    } catch (err) {
      console.error('Failed to fetch register:', err);
      toast.error('Failed to load returned items register');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  };

  const getDispositionIcon = (disposition) => {
    const item = ITEM_DISPOSITIONS.find(d => d.value === disposition);
    return item?.icon || Package;
  };

  const getDispositionLabel = (disposition) => {
    const item = ITEM_DISPOSITIONS.find(d => d.value === disposition);
    return item?.label || disposition;
  };

  const { summary } = data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="returned-items-register">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Returned Items Register</h1>
            <p className="text-sm text-slate-500">Aggregated view of all purchase and sales returns</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => navigate('/finance/purchase-returns')}
            data-testid="go-purchase-returns-btn"
          >
            <ShoppingCart className="w-4 h-4 mr-2" />
            Purchase Returns
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/finance/sales-returns')}
            data-testid="go-sales-returns-btn"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Sales Returns
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Returns</p>
                <p className="text-xl font-bold text-slate-900">{summary.total_returns || 0}</p>
                <p className="text-xs text-slate-400">{summary.total_items || 0} items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Warehouse className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">With Company</p>
                <p className="text-xl font-bold text-slate-900">{summary.items_with_company?.count || 0}</p>
                <p className="text-xs text-slate-400">{formatCurrency(summary.items_with_company?.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Truck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Returned to Vendor</p>
                <p className="text-xl font-bold text-slate-900">{summary.items_returned_to_vendor?.count || 0}</p>
                <p className="text-xs text-slate-400">{formatCurrency(summary.items_returned_to_vendor?.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Trash2 className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Scrapped/Rejected</p>
                <p className="text-xl font-bold text-slate-900">{summary.items_scrapped?.count || 0}</p>
                <p className="text-xs text-slate-400">{formatCurrency(summary.items_scrapped?.value)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Pending Refunds</p>
                <p className="text-xl font-bold text-purple-600">{formatCurrency(summary.pending_refunds)}</p>
                {summary.total_loss > 0 && (
                  <p className="text-xs text-red-500">Loss: {formatCurrency(summary.total_loss)}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="w-36">
              <Label className="text-xs">Return Type</Label>
              <Select value={filters.return_type || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, return_type: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="purchase">Purchase</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-48">
              <Label className="text-xs">Item Disposition</Label>
              <Select value={filters.item_disposition || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, item_disposition: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {ITEM_DISPOSITIONS.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <Label className="text-xs">Refund Status</Label>
              <Select value={filters.refund_status || "all"} onValueChange={(v) => setFilters(prev => ({ ...prev, refund_status: v === "all" ? "" : v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="adjusted">Adjusted</SelectItem>
                  <SelectItem value="no_refund">No Refund</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="text-xs">From Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.from_date}
                onChange={(e) => setFilters(prev => ({ ...prev, from_date: e.target.value }))}
              />
            </div>
            <div className="w-36">
              <Label className="text-xs">To Date</Label>
              <Input
                type="date"
                className="h-9"
                value={filters.to_date}
                onChange={(e) => setFilters(prev => ({ ...prev, to_date: e.target.value }))}
              />
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setFilters({ return_type: '', item_disposition: '', refund_status: '', from_date: '', to_date: '' })}
            >
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : data.items.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No returned items found</p>
              <p className="text-sm mt-1">Create purchase or sales returns to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Return ID</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Type</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Date</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Vendor/Customer</th>
                    <th className="text-left p-3 text-xs font-medium text-slate-500">Item</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Qty</th>
                    <th className="text-right p-3 text-xs font-medium text-slate-500">Amount</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Item Status</th>
                    <th className="text-center p-3 text-xs font-medium text-slate-500">Refund Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.items.map((item, idx) => {
                    const refundInfo = REFUND_STATUSES[item.refund_status] || REFUND_STATUSES.pending;
                    const RefundIcon = refundInfo.icon;
                    const DispositionIcon = getDispositionIcon(item.item_disposition);
                    const isPurchase = item.return_type === 'purchase';
                    
                    return (
                      <tr 
                        key={`${item.return_id}-${idx}`} 
                        className="hover:bg-slate-50"
                        data-testid={`register-row-${item.return_id}-${idx}`}
                      >
                        <td className="p-3">
                          <span className="font-mono text-sm text-blue-600">{item.return_id}</span>
                        </td>
                        <td className="p-3">
                          <Badge variant={isPurchase ? "default" : "secondary"} className="text-xs">
                            {isPurchase ? 'Purchase' : 'Sales'}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-slate-600">{item.return_date}</td>
                        <td className="p-3 text-sm">
                          {isPurchase ? item.vendor_name : item.customer_name || 'N/A'}
                        </td>
                        <td className="p-3">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{item.item_name || 'Unnamed'}</p>
                            {item.return_reason && (
                              <p className="text-xs text-slate-400 capitalize">{item.return_reason.replace(/_/g, ' ')}</p>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-center text-sm">{item.qty}</td>
                        <td className="p-3 text-right text-sm font-medium">{formatCurrency(item.amount)}</td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="text-xs">
                            <DispositionIcon className="w-3 h-3 mr-1" />
                            {getDispositionLabel(item.item_disposition)}
                          </Badge>
                          {item.disposition_location && (
                            <p className="text-xs text-slate-400 mt-1">{item.disposition_location}</p>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className={`${refundInfo.color} text-xs`}>
                            <RefundIcon className="w-3 h-3 mr-1" />
                            {refundInfo.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
