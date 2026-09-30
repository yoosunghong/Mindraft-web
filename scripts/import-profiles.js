import { readFileSync } from 'node:fs';
import { createCloudStore } from '../lib/cloud.js';

const projectId = process.env.GOOGLE_CLOUD_PROJECT;
if (!projectId) throw new Error('GOOGLE_CLOUD_PROJECT가 필요합니다.');

const source = process.argv[2] || 'data/profiles.json';
const local = new Map(JSON.parse(readFileSync(source, 'utf8')));
const cloud = createCloudStore(projectId);
const profiles = await cloud.loadProfiles();
let added = 0;
for (const [key, profile] of local) {
  if (profiles.has(key)) continue;
  profiles.set(key, profile);
  added++;
}
await cloud.saveProfiles(profiles);
console.log(`Imported ${added} profiles; ${local.size - added} already existed.`);
