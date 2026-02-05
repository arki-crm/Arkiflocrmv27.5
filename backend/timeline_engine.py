"""
Timeline Intelligence Engine
=============================
System-Generated Tentative Timeline Engine for Interior Design Projects

This module provides:
1. Auto-generation of project timelines based on multiple factors
2. Override request and approval workflow
3. Customer timeline sharing controls
"""

import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel


# ============ DATA MODELS ============

class TimelineMilestone(BaseModel):
    """Individual milestone in a timeline"""
    milestone_key: str
    milestone_name: str
    planned_date: str
    buffer_days: int = 0
    is_customer_facing: bool = True
    requires_meeting: bool = False
    dependencies: List[str] = []


class TimelineCalculationInputs(BaseModel):
    """Inputs used to calculate the timeline"""
    # Project factors
    scope_type: str
    complexity_factor: float
    project_tier: str
    revision_buffer: float
    priority_tag: str
    timeline_compression: float
    
    # Designer factors
    designer_id: str
    designer_name: str
    designer_skill_level: str
    skill_multiplier: float
    designer_active_projects: int
    workload_multiplier: float
    
    # Manager factors
    manager_pending_reviews: int
    manager_review_buffer_days: int
    
    # Client factors
    client_coordination_buffer: int
    
    # Historical
    designer_avg_turnaround_days: Optional[float] = None
    performance_factor: float = 1.0


class TimelineVersion(BaseModel):
    """A version of the timeline (system or override)"""
    version: int
    type: str  # system_generated | manual_override
    status: str  # pending_approval | approved | rejected | superseded
    milestones: List[Dict[str, Any]]
    calculation_inputs: Dict[str, Any]
    created_by: str
    created_by_name: str
    created_at: str
    reviewed_by: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    reviewed_at: Optional[str] = None
    review_notes: Optional[str] = None


class TimelineOverrideRequest(BaseModel):
    """Request to override timeline milestones"""
    milestones: List[Dict[str, Any]]
    override_reason: str
    notes: Optional[str] = None


class TimelineReviewRequest(BaseModel):
    """Manager review of a timeline"""
    approved: bool
    review_notes: Optional[str] = None
    adjusted_milestones: Optional[List[Dict[str, Any]]] = None


# ============ DEFAULT CONFIGURATION ============

