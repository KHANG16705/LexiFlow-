import {spawn,spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
function fail(message){console.error('Không thể khởi động: '+message);process.exit(1);}
if(!existsSync('.env')||!existsSync('backend/node_modules')||!existsSync('frontend/dist/index.html'))fail('Hãy chạy npm run setup trước.');
const require=createRequire(path.join(root,'backend/package.json'));require('dotenv').config({path:path.join(root,'.env')});
const port=Number(process.env.PORT||3001);if(!Number.isInteger(port)||port<1||port>65535)fail('PORT trong .env không hợp lệ.');
const free=await new Promise(resolve=>{const s=net.createServer();s.once('error',()=>resolve(false));s.listen(port,'127.0.0.1',()=>s.close(()=>resolve(true)));});if(!free)fail(`Cổng ${port} đang được sử dụng. Đóng ứng dụng đang dùng cổng hoặc đổi PORT trong .env.`);
if(process.env.DB_MODE==='service'){
 if(process.platform==='win32'){
  const service=process.env.MYSQL_SERVICE||'MySQL80';
  if(!/^[A-Za-z0-9_-]+$/.test(service))fail('Tên MYSQL_SERVICE không hợp lệ.');
  const status=spawnSync('sc.exe',['query',service],{encoding:'utf8'});
  if(status.status!==0)fail(`Không tìm thấy Windows service ${service}. Kiểm tra MYSQL_SERVICE trong .env.`);
  if(!status.stdout.includes('RUNNING')&&spawnSync('sc.exe',['start',service],{stdio:'inherit'}).status!==0)fail(`Không khởi động được ${service}. Mở Services bằng quyền quản trị, khởi động MySQL rồi thử lại.`);
 }
}else{
if(spawnSync('docker',['--version'],{stdio:'ignore'}).status!==0)fail('Chưa tìm thấy Docker. Cài Docker Desktop cho Windows, bật WSL 2 rồi mở Docker Desktop. Xem README.md.');
if(spawnSync('docker',['info'],{stdio:'ignore'}).status!==0)fail('Docker Desktop chưa sẵn sàng. Mở Docker Desktop rồi chạy lại.');
console.log('Khởi động MySQL, giữ nguyên dữ liệu hiện có…');
if(spawnSync('docker',['compose','up','-d','--wait','--wait-timeout','120'],{stdio:'inherit'}).status!==0)fail('MySQL chưa khởi động được. Kiểm tra cổng DB_PORT, cấu hình .env và thông báo Docker ở trên.');
}
const mysql=require('mysql2/promise');let ready=false;
for(let i=0;i<30;i++){try{const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});await c.query('SELECT 1 FROM words LIMIT 1');await c.end();ready=true;break;}catch(e){if(i===29)console.error(e.message);await new Promise(r=>setTimeout(r,1000));}}
if(!ready)fail('Không kết nối được MySQL hoặc thiếu bảng. Kiểm tra .env. Đổi mật khẩu trong .env không tự đổi mật khẩu của volume MySQL đã tồn tại. Không xóa volume có dữ liệu.');
const child=spawn(process.execPath,['backend/server.js'],{cwd:root,stdio:'inherit'});let stopped=false;child.on('exit',code=>{stopped=true;process.exitCode=code||0;});
const url=`http://127.0.0.1:${port}`;let healthy=false;
for(let i=0;i<40&&!stopped;i++){try{const r=await fetch(url+'/api/health');if(r.ok){healthy=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
if(!healthy){child.kill();fail('Backend chưa sẵn sàng. Xem lỗi phía trên.');}
console.log('Sẵn sàng: '+url+' · Ctrl+C để dừng ứng dụng.');
if(process.env.NO_BROWSER!=='1'){if(process.platform==='win32')spawn('cmd.exe',['/c','start','',url],{stdio:'ignore'});else spawn(process.platform==='darwin'?'open':'xdg-open',[url],{stdio:'ignore'});}
process.on('SIGINT',()=>child.kill());process.on('SIGTERM',()=>child.kill());
