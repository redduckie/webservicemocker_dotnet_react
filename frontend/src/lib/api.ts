let token:Promise<string>|null=null;
export async function apiFetch(input:RequestInfo|URL,init?:RequestInit):Promise<Response>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,window.location.origin);
 const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
 if(url.origin===window.location.origin&&!['GET','HEAD','OPTIONS'].includes(method)){
  token??=globalThis.fetch('/api/auth/csrf').then(async r=>{if(!r.ok)throw new Error('Unable to initialize your session.');return (await r.json()).token;}).catch(e=>{token=null;throw e;});
  const headers=new Headers(init?.headers);headers.set('X-CSRF-TOKEN',await token);
  return globalThis.fetch(input,{...init,headers,credentials:'same-origin'});
 }
 return globalThis.fetch(input,init);
}
export async function api<T>(path:string,method='GET',body?:unknown):Promise<T>{
 const response=await apiFetch(path,{method,headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const data=response.status===204?null:await response.json();if(!response.ok)throw new Error(data?.error||`Request failed (${response.status})`);return data;
}
