import {fileURLToPath} from 'node:url';
import {runSupervisor} from './backend-release.mjs';
await runSupervisor(fileURLToPath(new URL('.',import.meta.url)));
