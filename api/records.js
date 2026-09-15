const {handle,uuid,HttpError}=require('../lib/server/session.cjs');
const tables=new Set(['units','tenants','contracts','invoices','payments','condo_expenses','service_tickets','properties','transactions','organization_memberships','access_audit','organization_settings']);
module.exports=handle(async(req,res,ctx)=>{
 const org=uuid(req.query?.organization_id),table=req.query?.entity;
 if(!tables.has(table))throw new HttpError(422,'INVALID_ENTITY');
 const member=await ctx.rest(`organization_memberships?organization_id=eq.${org}&user_id=eq.${ctx.user.id}&status=eq.active&select=id`);
 if(member.length!==1)throw new HttpError(403,'FORBIDDEN');
 const offset=Number(req.query?.offset||0);if(!Number.isSafeInteger(offset)||offset<0)throw new HttpError(422,'INVALID_OFFSET');
 const rows=await ctx.rest(`${table}?organization_id=eq.${org}&select=*&order=${table==='organization_settings'?'organization_id':'id'}.asc&limit=100&offset=${offset}`);
 return res.status(200).json({rows,next_offset:rows.length===100?offset+100:null});
},['GET']);
