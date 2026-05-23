import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Incremental cache is disabled for now — will be revisited when Supabase is wired up (Goal 2).
export default defineCloudflareConfig();
