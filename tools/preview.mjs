import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.svg':'image/svg+xml'};
const portFlag=process.argv.indexOf('--port');
const hostFlag=process.argv.indexOf('--host');
const port=Number(process.env.PORT||(portFlag>=0?process.argv[portFlag+1]:3000));
const host=hostFlag>=0?process.argv[hostFlag+1]:'0.0.0.0';
createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const path=resolve(root,'.'+(url.pathname==='/'?'/index.html':url.pathname));
  const ext=extname(path);
  if(!path.startsWith(root+'/')||!/^\/(index\.html|assets\/|css\/|js\/|data\/)/.test(url.pathname==='/'?'/index.html':url.pathname)||
     !types[ext]||!existsSync(path)||!statSync(path).isFile()){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',types[ext]);
  createReadStream(path).pipe(res);
}).listen(port,host,()=>console.log('Preview listening on http://'+host+':'+port));
