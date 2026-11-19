const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(relative,mocks={}){const f=path.resolve(relative),m=new Module(f,module);m.paths=module.paths;m.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('@/')?load(id.slice(2)+'.ts',mocks):id==='./navigation'?load('lib/auth/navigation.ts',mocks):require(id);m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);return m.exports;}
const {NextResponse,NextRequest}=require('next/server');
const verified={id:'staff',email:'staff@example.test',email_confirmed_at:'2026-11-18',is_anonymous:false};
function harness(options={}){
 const calls={password:0,out:0,limit:0};
 const client={auth:{getUser:async()=>({data:{user:options.user===undefined?verified:options.user},error:options.authError}),signInWithPassword:async()=>{calls.password++;return {data:{user:options.user===undefined?verified:options.user},error:options.authError};},signOut:async({scope})=>{calls.out++;assert.equal(scope,'local');return {error:null};}}};
 const db={rpc:async()=>{calls.limit++;return {data:options.limit!==false,error:options.limitError};},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:options.member===false?null:{user_id:'staff'},error:options.memberError})})})})};
 const mocks={'next/server':{NextResponse},'@/lib/supabase/staff-server':{createStaffClient:async()=>client},'@/lib/supabase/server':{createClient:()=>{throw Error('Must never use a customer session');}},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/server/limits':{clientIpHash:()=> 'network-hash'}};
 return {calls,mocks};
}
function loginRequest(origin='https://styled.test',body={email:'staff@example.test',password:'test-only-password',next:'/admin/money?status=due'}){return new Request('https://styled.test/auth/staff/login',{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json'},body:JSON.stringify(body)});}
test('staff login rejects cross-site and malformed requests before authenticating',async()=>{
 const h=harness(),route=load('app/auth/staff/login/route.ts',h.mocks);
 for(const origin of [null,'https://evil.test','http://styled.test'])assert.equal((await route.POST(loginRequest(origin))).status,403);
 assert.equal((await route.POST(loginRequest('https://styled.test',{email:'bad'}))).status,400);
 assert.equal(h.calls.password,0);assert.equal(h.calls.limit,0);
});
test('staff login throttles attempts and fails closed if its shared limiter fails',async()=>{
 for(const [opts,status] of [[{limit:false},429],[{limitError:{}},503]]){const h=harness(opts),route=load('app/auth/staff/login/route.ts',h.mocks);assert.equal((await route.POST(loginRequest())).status,status);assert.equal(h.calls.password,0);}
});
test('staff login denies customer, supplier and unverified identities and clears their staff session',async()=>{
 for(const opts of [{member:false},{user:{...verified,is_anonymous:true}},{user:{...verified,email_confirmed_at:null}},{authError:{message:'invalid'}},{memberError:{message:'db'}}]){
 const h=harness(opts),res=await load('app/auth/staff/login/route.ts',h.mocks).POST(loginRequest());assert([401,403,503].includes(res.status));assert.equal(h.calls.out,1);
 }
});
test('verified staff login returns a safe dashboard continuation without a token',async()=>{
 const h=harness(),route=load('app/auth/staff/login/route.ts',h.mocks),r=await route.POST(loginRequest());assert.deepEqual(await r.json(),{ok:true,next:'/admin/money?status=due'});assert.match(r.headers.get('cache-control'),/no-store/);
 const n=load('lib/auth/staff-session.ts');for(const bad of ['//evil.test','/portal','/admin/login','/admin/../login','/administrator','/admin/login?next=/admin'])assert.equal(n.staffDestination(bad),'/admin');
});
test('staff API verifies staff-only session, confirmed email and live membership each time',async()=>{
 for(const [opts,status] of [[{user:null},401],[{member:false},403],[{memberError:{}},503],[{user:{...verified,email_confirmed_at:null}},401]]){const h=harness(opts),a=await load('lib/server/staff.ts',h.mocks).requireStaff(new Request('https://styled.test/api/admin/me'));assert.equal(a.response.status,status);}
 const h=harness(),guard=load('lib/server/staff.ts',h.mocks);assert.equal((await guard.requireStaff(new Request('https://styled.test/api/admin/me'))).ok,true);
 for(const origin of [null,'https://evil.test'])assert.equal((await guard.requireStaff(new Request('https://styled.test/api/admin/settings',{method:'POST',headers:{...(origin?{origin}:{}),'content-type':'application/json'}}))).response.status,403);
});
test('staff signout cannot clear the regular customer session and refuses external origins',async()=>{
 const h=harness(),r=load('app/auth/staff/signout/route.ts',h.mocks);assert.equal((await r.POST(loginRequest(null))).status,403);assert.equal(h.calls.out,0);assert.equal((await r.POST(loginRequest())).status,200);assert.equal(h.calls.out,1);
});
test('staff server uses its own HttpOnly cookie storage with no customer fallback',async()=>{
 let options,write;const r=load('lib/supabase/staff-server.ts',{'@supabase/ssr':{createServerClient:(_u,_k,o)=>{options=o;return {}; }},'next/headers':{cookies:async()=>({getAll:()=>[],set:(name,value,opts)=>{write={name,value,opts};}})},'@/lib/server/env':{env:{supabaseUrl:'https://example.test',supabaseAnonKey:'public-test'}}});await r.createStaffClient();assert.equal(options.cookieOptions.name,'styled-staff-auth');assert.equal(options.cookieOptions.httpOnly,true);assert.equal(options.cookieOptions.sameSite,'lax');options.cookies.setAll([{name:'styled-staff-auth.0',value:'redacted-test',options:{httpOnly:false}}]);assert.equal(write.opts.httpOnly,true);assert.equal(write.name,'styled-staff-auth.0');assert.equal(write.opts.name,undefined,'Storage key must not overwrite a split-cookie name');options.cookies.setAll([{name:'styled-staff-auth.1',value:'second-test-chunk',options:{}}]);assert.equal(write.name,'styled-staff-auth.1');assert.equal(write.opts.name,undefined);
});
test('staff middleware selects only staff cookie storage and preserves deep links',async()=>{
 let options;const r=load('lib/supabase/middleware.ts',{'next/server':{NextResponse},'@supabase/ssr':{createServerClient:(_u,_k,o)=>{options=o;return {auth:{getUser:async()=>({data:{user:null}})}};}},'@/lib/supabase/admin':{createAdminClient:()=>{throw Error('No regular user lookup');}}});
 const res=await r.updateSession(new NextRequest('https://styled.test/admin/money?state=due'));assert.equal(options.cookieOptions.name,'styled-staff-auth');assert.equal(new URL(res.headers.get('location')).searchParams.get('next'),'/admin/money?state=due');
 assert.equal((await r.updateSession(new NextRequest('https://styled.test/admin/login'))).status,200);
 await r.updateSession(new NextRequest('https://styled.test/'));assert.equal(options.cookieOptions,undefined);
});
test('expired admin API requests return directly to staff login and never interrupt public pages',async()=>{
 const oldFetch=global.fetch,oldWindow=global.window,redirects=[];
 try {
 global.fetch=async()=>new Response(JSON.stringify({error:'Sign in'}),{status:401});
 global.window={location:{pathname:'/admin/suppliers',search:'?page=3',replace:url=>redirects.push(url)}};
 const client=load('lib/admin-client.ts');await client.adminApi('/api/admin/suppliers');
 assert.deepEqual(redirects,['/admin/login?next=%2Fadmin%2Fsuppliers%3Fpage%3D3']);
 for(const path of ['/admin/login','/','/portal']){global.window.location.pathname=path;await client.adminApi('/api/admin/suppliers');}
 assert.equal(redirects.length,1);
 } finally {global.fetch=oldFetch;global.window=oldWindow;}
});
