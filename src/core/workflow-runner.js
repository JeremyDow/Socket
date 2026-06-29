import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/**
 * Workflow Runner — executes a workflow definition and records run metadata.
 *
 * Workflow contract:
 *   { id, name, run(input, context) => { artifact, writtenPath?, preview? } }
 */

export async function runWorkflow(workflow, input, context = {}) {
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();

  const record = {
    id: runId,
    workflowId: workflow.id,
    startedAt,
    status: 'running',
    input: sanitizeInputForLog(input),
  };

  try {
    const result = await workflow.run(input, { ...context, runId });
    record.status = 'completed';
    record.completedAt = new Date().toISOString();
    record.result = {
      writtenPath: result.writtenPath ?? null,
      preview: result.preview ?? null,
      meta: result.meta ?? {},
    };
    persistRun(record);
    return { success: true, runId, ...result };
  } catch (err) {
    record.status = 'failed';
    record.completedAt = new Date().toISOString();
    record.error = err.message || String(err);
    persistRun(record);
    return { success: false, runId, error: record.error };
  }
}

function persistRun(record) {
  try {
    fs.mkdirSync(config.runsDir, { recursive: true });
    const filePath = path.join(config.runsDir, `${record.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf8');
  } catch {
    // Non-fatal: run logging should not block workflow execution
  }
}

function sanitizeInputForLog(input) {
  const copy = { ...input };
  if (copy.vaultPath) copy.vaultPath = '[configured]';
  if (copy.transcriptFolder) copy.transcriptFolder = '[configured]';
  return copy;
}