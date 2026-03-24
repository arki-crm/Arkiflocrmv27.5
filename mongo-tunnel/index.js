import { createTunnel } from 'tunnel-ssh';
import { MongoClient } from 'mongodb';

// SSH Configuration
const SSH_CONFIG = {
  host: '62.72.43.143',
  port: 22,
  username: 'emergent_agent',
  privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDB4unbi34LMivEI8q/bIgl2rLaxbNQFhhoVbMwBV+jdgAAAJhEDpEnRA6R
JwAAAAtzc2gtZWQyNTUxOQAAACDB4unbi34LMivEI8q/bIgl2rLaxbNQFhhoVbMwBV+jdg
AAAECmkeLam+yjugyOr9crEnHzGshO+6/n54OOWfJEfA4+ucHi6duLfgsyK8Qjyr9siCXa
strFs1AWGGhVszAFX6N2AAAADmVtZXJnZW50LWFnZW50AQIDBAUGBw==
-----END OPENSSH PRIVATE KEY-----`
};

// MongoDB Configuration
const MONGO_URI = 'mongodb://arkiflo_app:pass123@127.0.0.1:27018/arkiflo?authSource=arkiflo';
const LOCAL_PORT = 27018;

// Tunnel configuration
const tunnelOptions = {
  autoClose: false
};

const serverOptions = {
  port: LOCAL_PORT
};

const sshOptions = {
  host: SSH_CONFIG.host,
  port: SSH_CONFIG.port,
  username: SSH_CONFIG.username,
  privateKey: SSH_CONFIG.privateKey
};

const forwardOptions = {
  srcAddr: '127.0.0.1',
  srcPort: LOCAL_PORT,
  dstAddr: '127.0.0.1',
  dstPort: 27017
};

// Diagnostic Functions
async function analyzeProjectTransactions(db, projectId, projectName) {
  const issues = [];
  
  const txns = await db.collection('accounting_transactions')
    .find({ project_id: projectId })
    .toArray();
  
  if (!txns.length) {
    return { project_id: projectId, project_name: projectName, txn_count: 0, issues: [] };
  }
  
  // Group by source_id
  const bySource = {};
  for (const t of txns) {
    const sourceId = t.source_id || t.reference_id || t.receipt_id || 'NO_SOURCE';
    if (!bySource[sourceId]) bySource[sourceId] = [];
    bySource[sourceId].push(t);
  }
  
  // Check each source_id group
  for (const [sourceId, entries] of Object.entries(bySource)) {
    if (sourceId === 'NO_SOURCE') {
      for (const e of entries) {
        issues.push({
          type: 'MISSING_SOURCE_ID',
          severity: 'HIGH',
          transaction_id: e.transaction_id,
          amount: e.amount,
          details: 'Transaction has no source_id/reference_id'
        });
      }
      continue;
    }
    
    // Check entry count (should be exactly 2 for double-entry)
    if (entries.length > 2) {
      issues.push({
        type: 'DUPLICATE_ENTRIES',
        severity: 'CRITICAL',
        source_id: sourceId,
        entry_count: entries.length,
        transaction_ids: entries.map(e => e.transaction_id),
        details: `source_id has ${entries.length} entries (expected 2)`
      });
    } else if (entries.length === 1) {
      const e = entries[0];
      if (e.is_double_entry || e.entry_role) {
        issues.push({
          type: 'ORPHAN_ENTRY',
          severity: 'HIGH',
          source_id: sourceId,
          transaction_id: e.transaction_id,
          entry_role: e.entry_role,
          details: 'Double-entry marked but missing pair'
        });
      }
    }
    
    // Check for balance
    if (entries.length === 2) {
      const amounts = entries.map(e => e.amount || 0);
      const uniqueAmounts = [...new Set(amounts)];
      if (uniqueAmounts.length > 1) {
        issues.push({
          type: 'UNBALANCED_PAIR',
          severity: 'CRITICAL',
          source_id: sourceId,
          amounts: amounts,
          details: `Entry amounts don't match: ${JSON.stringify(amounts)}`
        });
      }
    }
  }
  
  // Check for NULL/invalid fields
  for (const t of txns) {
    if (t.amount === null || t.amount === undefined) {
      issues.push({
        type: 'NULL_AMOUNT',
        severity: 'CRITICAL',
        transaction_id: t.transaction_id,
        details: 'Transaction has NULL amount'
      });
    }
    
    if (t.transaction_type && !['inflow', 'outflow'].includes(t.transaction_type)) {
      issues.push({
        type: 'INVALID_TYPE',
        severity: 'HIGH',
        transaction_id: t.transaction_id,
        transaction_type: t.transaction_type,
        details: `Invalid transaction_type: ${t.transaction_type}`
      });
    }
  }
  
  return {
    project_id: projectId,
    project_name: projectName,
    txn_count: txns.length,
    source_id_count: Object.keys(bySource).length,
    issues: issues
  };
}

