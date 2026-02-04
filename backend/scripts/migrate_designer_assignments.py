"""
Migration Script: Backfill Designer Assignments for Existing Projects

This script creates initial designer_assignments records for all existing projects
that have a primary_designer_id but no assignment records.

Run once to migrate existing data.
"""

import asyncio
import os
from datetime import datetime, timezone
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pathlib import Path

# Load environment
ROOT_DIR = Path(__file__).parent.parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]


async def migrate_designer_assignments():
    """Create initial assignments for projects with primary_designer_id"""
    
    print("=" * 60)
    print("Designer Assignment Migration Script")
    print("=" * 60)
    
    # Get all projects with primary_designer_id
    projects = await db.projects.find(
        {"primary_designer_id": {"$ne": None, "$exists": True}},
        {"_id": 0, "project_id": 1, "primary_designer_id": 1, "primary_designer_name": 1, "created_at": 1}
    ).to_list(None)
    
    print(f"\nFound {len(projects)} projects with primary_designer_id")
    
    # Get existing assignments to avoid duplicates
    existing_assignments = await db.designer_assignments.find(
        {},
        {"_id": 0, "project_id": 1, "designer_id": 1}
    ).to_list(None)
    
    existing_set = set(
        (a["project_id"], a["designer_id"]) 
        for a in existing_assignments
    )
    
    print(f"Found {len(existing_set)} existing assignments")
    
    created_count = 0
    skipped_count = 0
    
    for project in projects:
        project_id = project.get("project_id")
        designer_id = project.get("primary_designer_id")
        
        # Skip if assignment already exists
        if (project_id, designer_id) in existing_set:
            skipped_count += 1
            continue
        
        # Create initial assignment
        assignment = {
            "assignment_id": str(uuid.uuid4()),
            "project_id": project_id,
            "designer_id": designer_id,
            "role": "Primary",
            "assigned_from": project.get("created_at", datetime.now(timezone.utc).isoformat()),
            "assigned_to": None,  # Active
            "assignment_reason": "initial",
            "end_reason": None,
            "assigned_by": "system_migration",
            "notes": "Auto-created from existing primary_designer_id during migration",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.designer_assignments.insert_one(assignment)
        
        # Update project with assignment reference
        await db.projects.update_one(
            {"project_id": project_id},
            {"$set": {"primary_designer_assignment_id": assignment["assignment_id"]}}
        )
        
        created_count += 1
        print(f"  Created assignment for project {project_id} -> {designer_id}")
    
    print("\n" + "=" * 60)
    print(f"Migration Complete!")
    print(f"  - Created: {created_count} new assignments")
    print(f"  - Skipped: {skipped_count} (already exists)")
    print("=" * 60)
    
    return created_count, skipped_count


async def verify_migration():
    """Verify migration results"""
    
    print("\n" + "=" * 60)
    print("Verification")
    print("=" * 60)
    
    # Count assignments
    total_assignments = await db.designer_assignments.count_documents({})
    active_assignments = await db.designer_assignments.count_documents({"assigned_to": None})
    
    print(f"Total assignments: {total_assignments}")
    print(f"Active assignments: {active_assignments}")
    
    # Check for projects without assignments
    projects_with_designer = await db.projects.find(
        {"primary_designer_id": {"$ne": None, "$exists": True}},
        {"_id": 0, "project_id": 1}
    ).to_list(None)
    
    project_ids = [p["project_id"] for p in projects_with_designer]
    
    assigned_projects = await db.designer_assignments.distinct("project_id")
    
    missing = set(project_ids) - set(assigned_projects)
    
    if missing:
        print(f"\nWARNING: {len(missing)} projects still missing assignments:")
        for pid in list(missing)[:5]:
            print(f"  - {pid}")
    else:
        print("\n✓ All projects with designers have assignments!")
    
    print("=" * 60)


async def main():
    try:
        created, skipped = await migrate_designer_assignments()
        await verify_migration()
    finally:
        client.close()


if __name__ == "__main__":
    asyncio.run(main())
