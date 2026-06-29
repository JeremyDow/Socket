import fs from 'node:fs';
import path from 'node:path';
import { createArtifact } from '../../core/artifact.js';
import { ensureDir, resolveWithinBase, uniqueFilePath } from '../../core/safe-paths.js';

/**
 * Obsidian Destination Drop-in
 *
 * Writes markdown artifacts into a configured vault folder.
 * Never overwrites existing files — generates unique filenames.
 */

export const obsidianDestinationDropin = {
  id: 'obsidian',
  name: 'Obsidian',
  role: 'destination',

  /**
   * @param {object} artifact - Socket artifact with markdown content
   * @param {object} params
   * @param {string} params.vaultPath - Obsidian vault root
   * @param {string} params.transcriptFolder - folder within vault for transcripts
   * @param {string} [params.filename] - base filename (without extension)
   */
  async write(artifact, params) {
    const { vaultPath, transcriptFolder, filename } = params;

    if (!vaultPath) throw new Error('Obsidian vault path is required');
    if (!transcriptFolder) throw new Error('Obsidian transcript folder path is required');
    if (!artifact?.data?.markdown) throw new Error('Artifact must contain markdown data');

    const vaultResolved = path.resolve(vaultPath);
    if (!fs.existsSync(vaultResolved)) {
      throw new Error(`Obsidian vault path does not exist: ${vaultResolved}`);
    }

    const targetDir = resolveWithinBase(vaultResolved, transcriptFolder);
    ensureDir(targetDir);

    const baseName = filename || artifact.data.title || 'transcript';
    const filePath = uniqueFilePath(targetDir, baseName, '.md');

    fs.writeFileSync(filePath, artifact.data.markdown, 'utf8');

    return createArtifact('obsidian.file', {
      path: filePath,
      markdown: artifact.data.markdown,
    }, {
      destination: 'obsidian',
      writtenAt: new Date().toISOString(),
    });
  },
};