"""
Design Approval Gate System
============================
Mandatory approval workflow before client presentations.

Phase 1 Features:
- Designer submits design renders/drawings with checklist
- Manager approves/rejects with comments
- Milestone locks during review
- Rejection returns to revision state with tracking
"""

import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# ============ GATED MILESTONES ============
# These milestones require manager approval before completion

GATED_MILESTONES = {
    "design_meeting_2": {
        "name": "Design Meeting 2 (3D Concept Freeze)",
        "description": "3D concept must be approved before client presentation",
        "stage": "3D Design",
        "order": 1
    },
    "design_meeting_3_final": {
        "name": "Design Meeting 3",
        "description": "Final design must be approved before sign-off meeting",
        "stage": "Final Design",
        "order": 2
    },
    "pre_production_signoff": {
        "name": "Final Design Presentation",
        "description": "Design must be approved before BOQ/Order lock",
        "stage": "Production Handover",
        "order": 3
    },
    "validation_internal_check": {
        "name": "Submit for Validation (Internal Check)",
        "description": "Internal validation check before final presentation",
        "stage": "Validation (Internal Check)",
        "order": 4
    },
    "kws_signoff_document": {
        "name": "KWS Sign Off Document",
        "description": "Final KWS sign-off document with client signature",
        "stage": "KWS Sign Off Document Preparation",
        "requires_pdf_upload": True,
        "order": 5
    }
}

# ============ SUBMISSION CHECKLIST TEMPLATE ============

SUBMISSION_CHECKLIST = {
    "design_meeting_2": [
        {"key": "floor_plan_finalized", "label": "Floor Plan Finalized", "required": True},
        {"key": "3d_renders_ready", "label": "3D Renders Ready", "required": True},
        {"key": "material_palette_selected", "label": "Material Palette Selected", "required": True},
        {"key": "budget_aligned", "label": "Budget Aligned with Client Expectations", "required": True},
        {"key": "scope_coverage_complete", "label": "All Rooms/Areas Covered", "required": True},
        {"key": "client_requirements_addressed", "label": "Client Requirements Addressed", "required": True}
    ],
    "design_meeting_3_final": [
        {"key": "all_revisions_incorporated", "label": "All Client Revisions Incorporated", "required": True},
        {"key": "final_3d_renders", "label": "Final 3D Renders Complete", "required": True},
        {"key": "working_drawings_ready", "label": "Working Drawings Ready", "required": True},
        {"key": "material_specifications_finalized", "label": "Material Specifications Finalized", "required": True},
        {"key": "budget_final_approval", "label": "Budget Has Client Approval", "required": True},
        {"key": "design_presentation_ready", "label": "Design Presentation Ready", "required": True}
    ],
    "validation_internal_check": [
        {"key": "design_quality_verified", "label": "Design Quality Verified", "required": True},
        {"key": "technical_accuracy_checked", "label": "Technical Accuracy Checked", "required": True},
        {"key": "client_brief_alignment", "label": "Aligned with Client Brief", "required": True},
        {"key": "internal_review_complete", "label": "Internal Review Complete", "required": True}
    ],
    "pre_production_signoff": [
        {"key": "gfc_drawings_complete", "label": "GFC Drawings Complete", "required": True},
        {"key": "boq_prepared", "label": "BOQ Prepared", "required": True},
        {"key": "vendor_quotes_received", "label": "Vendor Quotes Received", "required": True},
        {"key": "site_measurements_verified", "label": "Site Measurements Verified", "required": True},
        {"key": "production_timeline_confirmed", "label": "Production Timeline Confirmed", "required": True},
        {"key": "client_signoff_ready", "label": "Ready for Client Sign-Off", "required": True}
    ],
    "kws_signoff_document": [
        {"key": "kws_document_prepared", "label": "KWS Document Prepared", "required": True},
        {"key": "scope_finalized", "label": "Scope of Work Finalized", "required": True},
        {"key": "pricing_confirmed", "label": "Pricing Confirmed", "required": True},
        {"key": "terms_conditions_included", "label": "Terms & Conditions Included", "required": True},
        {"key": "pdf_signed_uploaded", "label": "Signed PDF Uploaded", "required": True}
    ]
}

# ============ SUBMISSION STATUSES ============

SUBMISSION_STATUSES = {
    "draft": {"label": "Draft", "color": "slate"},
    "pending_review": {"label": "Pending Review", "color": "amber"},
    "approved": {"label": "Approved", "color": "emerald"},
    "rejected": {"label": "Rejected", "color": "red"},
    "revision_required": {"label": "Revision Required", "color": "orange"}
}


# ============ PYDANTIC MODELS ============

