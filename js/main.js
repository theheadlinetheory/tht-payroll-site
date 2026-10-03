import { initAuth } from './auth.js';
import { refreshLedger } from './ledger-view.js';

initAuth(() => refreshLedger());
