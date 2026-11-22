import {firebaseConfig} from './config.js';

const local = ['localhost','127.0.0.1'].includes(location.hostname);
const params = new URLSearchParams(location.search);
export const emulator = local && params.get('emulator')==='1';
export const testGuest = emulator && params.get('guest')==='1';
export const configured = emulator || Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL && firebaseConfig.projectId);
let api;

export async function connect() {
  if (!configured) throw new Error('Connect a Firebase project to open online rooms. See SETUP.md.');
  if (!api) api=initialize().catch(error=>{api=null;throw error;});
  return api;
}
async function initialize() {
  const cdn='https://www.gstatic.com/firebasejs/11.10.0/';
  const [appSDK,authSDK,dbSDK]=await Promise.all(['app','auth','database'].map(part=>import(cdn+'firebase-'+part+'.js')));
  const config=emulator ? {
    apiKey:'demo-api-key', projectId:'demo-rival-roster', appId:'1:123:web:demo',
    databaseURL:'https://demo-rival-roster-default-rtdb.firebaseio.com',
  } : firebaseConfig;
  const app=appSDK.initializeApp(config,testGuest?'rival-roster-guest':'rival-roster');
  const auth=authSDK.getAuth(app);
  const db=dbSDK.getDatabase(app);
  if (emulator) {
    authSDK.connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    dbSDK.connectDatabaseEmulator(db,'127.0.0.1',9000);
  }
  if (testGuest) await authSDK.setPersistence(auth,authSDK.browserSessionPersistence);
  await auth.authStateReady();
  const {uid}=auth.currentUser || (await authSDK.signInAnonymously(auth)).user;
  return {db,uid,...dbSDK};
}
