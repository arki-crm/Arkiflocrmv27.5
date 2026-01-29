// =====================================================
// ARKIFLO PERMISSION REPAIR SCRIPT
// Run this ONCE to fix all existing users
// =====================================================
// 
// HOW TO RUN:
// 1. SSH into your VPS
// 2. docker exec -it arkiflo_mongo mongosh -u admin -p YOUR_PASSWORD --authenticationDatabase admin
// 3. Copy and paste this entire script
// =====================================================

use arkiflo

print("=========================================")
print("ARKIFLO PERMISSION REPAIR - Starting...")
print("=========================================")

// Define the permission sets (must match backend DEFAULT_ROLE_PERMISSIONS)
const ADMIN_PERMISSIONS = [
    "presales.view", "presales.view_all", "presales.create", "presales.edit", "presales.delete",
    "leads.view", "leads.view_all", "leads.create", "leads.edit", "leads.delete", "leads.convert",
    "projects.view", "projects.view_all", "projects.create", "projects.edit", "projects.delete",
    "projects.assign", "projects.change_status", "projects.manage_phases",
    "crm.view", "crm.view_all", "crm.create", "crm.edit", "crm.delete",
    "crm.view_interactions", "crm.add_interactions", "crm.view_files", "crm.upload_files",
    "finance.view_cashbook", "finance.add_transaction", "finance.edit_transaction", "finance.delete_transaction",
    "finance.view_payables", "finance.create_payable", "finance.edit_payable", "finance.mark_paid",
    "finance.view_receivables", "finance.create_receivable", "finance.edit_receivable", "finance.mark_received",
    "finance.view_budgets", "finance.create_budget", "finance.edit_budget",
    "finance.view_expenses", "finance.add_expense", "finance.approve_expense",
    "finance.view_reports", "finance.export_reports",
    "reports.view_all", "reports.export", "reports.cash_flow", "reports.profitability",
    "users.view", "users.create", "users.edit", "users.delete", "users.manage_roles",
    "settings.view", "settings.edit", "settings.manage_permissions",
    "backup.view", "backup.create", "backup.restore",
    "audit.view", "audit.export",
    "import_export.import", "import_export.export",
    "ca_mode.access"
]

const DESIGNER_PERMISSIONS = [
    "projects.view", "projects.edit",
    "crm.view", "crm.add_interactions",
    "finance.view_expenses", "finance.add_expense"
]

// Count users before repair
const totalUsers = db.users.countDocuments({})
print(`\nTotal users in database: ${totalUsers}`)

// Find users with missing or empty permissions
const usersToRepair = db.users.find({
    $or: [
        { permissions: { $exists: false } },
        { permissions: [] },
        { permissions: null }
    ]
}).toArray()

print(`Users needing repair: ${usersToRepair.length}`)

if (usersToRepair.length === 0) {
    print("\n✓ All users already have valid permissions. No repair needed.")
} else {
    print("\n--- Repairing users ---")
    
    let adminRepaired = 0
    let designerRepaired = 0
    let otherRepaired = 0
    
    usersToRepair.forEach(user => {
        const role = user.role || "Designer"
        let permissions = []
        
        if (role === "Admin") {
            permissions = ADMIN_PERMISSIONS
            adminRepaired++
        } else if (role === "Designer") {
            permissions = DESIGNER_PERMISSIONS
            designerRepaired++
        } else {
            // Unknown role - give Designer permissions as safe default
            permissions = DESIGNER_PERMISSIONS
            otherRepaired++
        }
        
        db.users.updateOne(
            { user_id: user.user_id },
            { $set: { permissions: permissions } }
        )
        
        print(`  ✓ Repaired: ${user.email} (${role}) - ${permissions.length} permissions`)
    })
    
    print(`\n--- Repair Summary ---`)
    print(`  Admins repaired: ${adminRepaired}`)
    print(`  Designers repaired: ${designerRepaired}`)
    print(`  Other roles repaired: ${otherRepaired}`)
}

// Verification
print("\n--- Verification ---")
const stillBroken = db.users.countDocuments({
    $or: [
        { permissions: { $exists: false } },
        { permissions: [] },
        { permissions: null }
    ]
})

if (stillBroken === 0) {
    print("✓ SUCCESS: All users now have valid permissions")
} else {
    print(`✗ WARNING: ${stillBroken} users still have invalid permissions`)
}

// Show final state
print("\n--- Final User State ---")
db.users.find({}, { email: 1, role: 1, status: 1, "permissions": { $size: "$permissions" } }).forEach(user => {
    const permCount = user.permissions ? (Array.isArray(user.permissions) ? user.permissions.length : "N/A") : 0
    print(`  ${user.email} | ${user.role} | ${user.status} | ${permCount} permissions`)
})

print("\n=========================================")
print("REPAIR COMPLETE")
print("=========================================")