async function runDiagnostic(db) {
  console.log('\n' + '='.repeat(70));
  console.log('PRODUCTION DIAGNOSTIC: Failing Project Financials');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('='.repeat(70));
  
  // Get all projects
  console.log('\n[1] Fetching all projects...');
  const projects = await db.collection('projects')
    .find({}, { projection: { project_id: 1, project_name: 1, name: 1 } })
    .toArray();
  console.log(`    Found ${projects.length} projects`);
  
  // Analyze each project
  console.log('\n[2] Analyzing projects for transaction integrity issues...');
  
  const failingProjects = [];
  const allIssues = [];
  
  for (const proj of projects) {
    const projectId = proj.project_id;
    const projectName = proj.project_name || proj.name || 'Unknown';
    
    const result = await analyzeProjectTransactions(db, projectId, projectName);
    
    if (result.issues.length > 0) {
      failingProjects.push(result);
      allIssues.push(...result.issues);
    }
  }
  
  // Report findings
  console.log('\n' + '='.repeat(70));
  console.log('DIAGNOSTIC RESULTS');
  console.log('='.repeat(70));
  
  if (failingProjects.length === 0) {
    console.log('\n✓ No issues found in any project!');
  } else {
    console.log(`\n✗ Found ${failingProjects.length} projects with issues:\n`);
    
    for (const fp of failingProjects) {
      console.log('\n' + '─'.repeat(60));
      console.log(`PROJECT: ${fp.project_name}`);
      console.log(`ID: ${fp.project_id}`);
      console.log(`Transactions: ${fp.txn_count}`);
      console.log(`Unique source_ids: ${fp.source_id_count}`);
      
      // Group by type
      const byType = {};
      for (const issue of fp.issues) {
        if (!byType[issue.type]) byType[issue.type] = [];
        byType[issue.type].push(issue);
      }
      
      for (const [issueType, issues] of Object.entries(byType)) {
        console.log(`\n  [${issueType}] - ${issues.length} occurrence(s)`);
        for (const issue of issues.slice(0, 3)) {
          console.log(`    Severity: ${issue.severity}`);
          console.log(`    Details: ${issue.details}`);
          if (issue.source_id) console.log(`    source_id: ${issue.source_id}`);
          if (issue.transaction_ids) console.log(`    txn_ids: ${JSON.stringify(issue.transaction_ids)}`);
        }
      }
    }
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('ISSUE SUMMARY');
  console.log('='.repeat(70));
  
  const issueCounts = {};
  for (const issue of allIssues) {
    issueCounts[issue.type] = (issueCounts[issue.type] || 0) + 1;
  }
  
  console.log(`\nTotal issues found: ${allIssues.length}`);
  for (const [type, count] of Object.entries(issueCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  - ${type}: ${count}`);
  }
  
  // Broken source_ids
  const brokenSources = allIssues.filter(i => 
    ['DUPLICATE_ENTRIES', 'ORPHAN_ENTRY', 'UNBALANCED_PAIR'].includes(i.type)
  );
  
  if (brokenSources.length > 0) {
    console.log('\n' + '='.repeat(70));
    console.log('BROKEN SOURCE_IDS (Requiring Fix)');
    console.log('='.repeat(70));
    
    for (const issue of brokenSources.slice(0, 20)) {
      console.log(`\n  Type: ${issue.type}`);
      console.log(`  source_id: ${issue.source_id || 'N/A'}`);
      console.log(`  Details: ${issue.details}`);
      if (issue.transaction_ids) {
        console.log(`  Transactions: ${JSON.stringify(issue.transaction_ids)}`);
      }
    }
  }
  
  return { failingProjects, allIssues };
}

// Main execution
async function main() {
  console.log('='.repeat(70));
  console.log('MongoDB SSH Tunnel Diagnostic Tool');
  console.log('='.repeat(70));
  
  let tunnel = null;
  let mongoClient = null;
  
  try {
    // Step 1: Create SSH tunnel
    console.log('\n[1] Creating SSH tunnel to 62.72.43.143...');
    console.log(`    Local port: ${LOCAL_PORT} -> Remote: 127.0.0.1:27017`);
    
    const [server, client] = await createTunnel(
      tunnelOptions,
      serverOptions,
      sshOptions,
      forwardOptions
    );
    
    tunnel = { server, client };
    console.log('    ✓ SSH tunnel established');
    
    // Step 2: Connect to MongoDB through tunnel
    console.log('\n[2] Connecting to MongoDB through tunnel...');
    mongoClient = new MongoClient(MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    
    await mongoClient.connect();
    console.log('    ✓ MongoDB connected');
    
    // Step 3: Test connection
    const db = mongoClient.db('arkiflo');
    const collections = await db.listCollections().toArray();
    console.log(`    ✓ Found ${collections.length} collections`);
    
    // List some collections
    const collectionCounts = {};
    for (const coll of collections.slice(0, 10)) {
      const count = await db.collection(coll.name).countDocuments();
      collectionCounts[coll.name] = count;
    }
    console.log('\n    Collection counts:');
    for (const [name, count] of Object.entries(collectionCounts)) {
      console.log(`      - ${name}: ${count}`);
    }
    
    // Step 4: Run diagnostic
    const results = await runDiagnostic(db);
    
    console.log('\n\n✓ Diagnostic complete.');
    
  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.code) console.error('  Code:', error.code);
    console.error('\nStack trace:', error.stack);
  } finally {
    // Cleanup
    if (mongoClient) {
      await mongoClient.close();
      console.log('\n[Cleanup] MongoDB connection closed');
    }
    if (tunnel) {
      tunnel.server.close();
      console.log('[Cleanup] SSH tunnel closed');
    }
    process.exit(0);
  }
}

main();