DEFAULT_TIMELINE_CONFIG = {
    "config_id": "default",
    
    # === MILESTONE DEFINITIONS (11 total) ===
    "milestones": [
        {
            "key": "site_measurement",
            "name": "Site Measurement",
            "sequence": 1,
            "base_days_from_booking": 3,
            "base_days_from_previous": 0,
            "is_customer_facing": True,
            "requires_meeting": False
        },
        {
            "key": "internal_design_review_1",
            "name": "Internal Design Review 1",
            "sequence": 2,
            "base_days_from_booking": 0,
            "base_days_from_previous": 5,
            "is_customer_facing": False,
            "requires_meeting": False
        },
        {
            "key": "design_meeting_1",
            "name": "Design Meeting 1",
            "sequence": 3,
            "base_days_from_booking": 0,
            "base_days_from_previous": 3,
            "is_customer_facing": True,
            "requires_meeting": True
        },
        {
            "key": "internal_design_review_2",
            "name": "Internal Design Review 2",
            "sequence": 4,
            "base_days_from_booking": 0,
            "base_days_from_previous": 5,
            "is_customer_facing": False,
            "requires_meeting": False
        },
        {
            "key": "design_meeting_2",
            "name": "Design Meeting 2",
            "sequence": 5,
            "base_days_from_booking": 0,
            "base_days_from_previous": 3,
            "is_customer_facing": True,
            "requires_meeting": True
        },
        {
            "key": "design_meeting_3_final",
            "name": "Design Meeting 3 (Final)",
            "sequence": 6,
            "base_days_from_booking": 0,
            "base_days_from_previous": 5,
            "is_customer_facing": True,
            "requires_meeting": True
        },
        {
            "key": "material_selection_confirmation",
            "name": "Final Material Selection & Design Confirmation",
            "sequence": 7,
            "base_days_from_booking": 0,
            "base_days_from_previous": 5,
            "is_customer_facing": True,
            "requires_meeting": False
        },
        {
            "key": "payment_order_confirmation",
            "name": "Payment Collection & Order Confirmation",
            "sequence": 8,
            "base_days_from_booking": 0,
            "base_days_from_previous": 3,
            "is_customer_facing": True,
            "requires_meeting": False
        },
        {
            "key": "site_validation",
            "name": "Site Validation",
            "sequence": 9,
            "base_days_from_booking": 0,
            "base_days_from_previous": 5,
            "is_customer_facing": True,
            "requires_meeting": False
        },
        {
            "key": "gfc_approval",
            "name": "GFC Approval (Internal)",
            "sequence": 10,
            "base_days_from_booking": 0,
            "base_days_from_previous": 3,
            "is_customer_facing": False,
            "requires_meeting": False
        },
        {
            "key": "order_signoff_meeting",
            "name": "Order Sign-Off Meeting",
            "sequence": 11,
            "base_days_from_booking": 0,
            "base_days_from_previous": 2,
            "is_customer_facing": True,
            "requires_meeting": True
        }
    ],
    
    # === SCOPE COMPLEXITY ===
    "scope_types": {
        "studio": {"label": "Studio", "complexity_factor": 0.6, "estimated_rooms": 2},
        "1bhk": {"label": "1 BHK", "complexity_factor": 0.7, "estimated_rooms": 3},
        "2bhk": {"label": "2 BHK", "complexity_factor": 0.9, "estimated_rooms": 5},
        "3bhk": {"label": "3 BHK", "complexity_factor": 1.0, "estimated_rooms": 8},
        "4bhk": {"label": "4 BHK", "complexity_factor": 1.2, "estimated_rooms": 10},
        "5bhk_plus": {"label": "5 BHK+", "complexity_factor": 1.4, "estimated_rooms": 12},
        "villa": {"label": "Villa", "complexity_factor": 1.5, "estimated_rooms": 12},
        "luxury_villa": {"label": "Luxury Villa", "complexity_factor": 1.8, "estimated_rooms": 15},
        "commercial": {"label": "Commercial", "complexity_factor": 1.6, "estimated_rooms": 10}
    },
    
    # === DESIGNER SKILL MULTIPLIERS ===
    "designer_skill_levels": {
        "junior": {"label": "Junior Designer", "productivity_multiplier": 1.4, "max_concurrent_projects": 3},
        "intermediate": {"label": "Intermediate Designer", "productivity_multiplier": 1.15, "max_concurrent_projects": 5},
        "senior": {"label": "Senior Designer", "productivity_multiplier": 1.0, "max_concurrent_projects": 7},
        "architect": {"label": "Architect", "productivity_multiplier": 0.85, "max_concurrent_projects": 8}
    },
    
    # === PROJECT TIER & REVISION BUFFERS ===
    "project_tiers": {
        "standard": {"label": "Standard", "revision_probability_buffer": 1.0, "expected_revisions": 1},
        "premium": {"label": "Premium", "revision_probability_buffer": 1.2, "expected_revisions": 2},
        "luxury": {"label": "Luxury", "revision_probability_buffer": 1.5, "expected_revisions": 3}
    },
    
    # === PRIORITY / URGENCY TAGS ===
    "priority_tags": {
        "normal": {"label": "Normal", "timeline_compression": 1.0},
        "fast_track": {"label": "Fast-Track", "timeline_compression": 0.75},
        "vip": {"label": "VIP", "timeline_compression": 0.8},
        "referral": {"label": "Referral", "timeline_compression": 0.85}
    },
    
    # === WORKLOAD THRESHOLDS ===
    "workload_thresholds": {
        "low": {"max_projects": 3, "buffer_multiplier": 1.0},
        "medium": {"max_projects": 5, "buffer_multiplier": 1.15},
        "high": {"max_projects": 7, "buffer_multiplier": 1.3},
        "overloaded": {"max_projects": 999, "buffer_multiplier": 1.5}
    },
    
    # === DESIGN MANAGER REVIEW CAPACITY ===
    "manager_review_capacity": {
        "base_review_days": 1,
        "capacity_thresholds": {
            "light": {"max_pending_reviews": 3, "review_buffer_days": 1},
            "moderate": {"max_pending_reviews": 6, "review_buffer_days": 2},
            "heavy": {"max_pending_reviews": 10, "review_buffer_days": 3},
            "overloaded": {"max_pending_reviews": 999, "review_buffer_days": 5}
        }
    },
    
    # === CLIENT SCHEDULING BUFFER ===
    "client_buffers": {
        "meeting_coordination_days": 2,
        "rescheduling_buffer_days": 1,
        "weekend_availability_factor": 1.2
    },
    
    # === GENERAL DEFAULTS ===
    "default_buffers": {
        "weekend_skip": True,
        "holiday_skip": True
    },
    
    "created_at": datetime.now(timezone.utc).isoformat(),
    "updated_at": datetime.now(timezone.utc).isoformat()
}


# ============ HELPER FUNCTIONS ============

