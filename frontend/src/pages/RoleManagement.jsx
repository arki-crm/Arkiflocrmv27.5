import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { 
  Shield, Plus, Edit2, Trash2, RotateCcw, Users, Lock, 
  ChevronDown, ChevronRight, Check, X, Search, Loader2,
  AlertTriangle, Info
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';

const API = process.env.REACT_APP_BACKEND_URL;

// Permission group colors
const GROUP_COLORS = {
  presales: 'bg-blue-100 text-blue-800',
  leads: 'bg-purple-100 text-purple-800',
  projects: 'bg-green-100 text-green-800',
  milestones: 'bg-orange-100 text-orange-800',
  warranty: 'bg-yellow-100 text-yellow-800',
  service: 'bg-red-100 text-red-800',
  academy: 'bg-pink-100 text-pink-800',
  admin: 'bg-slate-100 text-slate-800',
  finance_cashbook: 'bg-emerald-100 text-emerald-800',
  finance_accounts: 'bg-teal-100 text-teal-800',
  finance_receipts: 'bg-cyan-100 text-cyan-800',
  finance_invoices: 'bg-sky-100 text-sky-800',
  finance_refunds: 'bg-indigo-100 text-indigo-800',
  finance_project: 'bg-violet-100 text-violet-800',
  finance_expenses: 'bg-fuchsia-100 text-fuchsia-800',
  finance_budget: 'bg-rose-100 text-rose-800',
  finance_reports: 'bg-amber-100 text-amber-800',
  finance_settings: 'bg-lime-100 text-lime-800'
};

export default function RoleManagement() {
  const { user, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availablePermissions, setAvailablePermissions] = useState({});
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    default_permissions: []
  });
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    if (user && !hasPermission('admin.assign_permissions')) {
      navigate('/dashboard');
      return;
    }
    fetchRoles();
    fetchPermissions();
  }, [user, navigate, hasPermission]);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/api/roles`, { withCredentials: true });
      setRoles(response.data.roles || []);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${API}/api/permissions/available`, { withCredentials: true });
      setAvailablePermissions(response.data.permission_groups || {});
    } catch (err) {
      console.error('Failed to fetch permissions:', err);
    }
  };

  const handleCreateRole = async () => {
    if (!formData.id.trim()) {
      toast.error('Role ID is required');
      return;
    }
    if (!formData.name.trim()) {
      toast.error('Role name is required');
      return;
    }
    
    try {
      setSaving(true);
      await axios.post(`${API}/api/roles`, formData, { withCredentials: true });
      toast.success(`Role "${formData.name}" created successfully`);
      setShowCreateModal(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    try {
      setSaving(true);
      await axios.put(`${API}/api/roles/${selectedRole.id}`, {
        name: formData.name,
        description: formData.description,
        default_permissions: formData.default_permissions
      }, { withCredentials: true });
      toast.success(`Role "${formData.name}" updated successfully`);
      setShowEditModal(false);
      resetForm();
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    try {
      setSaving(true);
      await axios.delete(`${API}/api/roles/${selectedRole.id}`, { withCredentials: true });
      toast.success(selectedRole.is_builtin 
        ? `Role "${selectedRole.name}" reset to defaults`
        : `Role "${selectedRole.name}" deleted`
      );
      setShowDeleteModal(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  const handleResetRole = async (role) => {
    try {
      await axios.post(`${API}/api/roles/${role.id}/reset`, {}, { withCredentials: true });
      toast.success(`Role "${role.name}" reset to default permissions`);
      fetchRoles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to reset role');
    }
  };

  const openEditModal = (role) => {
    setSelectedRole(role);
    setFormData({
      id: role.id,
      name: role.name,
      description: role.description || '',
      default_permissions: role.custom_permissions || role.default_permissions || []
    });
    setShowEditModal(true);
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      id: '',
      name: '',
      description: '',
      default_permissions: []
    });
    setSelectedRole(null);
    setExpandedGroups({});
  };

  const togglePermission = (permId) => {
    setFormData(prev => ({
      ...prev,
      default_permissions: prev.default_permissions.includes(permId)
        ? prev.default_permissions.filter(p => p !== permId)
        : [...prev.default_permissions, permId]
    }));
  };

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey]
    }));
  };

  const selectAllInGroup = (groupKey, permissions) => {
    const permIds = permissions.map(p => p.id);
    const allSelected = permIds.every(id => formData.default_permissions.includes(id));
    
    setFormData(prev => ({
      ...prev,
      default_permissions: allSelected
        ? prev.default_permissions.filter(p => !permIds.includes(p))
        : [...new Set([...prev.default_permissions, ...permIds])]
    }));
  };

  const filteredPermissions = Object.entries(availablePermissions).filter(([key, group]) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return group.name.toLowerCase().includes(search) ||
      group.permissions.some(p => 
        p.name.toLowerCase().includes(search) || 
        p.id.toLowerCase().includes(search)
      );
  });

  // Access check
  if (!user || !hasPermission('admin.assign_permissions')) {
    return (
      <div className="p-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <p className="text-red-600">Access Denied. Requires permission assignment privileges.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="role-management-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            Role Management
          </h1>
          <p className="text-slate-500 mt-1">
            Create and manage roles with custom permissions
          </p>
        </div>
        <Button onClick={openCreateModal} data-testid="create-role-btn">
          <Plus className="w-4 h-4 mr-2" />
          Create Role
        </Button>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4 flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">About Roles</p>
            <p className="mt-1">
              Roles define default permissions for new users. Built-in roles can be customized but not deleted. 
              When you modify a built-in role, it creates a custom override that can be reset anytime.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {roles.map(role => (
          <Card 
            key={role.id} 
            className={`hover:shadow-md transition-shadow ${role.has_custom_permissions ? 'ring-2 ring-amber-300' : ''}`}
            data-testid={`role-card-${role.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  {role.is_builtin && (
                    <Badge variant="outline" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Built-in
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => openEditModal(role)}
                    data-testid={`edit-role-${role.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  {role.has_custom_permissions && role.is_builtin && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleResetRole(role)}
                      title="Reset to defaults"
                    >
                      <RotateCcw className="w-4 h-4 text-amber-600" />
                    </Button>
                  )}
                  {(!role.is_builtin || role.has_custom_permissions) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setSelectedRole(role);
                        setShowDeleteModal(true);
                      }}
                      data-testid={`delete-role-${role.id}`}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription className="text-xs mt-1">
                {role.description || 'No description'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-4">
                  <span className="text-slate-600">
                    <Shield className="w-4 h-4 inline mr-1" />
                    {role.permission_count} permissions
                  </span>
                  <span className="text-slate-600">
                    <Users className="w-4 h-4 inline mr-1" />
                    {role.user_count} users
                  </span>
                </div>
              </div>
              {role.has_custom_permissions && (
                <Badge className="mt-2 bg-amber-100 text-amber-800 text-xs">
                  Custom Permissions
                </Badge>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showCreateModal || showEditModal} onOpenChange={() => {
        setShowCreateModal(false);
        setShowEditModal(false);
        resetForm();
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {showCreateModal ? 'Create New Role' : `Edit Role: ${selectedRole?.name}`}
            </DialogTitle>
            <DialogDescription>
              {showCreateModal 
                ? 'Define a new role with custom permissions'
                : 'Modify the default permissions for this role'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="roleId">Role ID</Label>
                <Input
                  id="roleId"
                  value={formData.id}
                  onChange={(e) => setFormData(prev => ({ ...prev, id: e.target.value.replace(/\s/g, '') }))}
                  placeholder="e.g., CustomManager"
                  disabled={showEditModal}
                  data-testid="role-id-input"
                />
                <p className="text-xs text-slate-500 mt-1">Unique identifier (no spaces)</p>
              </div>
              <div>
                <Label htmlFor="roleName">Display Name</Label>
                <Input
                  id="roleName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Custom Manager"
                  data-testid="role-name-input"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="roleDesc">Description</Label>
              <Textarea
                id="roleDesc"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this role is for..."
                rows={2}
              />
            </div>

            {/* Permission Selection */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">
                  Permissions ({formData.default_permissions.length} selected)
                </Label>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search permissions..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {filteredPermissions.map(([groupKey, group]) => {
                  const groupPerms = group.permissions || [];
                  const selectedCount = groupPerms.filter(p => 
                    formData.default_permissions.includes(p.id)
                  ).length;
                  const isExpanded = expandedGroups[groupKey];

                  return (
                    <div key={groupKey} className="border rounded-lg overflow-hidden">
                      <div
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                        onClick={() => toggleGroup(groupKey)}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <Badge className={GROUP_COLORS[groupKey] || 'bg-slate-100'}>
                            {group.name}
                          </Badge>
                          <span className="text-sm text-slate-600">
                            {selectedCount}/{groupPerms.length} selected
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInGroup(groupKey, groupPerms);
                          }}
                        >
                          {selectedCount === groupPerms.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2 bg-white">
                          {groupPerms.map(perm => (
                            <label
                              key={perm.id}
                              className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer"
                            >
                              <Checkbox
                                checked={formData.default_permissions.includes(perm.id)}
                                onCheckedChange={() => togglePermission(perm.id)}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">{perm.name}</p>
                                <p className="text-xs text-slate-500">{perm.description}</p>
                                <code className="text-xs text-slate-400">{perm.id}</code>
                              </div>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateModal(false);
              setShowEditModal(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button 
              onClick={showCreateModal ? handleCreateRole : handleUpdateRole}
              disabled={saving}
              data-testid="save-role-btn"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {showCreateModal ? 'Create Role' : 'Save Changes'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {selectedRole?.is_builtin ? 'Reset Role' : 'Delete Role'}
            </DialogTitle>
            <DialogDescription>
              {selectedRole?.is_builtin ? (
                <>
                  This will reset <strong>{selectedRole?.name}</strong> to its default permissions.
                  Any custom permission overrides will be removed.
                </>
              ) : selectedRole?.user_count > 0 ? (
                <>
                  Cannot delete <strong>{selectedRole?.name}</strong> because {selectedRole?.user_count} users 
                  are assigned to this role. Please reassign them first.
                </>
              ) : (
                <>
                  Are you sure you want to delete <strong>{selectedRole?.name}</strong>? 
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            {(!selectedRole?.user_count || selectedRole?.user_count === 0 || selectedRole?.is_builtin) && (
              <Button 
                variant="destructive" 
                onClick={handleDeleteRole}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : selectedRole?.is_builtin ? (
                  'Reset to Defaults'
                ) : (
                  'Delete Role'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
