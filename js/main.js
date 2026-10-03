import { initAuth } from './auth.js?v=1a289eb';
import { refreshLedger } from './ledger-view.js?v=1a289eb';

initAuth(() => refreshLedger());
