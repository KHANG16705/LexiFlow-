import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
if(!existsSync('.env')){writeFileSync('.env',readFileSync('.env.example','utf8').replace('replace_with_a_long_random_password',randomBytes(24).toString('hex')).replace('replace_with_another_random_password',randomBytes(24).toString('hex')));console.log('Đã tạo .env với mật khẩu ngẫu nhiên.');}
function npm(args,dir){const r=spawnSync(process.platform==='win32'?'npm.cmd':'npm',args,{cwd:path.join(root,dir),stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(1);}
for(const dir of ['backend','frontend'])npm(['install'],dir);
npm(['run','build'],'frontend');console.log('Cài đặt hoàn tất. Chạy npm start. Cần Docker Desktop đang chạy.');
