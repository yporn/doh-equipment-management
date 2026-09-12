import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import { authRequest, checkSession } from "../lib/auth-request.mjs";

const user = { id: "u1", username: "staff", displayName: "เจ้าหน้าที่", role: "STAFF" };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("session checks require a valid authenticated user and bypass the cache", async () => {
  assert.deepEqual(await checkSession({ fetchImpl: async (url, init) => {
    assert.equal(url,"/api/auth/me"); assert.equal(init.cache,"no-store");
    assert.ok(init.signal instanceof AbortSignal);
    return json(user);
  }}),user);
  assert.equal(await checkSession({ fetchImpl: async () => json({},401) }),null);
  for (const body of [null, {}, {...user,role:"UNKNOWN"}]) {
    await assert.rejects(checkSession({fetchImpl:async () => json(body)}),/ไม่สามารถติดต่อ/);
  }
});

test("network errors, malformed responses and server errors reject without granting access", async () => {
  for (const fetchImpl of [
    async () => { throw new Error("network"); },
    async () => new Response("<html>Unavailable</html>",{status:503}),
    async () => json({message:"internal database details"},500),
    async () => new Response("invalid json"),
  ]) await assert.rejects(checkSession({fetchImpl}),/ไม่สามารถติดต่อ/);
  await assert.rejects(authRequest("/api/auth/login",{}, {fetchImpl:async () => json({message:"ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"},401)}),/รหัสผ่านไม่ถูกต้อง/);
});

test("timeout bounds both a hanging network and a hanging response body", async () => {
  for (const stalledBody of [false,true]) {
    let signal;
    const fetchImpl = async (_url,init) => {
      signal = init.signal;
      if (!stalledBody) return new Promise(() => {});
      return {status:200,ok:true,json:() => new Promise(() => {})};
    };
    await assert.rejects(checkSession({fetchImpl,timeoutMs:15}),/นานเกินไป/);
    assert.equal(signal.aborted,true);
  }
});

test("unmount cancellation stops a pending request, while a new retry can succeed", async () => {
  const controller = new AbortController();
  const pending = checkSession({signal:controller.signal,fetchImpl:async () => new Promise(() => {})});
  controller.abort();
  await assert.rejects(pending,{name:"AbortError"});
  await assert.rejects(checkSession({signal:controller.signal,fetchImpl:async () => { throw new Error("must not fetch"); }}),{name:"AbortError"});
  assert.deepEqual(await checkSession({fetchImpl:async () => json(user)}),user);
});

// Exercise the component's hook lifecycle without a browser or authenticated production writes.
async function providerHarness(session, pathname = "/") {
  const source = await readFile(new URL("../app/auth-context.tsx",import.meta.url),"utf8");
  const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const states = [], effects = [], pending = [], redirects = [];
  let stateIndex = 0, effectIndex = 0;
  const react = {
    createContext:() => ({Provider:"provider"}), useContext:() => ({}),
    useState(initial) {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useEffect(fn,deps) {
      const index = effectIndex++;
      if (!effects[index] || deps.some((value,i) => value !== effects[index].deps[i])) {
        effects[index]?.cleanup?.();
        effects[index] = {deps};
        pending.push(() => {effects[index].cleanup = fn();});
      }
    },
  };
  const exports = {};
  vm.runInNewContext(code,{
    exports, AbortController, Error,
    window:{location:{replace:path => redirects.push(path)}},
    require:name => name === "react" ? react : name === "next/navigation" ? {usePathname:() => pathname} :
      name === "react/jsx-runtime" ? {jsx:(type,props) => ({type,props}),jsxs:(type,props) => ({type,props}),Fragment:"fragment"} :
      {checkSession:session,authRequest:async () => ({})},
  });
  const render = () => {
    stateIndex = 0; effectIndex = 0;
    const tree = exports.default({children:"PROTECTED_CONTENT"});
    while (pending.length) pending.shift()();
    return tree;
  };
  return {render,redirects,setPath:path => { pathname = path; },unmount:() => effects.forEach(e => e.cleanup?.())};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
const nodes = tree => !tree || typeof tree !== "object" ? [] : [tree,...[tree.props?.children].flat(Infinity).flatMap(nodes)];

test("provider shows error and retry instead of protected content; retry can recover", async () => {
  let attempts = 0;
  const h = await providerHarness(async () => {
    if (!attempts++) throw new Error("ทดสอบการเชื่อมต่อล้มเหลว");
    return user;
  });
  assert.match(JSON.stringify(h.render()),/กำลังตรวจสอบการเข้าสู่ระบบ/);
  await flush();
  const failed = h.render();
  assert.doesNotMatch(JSON.stringify(failed),/PROTECTED_CONTENT/);
  assert.match(JSON.stringify(failed),/ทดสอบการเชื่อมต่อล้มเหลว/);
  nodes(failed).find(node => node.type === "button").props.onClick();
  assert.match(JSON.stringify(h.render()),/กำลังตรวจสอบการเข้าสู่ระบบ/);
  await flush();
  assert.match(JSON.stringify(h.render()),/PROTECTED_CONTENT/);
  h.unmount();
});

test("401 redirects protected pages and allows login, while server failures never redirect", async () => {
  for (const [path,result,redirect] of [["/",null,"/login"],["/login",null,null],["/login",user,"/"]]) {
    const h = await providerHarness(async () => result,path);
    h.render(); await flush();
    assert.deepEqual(h.redirects,redirect ? [redirect] : []);
    if (redirect) assert.doesNotMatch(JSON.stringify(h.render()),/PROTECTED_CONTENT/);
    h.unmount();
  }
});

test("late session response after unmount cannot redirect", async () => {
  let resolve, signal;
  const h = await providerHarness(options => {signal = options.signal; return new Promise(done => {resolve = done;});});
  h.render(); h.unmount(); assert.equal(signal.aborted,true);
  resolve(null); await flush(); assert.deepEqual(h.redirects,[]);
});

test("switching protected modules retains the authenticated provider without repeated checks", async () => {
  let checks = 0;
  const h = await providerHarness(async () => { checks++; return user; });
  h.render(); await flush();
  for (const path of ["/machineries","/rentals","/service","/repairs","/transfers","/disposals"]) {
    h.setPath(path);
    assert.match(JSON.stringify(h.render()),/PROTECTED_CONTENT/);
    await flush();
  }
  assert.equal(checks,1);
  assert.deepEqual(h.redirects,[]);
  h.unmount();
});
