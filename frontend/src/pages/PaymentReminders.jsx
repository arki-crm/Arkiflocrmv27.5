import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { Mail, AlertCircle, Send, History, Calendar, User, Phone, IndianRupee, Clock, Loader2, CheckCircle } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function PaymentReminders() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState('overdue');
  const [overdueProjects, setOverdueProjects] = useState([]);
  const [reminderHistory, setReminderHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null);
  const [daysThreshold, setDaysThreshold] = useState(7);
  const [customMessage, setCustomMessage] = useState('');
  const [selectedProject, setSelectedProject] = useState(null);

  const fetchOverduePayments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/finance/reminders/overdue?days_threshold=${daysThreshold}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch overdue payments');
      }
      
      const data = await res.json();
      setOverdueProjects(data.overdue_projects || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReminderHistory = async () => {
    try {
      const res = await fetch(`${API}/api/finance/reminders/history?limit=100`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to fetch reminder history');
      }
      
      const data = await res.json();
      setReminderHistory(data.reminders || []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    fetchOverduePayments();
    fetchReminderHistory();
  }, []);

  useEffect(() => {
    if (activeTab === 'overdue') {
      fetchOverduePayments();
    }
  }, [daysThreshold]);

  const handleSendReminder = async (projectId, message = null) => {
    setSending(projectId);
    try {
      const res = await fetch(`${API}/api/finance/reminders/send`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project_id: projectId,
          reminder_type: 'manual',
          message: message || null
        })
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to send reminder');
      }
      
      const data = await res.json();
      toast.success(`Reminder logged for ₹${data.pending_amount?.toLocaleString() || 0}`);
      setSelectedProject(null);
      setCustomMessage('');
      fetchOverduePayments();
      fetchReminderHistory();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (amount) => {
    return `₹${(amount || 0).toLocaleString('en-IN')}`;
  };

  return (
    <div className="p-6 space-y-6" data-testid="payment-reminders-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-8 h-8 text-slate-700" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Payment Reminders</h1>
            <p className="text-sm text-slate-500">Send payment reminders to clients (mocked)</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
          <AlertCircle className="w-3 h-3 mr-1" />
          Mocked - Emails logged only
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overdue" data-testid="tab-overdue">
            <AlertCircle className="w-4 h-4 mr-2" />
            Overdue Payments ({overdueProjects.length})
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <History className="w-4 h-4 mr-2" />
            Reminder History ({reminderHistory.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overdue" className="mt-4">
          {/* Filters */}
          <Card className="mb-4">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">Overdue threshold:</label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={daysThreshold}
                    onChange={(e) => setDaysThreshold(parseInt(e.target.value) || 7)}
                    className="w-20"
                    data-testid="days-threshold"
                  />
                  <span className="text-sm text-slate-500">days</span>
                </div>
                <Button variant="outline" onClick={fetchOverduePayments}>
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Overdue List */}
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-slate-500">Loading overdue payments...</div>
              ) : overdueProjects.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-400 mb-2" />
                  No overdue payments found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Project</th>
                        <th className="text-left p-3 font-medium text-slate-600">Client</th>
                        <th className="text-right p-3 font-medium text-slate-600">Contract</th>
                        <th className="text-right p-3 font-medium text-slate-600">Received</th>
                        <th className="text-right p-3 font-medium text-slate-600">Pending</th>
                        <th className="text-center p-3 font-medium text-slate-600">Last Reminder</th>
                        <th className="text-center p-3 font-medium text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {overdueProjects.map((project) => (
                        <tr key={project.project_id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{project.project_name}</div>
                            <div className="text-xs text-slate-400 font-mono">{project.project_id}</div>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <User className="w-3 h-3 text-slate-400" />
                              <div>
                                <div className="text-slate-700">{project.client_name}</div>
                                {project.client_phone && (
                                  <div className="text-xs text-slate-400 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {project.client_phone}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-medium text-slate-600">
                            {formatCurrency(project.contract_value)}
                          </td>
                          <td className="p-3 text-right text-green-600">
                            {formatCurrency(project.total_received)}
                          </td>
                          <td className="p-3 text-right">
                            <span className="font-bold text-red-600">
                              {formatCurrency(project.pending_amount)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {project.last_reminder_sent ? (
                              <div>
                                <div className="text-xs text-slate-500">
                                  {formatDate(project.last_reminder_sent)}
                                </div>
                                {project.days_since_last_reminder !== null && (
                                  <Badge variant="outline" className="text-xs">
                                    {project.days_since_last_reminder} days ago
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Never</span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex items-center gap-2 justify-center">
                              <Button
                                size="sm"
                                onClick={() => handleSendReminder(project.project_id)}
                                disabled={sending === project.project_id}
                                data-testid={`send-reminder-${project.project_id}`}
                              >
                                {sending === project.project_id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <Send className="w-4 h-4 mr-1" />
                                    Send
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedProject(project)}
                              >
                                Custom
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardContent className="p-0">
              {reminderHistory.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No reminders sent yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 font-medium text-slate-600">Sent At</th>
                        <th className="text-left p-3 font-medium text-slate-600">Project</th>
                        <th className="text-left p-3 font-medium text-slate-600">Client</th>
                        <th className="text-right p-3 font-medium text-slate-600">Pending Amount</th>
                        <th className="text-center p-3 font-medium text-slate-600">Type</th>
                        <th className="text-left p-3 font-medium text-slate-600">Sent By</th>
                        <th className="text-center p-3 font-medium text-slate-600">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {reminderHistory.map((reminder) => (
                        <tr key={reminder.reminder_id} className="hover:bg-slate-50">
                          <td className="p-3 text-slate-600">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {formatDate(reminder.sent_at)}
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="font-medium text-slate-700">{reminder.project_name}</div>
                          </td>
                          <td className="p-3 text-slate-600">
                            {reminder.client_name}
                          </td>
                          <td className="p-3 text-right font-medium text-red-600">
                            {formatCurrency(reminder.pending_amount)}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="capitalize">
                              {reminder.reminder_type}
                            </Badge>
                          </td>
                          <td className="p-3 text-slate-600">
                            {reminder.sent_by_name}
                          </td>
                          <td className="p-3 text-center">
                            <Badge className="bg-yellow-100 text-yellow-700">
                              {reminder.is_mocked ? 'Logged (Mock)' : reminder.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Custom Message Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Send Custom Reminder
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="bg-slate-50 p-3 rounded">
                <div className="text-sm text-slate-600">
                  <strong>Project:</strong> {selectedProject.project_name}
                </div>
                <div className="text-sm text-slate-600">
                  <strong>Client:</strong> {selectedProject.client_name}
                </div>
                <div className="text-sm text-red-600 font-medium">
                  <strong>Pending:</strong> {formatCurrency(selectedProject.pending_amount)}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">
                  Custom Message (optional)
                </label>
                <Textarea
                  placeholder="Enter a custom message for this reminder..."
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  rows={5}
                  data-testid="custom-message"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Leave empty to use default message template
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedProject(null);
                    setCustomMessage('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => handleSendReminder(selectedProject.project_id, customMessage || null)}
                  disabled={sending}
                  data-testid="send-custom-reminder-btn"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Send Reminder
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
