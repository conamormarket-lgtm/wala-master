"use strict";
const {authenticate,parse,ReceiptError}=require('./kentaReceiptContract');
function createHandler({getSecret,getConfig,service,logger=console}) {
  return async(req,res)=>{
    res.set('Cache-Control','no-store');
    if(req.method!=='POST') return res.status(405).json({ok:false,error:'method_not_allowed'});
    try {
      authenticate(req,getSecret());
      const payload=parse(req.body,getConfig());
      const result=await service(payload);
      logger.info('kenta_receipt',{action:payload.action,status:result.status||'ok',request_bytes:req.rawBody.length});
      return res.status(200).json(result);
    } catch(error) {
      if(!(error instanceof ReceiptError)) logger.error('kenta_receipt_failed',{type:error.name,code:error.code||'internal'});
      return res.status(error instanceof ReceiptError?error.status:503).json({ok:false,error:error instanceof ReceiptError?error.code:'receipt_temporarily_unavailable'});
    }
  };
}
module.exports={createHandler};
