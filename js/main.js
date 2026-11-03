import { initAuth } from './auth.js?v=d4726bc';
import { refreshLedger } from './ledger-view.js?v=d4726bc';

initAuth(() => refreshLedger());
