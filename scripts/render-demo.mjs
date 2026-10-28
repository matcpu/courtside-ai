import {chromium} from '@playwright/test';
import {readFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{const page=await browser.newPage({viewport:{width:1000,height:1250},deviceScaleFactor:1});await page.setContent('<html><body style="margin:0">'+readFileSync('public/demo/scoresheet.svg','utf8')+'</body></html>');await page.screenshot({path:'public/demo/scoresheet.png'});console.log('Rendered fictional scoresheet PNG');}finally{await browser.close();}
