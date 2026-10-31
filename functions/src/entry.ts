const actual=process.env.GCLOUD_PROJECT||process.env.GOOGLE_CLOUD_PROJECT
const declared=process.env.YINGYANG_PROJECT_ID
if(actual&&declared&&actual!==declared)throw Error('Firebase environment mismatch')
const project=actual||declared
if(project==='yingyangcheck')module.exports=require('./production')
else if(project==='yingyangtest'||!project)module.exports=require('./index')
else throw Error('Unsupported Firebase project')
