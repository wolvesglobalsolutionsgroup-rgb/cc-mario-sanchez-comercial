'use strict';
const {environment}=require('./environment.cjs');
class HttpError extends Error {constructor(status,code){super(code);this.status=status;}}
async function session(req) {
 const token=req.headers?.authorization;
 if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token||'')) throw new HttpError(401,'AUTH_REQUIRED');
 let config;try{config=environment();}catch(_){throw new HttpError(503,'ENVIRONMENT_NOT_READY');}
 const headers={apikey:config.anonKey,Authorization:token,'Content-Type':'application/json'};
 const result=await fetch(`${config.supabaseUrl}/auth/v1/user`,{headers,signal:AbortSignal.timeout(8000)});
 if(!result.ok)throw new HttpError(401,'INVALID_SESSION');
 const user=await result.json();if(!user.id)throw new HttpError(401,'INVALID_SESSION');
 async function rest(route,options={}) {
  const response=await fetch(`${config.supabaseUrl}/rest/v1/${route}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000)});
  const value=await response.json().catch(()=>null);
  if(!response.ok){
   const message=value?.message||'';
   const status=/CONFLICT|IDEMPOTENCY/.test(message)?409:/FORBIDDEN|AUTH|42501/.test(message+' '+value?.code)?403:response.status>=500?503:422;
   throw new HttpError(status,status===409?'CONFLICT':status===403?'FORBIDDEN':'COMMAND_REJECTED');
  }
  return value;
 }
 return {user,config,rest,rpc:(name,args)=>rest(`rpc/${name}`,{method:'POST',body:JSON.stringify(args)})};
}
function handle(handler,methods) {return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(!methods.includes(req.method)){res.setHeader('Allow',methods.join(', '));return res.status(405).json({error:'METHOD_NOT_ALLOWED'});}
 try{return await handler(req,res,await session(req));}catch(error){return res.status(error.status||503).json({error:error.status?error.message:'SERVICE_UNAVAILABLE'});}
};}
function uuid(value){if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(value||''))throw new HttpError(422,'INVALID_ID');return value;}
function body(req){let value=req.body;if(typeof value==='string'){try{value=JSON.parse(value);}catch(_){throw new HttpError(422,'INVALID_JSON');}}if(!value||typeof value!=='object'||Array.isArray(value))throw new HttpError(422,'INVALID_BODY');return value;}
module.exports={session,handle,uuid,body,HttpError};
