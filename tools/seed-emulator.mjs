import {readFile} from 'node:fs/promises';
const body=await readFile(new URL('../firebase/catalog.seed.json',import.meta.url),'utf8');
const result=await fetch('http://127.0.0.1:9000/catalog.json?ns=demo-rival-roster-default-rtdb',{
  method:'PUT',headers:{'Authorization':'Bearer owner','Content-Type':'application/json'},body,
});
if (!result.ok) throw new Error(`Emulator seed failed with HTTP ${result.status}. Start npm run preview first.`);
console.log('Catalog loaded into the local database emulator.');
