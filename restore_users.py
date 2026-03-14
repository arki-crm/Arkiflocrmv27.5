#!/usr/bin/env python3
"""
Script to restore essential users after accidental deletion.
Run this script with your MongoDB connection string.

Usage:
  python3 restore_users.py "mongodb://your-connection-string"

Or set MONGO_URL environment variable and run:
  python3 restore_users.py
"""

import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone

# Try to import bcrypt, if not available use a fallback
try:
    import bcrypt
    def hash_password(password: str) -> str:
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
except ImportError:
    import hashlib
    print("WARNING: bcrypt not installed, using SHA-256 (less secure)")
    def hash_password(password: str) -> str:
        return hashlib.sha256(password.encode()).hexdigest()

from motor.motor_asyncio import AsyncIOMotorClient

# Default users to restore
USERS_TO_RESTORE = [
    {
        "email": "sidheeq.arkidots@gmail.com",
        "name": "Sidheeq",
        "role": "Founder",
        "password": "founder123",  # Will be hashed
        "status": "active"
    },
    {
        "email": "thaha.pakayil@gmail.com",
        "name": "Thaha",
        "role": "Admin",
        "password": "password123",  # Will be hashed
        "status": "active"
    }
]

# All permissions for Founder/Admin
ALL_PERMISSIONS = [
    "users.view", "users.create", "users.edit", "users.delete", "users.manage_permissions",
    "projects.view_all", "projects.create", "projects.update", "projects.delete", "projects.assign",
    "leads.view_all", "leads.create", "leads.update", "leads.convert",
    "calendar.view", "calendar.create", "calendar.update",
    "meetings.view_all", "meetings.create", "meetings.update",
    "finance.view_project_finance", "finance.edit_project_finance", "finance.edit_vendor_mapping",
    "finance.cashbook.view", "finance.cashbook.create", "finance.cashbook.edit",
    "finance.receipts.view", "finance.receipts.create", "finance.receipts.edit",
    "finance.expense_requests.view", "finance.expense_requests.create", 
    "finance.expense_requests.approve", "finance.expense_requests.record",
    "finance.liabilities.view", "finance.liabilities.create", "finance.liabilities.settle",
    "finance.trial_balance.view", "finance.pnl.view", "finance.founder_dashboard",
    "finance.salary.view", "finance.salary.process",
    "admin.audit_trail", "admin.settings", "admin.roles",
    "reports.view", "reports.export",
    "design.view_queue", "design.review", "design.approve",
    "production.view", "production.update", "production.manage",
    "inventory.view", "inventory.manage",
    "vendors.view", "vendors.create", "vendors.edit"
]

async def restore_users(mongo_url: str, db_name: str = "test_database"):
    """Restore essential users to the database"""
    
    print(f"\nConnecting to MongoDB...")
    print(f"  URL: {mongo_url[:50]}..." if len(mongo_url) > 50 else f"  URL: {mongo_url}")
    print(f"  Database: {db_name}")
    
    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]
    
    # Test connection
    try:
        await db.command('ping')
        print("  Connection: SUCCESS ✓")
    except Exception as e:
        print(f"  Connection: FAILED ✗ - {e}")
        return
    
    # Check existing users
    existing_count = await db.users.count_documents({})
    print(f"\nExisting users in database: {existing_count}")
    
    # Restore each user
    print("\nRestoring users...")
    restored = 0
    skipped = 0
    
    for user_data in USERS_TO_RESTORE:
        email = user_data["email"]
        
        # Check if user already exists
        existing = await db.users.find_one({"email": email})
        if existing:
            print(f"  SKIP: {email} (already exists)")
            skipped += 1
            continue
        
        # Create user document
        now = datetime.now(timezone.utc)
        user_id = f"user_{uuid.uuid4().hex[:16]}"
        
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": user_data["name"],
            "role": user_data["role"],
            "password_hash": hash_password(user_data["password"]),
            "status": user_data["status"],
            "permissions": ALL_PERMISSIONS,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "auth_provider": "local"
        }
        
        # Insert user
        await db.users.insert_one(user_doc)
        print(f"  CREATED: {email} ({user_data['role']}) - user_id: {user_id}")
        restored += 1
    
    print(f"\n=== SUMMARY ===")
    print(f"  Restored: {restored}")
    print(f"  Skipped (already exist): {skipped}")
    print(f"  Total users now: {await db.users.count_documents({})}")
    
    # Print login credentials
    print(f"\n=== LOGIN CREDENTIALS ===")
    for user_data in USERS_TO_RESTORE:
        print(f"  {user_data['role']}: {user_data['email']} / {user_data['password']}")
    
    print("\nDone!")

if __name__ == "__main__":
    # Get MongoDB URL from argument or environment
    if len(sys.argv) > 1:
        mongo_url = sys.argv[1]
    else:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    
    # Get DB name from environment or use default
    db_name = os.environ.get('DB_NAME', 'test_database')
    
    # Run restoration
    asyncio.run(restore_users(mongo_url, db_name))
