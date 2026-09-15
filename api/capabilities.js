const {handle,uuid,HttpError}=require('../lib/server/session.cjs');
module.exports=handle(async(req,res,ctx)=>{
 const org=uuid(req.query?.organization_id);
 const memberships=await ctx.rest(`organization_memberships?user_id=eq.${ctx.user.id}&organization_id=eq.${org}&status=eq.active&select=id,policy_version`);
 if(memberships.length!==1)throw new HttpError(403,'FORBIDDEN');
 const catalog=await ctx.rest('permissions?select=module,action');
 const capabilities=await Promise.all(catalog.map(async p=>({...p,allowed:await ctx.rpc('ccms_can',{org,mod:p.module,act:p.action})})));
 const overrides=await ctx.rest(`membership_permission_overrides?membership_id=eq.${memberships[0].id}&select=module,action,scope,resource_ids,expires_at,granted`);
 return res.status(200).json({organization_id:org,membership_id:memberships[0].id,version:memberships[0].policy_version,capabilities,overrides});
},['GET']);
