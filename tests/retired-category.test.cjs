const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const path = require('node:path');

test('historical retired listings cannot enter browsing or direct item lookups', async () => {
  const rows = [
    {id:'old-invitations', category:'stationery', suppliers:{id:'paper-supplier',name:'Paper business',area:'London'}},
    {id:'current-chair', category:'furniture', suppliers:{id:'chair-supplier',name:'Chair business',area:'London'}, unit_price_pence:650, capacity:100},
  ];
  const query = {
    select(){return this;}, eq(){return this;}, order(){return this;}, range(){return this;},
    async returns(){return {data:rows,error:null};},
  };
  const shoppingFile = path.resolve('lib/shopping.ts');
  const shopping = new Module(shoppingFile);
  shopping._compile(ts.transpileModule(fs.readFileSync('lib/shopping.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,shoppingFile);
  const file = path.resolve('lib/server/catalogue.ts');
  const catalogueModule = new Module(file);
  catalogueModule.require = id => {
    if(id === '@/lib/supabase/anon') return {createAnonClient:()=>({from:()=>query})};
    if(id === '@/lib/shopping') return shopping.exports;
    if(id === '@/lib/supplier-workspace') return {money:()=>0};
    if(id === './crescent-call-demo') return {linkedCrescentProduct:()=>false};
    throw Error('Unexpected runtime dependency: '+id);
  };
  catalogueModule._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,file);
  assert.deepEqual((await catalogueModule.exports.loadCatalogue()).map(p=>p.id),['current-chair']);
  assert.equal((await catalogueModule.exports.loadItemsById(['old-invitations'])).size,0);
});
