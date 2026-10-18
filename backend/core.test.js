import test from 'node:test';
import assert from 'node:assert/strict';
import {parseText,schedule} from './core.js';
test('UTF-8 BOM CRLF optional fields semicolon separator and line numbers',()=>{const r=parseText('\uFEFF你好;nǐ hǎo;xin chào;;;hello.png\r\n\r\napple;;quả táo');assert.equal(r[0].term,'你好');assert.equal(r[0].filename,'hello.png');assert.equal(r[1].line,3);assert.equal(r[1].error,null);});
test('quoted semicolons and doubled quotes are preserved',()=>{const r=parseText('phrase;;"một; nghĩa có dấu nháy ""đôi""";;;');assert.equal(r[0].meaning,'một; nghĩa có dấu nháy "đôi"');assert.equal(r[0].error,null);});
test('invalid rows',()=>{for(const text of ['apple meaning','apple;;','a;b;c;d;e;f;g','x'.repeat(256)+';;nghĩa','apple;;"chưa đóng'])assert.ok(parseText(text)[0].error);});
test('review intervals and next date',()=>{const now=new Date('2026-01-01T00:00:00Z');assert.equal(schedule(0,'again',now).due.toISOString(),'2026-01-01T00:10:00.000Z');assert.equal(schedule(0,'good',now).days,1);assert.equal(schedule(0,'easy',now).days,4);assert.equal(schedule(10,'hard',now).days,12);assert.equal(schedule(10,'good',now).days,25);assert.equal(schedule(10,'easy',now).days,35);});
