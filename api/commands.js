const {handle,body,uuid,HttpError}=require('../lib/server/session.cjs');
module.exports=handle(async(req,res,ctx)=>{
 const command=body(req),data=command.data;
 if(!data||typeof data!=='object'||!Number.isSafeInteger(command.expected_version))throw new HttpError(422,'INVALID_COMMAND');
 let result;
 if(command.type==='permissions.set') {
  result=await ctx.rpc('set_member_permission',{target:uuid(data.membership_id),mod:data.module,act:data.action,allow_access:data.granted,
   expected_version:command.expected_version,change_reason:data.reason,scope_type:data.scope||'organization',resources:data.resource_ids||[],valid_until:data.expires_at||null});
 } else if(command.type==='payments.approve') {
  result=await ctx.rpc('approve_payment_v2',{payment_id:uuid(data.payment_id),expected_version:command.expected_version,command_key:uuid(command.idempotency_key)});
 } else throw new HttpError(422,'UNSUPPORTED_COMMAND');
 return res.status(200).json({ok:true,result});
},['POST']);
