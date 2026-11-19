import type { Config } from '@netlify/functions';
import { env, handler, json } from '../../src/server/http';

// Public Firebase web config the extension needs to sign users in. These values are
// designed to be public; all data access is enforced by Firestore/Storage security rules.
export default handler(async () =>
  json({
    apiKey: env('VITE_FIREBASE_API_KEY'),
    authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
    projectId: env('VITE_FIREBASE_PROJECT_ID'),
  }));

export const config: Config = { path: '/api/config' };