def add_business_days(start_date: datetime, days: int, skip_weekends: bool = True) -> datetime:
    """Add business days to a date, optionally skipping weekends"""
    if not skip_weekends:
        return start_date + timedelta(days=days)
    
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        # Skip Saturday (5) and Sunday (6)
        if current.weekday() < 5:
            added += 1
    return current


def determine_workload_level(active_projects: int, thresholds: Dict) -> str:
    """Determine workload level based on active project count"""
    if active_projects <= thresholds["low"]["max_projects"]:
        return "low"
    elif active_projects <= thresholds["medium"]["max_projects"]:
        return "medium"
    elif active_projects <= thresholds["high"]["max_projects"]:
        return "high"
    return "overloaded"


def determine_review_capacity(pending_reviews: int, capacity_config: Dict) -> str:
    """Determine manager review capacity based on pending reviews"""
    thresholds = capacity_config["capacity_thresholds"]
    if pending_reviews <= thresholds["light"]["max_pending_reviews"]:
        return "light"
    elif pending_reviews <= thresholds["moderate"]["max_pending_reviews"]:
        return "moderate"
    elif pending_reviews <= thresholds["heavy"]["max_pending_reviews"]:
        return "heavy"
    return "overloaded"


# ============ MAIN TIMELINE GENERATION ============

def generate_system_timeline(
    booking_date: datetime,
    scope_type: str,
    project_tier: str,
    priority_tag: str,
    designer_id: str,
    designer_name: str,
    designer_skill_level: str,
    designer_active_projects: int,
    manager_pending_reviews: int,
    config: Dict = None
) -> tuple[List[Dict], Dict]:
    """
    Generate a system timeline based on all calculation factors.
    
    Returns:
        tuple: (milestones list, calculation_inputs dict)
    """
    if config is None:
        config = DEFAULT_TIMELINE_CONFIG
    
    # ========== FACTOR 1: SCOPE COMPLEXITY ==========
    scope_config = config["scope_types"].get(scope_type, config["scope_types"]["3bhk"])
    complexity_factor = scope_config["complexity_factor"]
    
    # ========== FACTOR 2: DESIGNER SKILL MULTIPLIER ==========
    skill_config = config["designer_skill_levels"].get(
        designer_skill_level, 
        config["designer_skill_levels"]["intermediate"]
    )
    skill_multiplier = skill_config["productivity_multiplier"]
    
    # ========== FACTOR 3: DESIGNER WORKLOAD ==========
    workload_level = determine_workload_level(
        designer_active_projects, 
        config["workload_thresholds"]
    )
    workload_multiplier = config["workload_thresholds"][workload_level]["buffer_multiplier"]
    
    # ========== FACTOR 4: PROJECT TIER (Revision Buffer) ==========
    tier_config = config["project_tiers"].get(project_tier, config["project_tiers"]["standard"])
    revision_buffer = tier_config["revision_probability_buffer"]
    
    # ========== FACTOR 5: PRIORITY TAG (Timeline Compression) ==========
    priority_config = config["priority_tags"].get(priority_tag, config["priority_tags"]["normal"])
    timeline_compression = priority_config["timeline_compression"]
    
    # ========== FACTOR 6: DESIGN MANAGER REVIEW CAPACITY ==========
    review_capacity = determine_review_capacity(
        manager_pending_reviews, 
        config["manager_review_capacity"]
    )
    manager_review_buffer = config["manager_review_capacity"]["capacity_thresholds"][review_capacity]["review_buffer_days"]
    
    # ========== FACTOR 7: CLIENT COORDINATION BUFFER ==========
    client_buffer = config["client_buffers"]["meeting_coordination_days"]
    
    # ========== COMBINED DESIGN MULTIPLIER ==========
    design_multiplier = (
        complexity_factor * 
        skill_multiplier * 
        workload_multiplier * 
        revision_buffer * 
        timeline_compression
    )
    
    # ========== GENERATE MILESTONES ==========
    current_date = booking_date
    milestones = []
    skip_weekends = config["default_buffers"]["weekend_skip"]
    
    for milestone_config in config["milestones"]:
        # Calculate base days
        if milestone_config["sequence"] == 1:
            base_days = milestone_config["base_days_from_booking"]
        else:
            base_days = milestone_config["base_days_from_previous"]
        
        # Apply design multiplier
        adjusted_days = base_days * design_multiplier
        
        # Add manager review buffer for internal review milestones
        if milestone_config["key"] in ["internal_design_review_1", "internal_design_review_2"]:
            adjusted_days += manager_review_buffer
        
        # Add client buffer for customer-facing meetings
        if milestone_config["requires_meeting"] and milestone_config["is_customer_facing"]:
            adjusted_days += client_buffer
        
        # Round to nearest day
        adjusted_days = max(1, round(adjusted_days))
        
        # Calculate planned date
        planned_date = add_business_days(current_date, adjusted_days, skip_weekends)
        
        milestones.append({
            "milestone_key": milestone_config["key"],
            "milestone_name": milestone_config["name"],
            "sequence": milestone_config["sequence"],
            "planned_date": planned_date.strftime("%Y-%m-%d"),
            "base_days": base_days,
            "adjusted_days": adjusted_days,
            "is_customer_facing": milestone_config["is_customer_facing"],
            "requires_meeting": milestone_config["requires_meeting"],
            "status": "pending"  # pending | completed | skipped
        })
        
        current_date = planned_date
    
    # Build calculation inputs record
    calculation_inputs = {
        "scope_type": scope_type,
        "scope_label": scope_config["label"],
        "complexity_factor": complexity_factor,
        "project_tier": project_tier,
        "tier_label": tier_config["label"],
        "revision_buffer": revision_buffer,
        "priority_tag": priority_tag,
        "priority_label": priority_config["label"],
        "timeline_compression": timeline_compression,
        "designer_id": designer_id,
        "designer_name": designer_name,
        "designer_skill_level": designer_skill_level,
        "skill_label": skill_config["label"],
        "skill_multiplier": skill_multiplier,
        "designer_active_projects": designer_active_projects,
        "workload_level": workload_level,
        "workload_multiplier": workload_multiplier,
        "manager_pending_reviews": manager_pending_reviews,
        "review_capacity": review_capacity,
        "manager_review_buffer_days": manager_review_buffer,
        "client_coordination_buffer": client_buffer,
        "design_multiplier": round(design_multiplier, 3),
        "booking_date": booking_date.strftime("%Y-%m-%d"),
        "total_days": (milestones[-1]["planned_date"] if milestones else booking_date.strftime("%Y-%m-%d"))
    }
    
    return milestones, calculation_inputs


