import { createDriveRuntime } from './drive-runtime'
const runtime=createDriveRuntime({project:'yingyangtest',bucket:'yingyangtest-mail-state-495270334718',archiveBucket:'yingyangtest-admin-reports-495270334718',secret:'STAGING_DRIVE_CONFIG',options:{region:'asia-northeast3',serviceAccount:'yingyang-staging-mail-runtime@yingyangtest.iam.gserviceaccount.com',minInstances:0,maxInstances:1,concurrency:1,memory:'512MiB',cpu:1,timeoutSeconds:120,enforceAppCheck:true,cors:['https://yingyangtest.web.app','https://yingyangtest.firebaseapp.com']}})
export const createDriveAdmin=runtime.createDriveAdmin
export const stagingDriveBackup=runtime.storageBackup
