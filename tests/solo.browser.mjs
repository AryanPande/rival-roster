import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright-core';

const origin=new URL(process.env.RIVAL_BROWSER_URL||'http://localhost:3000').origin;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try {
  for(const [universe,width,action] of [['wrestling',1280,'Keep'],['comics',390,'Let Go']]) {
    const context=await browser.newContext({viewport:{width,height:844},acceptDownloads:true,isMobile:width<500,hasTouch:width<500,permissions:['clipboard-read','clipboard-write']});
    const externalRequests=[];
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());
      if(url.origin===origin) return route.continue();
      if(!['fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) externalRequests.push(url.href);
      return route.abort();
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(String(error)));
    await page.addInitScript(()=>localStorage.setItem('rival-roster.room.live','123456'));
    await page.goto(origin);
    await page.getByRole('button',{name:'Single Player',exact:true}).click();
    await page.getByRole('button',{name:universe==='comics'?'Start comics draft':'Start wrestling draft'}).click();
    const reveal=page.getByRole('region',{name:'Current reveal'});
    await reveal.getByText('Reveal 1 of 10').waitFor();
    assert.equal(await reveal.locator('.character-card').count(),1);
    assert.equal(await page.locator('main [data-clock]').count(),0);
    await reveal.locator('.character-card').click();
    const dialog=page.getByRole('dialog');
    await dialog.getByText(universe==='comics'?'Primary abilities':'Signature moves',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Close dialog'}).click();
    for(let i=1;i<=5;i++) {
      await reveal.getByText('Reveal '+i+' of 10').waitFor();
      await reveal.getByRole('button',{name:action,exact:true}).click();
    }
    for(let i=6;i<=10;i++) {
      await reveal.getByText('Reveal '+i+' of 10').waitFor();
      assert.equal(await reveal.locator('.character-card').count(),1);
      assert.equal(await reveal.getByRole('button',{name:action,exact:true}).count(),0);
    }
    await page.getByRole('heading',{name:'Final rosters'}).waitFor();
    assert.deepEqual(await page.locator('.roster-header strong').allTextContents(),['5/5','5/5']);
    await page.getByRole('table').waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.getByRole('button',{name:'Copy Teams'}).click();
    const clip=await page.evaluate(()=>navigator.clipboard.readText());
    assert(clip.includes('Your team')&&clip.includes('Opponent'));
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'JSON Export'}).click()]);
    const data=JSON.parse(readFileSync(await download.path()));
    assert.equal(data.universe,universe);
    assert.deepEqual(data.teams.map(team=>team.length),[5,5]);
    assert.equal(new Set(data.teams.flat().map(c=>c.identity)).size,10);
    assert.equal(data.history.filter(x=>x.automatic).length,5);
    await page.getByRole('button',{name:'Play Again'}).click();
    await reveal.getByText('Reveal 1 of 10').waitFor();
    assert.deepEqual(await page.locator('.roster-header strong').allTextContents(),['0/5','0/5']);
    await page.getByRole('button',{name:'Return to Home'}).click();
    await page.getByRole('button',{name:'Character Library'}).click();
    await dialog.getByRole('searchbox').fill('raven');
    await dialog.locator('[data-id=wrestler-raven]').click();
    await dialog.getByText('Signature moves',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Back to library'}).click();
    await dialog.locator('[data-id=raven]').click();
    await dialog.getByText('Primary abilities',{exact:true}).waitFor();
    assert.deepEqual(externalRequests,[]);
    assert.deepEqual(errors,[]);
    console.log(universe,width,'passed full flow, sequential awards, no network dependency, both Raven profiles, export, copy and restart');
    await context.close();
  }
} finally {await browser.close();}