class SubmissionFile(BaseModel):
    """File attached to a submission"""
    file_id: str
    file_name: str
    file_url: str
    file_type: str  # render, drawing, pdf, other
    file_size: Optional[int] = None
    uploaded_at: str


class ChecklistItem(BaseModel):
    """Individual checklist item status"""
    key: str
    label: str
    checked: bool = False
    notes: Optional[str] = None


class DesignSubmissionCreate(BaseModel):
    """Create a new design submission"""
    milestone_key: str
    files: List[Dict[str, Any]]
    checklist: List[Dict[str, Any]]
    design_notes: str
    concept_summary: Optional[str] = None
    constraints_notes: Optional[str] = None
    drive_link: Optional[str] = None


class DesignSubmissionReview(BaseModel):
    """Manager review of a submission"""
    approved: bool
    review_notes: str
    improvement_areas: Optional[List[str]] = None  # For rejections


# ============ HELPER FUNCTIONS ============

def get_checklist_template(milestone_key: str) -> List[Dict]:
    """Get the checklist template for a milestone"""
    return SUBMISSION_CHECKLIST.get(milestone_key, [])


def is_gated_milestone(milestone_key: str) -> bool:
    """Check if a milestone requires approval"""
    return milestone_key in GATED_MILESTONES


def get_gated_milestone_info(milestone_key: str) -> Optional[Dict]:
    """Get info about a gated milestone"""
    return GATED_MILESTONES.get(milestone_key)


def create_submission_document(
    project_id: str,
    milestone_key: str,
    files: List[Dict],
    checklist: List[Dict],
    design_notes: str,
    concept_summary: str,
    constraints_notes: str,
    submitted_by: str,
    submitted_by_name: str,
    version: int = 1,
    deadline: str = None,
    previous_submission_id: str = None,
    drive_link: str = None
) -> Dict:
    """Create a submission document for storage"""
    now = datetime.now(timezone.utc)
    
    # Check if overdue
    is_overdue = False
    if deadline:
        try:
            # Handle various datetime formats
            if isinstance(deadline, str):
                if 'T' in deadline:
                    deadline_dt = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
                else:
                    # Date only format (YYYY-MM-DD)
                    deadline_dt = datetime.fromisoformat(deadline + 'T23:59:59+00:00')
                
                # Ensure timezone awareness
                if deadline_dt.tzinfo is None:
                    deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
                    
                is_overdue = now > deadline_dt
        except (ValueError, TypeError):
            # If parsing fails, don't mark as overdue
            is_overdue = False
    
    return {
        "submission_id": f"DS-{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "milestone_key": milestone_key,
        "milestone_name": GATED_MILESTONES.get(milestone_key, {}).get("name", milestone_key),
        
        # Version tracking
        "version": version,
        "previous_submission_id": previous_submission_id,
        
        # Status
        "status": "pending_review",
        "is_locked": True,  # Locked while under review
        
        # Content
        "files": files,
        "checklist": checklist,
        "design_notes": design_notes,
        "concept_summary": concept_summary,
        "constraints_notes": constraints_notes,
        "drive_link": drive_link,
        
        # Submission info
        "submitted_by": submitted_by,
        "submitted_by_name": submitted_by_name,
        "submitted_at": now.isoformat(),
        
        # Deadline tracking
        "deadline": deadline,
        "is_overdue": is_overdue,
        "days_until_deadline": None,  # Calculated dynamically
        
        # Review info (filled on review)
        "reviewed_by": None,
        "reviewed_by_name": None,
        "reviewed_at": None,
        "review_notes": None,
        "improvement_areas": [],
        
        # Audit
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }


def calculate_deadline_status(deadline: str) -> Dict:
    """Calculate deadline status (days remaining, is_overdue, etc.)"""
    if not deadline:
        return {"has_deadline": False}
    
    now = datetime.now(timezone.utc)
    
    try:
        # Handle various datetime formats
        if isinstance(deadline, str):
            if 'T' in deadline:
                deadline_dt = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            else:
                # Date only format (YYYY-MM-DD) - set to end of day
                deadline_dt = datetime.fromisoformat(deadline + 'T23:59:59+00:00')
            
            # Ensure timezone awareness
            if deadline_dt.tzinfo is None:
                deadline_dt = deadline_dt.replace(tzinfo=timezone.utc)
        else:
            return {"has_deadline": False}
        
        delta = deadline_dt - now
        days_remaining = delta.days
        
        return {
            "has_deadline": True,
            "deadline": deadline,
            "days_remaining": days_remaining,
            "is_overdue": days_remaining < 0,
            "is_due_soon": 0 <= days_remaining <= 2,
            "status_label": "Overdue" if days_remaining < 0 else f"{days_remaining} days remaining"
        }
    except (ValueError, TypeError):
        return {"has_deadline": False}

