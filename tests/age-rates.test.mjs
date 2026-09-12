import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import ts from 'typescript';
import * as ageRates from '../lib/age-rates.mjs';
import profiles from '../data/rental-rates.json' with {type:'json'};
import registry from '../data/machineries.json' with {type:'json'};
import {ageBand,rentalRate,currentMachine,validDate} from '../lib/age-rates.mjs';

test('all 201 workbook profiles match the registry and preserve four five-unit rate bands',()=>{
  assert.equal(Object.keys(profiles).length,201);
  assert.deepEqual(Object.keys(profiles).sort(),registry.map(m=>m.code).sort());
  for(const p of Object.values(profiles)){
    assert.ok(validDate(p.acquisitionDate)); assert.ok(Number.isInteger(p.standardLifeYears) && p.standardLifeYears>0);
    assert.equal(p.bands.length,4);
    for(const b of p.bands){assert.equal(Object.keys(b).length,5);for(const n of Object.values(b))assert.ok(n===null || Number.isInteger(n)&&n>=0);}
  }
  assert.equal(profiles['82-6095-10-1'].acquisitionDate,'2010-02-16');
  assert.equal(profiles['00-0069-76-0'].acquisitionDate,'1995-10-02');
});
test('calendar age boundaries are inclusive and final rate continues beyond twice standard life',()=>{
  for(const [date,band] of [['2025-01-01',0],['2025-01-02',1],['2030-01-01',1],['2030-01-02',2],['2035-01-01',2],['2035-01-02',3],['2040-01-02',3],['2060-01-01',3]])
    assert.equal(ageBand('2020-01-01',10,date),band);
  assert.equal(ageBand('2020-02-29',10,'2025-02-28'),0);
  assert.equal(ageBand('2020-02-29',10,'2025-03-01'),1);
  assert.equal(ageBand('2020-01-01',10,'2019-12-31'),null);
  assert.equal(ageBand('2020-01-01',0,'2026-01-01'),null);
  assert.equal(validDate('2026-02-30'),false);
});
test('quotes use workbook rates and edited acquisition information; blanks are not zero',()=>{
  const machine={code:'00-0069-76-0'};
  assert.equal(rentalRate(machine,'DAILY','1996-01-01'),38);
  assert.equal(rentalRate(machine,'DAILY','2026-09-04'),18);
  assert.equal(rentalRate(machine,'HOURLY','2026-09-04'),null);
  assert.equal(rentalRate({...machine,acquisitionDate:'2026-01-01'},'DAILY','2026-09-04'),38);
  assert.equal(rentalRate({code:'NEW',dailyRate:123},'DAILY','2026-09-04'),123);
  assert.equal(currentMachine(machine).standardLifeYears,10);
});
test('migration only adds acquisition information and preserves statuses, locations and rates',async()=>{
  const db=new DatabaseSync(':memory:');
  db.exec('CREATE TABLE machineries(code TEXT PRIMARY KEY,status TEXT,current_department TEXT,daily_rate INTEGER); CREATE TABLE rentals(id TEXT,rate_amount INTEGER);');
  for(const code of Object.keys(profiles))db.prepare('INSERT INTO machineries VALUES (?, ?, ?, ?)').run(code,'RENTED','PROJECT',999);
  db.exec("INSERT INTO rentals VALUES ('historic',321)");
  const sql=await readFile(new URL('../drizzle/0014_daily_blonde_phantom.sql',import.meta.url),'utf8');
  db.exec(sql);
  for(const [code,p] of Object.entries(profiles))assert.deepEqual({...db.prepare('SELECT acquisition_date,standard_life_years,status,current_department,daily_rate FROM machineries WHERE code=?').get(code)}, {acquisition_date:p.acquisitionDate,standard_life_years:p.standardLifeYears,status:'RENTED',current_department:'PROJECT',daily_rate:999});
  assert.equal(db.prepare('SELECT rate_amount FROM rentals').get().rate_amount,321); db.close();
});
test('server owns prices and preserves saved rate when price determinants are unchanged',async()=>{
  const api=await readFile(new URL('../app/api/rentals/route.ts',import.meta.url),'utf8');
  assert.match(api,/samePricing \? record.rateAmount : rentalRate/);
  assert.match(api,/effectiveRateAmount === null/);
  assert.doesNotMatch(api,/effectiveRateAmount = rentalMode === "M" \? 0 : rateAmount/);
});

test('overview and register tables omit acquisition fields while details and pricing retain them',async()=>{
  const page=await readFile(new URL('../app/page.tsx',import.meta.url),'utf8');
  const table=page.slice(page.indexOf('<table>'),page.indexOf('</table>')+8);
  assert.doesNotMatch(table,/วันที่จัดหา|อายุใช้งานมาตรฐาน|acquisitionDate|standardLifeYears/);
  assert.match(page,/<dt>วันที่จัดหา<\/dt>/);
  assert.match(page,/<dt>อายุการใช้งานมาตรฐาน<\/dt>/);
  assert.match(page,/name="acquisitionDate"/);
  assert.match(page,/name="standardLifeYears"/);
});

test('rental handlers ignore forged prices, keep history and reject unavailable rates',async()=>{
  const source=await readFile(new URL('../app/api/rentals/route.ts',import.meta.url),'utf8');
  const exports={}; let machine={code:'00-0069-76-0'}; let saved;
  const record={id:'r',machineryCode:machine.code,startDate:'2026-09-01',rateType:'MONTHLY',rateAmount:321,rentalMode:'W',duration:1};
  const db={
    select(){let table; const query={from(t){table=t;return this;},where(){return this;},async limit(){return [table==='rentals'?record:machine];}};return query;},
    insert(){return {async values(v){saved=v;}};},
    update(){return {set(v){saved=v;return {async where(){}};}};}
  };
  const sql=()=>'';sql.raw=()=>'';
  const imports={
    'drizzle-orm':{sql,eq:()=>'',desc:()=>''}, 'next/server':{NextResponse:{json:(body,options)=>({body,status:options?.status??200})}},
    '../../../db':{ensureDisposalSchema:async()=>{},getDb:()=>db}, '../../../db/schema':{machineries:'machineries',rentals:'rentals'},
    '../../../db/disposal-sql.mjs':{registryVisibilitySql:'1'}, '../../../lib/auth':{requireUser:async()=>({})}, '../../../lib/age-rates.mjs':ageRates
  };
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{assert.ok(n in imports,n);return imports[n];},crypto:{randomUUID:()=> 'new'},console});
  const input={machineryCode:machine.code,renterName:'PROJECT',approver:'Recorder',startDate:'2026-09-01',rateType:'MONTHLY',duration:2,rentalMode:'W',rateAmount:1};
  const call=(method,data)=>exports[method]({json:async()=>data});
  assert.equal((await call('POST',input)).status,201);assert.equal(saved.rateAmount,290);assert.equal(saved.totalAmount,580);
  assert.equal((await call('PATCH',{...input,id:'r',action:'EDIT'})).status,200);assert.equal(saved.rateAmount,321);assert.equal(saved.totalAmount,642);
  assert.equal((await call('PATCH',{...input,id:'r',action:'EDIT',startDate:'1996-01-01'})).status,200);assert.equal(saved.rateAmount,610);
  assert.equal((await call('POST',{...input,rentalMode:'M'})).status,201);assert.equal(saved.totalAmount,0);
  machine={code:'20-6311-19-0'};
  assert.equal((await call('POST',{...input,machineryCode:machine.code,rateType:'DAILY'})).status,400);
});