def create_timeline_document(
    project_id: str,
    design_project_id: str,
    scope_type: str,
    project_tier: str,
    priority_tag: str,
    milestones: List[Dict],
    calculation_inputs: Dict,
    created_by: str = "system",
    created_by_name: str = "System"
) -> Dict:
    """Create a complete timeline document for storage"""
    now = datetime.now(timezone.utc)
    
    return {
        "timeline_id": f"TL-{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "design_project_id": design_project_id,
        
        # Project classification
        "scope_type": scope_type,
        "project_tier": project_tier,
        "priority_tag": priority_tag,
        
        # Timeline versions
        "versions": [
            {
                "version": 1,
                "type": "system_generated",
                "status": "pending_approval",
                "milestones": milestones,
                "calculation_inputs": calculation_inputs,
                "created_by": created_by,
                "created_by_name": created_by_name,
                "created_at": now.isoformat(),
                "reviewed_by": None,
                "reviewed_by_name": None,
                "reviewed_at": None,
                "review_notes": None
            }
        ],
        
        # Override control (sequential)
        "pending_override_version": None,
        
        # Active timeline
        "active_version": None,  # No active version until approved
        "latest_version": 1,
        
        # Customer sharing
        "is_shared_with_customer": False,
        "shared_at": None,
        "shared_by": None,
        "shared_by_name": None,
        
        # Audit
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }


def create_override_version(
    existing_timeline: Dict,
    new_milestones: List[Dict],
    override_reason: str,
    created_by: str,
    created_by_name: str,
    notes: str = None
) -> Dict:
    """Create a new override version for a timeline"""
    now = datetime.now(timezone.utc)
    new_version_num = existing_timeline["latest_version"] + 1
    
    # Get calculation inputs from the original version for reference
    original_inputs = existing_timeline["versions"][0]["calculation_inputs"]
    
    new_version = {
        "version": new_version_num,
        "type": "manual_override",
        "status": "pending_approval",
        "milestones": new_milestones,
        "calculation_inputs": {
            **original_inputs,
            "override_reason": override_reason,
            "override_notes": notes,
            "original_version": existing_timeline["active_version"] or 1
        },
        "created_by": created_by,
        "created_by_name": created_by_name,
        "created_at": now.isoformat(),
        "reviewed_by": None,
        "reviewed_by_name": None,
        "reviewed_at": None,
        "review_notes": None
    }
    
    return new_version, new_version_num


def get_customer_facing_milestones(milestones: List[Dict]) -> List[Dict]:
    """Filter milestones to only include customer-facing ones"""
    return [m for m in milestones if m.get("is_customer_facing", True)]
