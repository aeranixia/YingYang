import {test} from 'node:test'
import assert from 'node:assert/strict'
import {validateProduction} from './production-policy.mjs'
const valid=()=>({config:{hosting:{site:'yingyangcheck',public:'dist'},functions:[{codebase:'yingyang-production'}]},sdk:{projectId:'yingyangcheck',authDomain:'yingyangcheck.firebaseapp.com',appId:'1:231582543863:web:synthetic',recaptchaSiteKey:'synthetic'},html:'<meta name="yingyang-environment" content="production">',assets:'production',env:'PRODUCTION_SEND_ENABLED=false\nYINGYANG_PROJECT_ID=yingyangcheck'})
test('production accepts only production app/build and explicit mail flag',()=>assert.equal(validateProduction(valid()),true))
test('production rejects staging project, bundle, directory, codebase and invalid sending flag',()=>{for(const change of [x=>x.sdk.projectId='yingyangtest',x=>x.assets='yingyangtest.firebaseapp.com',x=>x.config.hosting.public='dist-staging',x=>x.config.functions[0].codebase='yingyang-staging',x=>x.env=x.env.replace('false','invalid')]){const x=valid();change(x);assert.throws(()=>validateProduction(x))}})

test('production permits explicitly enabled server flag',()=>{const x=valid();x.env=x.env.replace('false','true');assert.equal(validateProduction(x),true)})
