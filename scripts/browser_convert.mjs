// The accepted producer uses only real file input, controls and downloads.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {openApp,loadNative,setFixturePolicy,saveDownload,E,INPUT} from './browser_common.mjs';
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const before=JSON.parse(await fs.readFile(path.join(E,'prototype-source-immutability.json'),'utf8')).before;
assert.equal(hash(await fs.readFile(INPUT)),before);
const app=await openApp(),{page}=app;
try{
 await page.locator('#lang-en').click();await loadNative(page);
 assert.equal(await page.locator('#track-count').textContent(),'2');assert.equal(await page.locator('#part-count').textContent(),'3');assert.equal(await page.locator('#note-count').textContent(),'6');
 await setFixturePolicy(page);assert.equal(await page.locator('#ack').isChecked(),false);assert.equal(await page.locator('#download').isDisabled(),true);
 await page.screenshot({path:path.join(E,'browser-native-review.png'),fullPage:true});
 await page.locator('#ack').check();const output=await saveDownload(page,'#download','cleaned.ustx');const review=await saveDownload(page,'#report','review.json');
 assert.deepEqual(app.errors,[]);assert.deepEqual(app.network,[]);
 const after=hash(await fs.readFile(INPUT));assert.equal(before,after);
 await fs.writeFile(path.join(E,'source-immutability.json'),JSON.stringify({before,after,unchanged:before===after,phase:'Entire browser test/export phase'},null,2)+'\n');
 const files={};for(const name of ['cleaned.ustx','review.json'])files[name]=hash(await fs.readFile(path.join(E,name)));
 await fs.writeFile(path.join(E,'browser-download-result.json'),JSON.stringify({status:'pass',producer:'Actual packaged offline browser file input, explicit policy and downloads',suggestedFilenames:{output:output.suggestedFilename,report:review.suggestedFilename},files,noNetworkRequests:true},null,2)+'\n');
 console.log('Actual browser USTX/report retained for the unchanged native consumer');
}catch(error){await page.screenshot({path:path.join(E,'FAILED-browser-convert.png'),fullPage:true});throw error;}finally{await app.browser.close();}
