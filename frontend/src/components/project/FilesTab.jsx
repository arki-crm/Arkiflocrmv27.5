import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Upload, Download, Trash2, Loader2, Link2, ExternalLink, FileCheck, Lock, Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { formatRelativeTime } from './utils';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const FilesTab = ({ projectId, files, signoffDocuments = [], onFilesChange, userRole }) => {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const fileInputRef = useRef(null);

  const canUpload = ['Admin', 'Manager', 'Designer'].includes(userRole);
  const canDelete = userRole === 'Admin';

  const getFileIcon = (fileType, isSignoff = false) => {
    if (isSignoff) return <FileCheck className="w-5 h-5 text-emerald-600" />;
    switch (fileType) {
      case 'image':
        return '🖼️';
      case 'pdf':
        return '📄';
      case 'doc':
        return '📝';
      case 'drive_link':
        return <Link2 className="w-5 h-5 text-blue-600" />;
      default:
        return '📎';
    }
  };

  const getFileType = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (ext === 'pdf') return 'pdf';
    if (['doc', 'docx'].includes(ext)) return 'doc';
    return 'other';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    try {
      setUploading(true);
      
      // Convert to base64 for storage (in production, use cloud storage)
      const reader = new FileReader();
      reader.onload = async () => {
        const fileUrl = reader.result;
        const fileType = getFileType(file.name);
        
        const response = await axios.post(`${API}/projects/${projectId}/files`, {
          file_name: file.name,
          file_url: fileUrl,
          file_type: fileType
        }, { withCredentials: true });
        
        onFilesChange([...files, response.data]);
        toast.success('File uploaded successfully');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId) => {
    try {
      setDeleting(fileId);
      await axios.delete(`${API}/projects/${projectId}/files/${fileId}`, {
        withCredentials: true
      });
      onFilesChange(files.filter(f => f.id !== fileId));
      toast.success('File deleted');
    } catch (err) {
      console.error('Delete error:', err);
      toast.error(err.response?.data?.detail || 'Failed to delete file');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = (file) => {
    // For drive links, open in new tab
    if (file.is_drive_link || file.file_type === 'drive_link') {
      window.open(file.file_url, '_blank');
      return;
    }
    
    const link = document.createElement('a');
    link.href = file.file_url;
    link.download = file.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyLink = async (file) => {
    try {
      await navigator.clipboard.writeText(file.file_url);
      setCopiedId(file.id);
      toast.success('Link copied to clipboard');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const hasSignoffDocs = signoffDocuments && signoffDocuments.length > 0;
  const hasRegularFiles = files && files.length > 0;

  return (
    <div data-testid="files-tab">
      {/* Sign-Off Documents Section */}
      {hasSignoffDocs && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <FileCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-semibold text-slate-900">Sign-Off Documents</h3>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              Approved • Locked
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            Approved documents from Design Approval Gate. These files are locked and cannot be modified from here.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {signoffDocuments.map((doc) => (
              <div
                key={doc.id}
                className="border border-emerald-200 rounded-lg p-4 bg-emerald-50/30 hover:border-emerald-300 transition-colors"
                data-testid={`signoff-doc-${doc.id}`}
              >
                {/* Header with icon and lock */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {doc.is_drive_link ? (
                      <Link2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <FileCheck className="w-5 h-5 text-emerald-600" />
                    )}
                    <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-600">
                      {doc.gate_name}
                    </Badge>
                  </div>
                  <Lock className="w-4 h-4 text-slate-400" title="Locked - Cannot be edited from here" />
                </div>
                
                {/* File name */}
                <p className="text-sm font-medium text-slate-900 truncate mb-2" title={doc.file_name}>
                  {doc.file_name}
                </p>
                
                {/* Metadata */}
                <div className="space-y-1 text-xs text-slate-500 mb-3">
                  <p>
                    <span className="font-medium">Uploaded by:</span> {doc.uploaded_by_name}
                  </p>
                  <p>
                    <span className="font-medium">Approved by:</span> {doc.approved_by_name}
                  </p>
                  <p>
                    <span className="font-medium">Approval Date:</span> {formatDate(doc.approval_date)}
                  </p>
                  {doc.version > 1 && (
                    <p>
                      <span className="font-medium">Version:</span> v{doc.version}
                    </p>
                  )}
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(doc)}
                    className="flex-1 text-xs"
                  >
                    {doc.is_drive_link ? (
                      <>
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open Link
                      </>
                    ) : (
                      <>
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopyLink(doc)}
                    className="text-xs"
                    title="Copy link"
                  >
                    {copiedId === doc.id ? (
                      <CheckCircle className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider if both sections have content */}
      {hasSignoffDocs && (hasRegularFiles || canUpload) && (
        <div className="border-t border-slate-200 my-6" />
      )}

      {/* Regular Project Files Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Project Files</h3>
          {canUpload && (
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="upload-file-btn"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload File
              </Button>
            </div>
          )}
        </div>
        
        {canUpload && (
          <p className="text-xs text-slate-500 mb-4">Max file size: 10MB</p>
        )}

        {/* Files Grid */}
        {!hasRegularFiles ? (
          <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <span className="text-2xl">📁</span>
            </div>
            <h4 className="text-sm font-medium text-slate-900">No project files uploaded yet</h4>
            <p className="text-xs text-slate-500 mt-1">Upload project files to share with the team</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((file) => (
              <div
                key={file.id}
                className="border border-slate-200 rounded-lg p-4 bg-white hover:border-slate-300 transition-colors"
                data-testid={`file-${file.id}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{typeof getFileIcon(file.file_type) === 'string' ? getFileIcon(file.file_type) : '📎'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{file.file_name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {file.uploaded_by_name} • {formatRelativeTime(file.uploaded_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(file)}
                    className="flex-1"
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(file.id)}
                      disabled={deleting === file.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {deleting === file.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
