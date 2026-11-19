import { scanPage } from '../../../src/shared/scan';
import { fillFields, revealField } from '../../../src/shared/fill';
import type { FillResult, FillValue, ScanResult } from '../../../src/shared/types';

export class AccessError extends Error {
  constructor(message: string, public canRequest: boolean) { super(message); }
}

export async function activeTabId(): Promise<number> {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!t?.id) throw new AccessError('No active tab', false);
  return t.id;
}

async function run<T>(tabId: number, func: (...a: any[]) => T, args: any[] = []): Promise<T> {
  try {
    const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args, world: 'ISOLATED' });
    return r.result as T;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/chrome:\/\/|chrome-extension:|webstore|edge:\/\/|about:|cannot be scripted|devtools/i.test(msg)) {
      throw new AccessError("FormPilot can't run on browser or store pages. Open a website with a form.", false);
    }
    throw new AccessError('FormPilot needs your permission to read forms on websites.', true);
  }
}

export const scan = (tabId: number) => run<ScanResult>(tabId, scanPage);
export const fill = (tabId: number, values: FillValue[]) => run<FillResult[]>(tabId, fillFields, [values, true]);
export const reveal = (tabId: number, id: string) => run<boolean>(tabId, revealField, [id]).catch(() => false);

export const HOST_ORIGINS = ['https://*/*', 'http://*/*'];
export const hasHostAccess = () => chrome.permissions.contains({ origins: HOST_ORIGINS });
/** Must be called directly from a click handler (user gesture). */
export const requestHostAccess = () => chrome.permissions.request({ origins: HOST_ORIGINS });
