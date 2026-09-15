const {handle,uuid,HttpError,body}=require('../lib/server/session.cjs');
const tables=new Set(['units','tenants','contracts','invoices','condo_expenses','service_tickets','properties','organization_memberships','access_audit','organization_settings','special_agreements','receiving_accounts','activos_fijos','consumibles','kardex_movimientos','authorized_import_staging']);
const readOnlyTables=new Set(['authorized_import_staging']);
const textIdTables=new Set(['special_agreements','receiving_accounts','activos_fijos','consumibles','kardex_movimientos']);
module.exports=handle(async(req,res,ctx)=>{
 if(req.method==='POST') {
  const command=body(req), org=uuid(command.organization_id), table=command.entity;
  if(!tables.has(table)||!['upsert','delete'].includes(command.operation))throw new HttpError(422,'INVALID_RECORD_COMMAND');
  if(readOnlyTables.has(table))throw new HttpError(403,'READ_ONLY_ENTITY');
  const member=await ctx.rest(`organization_memberships?organization_id=eq.${org}&user_id=eq.${ctx.user.id}&status=eq.active&select=id`);
  if(member.length!==1)throw new HttpError(403,'FORBIDDEN');
  if(command.operation==='upsert') {
   if(!command.row||typeof command.row!=='object'||Array.isArray(command.row))throw new HttpError(422,'INVALID_ROW');
   if(command.row.organization_id && command.row.organization_id!==org)throw new HttpError(403,'CROSS_ORG_FORBIDDEN');
   const row={...command.row,organization_id:org};
   const result=await ctx.rest(table,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(row)});
   return res.status(200).json({ok:true,row:Array.isArray(result)?result[0]:result});
  }
  const id=textIdTables.has(table) ? String(command.id||'').trim() : uuid(command.id);
  if(textIdTables.has(table) && !id) throw new HttpError(422,'INVALID_ID');
  const result=await ctx.rest(`${table}?id=eq.${encodeURIComponent(id)}&organization_id=eq.${org}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
  return res.status(200).json({ok:true,deleted:Array.isArray(result)?result.length:0});
 }
 const org=uuid(req.query?.organization_id),table=req.query?.entity;
 if(!tables.has(table))throw new HttpError(422,'INVALID_ENTITY');
 const member=await ctx.rest(`organization_memberships?organization_id=eq.${org}&user_id=eq.${ctx.user.id}&status=eq.active&select=id`);
 if(member.length!==1)throw new HttpError(403,'FORBIDDEN');
 const offset=Number(req.query?.offset||0);if(!Number.isSafeInteger(offset)||offset<0)throw new HttpError(422,'INVALID_OFFSET');
 const rows=await ctx.rest(`${table}?organization_id=eq.${org}&select=*&order=${table==='organization_settings'?'organization_id':'id'}.asc&limit=100&offset=${offset}`);
 return res.status(200).json({rows,next_offset:rows.length===100?offset+100:null});
},['GET','POST']);
