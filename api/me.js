const {handle}=require('../lib/server/session.cjs');
module.exports=handle(async(req,res,ctx)=>{
 const memberships=await ctx.rest(`organization_memberships?user_id=eq.${ctx.user.id}&status=eq.active&select=id,organization_id,role,policy_version,organizations(id,name,status,features)`);
 return res.status(200).json({user:{id:ctx.user.id},memberships});
},['GET']);
